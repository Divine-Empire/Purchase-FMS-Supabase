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
const SUBMIT_INVOICE_HO_CACHE_TTL_MS = 45_000;
let submitInvoiceHoRawCache: { lifts: any[]; cancelledNos: Set<string>; expiresAt: number } | null = null;

async function fetchRawSubmitInvoiceHoData() {
  // Fetch tally-entry records to determine pending and completed HO submissions.
  // Paginated in 1000-row pages — pfms_tally-entry is close to PostgREST's default
  // 1000-row cap and growing, so this is paginated pre-emptively (same bypass
  // pattern as app/api/dashboard/route.ts) rather than waiting for it to start
  // silently dropping rows.
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
          tallyEntry:"pfms_tally-entry"!inner (
            id,
            timestamp,
            plannedInvoiceHO
          ),
          submitInvoiceHO:"pfms_submit-invoice-ho" (
            id,
            timestamp,
            hardcopySubmitted,
            submissionDate
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
            receivedQty
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
    if (submitInvoiceHoRawCache && submitInvoiceHoRawCache.expiresAt > Date.now()) {
      raw = submitInvoiceHoRawCache;
    } else {
      raw = await fetchRawSubmitInvoiceHoData();
      submitInvoiceHoRawCache = { ...raw, expiresAt: Date.now() + SUBMIT_INVOICE_HO_CACHE_TTL_MS };
    }
    const { lifts, cancelledNos } = raw;

    const pending = [];
    const history = [];
    let historyCount = 0;

    for (const lift of (lifts || [])) {
      const tally = Array.isArray(lift.tallyEntry) ? lift.tallyEntry[0] : lift.tallyEntry;
      if (!tally) continue;

      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const poEntry = Array.isArray(indent.poEntry) ? (indent.poEntry[0] || {}) : (indent.poEntry || {});
      const matRecd = Array.isArray(lift.materialReceived) ? (lift.materialReceived[0] || {}) : (lift.materialReceived || {});
      
      const subHO = Array.isArray(lift.submitInvoiceHO) ? lift.submitInvoiceHO[0] : lift.submitInvoiceHO;

      const itemData = {
        indentNumber: indent.indentNo || "",
        liftNo: lift.liftNo || "",
        category: indent.category || "-",
        itemName: indent.itemName || "-",
        quantity: matRecd.receivedQty || "-",
        poNumber: poEntry.poNumber || "-",
        billAttachment: lift.biltyCopy || "",
        invoiceNumber: matRecd.invoiceNumber || "-",
        invoiceDate: matRecd.invoiceDate || "-",
        planDate: tally.plannedInvoiceHO || "",
        actualDate: subHO ? subHO.timestamp : "",
        hardcopySubmitted: subHO ? subHO.hardcopySubmitted : "",
        submissionDate: subHO ? subHO.submissionDate : "",
        warehouse: indent.warehouseLocation || "-",
        basicValue: poEntry.basicValue || "-",
        totalWithTax: poEntry.totalWithTax || "-",
        vendorName: negotiation.selectedVendorName || "-",
        purchaser: indent.purchaser || null,
      };

      if (!canViewPurchaserRecord(itemData.purchaser, records, role)) continue;

      const mappedRecord = {
        id: lift.liftNo,
        rowIndex: lift.liftNo,
        status: subHO ? "completed" : "pending",
        data: itemData
      };

      if (subHO) {
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
    console.error("Error in submit-invoice-ho GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { records } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ success: false, error: "No records to submit" }, { status: 400 });
    }

    const now = getLocalTimestamp();

    // Calculate planned time for submit-invoice
    const plannedInvoice = await calculatePlannedTime("submit-invoice");

    // Batch insert HO invoice submissions
    const inserts = records.map((rec: any) => ({
      id: randomUUID(),
      timestamp: now,
      liftNo: rec.liftNo,
      hardcopySubmitted: rec.hardcopySubmitted,
      submissionDate: getLocalTimestamp(rec.submissionDate),
      plannedInvoice: plannedInvoice,
      createdAt: now,
      updatedAt: now
    }));

    const { error: insertError } = await supabase
      .from("pfms_submit-invoice-ho")
      .insert(inserts);

    if (insertError) throw insertError;

    submitInvoiceHoRawCache = null;
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in submit-invoice-ho POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
