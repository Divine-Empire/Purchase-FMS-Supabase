import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { calculatePlannedTime } from "@/app/api/helper/plannedCalculator";

function getLocalTimestamp(dateInput?: Date | string | number | null): string {
  const date = dateInput ? new Date(dateInput) : new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().replace("Z", "");
}

export async function GET() {
  try {
    // 1. Fetch lifts that have completed the submit-invoice-ho stage (i.e. submitInvoiceHO is not null)
    const { data: lifts, error: liftError } = await supabase
      .from("pfms_lift")
      .select(`
        *,
        submitInvoiceHO:"pfms_submit-invoice-ho"!inner (
          id,
          timestamp,
          plannedInvoice
        ),
        submitInvoice:"pfms_submit-invoice" (
          id,
          timestamp,
          handoverBy,
          invoiceSubmissionDate
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
          receivedQty
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
      
      const subHO = Array.isArray(lift.submitInvoiceHO) ? lift.submitInvoiceHO[0] : lift.submitInvoiceHO;
      const tally = Array.isArray(lift.tallyEntry) ? lift.tallyEntry[0] : lift.tallyEntry;
      const subInv = Array.isArray(lift.submitInvoice) ? lift.submitInvoice[0] : lift.submitInvoice;

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
        plan9: subHO ? subHO.plannedInvoice : "",
        actual9: subInv ? subInv.timestamp : "",
        handoverBy: subInv ? subInv.handoverBy : "",
        invoiceSubmissionDate: subInv ? subInv.invoiceSubmissionDate : "",
        warehouse: indent.warehouseLocation || "-",
        basicValue: poEntry.basicValue || "-",
        totalWithTax: poEntry.totalWithTax || "-",
        vendorName: negotiation.selectedVendorName || "-",
        tallyDate: tally ? (tally.doneDate || tally.timestamp) : "",
        tallyRemarks: tally ? (tally.remarks || "-") : "-"
      };

      const mappedRecord = {
        id: lift.liftNo,
        rowIndex: lift.liftNo,
        status: subInv ? "completed" : "pending",
        data: itemData
      };

      if (subInv) {
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
    console.error("Error in submit-invoice GET:", error);
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

    // Calculate planned time for acc-verification
    const plannedVerification = await calculatePlannedTime("acc-verification");

    // Batch insert invoice submissions
    const inserts = records.map((rec: any) => ({
      id: randomUUID(),
      timestamp: now,
      liftNo: rec.liftNo,
      handoverBy: rec.handoverBy,
      invoiceSubmissionDate: getLocalTimestamp(rec.invoiceSubmissionDate),
      plannedVerification: plannedVerification,
      createdAt: now,
      updatedAt: now
    }));

    const { error: insertError } = await supabase
      .from("pfms_submit-invoice")
      .insert(inserts);

    if (insertError) throw insertError;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in submit-invoice POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
