import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { calculatePlannedTime, getLocalTimestamp } from "@/app/api/helper/plannedCalculator";
import { canViewPurchaserRecord } from "@/lib/utils";

// Short-lived in-memory cache for this stage's raw fetch (lifts + cancellations) —
// same pattern as app/api/dashboard/route.ts. 45s TTL means bursts of GETs within that
// window (same warm instance) reuse the already-fetched data instead of re-querying
// Supabase. Cleared on a successful write below so a user's own change is reflected
// immediately on their next load, instead of waiting out the TTL.
const VERIFICATION_CACHE_TTL_MS = 45_000;
let verificationRawCache: { lifts: any[]; cancelledNos: Set<string>; expiresAt: number } | null = null;

async function fetchRawVerificationData() {
  // Fetch lifts that have completed the submit-invoice stage (i.e. submitInvoice is not
  // null). Paginated in 1000-row pages — pfms_submit-invoice is growing toward
  // PostgREST's default 1000-row cap, so this is paginated pre-emptively (same bypass
  // pattern as app/api/dashboard/route.ts).
  const lifts: any[] = [];
  {
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data: pageLifts, error: liftError }: any = await supabase
        .from("pfms_lift")
        .select(`
          *,
          submitInvoice:"pfms_submit-invoice"!inner (
            id,
            timestamp,
            handoverBy,
            invoiceSubmissionDate,
            plannedVerification
          ),
          accountsVerification:"pfms_accounts-verification" (
            id,
            timestamp,
            verifiedCheckedBy,
            verificationDate,
            remarks
          ),
          tallyEntry:"pfms_tally-entry" (
            doneDate,
            timestamp,
            remarks
          ),
          indent:"pfms_indent_generation"!inner (
            indentNo,
            itemName,
            category,
            warehouseLocation,
            purchaser,
            negotiation:pfms_negotiation (
              selectedVendorName
            ),
            poEntry:"pfms_po-entry" (
              poNumber,
              basicValue,
              totalWithTax
            )
          ),
          materialReceived:"pfms_material-received" (
            invoiceNumber,
            invoiceDate,
            receivedQty,
            billAttachment
          )
        `)
        .order("timestamp", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (liftError) throw liftError;
      if (!pageLifts || pageLifts.length === 0) {
        hasMore = false;
      } else {
        lifts.push(...pageLifts);
        hasMore = pageLifts.length === pageSize;
        page++;
      }
    }
  }

  const { data: cancelledList } = await supabase
    .from("pfms_order-cancellation")
    .select("indentNo");
  const cancelledNos = new Set((cancelledList || []).map((c: any) => c.indentNo));

  return { lifts, cancelledNos };
}

