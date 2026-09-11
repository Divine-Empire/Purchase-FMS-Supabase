import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabase } from "@/utils/supabase/server";
import { calculatePlannedTime, getLocalTimestamp } from "@/app/api/helper/plannedCalculator";

export async function GET() {
  try {
    // Fetch all records from material-testing
    const { data: testings, error: testingError } = await supabase
      .from("pfms_material-testing")
      .select(`
        *,
        lift:pfms_lift!inner (
          liftNo,
          indent:pfms_indent_generation!inner (
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
        rejectedRepairQty: testing.rejectedRepairQty || 0,
        rejectedReturnQty: testing.rejectedReturnQty || 0,
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
        purchaser: indent.purchaser || null,
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
    const oldRejectedRepairQty = currentTesting.rejectedRepairQty || 0;
    const oldRejectedReturnQty = currentTesting.rejectedReturnQty || 0;

    const roundRejectedQty = parseFloat(rejectedQty) || 0;
    const newApproved = oldApproved + (parseFloat(approvedQty) || 0);
    const newRejected = oldRejected + roundRejectedQty;
    const newPending = Math.max(0, receivedQty - (newApproved + newRejected));

    // Split this round's rejected qty by reject type, so a lift that gets rejected across
    // multiple QC rounds with different reject types (e.g. one round "Repair", another
    // "Return") still tracks each bucket's running total correctly.
    const isRepairReject = roundRejectedQty > 0 && (rejectType || "").trim() === "Repair";
    const newRejectedRepairQty = oldRejectedRepairQty + (isRepairReject ? roundRejectedQty : 0);
    const newRejectedReturnQty = oldRejectedReturnQty + (!isRepairReject ? roundRejectedQty : 0);

    // 4. Append to lists
    const newChecklist = Array.from(new Set([...(currentTesting.checklist || []), ...(checklistSelected || [])]));
    const newSerialNumbers = [...(currentTesting.serialNumbers || []), ...(serialNumbers || [])];
    const newImages = [...(currentTesting.images || []), ...(images || [])];

    const now = getLocalTimestamp();

    // 5. Determine planned purchase returns — only for the "Exchange/Return" bucket, and only
    // once testing is fully resolved for this lift. "Repair" rejects go to Repair Process
    // instead (handled via the pfms_lift_qc_resolution ledger below), not straight to Purchase Return.
    let plannedPurchaseReturns = currentTesting.plannedPurchaseReturns;
    if (newPending === 0 && newRejectedReturnQty > 0) {
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
        rejectedRepairQty: newRejectedRepairQty,
        rejectedReturnQty: newRejectedReturnQty,
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

    // 7. Sync the qty-resolution ledger (only exists for lifts where QC was required).
    // Serial Generation / Receipt in Tally read this ledger to decide when the lift is
    // fully resolved and ready to be released.
    const { data: ledgerRow } = await supabase
      .from("pfms_lift_qc_resolution")
      .select("*")
      .eq("liftNo", liftNo)
      .maybeSingle();

    if (ledgerRow) {
      const ledgerUpdate: any = {
        pendingQcQty: newPending,
        passedQty: newApproved,
        updatedAt: now,
      };

      if (newPending === 0) {
        // Testing is fully done for this lift — hand off whatever repair-bound qty remains
        // unresolved (accounting for any repair progress already made, if this fires again).
        const outstandingRepairQty = Math.max(
          0,
          newRejectedRepairQty - (ledgerRow.repairedQty || 0) - (ledgerRow.repairFailedQty || 0)
        );
        ledgerUpdate.repairPendingQty = outstandingRepairQty;

        const fullyResolved = outstandingRepairQty === 0;
        ledgerUpdate.isFullyResolved = fullyResolved;
        if (fullyResolved && !ledgerRow.releasedAt) {
          ledgerUpdate.releasedAt = now;
        }

        // If some qty needs repair, create the Repair Process record for this lift
        // (only once — subsequent testing rounds, if any, won't re-create it).
        if (outstandingRepairQty > 0) {
          const { data: existingRepair } = await supabase
            .from("pfms_repair_process")
            .select("id")
            .eq("liftNo", liftNo)
            .maybeSingle();

          if (!existingRepair) {
            const { error: repairInsertError } = await supabase
              .from("pfms_repair_process")
              .insert({
                id: randomUUID(),
                timestamp: now,
                liftNo: liftNo,
                repairedQty: 0,
                failedQty: 0,
                createdAt: now,
                updatedAt: now,
              });
            if (repairInsertError) throw repairInsertError;
          }
        }
      }

      const { error: ledgerUpdateError } = await supabase
        .from("pfms_lift_qc_resolution")
        .update(ledgerUpdate)
        .eq("liftNo", liftNo);
      if (ledgerUpdateError) throw ledgerUpdateError;
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in material-testing POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Submission failed" }, { status: 500 });
  }
}
