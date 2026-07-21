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
    // 1. Fetch lifts that have completed the submit-invoice stage (i.e. submitInvoice is not null)
    const { data: lifts, error: liftError } = await supabase
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
        indent:"pfms_indent-generation"!inner (
          indentNo,
          itemName,
          category,
          warehouseLocation,
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
      `) as any;

    if (liftError) throw liftError;

    const pending = [];
    const history = [];

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
        verificationRemarks: ver ? ver.remarks : ""
      };

      const mappedRecord = {
        id: lift.liftNo,
        rowIndex: lift.liftNo,
        status: ver ? "completed" : "pending",
        data: itemData
      };

      if (ver) {
        history.push(mappedRecord);
      } else {
        pending.push(mappedRecord);
      }
    }

    // Fetch cancellations
    const { data: cancelledList } = await supabase
      .from("pfms_order-cancellation")
      .select("indentNo");
    const cancelledNos = new Set((cancelledList || []).map((c: any) => c.indentNo));

    const filteredPending = pending.filter((row: any) => !cancelledNos.has(row.data.indentNumber));

    return NextResponse.json({
      success: true,
      pending: filteredPending,
      history
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

    // Fetch TAT for vendor-payment to calculate plannedDate
    const { data: tatData } = await supabase
      .from("pfms_tat")
      .select("actionTime")
      .eq("stageName", "vendor-payment")
      .maybeSingle();
    const tatHours = tatData?.actionTime || 72; // default to 72 hours

    // Update plannedDate in vendor-payment-details
    for (const rec of records) {
      const vDate = rec.verificationDate ? new Date(rec.verificationDate) : new Date();
      const plannedDate = getLocalTimestamp(new Date(vDate.getTime() + tatHours * 60 * 60 * 1000));

      await supabase
        .from("pfms_vendor-payment-details")
        .update({
          plannedDate: plannedDate,
          updatedAt: now
        })
        .eq("liftNo", rec.liftNo);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in verification POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
