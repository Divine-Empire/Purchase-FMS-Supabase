import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { calculatePlannedTime, getLocalTimestamp } from "@/app/api/helper/plannedCalculator";

// Short-lived in-memory cache for this stage's raw fetch (indents + cancellations) —
// same pattern as app/api/dashboard/route.ts. 45s TTL means bursts of GETs within that
// window (same warm instance) reuse the already-fetched data instead of re-querying
// Supabase. Cleared on a successful write below so a user's own change is reflected
// immediately on their next load, instead of waiting out the TTL.
const NEGOTIATION_CACHE_TTL_MS = 45_000;
let negotiationRawCache: { indents: any[]; cancelledNos: Set<string>; expiresAt: number } | null = null;

async function fetchRawNegotiationData() {
  // Fetch parent indents with inner join on update-3-vendors to ensure they completed
  // Stage 3. Paginated in 1000-row pages — pfms_update-3-vendors already exceeds
  // PostgREST's default 1000-row cap, so an unpaginated select here was silently
  // dropping the oldest indents (same bypass pattern as app/api/dashboard/route.ts).
  const indents: any[] = [];
  {
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data: pageIndents, error } = await supabase
        .from("pfms_indent_generation")
        .select(`
          *,
          approval:pfms_indent-approval (
            approvedQty
          ),
          update3Vendors:pfms_update-3-vendors!inner(*),
          negotiation:pfms_negotiation(*)
        `)
        .order("timestamp", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      if (!pageIndents || pageIndents.length === 0) {
        hasMore = false;
      } else {
        indents.push(...pageIndents);
        hasMore = pageIndents.length === pageSize;
        page++;
      }
    }
  }

  // Fetch cancellations
  const { data: cancelledList } = await supabase
    .from("pfms_order-cancellation")
    .select("indentNo");
  const cancelledNos = new Set((cancelledList || []).map((c: any) => c.indentNo));

  return { indents, cancelledNos };
}

export async function GET() {
  try {
    let raw: { indents: any[]; cancelledNos: Set<string> };
    if (negotiationRawCache && negotiationRawCache.expiresAt > Date.now()) {
      raw = negotiationRawCache;
    } else {
      raw = await fetchRawNegotiationData();
      negotiationRawCache = { ...raw, expiresAt: Date.now() + NEGOTIATION_CACHE_TTL_MS };
    }
    const { indents, cancelledNos } = raw;

    const mappedData = indents
      .map((row: any) => {
        const vendorArray = row.update3Vendors;
        const vendorData = Array.isArray(vendorArray) ? (vendorArray[0] || {}) : (vendorArray || {});

        const approvalArray = row.approval;
        const approval = Array.isArray(approvalArray) ? (approvalArray[0] || {}) : (approvalArray || {});

        const negotiationArray = row.negotiation;
        const hasNegotiation = Array.isArray(negotiationArray) ? negotiationArray.length > 0 : !!negotiationArray;
        const negotiationData = hasNegotiation ? (Array.isArray(negotiationArray) ? negotiationArray[0] : negotiationArray) : {};

        const status = hasNegotiation ? "completed" : "pending";

        return {
          id: `${row.indentNo}-${vendorData.id}`,
          dbId: vendorData.id,
          rowIndex: null,
          stage: 4,
          status: status,
          createdAt: vendorData.timestamp, // actual completion date of Stage 3
          history: hasNegotiation ? [{ stage: 4, date: negotiationData.timestamp || vendorData.timestamp, data: {} }] : [],
          data: {
            indentNumber: row.indentNo,
            timestamp: row.timestamp || vendorData.timestamp,
            itemName: row.itemName || "",
            quantity: approval.approvedQty || 0, // approvedQty from Stage 2
            planned3: vendorData.plannedNegotiation, // plannedNegotiation from update-3-vendors table
            actual3: hasNegotiation ? negotiationData.timestamp : null, // actual negotiation date
            delay3: null,

            // Vendor comparison fields for display/selection
            vendor1Name: vendorData.vendor1Name || "",
            vendor1Rate: vendorData.vendor1Rate || "",
            vendor1Terms: vendorData.vendor1Terms || "",
            vendor1DeliveryDate: vendorData.vendor1DeliveryDate || "",
            vendor1Attachment: vendorData.vendor1Attachment || "",

            vendor2Name: vendorData.vendor2Name || "",
            vendor2Rate: vendorData.vendor2Rate || "",
            vendor2Terms: vendorData.vendor2Terms || "",
            vendor2DeliveryDate: vendorData.vendor2DeliveryDate || "",
            vendor2Attachment: vendorData.vendor2Attachment || "",

            vendor3Name: vendorData.vendor3Name || "",
            vendor3Rate: vendorData.vendor3Rate || "",
            vendor3Terms: vendorData.vendor3Terms || "",
            vendor3DeliveryDate: vendorData.vendor3DeliveryDate || "",
            vendor3Attachment: vendorData.vendor3Attachment || "",

            // Negotiation fields
            selectedVendor: hasNegotiation ? (negotiationData.selectedVendorName || "") : "",
            selectedVendorName: hasNegotiation ? (negotiationData.selectedVendorName || "") : "",
            finalApprovedBy: hasNegotiation ? (negotiationData.finalApprovedBy || "") : "",
            negotiationRemarks: hasNegotiation ? (negotiationData.negotiationRemarks || "") : "",
            purchaser: row.purchaser || null
          }
        };
      })
      .filter((row: any) => {
        if (row.status === "pending" && cancelledNos.has(row.data.indentNumber)) {
          return false;
        }
        return true;
      });

    return NextResponse.json({ success: true, data: mappedData });
  } catch (error: any) {
    console.error("Error fetching negotiations:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "insertNegotiation") {
      const { idsToProcess, submissionData } = body;

      if (!idsToProcess || idsToProcess.length === 0) {
        return NextResponse.json({ success: false, error: "No records to process" }, { status: 400 });
      }

      // 1. Calculate planned time for po-entry
      const now = getLocalTimestamp();
      const plannedPOEntry = await calculatePlannedTime("po-entry");

      // 2. Prepare negotiation records
      const negotiationsToInsert = idsToProcess.map((recordId: string) => {
        // Robustly parse indentNo and UUID based on UUID's 36-char fixed length
        const recordIndentNo = recordId.length > 36 ? recordId.substring(0, recordId.length - 37) : recordId;

        return {
          id: randomUUID(),
          indentNo: recordIndentNo,
          selectedVendorName: submissionData.selectedVendorName,
          finalApprovedBy: submissionData.finalApprovedBy,
          negotiationRemarks: submissionData.negotiationRemarks || null,
          plannedPOEntry,
          timestamp: now,
          createdAt: now,
          updatedAt: now
        };
      });

      const { error: insertError } = await supabase
        .from("pfms_negotiation")
        .insert(negotiationsToInsert);

      if (insertError) throw insertError;

      negotiationRawCache = null;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in negotiation API:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
