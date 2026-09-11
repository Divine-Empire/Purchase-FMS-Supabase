import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { calculatePlannedTime, getLocalTimestamp } from "@/app/api/helper/plannedCalculator";

/**
 * Repair Process stage — picks up the portion of Material Testing's rejected qty where
 * rejectType === "Repair" (Exchange/Return rejects skip this stage and go straight to
 * Purchase Return, unchanged). A pfms_repair_process row only exists for a lift once
 * Material Testing has fully resolved AND some qty was routed to repair
 * (see pfms_lift_qc_resolution.repairPendingQty, synced from app/api/material-testing).
 *
 * Multi-round, same pattern as Material Testing: each POST adds to running
 * repairedQty/failedQty totals until the ledger's repairPendingQty hits 0. At that point:
 * - repairedQty is added to the lift's readyForNextQty (released to Serial Generation /
 *   Receipt in Tally via pfms_lift_qc_resolution.isFullyResolved + releasedAt)
 * - failedQty (still unrepairable) is routed to Purchase Return (plannedPurchaseReturns
 *   set on this row; Purchase Return reads it with source = "Repair Failed")
 */

export async function GET() {
  try {
    const { data: repairRows, error: repairError } = await supabase
      .from("pfms_repair_process")
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
            negotiation:pfms_negotiation ( selectedVendorName ),
            poEntry:"pfms_po-entry" ( poNumber )
          ),
          materialReceived:"pfms_material-received" ( invoiceNumber, invoiceDate, receivedQty )
        )
      `) as any;

    if (repairError) throw repairError;

    // Ledger rows keyed by liftNo — authoritative source for pending/repaired/failed qty
    const { data: ledgerRows, error: ledgerError } = await supabase
      .from("pfms_lift_qc_resolution")
      .select("liftNo, repairPendingQty, repairedQty, repairFailedQty, isFullyResolved");
    if (ledgerError) throw ledgerError;
    const ledgerMap = new Map((ledgerRows || []).map((l: any) => [l.liftNo, l]));

    // Material-testing context (partName, remarks, serialNumbers, images from the QC round
    // that routed this lift to repair) keyed by liftNo
    const { data: testingRows, error: testingError } = await supabase
      .from("pfms_material-testing")
      .select("liftNo, partName, remarks, serialNumbers, images, rejectedRepairQty");
    if (testingError) throw testingError;
    const testingMap = new Map((testingRows || []).map((t: any) => [t.liftNo, t]));

    const pending: any[] = [];
    const history: any[] = [];

    for (const repair of (repairRows || [])) {
      const lift = repair.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const poEntry = Array.isArray(indent.poEntry) ? (indent.poEntry[0] || {}) : (indent.poEntry || {});
      const matRecd = Array.isArray(lift.materialReceived) ? (lift.materialReceived[0] || {}) : (lift.materialReceived || {});
      const ledger: any = ledgerMap.get(lift.liftNo) || {};
      const testing: any = testingMap.get(lift.liftNo) || {};

      const repairPendingQty = ledger.repairPendingQty ?? 0;
      const totalRepairQty = testing.rejectedRepairQty || 0;

      const itemData = {
        indentNumber: indent.indentNo || "",
        liftNo: lift.liftNo || "",
        category: indent.category || "-",
        itemName: indent.itemName || "-",
        warehouse: indent.warehouseLocation || "-",
        vendorName: negotiation.selectedVendorName || "-",
        poNumber: poEntry.poNumber || "-",
        invoiceNumber: matRecd.invoiceNumber || "-",
        invoiceDate: matRecd.invoiceDate || "-",
        totalRepairQty,
        pendingQty: repairPendingQty,
        repairedQty: repair.repairedQty || 0,
        failedQty: repair.failedQty || 0,
        repairDate: repair.repairDate || "",
        repairBy: repair.repairBy || "",
        remarks: repair.remarks || "-",
        partName: testing.partName || "-",
        serialNo: (testing.serialNumbers || []).join(", "),
        images: (repair.images || []).join(","),
        purchaser: indent.purchaser || null,
      };

      const mappedRecord = {
        id: lift.liftNo,
        rowIndex: lift.liftNo,
        status: repairPendingQty > 0 ? "pending" : "completed",
        data: itemData,
      };

      if (repairPendingQty > 0) {
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
    console.error("Error in repair-process GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { liftNo, repairDate, repairBy, repairedQty, failedQty, remarks, images } = body;

    if (!liftNo) {
      return NextResponse.json({ success: false, error: "Missing liftNo" }, { status: 400 });
    }

    // 1. Fetch current repair-process record
    const { data: currentRepair, error: fetchError } = await supabase
      .from("pfms_repair_process")
      .select("*")
      .eq("liftNo", liftNo)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!currentRepair) {
      return NextResponse.json({ success: false, error: `Repair record not found for lift ${liftNo}` }, { status: 404 });
    }

    // 2. Fetch current ledger record (authoritative for outstanding repair qty)
    const { data: ledgerRow, error: ledgerFetchError } = await supabase
      .from("pfms_lift_qc_resolution")
      .select("*")
      .eq("liftNo", liftNo)
      .maybeSingle();

    if (ledgerFetchError) throw ledgerFetchError;
    if (!ledgerRow) {
      return NextResponse.json({ success: false, error: `Qty-resolution ledger not found for lift ${liftNo}` }, { status: 404 });
    }

    // 3. Compute new quantities (multi-round, same accumulation pattern as Material Testing)
    const oldRepaired = currentRepair.repairedQty || 0;
    const oldFailed = currentRepair.failedQty || 0;
    const roundRepaired = parseFloat(repairedQty) || 0;
    const roundFailed = parseFloat(failedQty) || 0;

    const newRepaired = oldRepaired + roundRepaired;
    const newFailed = oldFailed + roundFailed;
    const newRepairPendingQty = Math.max(0, (ledgerRow.repairPendingQty || 0) - (roundRepaired + roundFailed));

    const now = getLocalTimestamp();
    const newImages = [...(currentRepair.images || []), ...(images || [])];

    // 4. Determine planned purchase returns — only once repair is fully resolved for this
    // lift AND some qty turned out unrepairable.
    let plannedPurchaseReturns = currentRepair.plannedPurchaseReturns;
    if (newRepairPendingQty === 0 && newFailed > 0) {
      plannedPurchaseReturns = await calculatePlannedTime("purchase-return");
    }

    // 5. Update the repair-process record
    const { error: updateError } = await supabase
      .from("pfms_repair_process")
      .update({
        timestamp: now,
        repairDate: repairDate ? getLocalTimestamp(repairDate) : (currentRepair.repairDate || now),
        repairBy: repairBy || currentRepair.repairBy,
        repairedQty: newRepaired,
        failedQty: newFailed,
        remarks: remarks || currentRepair.remarks,
        images: newImages,
        plannedPurchaseReturns,
        updatedAt: now,
      })
      .eq("liftNo", liftNo);

    if (updateError) throw updateError;

    // 6. Sync the qty-resolution ledger. Once repairPendingQty hits 0, the lift is fully
    // resolved and Serial Generation / Receipt in Tally can pick it up (readyForNextQty =
    // passedQty + repairedQty).
    const fullyResolved = newRepairPendingQty === 0;
    const ledgerUpdate: any = {
      repairPendingQty: newRepairPendingQty,
      repairedQty: newRepaired,
      repairFailedQty: newFailed,
      isFullyResolved: fullyResolved,
      updatedAt: now,
    };
    if (fullyResolved && !ledgerRow.releasedAt) {
      ledgerUpdate.releasedAt = now;
    }

    const { error: ledgerUpdateError } = await supabase
      .from("pfms_lift_qc_resolution")
      .update(ledgerUpdate)
      .eq("liftNo", liftNo);
    if (ledgerUpdateError) throw ledgerUpdateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in repair-process POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Submission failed" }, { status: 500 });
  }
}
