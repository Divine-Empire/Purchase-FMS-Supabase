import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { calculatePlannedTime, getLocalTimestamp } from "@/app/api/helper/plannedCalculator";

export async function GET() {
  try {
    // 1. Fetch all material received records that have plannedTallyEntry populated
    const { data: materials, error: matError } = await supabase
      .from("pfms_material-received")
      .select(`
        *,
        lift:pfms_lift!inner (
          *,
          tallyEntry:"pfms_tally-entry" (
            id,
            timestamp,
            doneBy,
            doneDate,
            remarks,
            checkedStatus,
            checkedByAcc
          ),
          indent:"pfms_indent_generation"!inner (
            indentNo,
            itemName,
            category,
            warehouseLocation,
            quantity,
            createdBy,
            purchaser,
            negotiation:pfms_negotiation (
              selectedVendorName
            ),
            poEntry:"pfms_po-entry" (
              poNumber,
              poCopy,
              basicValue,
              totalWithTax,
              pkgAmount,
              pkgGST
            )
          )
        )
      `)
      .not("plannedTallyEntry", "is", null)
      .order("timestamp", { ascending: false }) as any;

    if (matError) throw matError;

    const pending = [];
    const history = [];

    for (const mat of (materials || [])) {
      const lift = mat.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const poEntry = Array.isArray(indent.poEntry) ? (indent.poEntry[0] || {}) : (indent.poEntry || {});
      
      const tally = Array.isArray(lift.tallyEntry) ? lift.tallyEntry[0] : lift.tallyEntry;

      const vendorName = negotiation.selectedVendorName || "-";
      const basicValue = poEntry.basicValue !== undefined && poEntry.basicValue !== null ? poEntry.basicValue : "-";
      const totalWithTax = poEntry.totalWithTax !== undefined && poEntry.totalWithTax !== null ? poEntry.totalWithTax : "-";

      const itemData = {
        indentNumber: indent.indentNo || "",
        liftNumber: lift.liftNo || "",
        vendorName: vendorName,
        poNumber: poEntry.poNumber || "-",
        remarksStage6: lift.remarks || "",
        itemName: indent.itemName || "",
        quantity: lift.quantity || "",
        indentQty: indent.quantity || "",
        transporterName: lift.transporterName || "",
        vehicleNo: lift.vehicleNo || "",
        contactNo: lift.contactNo || "",
        lrNo: lift.lrNo || "",
        dispatchDate: lift.dispatchDate || "",
        freightAmount: lift.freightAmount || "",
        advanceAmount: lift.advanceAmount || "",
        paymentDate: lift.paymentDate || "",
        paymentStatus: lift.paymentStatus || "",
        biltyCopy: lift.biltyCopy || "",
        invoiceType: mat.invoiceType || "-",
        invoiceDate: mat.invoiceDate || "-",
        invoiceNumber: mat.invoiceNumber || "-",
        receivedQty: mat.receivedQty || "-",
        receivedItemImage: mat.receivedItemImage || "",
        srnNumber: "-", // populated downstream in testing
        qcRequirement: mat.qcRequired || "-",
        billAttachment: mat.billAttachment || lift.biltyCopy || "",
        paymentAmountHydra: mat.hydraAmt || "",
        paymentAmountLabour: mat.labourAmt || "",
        paymentAmountHamali: mat.hamaliAmt || "",
        remarks7: mat.damageReason || "",

        plan8: mat.plannedTallyEntry || "",
        actual8: tally ? tally.timestamp : "",
        doneBy: tally ? tally.doneBy : "-",
        doneDate: tally ? tally.doneDate : "",
        remarks: tally ? tally.remarks : "",
        checkedStatus: tally ? tally.checkedStatus : "",
        checkedByAcc: tally ? tally.checkedByAcc : "",
        tallyStatus: tally ? tally.checkedStatus : "",

        createdBy: indent.createdBy || "-",
        category: indent.category || "-",
        warehouse: indent.warehouseLocation || "-",
        basicValue: basicValue,
        totalWithTax: totalWithTax,
        poCopy: poEntry.poCopy || "",
        purchaser: indent.purchaser || null,
      };

      const mappedRecord = {
        id: lift.liftNo,
        rowIndex: lift.liftNo, // placeholder for legacy key
        stage: 9,
        status: tally ? "completed" : "pending",
        data: itemData
      };

      if (tally) {
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
    console.error("Error in tally-entry GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { records } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ success: false, error: "No records to process" }, { status: 400 });
    }

    const now = getLocalTimestamp();

    // Calculate planned time for submit-invoice-ho
    const plannedInvoiceHO = await calculatePlannedTime("submit-invoice-ho");

    // Batch insert tally entries
    const inserts = records.map((rec: any) => ({
      id: randomUUID(),
      timestamp: now,
      liftNo: rec.liftNo,
      doneBy: rec.doneBy,
      doneDate: rec.doneDate ? getLocalTimestamp(rec.doneDate) : null,
      remarks: rec.remarks || null,
      checkedStatus: rec.checkedStatus,
      checkedByAcc: rec.checkedStatus === "Yes" ? rec.checkedByAcc : null,
      plannedInvoiceHO: plannedInvoiceHO,
      createdAt: now,
      updatedAt: now
    }));

    const { error: insertError } = await supabase
      .from("pfms_tally-entry")
      .insert(inserts);

    if (insertError) throw insertError;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in tally-entry POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
