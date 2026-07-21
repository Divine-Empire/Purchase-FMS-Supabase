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
    // 1. Fetch all records from purchase-return table
    const { data: returns, error: returnsError } = await supabase
      .from("pfms_purchase-return")
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
          indent:pfms_indent-generation!inner (
            indentNo,
            itemName,
            category,
            warehouseLocation,
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

    const approvalMap = new Map((approvals || []).map((a: any) => [a.liftNo, a]));
    const pending = [];
    const history = [];

    // Map pending list: returns that do not have an approval record
    for (const ret of (returns || [])) {
      if (approvalMap.has(ret.liftNo)) continue;

      const lift = ret.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const matRecd = Array.isArray(lift.materialReceived) ? (lift.materialReceived[0] || {}) : (lift.materialReceived || {});

      pending.push({
        id: lift.liftNo,
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
        }
      });
    }

    // Map history list: approvals from the return-approval table
    const returnMap = new Map((returns || []).map((r: any) => [r.liftNo, r]));
    for (const app of (approvals || [])) {
      const lift = app.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const matRecd = Array.isArray(lift.materialReceived) ? (lift.materialReceived[0] || {}) : (lift.materialReceived || {});
      const ret = returnMap.get(lift.liftNo) as any;

      let delayDays = "-";
      if (app.approvalDate && ret?.plannedReturnApproval) {
        const diff = new Date(app.approvalDate).getTime() - new Date(ret.plannedReturnApproval).getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        delayDays = days > 0 ? String(days) : "0";
      }

      history.push({
        id: lift.liftNo,
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
    const { liftNo, liftNos, dnNumber, remarks, returnImage, approvalDate } = body;

    const targetLiftNos = Array.isArray(liftNos) ? liftNos : (liftNo ? [liftNo] : []);
    if (targetLiftNos.length === 0) {
      return NextResponse.json({ success: false, error: "Missing liftNo or liftNos" }, { status: 400 });
    }

    if (!dnNumber) {
      return NextResponse.json({ success: false, error: "Missing dnNumber" }, { status: 400 });
    }

    const now = getLocalTimestamp();
    const appDate = approvalDate ? getLocalTimestamp(approvalDate) : now;

    // Build insert objects
    const insertData = targetLiftNos.map((lNo: string) => ({
      id: randomUUID(),
      timestamp: now,
      liftNo: lNo,
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
