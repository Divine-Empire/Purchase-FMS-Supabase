import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { calculatePlannedTime, getLocalTimestamp } from "@/app/api/helper/plannedCalculator";

// Fields shared by both pending-return sources (Material Testing direct reject / Repair Process failure)
const LIFT_CONTEXT_SELECT = `
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
    receivedQty
  )
`;

export async function GET() {
  try {
    // 1a. Fetch material-testing entries that have direct (Exchange/Return) rejections
    const { data: testings, error: testingError } = await supabase
      .from("pfms_material-testing")
      .select(`*, lift:pfms_lift!inner ( ${LIFT_CONTEXT_SELECT} )`)
      .not("plannedPurchaseReturns", "is", null) as any;

    if (testingError) throw testingError;

    // 1b. Fetch repair-process entries where some qty was unrepairable
    const { data: repairs, error: repairError } = await supabase
      .from("pfms_repair_process")
      .select(`*, lift:pfms_lift!inner ( ${LIFT_CONTEXT_SELECT} )`)
      .not("plannedPurchaseReturns", "is", null) as any;

    if (repairError) throw repairError;

    // 2. Fetch all completed purchase-returns
    const { data: returns, error: returnsError } = await supabase
      .from("pfms_purchase-return")
      .select(`*, lift:pfms_lift!inner ( ${LIFT_CONTEXT_SELECT} )`) as any;

    if (returnsError) throw returnsError;

    // A return "batch" is identified by its source row id (sourceId), not just liftNo —
    // the same lift can independently send a Direct QC Reject batch and, later, a Repair
    // Failed batch, each needing its own return processing.
    const processedSourceIds = new Set((returns || []).map((r: any) => r.sourceId).filter(Boolean));
    const pending = [];
    const history = [];

    const buildPendingRow = (source: any, sourceType: "Direct QC Reject" | "Repair Failed", rejectedQty: number) => {
      const lift = source.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const matRecd = Array.isArray(lift.materialReceived) ? (lift.materialReceived[0] || {}) : (lift.materialReceived || {});

      return {
        id: source.id,
        rowIndex: lift.liftNo,
        status: "pending",
        data: {
          indentNumber: indent.indentNo || "",
          unitTrackingNo: lift.liftNo || "",
          itemName: indent.itemName || "-",
          rejectedQty: rejectedQty || 0,
          rejectQty: rejectedQty || 0,
          vendor: negotiation.selectedVendorName || "-",
          invoiceNumber: matRecd.invoiceNumber || "-",
          remark: source.remarks || "-",
          partName: source.partName || "-",
          serialNo: (source.serialNumbers || []).join(", "),
          serialNoWithPhoto: (source.serialNumbers || []).join(", "),
          serialPhoto: (source.images || []).join(","),
          images: (source.images || []).join(","),
          plan6: source.plannedPurchaseReturns || "",
          purchaser: indent.purchaser || null,
          source: sourceType,
          sourceId: source.id,
        }
      };
    };

    // Pending: direct QC rejects (Exchange/Return) not yet returned
    for (const testing of (testings || [])) {
      if ((testing.rejectedReturnQty || 0) <= 0) continue;
      if (processedSourceIds.has(testing.id)) continue;
      pending.push(buildPendingRow(testing, "Direct QC Reject", testing.rejectedReturnQty));
    }

    // Pending: repair-failed (unrepairable) qty not yet returned
    for (const repair of (repairs || [])) {
      if ((repair.failedQty || 0) <= 0) continue;
      if (processedSourceIds.has(repair.id)) continue;
      pending.push(buildPendingRow(repair, "Repair Failed", repair.failedQty));
    }

    // Map history list: returns from the purchase-return table
    for (const ret of (returns || [])) {
      const lift = ret.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const matRecd = Array.isArray(lift.materialReceived) ? (lift.materialReceived[0] || {}) : (lift.materialReceived || {});

      // Pull display context (remarks/partName/serials/images/plan date) from whichever
      // source row triggered this return. Older returns predating this feature have no
      // `source`/`sourceId` — fall back to the lift's material-testing row for those.
      let sourceCtx: any = null;
      if (ret.source === "Repair Failed") {
        const { data } = await supabase
          .from("pfms_repair_process")
          .select("plannedPurchaseReturns, remarks, images")
          .eq(ret.sourceId ? "id" : "liftNo", ret.sourceId || lift.liftNo)
          .maybeSingle();
        sourceCtx = data;
      } else {
        const { data } = await supabase
          .from("pfms_material-testing")
          .select("plannedPurchaseReturns, remarks, partName, serialNumbers, images")
          .eq(ret.sourceId ? "id" : "liftNo", ret.sourceId || lift.liftNo)
          .maybeSingle();
        sourceCtx = data;
      }

      history.push({
        id: ret.id,
        rowIndex: lift.liftNo,
        status: "completed",
        data: {
          indentNumber: indent.indentNo || "",
          unitTrackingNo: lift.liftNo || "",
          itemName: indent.itemName || "-",
          vendor: negotiation.selectedVendorName || "-",
          invoiceNumber: matRecd.invoiceNumber || "-",
          remark: sourceCtx?.remarks || "-",
          partName: sourceCtx?.partName || "-",
          serialNo: (sourceCtx?.serialNumbers || []).join(", "),
          serialNoWithPhoto: (sourceCtx?.serialNumbers || []).join(", "),
          serialPhoto: (sourceCtx?.images || []).join(","),
          images: (sourceCtx?.images || []).join(","),
          plan6: sourceCtx?.plannedPurchaseReturns || "",
          actual6: ret.timestamp || "",
          returnedQty: ret.returnedQty || 0,
          returnAmount: ret.returnAmount || 0,
          returnReason: ret.returnReason || "-",
          returnStatus: ret.returnStatus || "-",
          returnItemImage: ret.returnItemImage || "",
          creditNoteImage: ret.creditNoteImage || "",
          purchaser: indent.purchaser || null,
          source: ret.source || "Direct QC Reject",
        }
      });
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
    console.error("Error in purchase-return GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      liftNo,
      returnedQty,
      returnRate,
      returnAmount,
      returnReason,
      returnStatus,
      returnItemImage,
      creditNoteImage,
      actualDate,
      source,
      sourceId
    } = body;

    if (!liftNo) {
      return NextResponse.json({ success: false, error: "Missing liftNo" }, { status: 400 });
    }

    const now = getLocalTimestamp();
    const actDate = actualDate ? getLocalTimestamp(actualDate) : now;

    // Calculate planned time for return-approval
    const plannedReturnApproval = await calculatePlannedTime("return-approval");

    // Insert purchase-return record. `source`/`sourceId` identify which batch this is
    // (a lift can have an independent "Direct QC Reject" batch and, later, a separate
    // "Repair Failed" batch — each needs its own return record).
    const { error: insertError } = await supabase
      .from("pfms_purchase-return")
      .insert({
        id: randomUUID(),
        timestamp: actDate,
        liftNo: liftNo,
        returnedQty: parseFloat(returnedQty) || 0,
        returnRate: parseFloat(returnRate) || null,
        returnAmount: parseFloat(returnAmount) || null,
        returnReason: returnReason || null,
        returnStatus: returnStatus,
        returnItemImage: returnItemImage || null,
        creditNoteImage: creditNoteImage || null,
        plannedReturnApproval: plannedReturnApproval,
        source: source || "Direct QC Reject",
        sourceId: sourceId || null,
        createdAt: now,
        updatedAt: now
      });

    if (insertError) throw insertError;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in purchase-return POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Submission failed" }, { status: 500 });
  }
}
