import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { getLocalTimestamp } from "@/app/api/helper/plannedCalculator";
import { canViewPurchaserRecord } from "@/lib/utils";

// Short-lived in-memory cache for this stage's raw fetch (pay details + paid logs +
// cancellations) — same pattern as app/api/dashboard/route.ts. 45s TTL means bursts
// of GETs within that window (same warm instance) reuse the already-fetched data
// instead of re-querying Supabase. Cleared on a successful write below so a user's
// own change is reflected immediately on their next load, instead of waiting out the TTL.
const FREIGHT_PAYMENT_CACHE_TTL_MS = 45_000;
let freightPaymentRawCache: {
  payDetails: any[];
  paidLogs: any[];
  cancelledNos: Set<string>;
  expiresAt: number;
} | null = null;

async function fetchRawFreightPaymentData() {
  // 1. Fetch all freight payment details. Paginated in 1000-row pages —
  // pfms_freight-payment-details is close to PostgREST's default 1000-row cap
  // and growing, so this is paginated pre-emptively (same bypass pattern as
  // app/api/dashboard/route.ts).
  const payDetails: any[] = [];
  {
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data: pagePayDetails, error: payError }: any = await supabase
        .from("pfms_freight-payment-details")
        .select(`
          *,
          lift:pfms_lift!inner (
            liftNo,
            indentNo,
            lrNo,
            biltyCopy,
            transporterName,
            vehicleNo,
            contactNo,
            advanceAmount,
            indent:pfms_indent_generation (
              purchaser
            ),
            materialReceived:"pfms_material-received" (
              invoiceNumber,
              billAttachment
            )
          )
        `)
        .order("timestamp", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (payError) throw payError;
      if (!pagePayDetails || pagePayDetails.length === 0) {
        hasMore = false;
      } else {
        payDetails.push(...pagePayDetails);
        hasMore = pagePayDetails.length === pageSize;
        page++;
      }
    }
  }

  const { data: cancelledList } = await supabase
    .from("pfms_order-cancellation")
    .select("indentNo");
  const cancelledNos = new Set((cancelledList || []).map((c: any) => c.indentNo));

  // 2. Fetch all paid freight data transaction logs
  const { data: paidLogs, error: logsError } = await supabase
    .from("pfms_paid-freight-data")
    .select(`
      *,
      freightInvoice:pfms_freight-payment-details!inner (
        plannedDate,
        lift:pfms_lift!inner (
          liftNo,
          lrNo,
          transporterName,
          indent:pfms_indent_generation (
            purchaser
          )
        )
      )
    `) as any;

  if (logsError) throw logsError;

  return { payDetails, paidLogs: paidLogs || [], cancelledNos };
}

