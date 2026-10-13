import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { getLocalTimestamp } from "@/app/api/helper/plannedCalculator";

export async function GET() {
  try {
    // 1. Fetch all records from purchase-return table
    const { data: returns, error: returnsError } = await supabase
      .from("pfms_purchase-return")
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
            )
          ),
          materialReceived:"pfms_material-received" (
            invoiceNumber
          )
        )
      `) as any;

    if (returnsError) throw returnsError;

    // 2. Fetch all records from return-approval table
    const { data: approvals, error: approvalsError } = await supabase
      .from("pfms_return-approval")
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
            )
          ),
          materialReceived:"pfms_material-received" (
            invoiceNumber
          )
        )
      `) as any;

    if (approvalsError) throw approvalsError;

    // An approval belongs to one specific return (returnId) — matching by liftNo
    // alone made a second return batch on the same lift look already approved.
    // Approvals saved before returnId existed (returnId null) still match by liftNo.
    const approvedReturnIds = new Set((approvals || []).map((a: any) => a.returnId).filter(Boolean));
    const legacyApprovedLifts = new Set((approvals || []).filter((a: any) => !a.returnId).map((a: any) => a.liftNo));
    const pending = [];
    const history = [];

    // Map pending list: returns that do not have an approval record
    for (const ret of (returns || [])) {
      if (approvedReturnIds.has(ret.id) || legacyApprovedLifts.has(ret.liftNo)) continue;

      const lift = ret.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const matRecd = Array.isArray(lift.materialReceived) ? (lift.materialReceived[0] || {}) : (lift.materialReceived || {});

      pending.push({
        id: ret.id,
        rowIndex: lift.liftNo,
        status: "pending",
        data: {
          indentNumber: indent.indentNo || "",
          liftNumber: lift.liftNo || "",
          itemName: indent.itemName || "-",
          vendorName: negotiation.selectedVendorName || "-",
          invoiceNumber: matRecd.invoiceNumber || "-",
          returnQty: ret.returnedQty || 0,
          returnStatus: ret.returnStatus || "-",
          plannedDate: ret.plannedReturnApproval || "",
          purchaser: indent.purchaser || null,
        }
      });
    }

    // Map history list: approvals from the return-approval table
    const returnById = new Map((returns || []).map((r: any) => [r.id, r]));
    const returnByLift = new Map((returns || []).map((r: any) => [r.liftNo, r]));
    for (const app of (approvals || [])) {
      const lift = app.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const matRecd = Array.isArray(lift.materialReceived) ? (lift.materialReceived[0] || {}) : (lift.materialReceived || {});
      const ret = (app.returnId ? returnById.get(app.returnId) : returnByLift.get(lift.liftNo)) as any;

      let delayDays = "-";
      if (app.approvalDate && ret?.plannedReturnApproval) {
        const diff = new Date(app.approvalDate).getTime() - new Date(ret.plannedReturnApproval).getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        delayDays = days > 0 ? String(days) : "0";
      }

      history.push({
        id: app.id,
        rowIndex: lift.liftNo,
        status: "completed",
        data: {
          indentNumber: indent.indentNo || "",
          liftNumber: lift.liftNo || "",
          itemName: indent.itemName || "-",
          vendorName: negotiation.selectedVendorName || "-",
          invoiceNumber: matRecd.invoiceNumber || "-",
          returnQty: ret?.returnedQty || 0,
          returnStatus: ret?.returnStatus || "-",
          plannedDate: ret?.plannedReturnApproval || "",
          actualDate: app.approvalDate || "",
          delay: delayDays,
          dnNumber: app.dnNumber || "-",
          remarks: app.remarks || "-",
          returnImage: app.returnImage || "",
          purchaser: indent.purchaser || null,
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
    console.error("Error in return-approval GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { returnId, returnIds, liftNo, liftNos, dnNumber, remarks, returnImage, approvalDate } = body;

    // The approval targets specific purchase-return rows. (liftNo/liftNos is
    // the old shape; it resolves to every not-yet-approved return on that lift.)
    const requestedIds: string[] = Array.isArray(returnIds) ? returnIds : (returnId ? [returnId] : []);
    const requestedLifts: string[] = Array.isArray(liftNos) ? liftNos : (liftNo ? [liftNo] : []);
    if (requestedIds.length === 0 && requestedLifts.length === 0) {
      return NextResponse.json({ success: false, error: "Missing returnId or returnIds" }, { status: 400 });
    }

    if (!dnNumber) {
      return NextResponse.json({ success: false, error: "Missing dnNumber" }, { status: 400 });
    }

    const now = getLocalTimestamp();
    const appDate = approvalDate ? getLocalTimestamp(approvalDate) : now;

    const { data: targetReturns, error: targetError } = requestedIds.length
      ? await supabase.from("pfms_purchase-return").select("id, liftNo").in("id", requestedIds)
      : await supabase.from("pfms_purchase-return").select("id, liftNo").in("liftNo", requestedLifts);
    if (targetError) throw targetError;
    if (!targetReturns || targetReturns.length === 0 || (requestedIds.length > 0 && targetReturns.length !== requestedIds.length)) {
      return NextResponse.json({ success: false, error: "Return not found" }, { status: 404 });
    }

    const { data: alreadyApproved } = await supabase
      .from("pfms_return-approval")
      .select("returnId")
      .in("returnId", targetReturns.map((r: any) => r.id));
    const approvedIds = new Set((alreadyApproved || []).map((a: any) => a.returnId));
    const toApprove = targetReturns.filter((r: any) => !approvedIds.has(r.id));
    if (toApprove.length === 0) {
      return NextResponse.json({ success: false, error: "Already approved" }, { status: 409 });
    }

    // Build insert objects
    const insertData = toApprove.map((r: any) => ({
      id: randomUUID(),
      timestamp: now,
      liftNo: r.liftNo,
      returnId: r.id,
      dnNumber: dnNumber,
      remarks: remarks || null,
      returnImage: returnImage || "",
      approvalDate: appDate,
      createdAt: now,
      updatedAt: now
    }));

    const { error: insertError } = await supabase
      .from("pfms_return-approval")
      .insert(insertData);

    if (insertError) throw insertError;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in return-approval POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Approval failed" }, { status: 500 });
  }
}
