import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";

function getLocalTimestamp(dateInput?: Date | string | number | null): string {
  const date = dateInput ? new Date(dateInput) : new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().replace("Z", "");
}

export async function GET() {
  try {
    // 1. Fetch all freight payment details
    const { data: payDetails, error: payError } = await supabase
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
      `) as any;

    if (payError) throw payError;

    // Fetch cancellations
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

    // Map history records
    for (const log of (paidLogs || [])) {
      const freightInvoice = log.freightInvoice || {};
      const lift = freightInvoice.lift || {};
      const indent = Array.isArray(lift.indent) ? (lift.indent[0] || {}) : (lift.indent || {});

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

    return NextResponse.json({
      success: true,
      pending,
      history
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

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in freight-payment POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Payment processing failed" }, { status: 500 });
  }
}
