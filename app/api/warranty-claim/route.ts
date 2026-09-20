import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { calculatePlannedTime, getLocalTimestamp } from "@/app/api/helper/plannedCalculator";
import { canViewPurchaserRecord, sortByIndentNumber, isWarrantyExpiringSoon } from "@/lib/utils";

// Pending here is the stage's big list (thousands of serials awaiting a claim decision —
// unlike Tally Entry, where Pending was small and History was the big one). The
// underlying Supabase fetch (all `pfms_serial-number` rows with plannedWarrantyClaim set)
// is unavoidable without a DB-side anti-join/view, but building full display objects for
// and sending all of them on every load was the bulk of the actual cost. This paginates
// the *response*: purchaser-visibility, cancellation, search and the expiring-only filter
// all now run server-side before slicing to `limit` (default 100, opens to 200 once a
// search/expiring filter is applied) — ClosurePending/History stay as one-shot fetches
// since their source table (`pfms_warranty-claim`, one row per filed claim) is small.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10) || 0);
    const search = (searchParams.get("search") || "").toLowerCase().trim();
    const expiringOnly = searchParams.get("expiringOnly") === "true";
    const sortDir = searchParams.get("sort") === "desc" ? "desc" : "asc";
    const hasPendingFilter = !!search || expiringOnly;
    const limit = hasPendingFilter ? 200 : 100;
    const role = searchParams.get("role");
    const records = searchParams.get("records");

    // 1. Fetch pending serials (plannedWarrantyClaim is not null, left-join warranty-claim and check null)
    const serials: any[] = [];
    let dbPage = 0;
    const dbPageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data: pageSerials, error: pageError } = await supabase
        .from("pfms_serial-number")
        .select(`
          *,
          warrantyClaim:"pfms_warranty-claim" (
            id
          ),
          lift:pfms_lift!inner (
            liftNo,
            indent:pfms_indent_generation!inner (
              indentNo,
              itemName,
              purchaser,
              negotiation:pfms_negotiation (
                selectedVendorName
              )
            ),
            materialReceived:"pfms_material-received" (
              invoiceDate,
              invoiceNumber,
              billAttachment
            )
          )
        `)
        .not("plannedWarrantyClaim", "is", null)
        .range(dbPage * dbPageSize, (dbPage + 1) * dbPageSize - 1) as any;

      if (pageError) throw pageError;
      if (!pageSerials || pageSerials.length === 0) {
        hasMore = false;
      } else {
        serials.push(...pageSerials);
        if (pageSerials.length < dbPageSize) {
          hasMore = false;
        } else {
          dbPage++;
        }
      }
    }

    const pending = [];
    for (const s of (serials || [])) {
      const hasClaim = Array.isArray(s.warrantyClaim) ? s.warrantyClaim.length > 0 : !!s.warrantyClaim;
      if (!hasClaim) {
        const lift = s.lift || {};
        const indent = lift.indent || {};
        const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
        const matRecd = Array.isArray(lift.materialReceived)
          ? (lift.materialReceived[0] || {})
          : (lift.materialReceived || {});

        const data = {
          indentNo: indent.indentNo || "",
          liftNo: s.liftNo || "",
          serialCode: s.qrLink || "",
          serialNo: s.serialNo || "",
          vendorName: negotiation.selectedVendorName || "-",
          itemName: indent.itemName || "-",
          invoiceDate: matRecd.invoiceDate || "",
          invoiceNo: matRecd.invoiceNumber || "",
          invoiceCopy: matRecd.billAttachment || "",
          warrantyEnd: s.warrantyExpiry || "",
          planned: s.plannedWarrantyClaim || "",
          actual: null,
          purchaser: indent.purchaser || null,
        };

        if (!canViewPurchaserRecord(data.purchaser, records, role)) continue;

        pending.push({ id: `pending_${s.serialNo}`, data });
      }
    }

    // 2. Fetch claims (Closure Pending and History)
    const { data: claims, error: claimError } = await supabase
      .from("pfms_warranty-claim")
      .select(`
        *,
        serialNumber:"pfms_serial-number"!inner (
          liftNo,
          qrLink,
          warrantyExpiry,
          lift:pfms_lift!inner (
            indent:pfms_indent_generation!inner (
              itemName,
              purchaser,
              negotiation:pfms_negotiation (
                selectedVendorName
              )
            ),
            materialReceived:"pfms_material-received" (
              invoiceDate
            )
          )
        )
      `) as any;

    if (claimError) throw claimError;

    const closurePending = [];
    const history = [];

    for (const claim of (claims || [])) {
      const serial = claim.serialNumber || {};
      const lift = serial.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});

      const matRecd = Array.isArray(lift.materialReceived)
        ? (lift.materialReceived[0] || {})
        : (lift.materialReceived || {});

      const itemData = {
        timestamp: claim.timestamp,
        indentNo: claim.invoiceNo || indent.indentNo || "",
        liftNo: serial.liftNo || "",
        serialCode: serial.qrLink || "",
        serialNo: claim.serialNo || "",
        qty: 1,
        invoiceNo: claim.invoiceNo || "",
        issueDescription: claim.issueDescription || "",
        invoiceCopy: claim.invoiceCopy || "",
        photoVideo: claim.photoVideo || "",
        claimType: claim.claimType || "",
        status: claim.status || "Pending",
        claimedBy: claim.claimedBy || "",
        plannedClosure: claim.plannedClosure || "",
        closureDate: claim.closureDate || "",
        remarks: claim.remarks || "",
        vendorName: negotiation.selectedVendorName || "-",
        itemName: indent.itemName || "-",
        warrantyEnd: serial.warrantyExpiry || "",
        invoiceDate: matRecd.invoiceDate || "",
        planned: claim.plannedClosure || "",
        actual: claim.closureDate || "",
        purchaser: indent.purchaser || null,
      };

      const mappedRecord = {
        id: claim.id,
        data: itemData
      };

      if (claim.status?.toLowerCase() === "pending") {
        closurePending.push(mappedRecord);
      } else if (claim.status?.toLowerCase() === "closure") {
        history.push(mappedRecord);
      }
    }

    // Fetch cancellations
    const { data: cancelledList } = await supabase
      .from("pfms_order-cancellation")
      .select("indentNo");
    const cancelledNos = new Set((cancelledList || []).map((c: any) => c.indentNo));

    const filteredClosurePending = closurePending.filter((row: any) => !cancelledNos.has(row.data.indentNo));

    // Pending: cancellation + search + expiring-only filters, sorted, then paged
    // server-side — this is the stage's big list (thousands of serials), so only a
    // `limit`-sized slice (default 100, 200 once search/expiring is applied) is ever
    // built into full row objects and sent over the wire.
    let filteredPending = pending.filter((row: any) => !cancelledNos.has(row.data.indentNo));
    if (search) {
      filteredPending = filteredPending.filter((r: any) =>
        String(r.data.indentNo || "").toLowerCase().includes(search) ||
        String(r.data.itemName || "").toLowerCase().includes(search) ||
        String(r.data.vendorName || "").toLowerCase().includes(search) ||
        String(r.data.serialNo || "").toLowerCase().includes(search) ||
        String(r.data.invoiceNo || "").toLowerCase().includes(search)
      );
    }
    if (expiringOnly) {
      filteredPending = filteredPending.filter((r: any) => isWarrantyExpiringSoon(r.data.warrantyEnd));
    }
    filteredPending = sortByIndentNumber(filteredPending, sortDir);

    const pendingTotalCount = filteredPending.length;
    const pageStart = page * limit;
    const pagedPending = filteredPending.slice(pageStart, pageStart + limit);

    return NextResponse.json({
      success: true,
      pending: pagedPending,
      pendingTotalCount,
      closurePending: filteredClosurePending,
      history
    });

  } catch (error: any) {
    console.error("Error in warranty-claim GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const now = getLocalTimestamp();

    if (action === "fileClaim") {
      const {
        serialNo,
        invoiceNo,
        invoiceCopy,
        issueDescription,
        photoVideo,
        claimType,
        claimedBy
      } = body;

      if (!serialNo || !issueDescription || !claimType) {
        return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
      }

      // Calculate planned time for warranty-claim closure
      const plannedClosure = await calculatePlannedTime("warranty-claim");

      const { error: insertError } = await supabase
        .from("pfms_warranty-claim")
        .insert({
          id: randomUUID(),
          timestamp: now,
          serialNo,
          invoiceNo,
          invoiceCopy,
          issueDescription,
          photoVideo,
          claimType,
          status: "Pending",
          claimedBy,
          plannedClosure,
          createdAt: now,
          updatedAt: now
        });

      if (insertError) throw insertError;

      return NextResponse.json({ success: true });

    } else if (action === "closeClaim") {
      const { claimId, closureDate, remarks } = body;

      if (!claimId || !closureDate) {
        return NextResponse.json({ success: false, error: "Missing claimId or closureDate" }, { status: 400 });
      }

      const { error: updateError } = await supabase
        .from("pfms_warranty-claim")
        .update({
          status: "Closure",
          closureDate: getLocalTimestamp(closureDate),
          remarks: remarks || null,
          updatedAt: now
        })
        .eq("id", claimId);

      if (updateError) throw updateError;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    console.error("Error in warranty-claim POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