// Same lazy-history pattern as Tally Entry: `view=pending` (default) only builds
// Pending + a cheap `historyCount`; `view=history` is only requested once the user
// opens that tab, and returns at most `limit` (100 default, 200 once searched) rows,
// filtered server-side.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") === "history" ? "history" : "pending";
    const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10) || 0);
    const search = (searchParams.get("search") || "").toLowerCase().trim();
    const warehouse = searchParams.get("warehouse") || "All";
    const limit = search || warehouse !== "All" ? 200 : 100;
    const role = searchParams.get("role");
    const records = searchParams.get("records");

    let raw: { lifts: any[]; cancelledNos: Set<string> };
    if (verificationRawCache && verificationRawCache.expiresAt > Date.now()) {
      raw = verificationRawCache;
    } else {
      raw = await fetchRawVerificationData();
      verificationRawCache = { ...raw, expiresAt: Date.now() + VERIFICATION_CACHE_TTL_MS };
    }
    const { lifts, cancelledNos } = raw;

    const pending = [];
    const history = [];
    let historyCount = 0;

    for (const lift of (lifts || [])) {
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const poEntry = Array.isArray(indent.poEntry) ? (indent.poEntry[0] || {}) : (indent.poEntry || {});
      const matRecd = Array.isArray(lift.materialReceived) ? (lift.materialReceived[0] || {}) : (lift.materialReceived || {});
      
      const subInv = Array.isArray(lift.submitInvoice) ? lift.submitInvoice[0] : lift.submitInvoice;
      const tally = Array.isArray(lift.tallyEntry) ? lift.tallyEntry[0] : lift.tallyEntry;
      const ver = Array.isArray(lift.accountsVerification) ? lift.accountsVerification[0] : lift.accountsVerification;

      const itemData = {
        indentNumber: indent.indentNo || "",
        liftNo: lift.liftNo || "",
        category: indent.category || "-",
        itemName: indent.itemName || "-",
        quantity: matRecd.receivedQty || "-",
        warehouse: indent.warehouseLocation || "-",
        vendorName: negotiation.selectedVendorName || "-",
        poNumber: poEntry.poNumber || "-",
        invoiceNumber: matRecd.invoiceNumber || "-",
        invoiceDate: matRecd.invoiceDate || "-",
        basicValue: poEntry.basicValue || "-",
        totalWithTax: poEntry.totalWithTax || "-",
        billAttachment: matRecd.billAttachment || "",
        tallyDate: tally ? (tally.doneDate || tally.timestamp) : "",
        tallyRemarks: tally ? (tally.remarks || "-") : "-",
        plan10: subInv ? subInv.plannedVerification : "",
        actual10: ver ? ver.timestamp : "",
        verifiedCheckedBy: ver ? ver.verifiedCheckedBy : "",
        verificationDate: ver ? ver.verificationDate : "",
        verificationRemarks: ver ? ver.remarks : "",
        purchaser: indent.purchaser || null,
      };

      if (!canViewPurchaserRecord(itemData.purchaser, records, role)) continue;

      const mappedRecord = {
        id: lift.liftNo,
        rowIndex: lift.liftNo,
        status: ver ? "completed" : "pending",
        data: itemData
      };

      if (ver) {
        if (view === "history") {
          history.push(mappedRecord);
        } else {
          historyCount++;
        }
      } else {
        pending.push(mappedRecord);
      }
    }

    const filteredPending = pending.filter((row: any) => !cancelledNos.has(row.data.indentNumber));

    if (view === "pending") {
      return NextResponse.json({
        success: true,
        pending: filteredPending,
        historyCount,
      });
    }

    const filteredHistory = history.filter((row: any) => {
      if (warehouse === "NE Warehouse" && row.data.warehouse !== "NE Warehouse") return false;
      if (warehouse === "Others" && row.data.warehouse === "NE Warehouse") return false;
      if (!search) return true;
      return (
        row.data.indentNumber?.toLowerCase().includes(search) ||
        row.data.itemName?.toLowerCase().includes(search) ||
        row.data.vendorName?.toLowerCase().includes(search) ||
        String(row.data.poNumber || "").toLowerCase().includes(search) ||
        String(row.data.invoiceNumber || "").toLowerCase().includes(search)
      );
    });

    const totalCount = filteredHistory.length;
    const pageStart = page * limit;
    const pagedHistory = filteredHistory.slice(pageStart, pageStart + limit);

    return NextResponse.json({
      success: true,
      history: pagedHistory,
      totalCount,
    });

  } catch (error: any) {
    console.error("Error in verification GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { records } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ success: false, error: "No records to verify" }, { status: 400 });
    }

    const now = getLocalTimestamp();

    // Batch insert accounts verification entries
    const inserts = records.map((rec: any) => ({
      id: randomUUID(),
      timestamp: now,
      liftNo: rec.liftNo,
      verifiedCheckedBy: rec.checkedBy,
      verificationDate: getLocalTimestamp(rec.verificationDate),
      remarks: rec.remarks || null,
      createdAt: now,
      updatedAt: now
    }));

    const { error: insertError } = await supabase
      .from("pfms_accounts-verification")
      .insert(inserts);

    if (insertError) throw insertError;

    // Update plannedDate in vendor-payment-details
    for (const rec of records) {
      const vDate = rec.verificationDate ? new Date(rec.verificationDate) : new Date();
      const plannedDate = await calculatePlannedTime("vendor-payments", vDate);

      await supabase
        .from("pfms_vendor-payment-details")
        .update({
          plannedDate: plannedDate,
          updatedAt: now
        })
        .eq("liftNo", rec.liftNo);
    }

    // Note: this also just wrote pfms_vendor-payment-details.plannedDate, which
    // app/api/vendor-payment/route.ts caches separately — that page's cache can lag
    // up to its own 45s TTL before showing the new plannedDate (same bounded-staleness
    // tradeoff already accepted for app/api/dashboard/route.ts's cache).
    verificationRawCache = null;
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in verification POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