// Same lazy-history pattern as Tally Entry/Vendor Payment: Pending stays small
// (bounded by open freight invoices) and loads in full; the paid-freight-data
// transaction log (History) grows unboundedly, so it's only fetched once the user
// opens that tab, filtered + paginated server-side (100 default, 200 once searched).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") === "history" ? "history" : "pending";
    const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10) || 0);
    const search = (searchParams.get("search") || "").toLowerCase().trim();
    const limit = search ? 200 : 100;
    const role = searchParams.get("role");
    const records = searchParams.get("records");

    let raw: { payDetails: any[]; paidLogs: any[]; cancelledNos: Set<string> };
    if (freightPaymentRawCache && freightPaymentRawCache.expiresAt > Date.now()) {
      raw = freightPaymentRawCache;
    } else {
      raw = await fetchRawFreightPaymentData();
      freightPaymentRawCache = { ...raw, expiresAt: Date.now() + FREIGHT_PAYMENT_CACHE_TTL_MS };
    }
    const { payDetails, paidLogs, cancelledNos } = raw;

    const pending = [];
    const history = [];

    // Map pending records
    for (const pd of (payDetails || [])) {
      const lift = pd.lift || {};

      if (cancelledNos.has(lift.indentNo)) continue;
      
      // Filter based strictly on totalAmount - paidAmount > 0
      const balance = pd.totalAmount - pd.paidAmount;
      if (balance <= 0) continue;

      // Net pending amount shown to the user
      const pendingAmt = pd.totalAmount - (lift.advanceAmount || 0) - pd.paidAmount;

      const matRecd = Array.isArray(lift.materialReceived) ? (lift.materialReceived[0] || {}) : (lift.materialReceived || {});
      const indent = Array.isArray(lift.indent) ? (lift.indent[0] || {}) : (lift.indent || {});

      if (!canViewPurchaserRecord(indent.purchaser, records, role)) continue;

      pending.push({
        id: pd.liftNo,
        rowIndex: pd.liftNo,
        status: "pending",
        data: {
          lrNo: lift.lrNo || "-",
          biltyImage: lift.biltyCopy || "",
          freightAmount: pd.totalAmount,
          transporter: lift.transporterName || "-",
          vehicleNo: lift.vehicleNo || "-",
          contact: lift.contactNo || "-",
          advanceAmount: lift.advanceAmount || 0,
          totalPaid: pd.paidAmount,
          pendingAmount: pendingAmt,
          plan1: pd.plannedDate ? getLocalTimestamp(pd.plannedDate).split("T")[0] : "-",
          actual1: pd.paidAmount >= pd.totalAmount ? getLocalTimestamp(pd.updatedAt).split("T")[0] : "-",
          invoiceNo: matRecd.invoiceNumber || "-",
          invoiceCopy: matRecd.billAttachment || "",
          freightVal: pd.totalAmount,
          advanceVal: lift.advanceAmount || 0,
          purchaser: indent.purchaser || null,
        }
      });
    }

    // Map history records. On a `view=pending` request only the count is needed (for
    // the History tab's badge) — skip building the full row objects.
    let historyCount = 0;
    for (const log of (paidLogs || [])) {
      const freightInvoice = log.freightInvoice || {};
      const lift = freightInvoice.lift || {};
      const indent = Array.isArray(lift.indent) ? (lift.indent[0] || {}) : (lift.indent || {});

      if (!canViewPurchaserRecord(indent.purchaser, records, role)) continue;

      if (view === "pending") {
        historyCount++;
        continue;
      }

      history.push({
        id: log.id,
        lrNo: lift.lrNo || "-",
        transporter: lift.transporterName || "-",
        amountPaid: log.amountPaid,
        status: log.paymentStatus || "paid",
        date: getLocalTimestamp(log.paymentDate).split("T")[0],
        planned: freightInvoice.plannedDate ? getLocalTimestamp(freightInvoice.plannedDate).split("T")[0] : "-",
        actual: getLocalTimestamp(log.paymentDate).split("T")[0],
        mode: log.paymentMode || "-",
        proof: log.proof || "",
        purchaser: indent.purchaser || null,
      });
    }

    if (view === "pending") {
      return NextResponse.json({
        success: true,
        pending,
        historyCount,
      });
    }

    const filteredHistory = search
      ? history.filter((h: any) =>
          String(h.lrNo || "").toLowerCase().includes(search) ||
          String(h.transporter || "").toLowerCase().includes(search)
        )
      : history;

    const totalCount = filteredHistory.length;
    const pageStart = page * limit;
    const pagedHistory = filteredHistory.slice(pageStart, pageStart + limit);

    return NextResponse.json({
      success: true,
      history: pagedHistory,
      totalCount,
    });

  } catch (error: any) {
    console.error("Error in freight-payment GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { liftNo, payAmount, paymentMode, paymentDate, proofUrl } = body;

    if (!liftNo) {
      return NextResponse.json({ success: false, error: "Missing liftNo" }, { status: 400 });
    }

    const amt = parseFloat(payAmount) || 0;
    if (amt <= 0) {
      return NextResponse.json({ success: false, error: "Payment amount must be greater than 0" }, { status: 400 });
    }

    const now = getLocalTimestamp();
    const payDate = paymentDate ? getLocalTimestamp(paymentDate) : now;

    // 1. Fetch current payment details
    const { data: pd, error: pdError } = await supabase
      .from("pfms_freight-payment-details")
      .select("*")
      .eq("liftNo", liftNo)
      .maybeSingle();

    if (pdError) throw pdError;
    if (!pd) {
      throw new Error(`FreightPaymentDetails not found for liftNo: ${liftNo}`);
    }

    const newPaidAmount = pd.paidAmount + amt;
    const paymentStatus = newPaidAmount >= pd.totalAmount ? "paid" : "partial";

    // 2. Insert transaction log into paid-freight-data
    const { error: insertError } = await supabase
      .from("pfms_paid-freight-data")
      .insert({
        id: randomUUID(),
        timestamp: now,
        freightDetailId: pd.id,
        amountPaid: amt,
        paymentStatus: paymentStatus,
        paymentDate: payDate,
        paymentMode: paymentMode || "Other",
        proof: proofUrl || null,
        createdAt: now,
        updatedAt: now
      });

    if (insertError) throw insertError;

    // 3. Update FreightPaymentDetails totals
    const { error: updateError } = await supabase
      .from("pfms_freight-payment-details")
      .update({
        paidAmount: newPaidAmount,
        updatedAt: now
      })
      .eq("liftNo", liftNo);

    if (updateError) throw updateError;

    freightPaymentRawCache = null;
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in freight-payment POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Payment processing failed" }, { status: 500 });
  }
}
