import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { calculatePlannedTime, getLocalTimestamp } from "@/app/api/helper/plannedCalculator";

// Short-lived in-memory cache for this stage's fully-computed list — same pattern as
// app/api/dashboard/route.ts. This route has no role/records-based per-request
// filtering, so the finished output is cached directly rather than the raw rows.
// 45s TTL means bursts of GETs within that window (same warm instance) reuse the
// already-computed data instead of re-querying Supabase. Cleared on a successful
// write below so a user's own change is reflected immediately on their next load,
// instead of waiting out the TTL.
const TRANSPORTER_FOLLOW_UP_CACHE_TTL_MS = 45_000;
let transporterFollowUpCache: { data: any[]; expiresAt: number } | null = null;

async function fetchTransporterFollowUpData() {
    // Paginated in 1000-row pages — pfms_transporter-follow-up is close to PostgREST's
    // default 1000-row cap and growing, so this is paginated pre-emptively (same bypass
    // pattern as app/api/dashboard/route.ts).
    const followUps: any[] = [];
    {
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data: pageFollowUps, error } = await supabase
          .from("pfms_transporter-follow-up")
          .select(`
            id,
            liftNo,
            status,
            expectedDeliveryDate,
            nextFollowUpDate,
            remarks,
            lastFollowUpDate,
            totalFollowUps,
            lift:pfms_lift!inner (
              plannedTransporterFlwUp,
              liftingQty,
              transporterName,
              vehicleNo,
              contactNo,
              lrNo,
              biltyCopy,
              freightAmount,
              indent:pfms_indent_generation!inner (
                indentNo,
                itemName,
                purchaser,
                negotiation:pfms_negotiation (
                  selectedVendorName
                ),
                poEntry:pfms_po-entry (
                  poNumber
                )
              )
            )
          `)
          .order("timestamp", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (!pageFollowUps || pageFollowUps.length === 0) {
          hasMore = false;
        } else {
          followUps.push(...pageFollowUps);
          hasMore = pageFollowUps.length === pageSize;
          page++;
        }
      }
    }

    // Fetch cancellations
    const { data: cancelledList } = await supabase
      .from("pfms_order-cancellation")
      .select("indentNo, liftNo");
    const cancelledLiftNos = new Set((cancelledList || []).map((c: any) => c.liftNo).filter(Boolean));
    const cancelledIndentNos = new Set((cancelledList || []).filter((c: any) => !c.liftNo).map((c: any) => c.indentNo));

    const mappedData = (followUps || [])
      .map((row: any) => {
        const lift = row.lift || {};
        const indent = lift.indent || {};
        const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
        const poEntry = Array.isArray(indent.poEntry) ? (indent.poEntry[0] || {}) : (indent.poEntry || {});

        // Map DB status to pending/history
        // pending source: intransit, history source: received
        const status = row.status === "received" ? "history" : "pending";

        return {
          id: row.id,
          status: status,
          data: {
            indentNumber: indent.indentNo || "",
            liftNo: row.liftNo || "",
            vendorName: negotiation.selectedVendorName || "-",
            poNumber: poEntry.poNumber || "-",
            itemName: indent.itemName || "",
            liftingQty: lift.liftingQty || 0,
            transporterName: lift.transporterName || "",
            vehicleNo: lift.vehicleNo || "",
            contactNo: lift.contactNo || "",
            freightAmt: lift.freightAmount || "",
            plannedDate: lift.plannedTransporterFlwUp || null,
            expectedDeliveryDate: row.expectedDeliveryDate || null,
            lastFollowUpDate: row.lastFollowUpDate || null,
            nextFollowUpDate: row.nextFollowUpDate || null,
            actualDate: row.status === "received" ? row.lastFollowUpDate : null,
            remarks: row.remarks || "",
            totalFollowUps: row.totalFollowUps || 0,
            lrNo: lift.lrNo || "",
            lrCopy: lift.biltyCopy || "",
            purchaser: indent.purchaser || null,
          }
        };
      })
      .filter((row: any) => {
        if (row.status === "pending") {
          if (cancelledLiftNos.has(row.data.liftNo) || cancelledIndentNos.has(row.data.indentNumber)) {
            return false;
          }
        }
        return true;
      });

  return mappedData;
}

