import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { calculatePlannedTime } from "@/app/api/helper/plannedCalculator";

function getLocalTimestamp(dateInput?: Date | string | number | null): string {
  const date = dateInput ? new Date(dateInput) : new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().replace("Z", "");
}

export async function GET() {
  try {
    // Fetch all records from material-testing
    const { data: testings, error: testingError } = await supabase
      .from("pfms_material-testing")
      .select(`
        *,
        lift:pfms_lift!inner (
          liftNo,
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
              basicValue,
              totalWithTax
            )
          ),
          materialReceived:"pfms_material-received" (
            invoiceNumber,
            invoiceDate,
            receivedQty,
            damagedQty,
            damageReason,
            damageImage,
            plannedMaterialTesting,
            timestamp
          )
        )
      `) as any;

    if (testingError) throw testingError;

    const pending = [];
    const history = [];

    for (const testing of (testings || [])) {
      const lift = testing.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const poEntry = Array.isArray(indent.poEntry) ? (indent.poEntry[0] || {}) : (indent.poEntry || {});
      const matRecd = Array.isArray(lift.materialReceived) ? (lift.materialReceived[0] || {}) : (lift.materialReceived || {});

      const pendingQty = testing.pendingQty !== null && testing.pendingQty !== undefined 
        ? testing.pendingQty 
        : (parseFloat(matRecd.receivedQty) || 0);

      const itemData = {
        indentNumber: indent.indentNo || "",
        liftNo: lift.liftNo || "",
        category: indent.category || "-",
        itemName: indent.itemName || "-",
        quantity: matRecd.receivedQty || "0",
        receivedQty: matRecd.receivedQty || "0",
        warehouse: indent.warehouseLocation || "-",
        vendorName: negotiation.selectedVendorName || "-",
        poNumber: poEntry.poNumber || "-",
        invoiceNumber: matRecd.invoiceNumber || "-",
        invoiceDate: matRecd.invoiceDate || "-",
        basicValue: poEntry.basicValue || "-",
        totalWithTax: poEntry.totalWithTax || "-",
        plan7: matRecd.plannedMaterialTesting || "",
        actual7: testing.qcDate || testing.timestamp || "",
        qcDate: testing.qcDate || "",
        qcBy: testing.qcBy || "",
        approvedQty: testing.approvedQty || 0,
        rejectedQty: testing.rejectedQty || 0,
        totalApproved: testing.approvedQty || 0,
        totalRejected: testing.rejectedQty || 0,
        pendingQty: pendingQty,
        damageQty: matRecd.damagedQty || "0",
        damageReason: matRecd.damageReason || "-",
        damageImage: matRecd.damageImage || "",
        workingCondition: testing.workingCondition || "",
        checklist: (testing.checklist || []).join(", "),
        serialNo: (testing.serialNumbers || []).join(", "),
        image: (testing.images || []).join(" , "),
        rejectType: testing.rejectType || "",
        partName: testing.partName || "",
        remarks: testing.remarks || "",
      };

      const mappedRecord = {
        id: lift.liftNo,
        rowIndex: lift.liftNo,
        status: pendingQty > 0 ? "pending" : "completed",
        data: itemData,
      };

      if (pendingQty > 0) {
        pending.push(mappedRecord);
      } else {
        history.push(mappedRecord);
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
      history,
    });

  } catch (error: any) {
    console.error("Error in material-testing GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      liftNo,
      qcBy,
      qcDate,
      workingCondition,
      remarks,
      approvedQty,
      rejectedQty,
      checklistSelected,
      serialNumbers,
      images,
      rejectType,
      partName,
    } = body;

    if (!liftNo) {
      return NextResponse.json({ success: false, error: "Missing liftNo" }, { status: 400 });
    }

    // 1. Fetch current material-testing record
    const { data: currentTesting, error: fetchError } = await supabase
      .from("pfms_material-testing")
      .select("*")
      .eq("liftNo", liftNo)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!currentTesting) {
      return NextResponse.json({ success: false, error: `Testing record not found for lift ${liftNo}` }, { status: 404 });
    }

    // 2. Fetch received quantity from material-received table
    const { data: receivedData, error: receivedError } = await supabase
      .from("pfms_material-received")
      .select("receivedQty")
      .eq("liftNo", liftNo)
      .maybeSingle();

    if (receivedError) throw receivedError;
    const receivedQty = receivedData?.receivedQty || 0;

    // 3. Compute new quantities
    const oldApproved = currentTesting.approvedQty || 0;
    const oldRejected = currentTesting.rejectedQty || 0;

    const newApproved = oldApproved + (parseFloat(approvedQty) || 0);
    const newRejected = oldRejected + (parseFloat(rejectedQty) || 0);
    const newPending = Math.max(0, receivedQty - (newApproved + newRejected));

    // 4. Append to lists
    const newChecklist = Array.from(new Set([...(currentTesting.checklist || []), ...(checklistSelected || [])]));
    const newSerialNumbers = [...(currentTesting.serialNumbers || []), ...(serialNumbers || [])];
    const newImages = [...(currentTesting.images || []), ...(images || [])];

    const now = getLocalTimestamp();

    // 5. Determine planned purchase returns if pending becomes 0 and there are rejected quantities
    let plannedPurchaseReturns = currentTesting.plannedPurchaseReturns;
    if (newPending === 0 && newRejected > 0) {
      plannedPurchaseReturns = await calculatePlannedTime("purchase-return");
    }

    // 6. Update the testing record
    const { error: updateError } = await supabase
      .from("pfms_material-testing")
      .update({
        timestamp: now,
        qcBy: qcBy || currentTesting.qcBy,
        qcDate: qcDate ? getLocalTimestamp(qcDate) : (currentTesting.qcDate || now),
        workingCondition: workingCondition || currentTesting.workingCondition,
        remarks: remarks || currentTesting.remarks,
        pendingQty: newPending,
        approvedQty: newApproved,
        rejectedQty: newRejected,
        checklist: newChecklist,
        serialNumbers: newSerialNumbers,
        images: newImages,
        rejectType: rejectType || currentTesting.rejectType,
        partName: partName || currentTesting.partName,
        plannedPurchaseReturns,
        updatedAt: now,
      })
      .eq("liftNo", liftNo);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in material-testing POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Submission failed" }, { status: 500 });
  }
}
