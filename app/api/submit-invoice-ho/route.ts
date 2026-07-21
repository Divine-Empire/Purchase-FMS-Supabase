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
    // 1. Fetch tally-entry records to determine pending and completed HO submissions
    const { data: lifts, error: liftError } = await supabase
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
        vendorName: negotiation.selectedVendorName || "-"
      };

      const mappedRecord = {
        id: lift.liftNo,
        rowIndex: lift.liftNo,
        status: subHO ? "completed" : "pending",
        data: itemData
      };

      if (subHO) {
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

    // Fetch TAT for submit-invoice (Stage 9)
    let tatHours = 192; // default
    const { data: tatData } = await supabase
      .from("pfms_tat")
      .select("actionTime")
      .eq("stageName", "submit-invoice")
      .single();
    if (tatData) {
      tatHours = tatData.actionTime;
    }

    const plannedInvoice = getLocalTimestamp(new Date(Date.now() + tatHours * 60 * 60 * 1000));

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

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in submit-invoice-ho POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