export async function GET() {
  try {
    let data: any[];
    if (transporterFollowUpCache && transporterFollowUpCache.expiresAt > Date.now()) {
      data = transporterFollowUpCache.data;
    } else {
      data = await fetchTransporterFollowUpData();
      transporterFollowUpCache = { data, expiresAt: Date.now() + TRANSPORTER_FOLLOW_UP_CACHE_TTL_MS };
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error("Error in transporter-follow-up GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { status, remarks, expectedDate, expectedDelivery, records } = body;

    if (!records || records.length === 0) {
      return NextResponse.json({ success: false, error: "No records to process" }, { status: 400 });
    }

    const now = getLocalTimestamp();
    const normalizedStatus = status === "Received" ? "received" : "intransit";

    for (const record of records) {
      const liftNo = record.data.liftNo;

      // 1. Fetch current follow up count if status is Intransit
      let totalFollowUps = 0;
      if (normalizedStatus === "intransit") {
        const { data: currentRecord } = await supabase
          .from("pfms_transporter-follow-up")
          .select("totalFollowUps")
          .eq("liftNo", liftNo)
          .maybeSingle();
        
        totalFollowUps = (currentRecord?.totalFollowUps || 0) + 1;
      }

      // 2. Perform update
      if (normalizedStatus === "intransit") {
        const { error: updateError } = await supabase
          .from("pfms_transporter-follow-up")
          .update({
            status: "intransit",
            nextFollowUpDate: expectedDate ? getLocalTimestamp(expectedDate) : null,
            expectedDeliveryDate: expectedDelivery ? getLocalTimestamp(expectedDelivery) : null,
            remarks: remarks || null,
            lastFollowUpDate: now,
            totalFollowUps: totalFollowUps,
            updatedAt: now
          })
          .eq("liftNo", liftNo);

        if (updateError) throw updateError;

        // Also update plannedTransporterFlwUp in pfms_lift
        const { error: liftUpdateError } = await supabase
          .from("pfms_lift")
          .update({
            plannedTransporterFlwUp: expectedDate ? getLocalTimestamp(expectedDate) : null,
            updatedAt: now
          })
          .eq("liftNo", liftNo);

        if (liftUpdateError) throw liftUpdateError;
      } else {
        // status is Received
        const { error: updateError } = await supabase
          .from("pfms_transporter-follow-up")
          .update({
            status: "received",
            remarks: remarks || null,
            lastFollowUpDate: now,
            updatedAt: now
          })
          .eq("liftNo", liftNo);

        if (updateError) throw updateError;

        // Fetch freightAmount from lift
        const { data: liftData } = await supabase
          .from("pfms_lift")
          .select("freightAmount")
          .eq("liftNo", liftNo)
          .maybeSingle();
        const freightAmount = liftData?.freightAmount || 0;

        // Calculate plannedDate for freight-payments
        const plannedDate = await calculatePlannedTime("freight-payments");

        const { data: existing } = await supabase
          .from("pfms_freight-payment-details")
          .select("id")
          .eq("liftNo", liftNo)
          .maybeSingle();

        if (existing) {
          const { error: fUpdateError } = await supabase
            .from("pfms_freight-payment-details")
            .update({
              totalAmount: parseFloat(freightAmount) || 0,
              plannedDate: plannedDate,
              updatedAt: now
            })
            .eq("liftNo", liftNo);
          if (fUpdateError) throw fUpdateError;
        } else {
          const { error: fInsertError } = await supabase
            .from("pfms_freight-payment-details")
            .insert({
              id: randomUUID(),
              timestamp: now,
              liftNo: liftNo,
              totalAmount: parseFloat(freightAmount) || 0,
              paidAmount: 0,
              plannedDate: plannedDate,
              createdAt: now,
              updatedAt: now
            });
          if (fInsertError) throw fInsertError;
        }
      }
    }

    transporterFollowUpCache = null;
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in transporter-follow-up POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
