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
    // 1. Fetch Turn Around Time (TAT) for vendor-payment
    const { data: tatData } = await supabase
      .from("pfms_tat")
      .select("actionTime")
      .eq("stageName", "vendor-payment")
      .maybeSingle();
    const tatHours = tatData?.actionTime || 72; // default to 72 hours

    // 2. Fetch all vendor payment details
    const { data: payDetails, error: payError } = await supabase
      .from("pfms_vendor-payment-details")
      .select(`
        *,
        lift:pfms_lift!inner (
          liftNo,
          plannedTallyEntry,
          accountsVerification:pfms_accounts-verification (
            verificationDate
          ),
          indent:pfms_indent-generation!inner (
            indentNo,
            itemName,
            category,
            warehouseLocation,
            negotiation:pfms_negotiation (
              selectedVendorName
            ),
            poEntry:"pfms_po-entry" (
              poNumber,
              poCopy
            )
          ),
          materialReceived:"pfms_material-received" (
            invoiceNumber,
            invoiceDate,
            receivedQty,
            billAttachment
          )
        )
      `) as any;

    if (payError) throw payError;

    // 3. Fetch all paid data transaction logs
    const { data: paidLogs, error: logsError } = await supabase
      .from("pfms_paid-data")
      .select(`
        *,
        vendorInvoice:pfms_vendor-payment-details!inner (
          totalAmount,
          dueDate,
          plannedDate,
          lift:pfms_lift!inner (
            liftNo,
            accountsVerification:pfms_accounts-verification (
              verificationDate
            ),
            indent:pfms_indent-generation!inner (
              indentNo,
              itemName,
              negotiation:pfms_negotiation (
                selectedVendorName
              )
            ),
            materialReceived:"pfms_material-received" (
              invoiceNumber,
              invoiceDate
            )
          )
        )
      `) as any;

    if (logsError) throw logsError;

    // Fetch cancellations
    const { data: cancelledList } = await supabase
      .from("pfms_order-cancellation")
      .select("indentNo");
    const cancelledNos = new Set((cancelledList || []).map((c: any) => c.indentNo));

    const pending = [];
    const history = [];

    // Map pending records
    for (const pd of (payDetails || [])) {
      const pendingAmt = pd.totalAmount - pd.paidAmount;
      if (pendingAmt <= 0) continue;

      const lift = pd.lift || {};
      const indent = lift.indent || {};

      if (cancelledNos.has(indent.indentNo)) continue;
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const poEntry = Array.isArray(indent.poEntry) ? (indent.poEntry[0] || {}) : (indent.poEntry || {});
      const matRecd = Array.isArray(lift.materialReceived) ? (lift.materialReceived[0] || {}) : (lift.materialReceived || {});
      const verification = Array.isArray(lift.accountsVerification) ? (lift.accountsVerification[0] || {}) : (lift.accountsVerification || {});

      // Calculate planned date: prioritize stored plannedDate, fallback to verificationDate + tatHours
      let plan1Date = "";
      if (pd.plannedDate) {
        plan1Date = pd.plannedDate;
      } else if (verification.verificationDate) {
        const vDate = new Date(verification.verificationDate);
        plan1Date = getLocalTimestamp(new Date(vDate.getTime() + tatHours * 60 * 60 * 1000));
      } else if (lift.plannedTallyEntry) {
        plan1Date = lift.plannedTallyEntry;
      }

      pending.push({
        id: pd.liftNo,
        rowIndex: pd.liftNo,
        status: "pending",
        data: {
          id: pd.liftNo,
          invoiceNo: matRecd.invoiceNumber || "-",
          invoiceCopy: matRecd.billAttachment || "",
          invoiceDate: matRecd.invoiceDate ? getLocalTimestamp(matRecd.invoiceDate).split("T")[0] : "-",
          dueDate: pd.dueDate ? getLocalTimestamp(pd.dueDate).split("T")[0] : "-",
          vendor: negotiation.selectedVendorName || "-",
          poNumber: poEntry.poNumber || "-",
          totalRcvd: matRecd.receivedQty || 0,
          poCopy: poEntry.poCopy || "",
          qty: matRecd.receivedQty || 0,
          receivedItems: indent.itemName || "-",
          totalVal: pd.totalAmount,
          plan1: plan1Date ? getLocalTimestamp(plan1Date).split("T")[0] : "-",
          actual1: pd.paidAmount >= pd.totalAmount ? getLocalTimestamp(pd.updatedAt).split("T")[0] : "-",
          totalPaid: pd.paidAmount,
          pendingAmount: pendingAmt,
          paymentStatus: pd.paidAmount > 0 ? "partial" : "pending",
        }
      });
    }

    // Map history records
    for (const log of (paidLogs || [])) {
      const vendorInvoice = log.vendorInvoice || {};
      const lift = vendorInvoice.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const matRecd = Array.isArray(lift.materialReceived) ? (lift.materialReceived[0] || {}) : (lift.materialReceived || {});
      const verification = Array.isArray(lift.accountsVerification) ? (lift.accountsVerification[0] || {}) : (lift.accountsVerification || {});

      let plan1Date = "";
      if (vendorInvoice.plannedDate) {
        plan1Date = vendorInvoice.plannedDate;
      } else if (verification.verificationDate) {
        const vDate = new Date(verification.verificationDate);
        plan1Date = getLocalTimestamp(new Date(vDate.getTime() + tatHours * 60 * 60 * 1000));
      }

      history.push({
        id: log.id,
        invoiceNo: matRecd.invoiceNumber || "-",
        vendor: negotiation.selectedVendorName || "-",
        planned: plan1Date ? getLocalTimestamp(plan1Date).split("T")[0] : "-",
        actual: getLocalTimestamp(log.paymentDate).split("T")[0],
        amountPaid: log.amountPaid,
        mode: log.paymentMode || "-",
        status: log.paymentStatus || "paid",
        proof: log.proof || "",
        date: getLocalTimestamp(log.paymentDate).split("T")[0],
      });
    }

    return NextResponse.json({
      success: true,
      pending,
      history
    });

  } catch (error: any) {
    console.error("Error in vendor-payment GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payments, paymentMode, paymentDate, proofUrl } = body;

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return NextResponse.json({ success: false, error: "No payments provided" }, { status: 400 });
    }

    const now = getLocalTimestamp();
    const payDate = paymentDate ? getLocalTimestamp(paymentDate) : now;

    // Process each payment transaction
    for (const pay of payments) {
      const { liftNo, payAmount } = pay;
      const amt = parseFloat(payAmount) || 0;
      if (amt <= 0) continue;

      // 1. Fetch current payment details
      const { data: pd, error: pdError } = await supabase
        .from("pfms_vendor-payment-details")
        .select("*")
        .eq("liftNo", liftNo)
        .maybeSingle();

      if (pdError) throw pdError;
      if (!pd) {
        throw new Error(`VendorPaymentDetails not found for liftNo: ${liftNo}`);
      }

      const newPaidAmount = pd.paidAmount + amt;
      const paymentStatus = newPaidAmount >= pd.totalAmount ? "paid" : "partial";

      // 2. Insert transaction log into paid-data
      const { error: insertError } = await supabase
        .from("pfms_paid-data")
        .insert({
          id: randomUUID(),
          timestamp: now,
          invoiceId: pd.id,
          amountPaid: amt,
          paymentStatus: paymentStatus,
          paymentDate: payDate,
          paymentMode: paymentMode || "Other",
          proof: proofUrl || null,
          createdAt: now,
          updatedAt: now
        });

      if (insertError) throw insertError;

      // 3. Update VendorPaymentDetails totals
      const { error: updateError } = await supabase
        .from("pfms_vendor-payment-details")
        .update({
          paidAmount: newPaidAmount,
          updatedAt: now
        })
        .eq("liftNo", liftNo);

      if (updateError) throw updateError;
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in vendor-payment POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Payment processing failed" }, { status: 500 });
  }
}
