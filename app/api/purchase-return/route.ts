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
    // 1. Fetch material-testing entries that have rejections (plannedPurchaseReturns is not null)
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
            receivedQty
          )
        )
      `)
      .not("plannedPurchaseReturns", "is", null) as any;

    if (testingError) throw testingError;

    // 2. Fetch all completed purchase-returns
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
        )
      `) as any;

    if (returnsError) throw returnsError;

    const returnMap = new Map((returns || []).map((r: any) => [r.liftNo, r]));
    const pending = [];
    const history = [];

    // Map pending list: testings that do not have a completed return
    for (const testing of (testings || [])) {
      if (returnMap.has(testing.liftNo)) continue;

      const lift = testing.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const poEntry = Array.isArray(indent.poEntry) ? (indent.poEntry[0] || {}) : (indent.poEntry || {});
      const matRecd = Array.isArray(lift.materialReceived) ? (lift.materialReceived[0] || {}) : (lift.materialReceived || {});

      pending.push({
        id: lift.liftNo,
        rowIndex: lift.liftNo,
        status: "pending",
        data: {
          indentNumber: indent.indentNo || "",
          unitTrackingNo: lift.liftNo || "",
          itemName: indent.itemName || "-",
          rejectedQty: testing.rejectedQty || 0,
          rejectQty: testing.rejectedQty || 0,
          vendor: negotiation.selectedVendorName || "-",
          invoiceNumber: matRecd.invoiceNumber || "-",
          remark: testing.remarks || "-",
          partName: testing.partName || "-",
          serialNo: (testing.serialNumbers || []).join(", "),
          serialNoWithPhoto: (testing.serialNumbers || []).join(", "),
          serialPhoto: (testing.images || []).join(","),
          images: (testing.images || []).join(","),
          plan6: testing.plannedPurchaseReturns || "",
        }
      });
    }

    // Map history list: returns from the purchase-return table
    for (const ret of (returns || [])) {
      const lift = ret.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const poEntry = Array.isArray(indent.poEntry) ? (indent.poEntry[0] || {}) : (indent.poEntry || {});
      const matRecd = Array.isArray(lift.materialReceived) ? (lift.materialReceived[0] || {}) : (lift.materialReceived || {});

      // Fetch the plan date from material-testing if exists
      const { data: mtData } = await supabase
        .from("pfms_material-testing")
        .select("plannedPurchaseReturns, remarks, partName, serialNumbers, images")
        .eq("liftNo", lift.liftNo)
        .maybeSingle();

      history.push({
        id: lift.liftNo,
        rowIndex: lift.liftNo,
        status: "completed",
        data: {
          indentNumber: indent.indentNo || "",
          unitTrackingNo: lift.liftNo || "",
          itemName: indent.itemName || "-",
          vendor: negotiation.selectedVendorName || "-",
          invoiceNumber: matRecd.invoiceNumber || "-",
          remark: mtData?.remarks || "-",
          partName: mtData?.partName || "-",
          serialNo: (mtData?.serialNumbers || []).join(", "),
          serialNoWithPhoto: (mtData?.serialNumbers || []).join(", "),
          serialPhoto: (mtData?.images || []).join(","),
          images: (mtData?.images || []).join(","),
          plan6: mtData?.plannedPurchaseReturns || "",
          actual6: ret.timestamp || "",
          returnedQty: ret.returnedQty || 0,
          returnAmount: ret.returnAmount || 0,
          returnReason: ret.returnReason || "-",
          returnStatus: ret.returnStatus || "-",
          returnItemImage: ret.returnItemImage || "",
          creditNoteImage: ret.creditNoteImage || "",
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
      actualDate
    } = body;

    if (!liftNo) {
      return NextResponse.json({ success: false, error: "Missing liftNo" }, { status: 400 });
    }

    const now = getLocalTimestamp();
    const actDate = actualDate ? getLocalTimestamp(actualDate) : now;

    // Calculate planned time for return-approval
    const plannedReturnApproval = await calculatePlannedTime("return-approval");

    // Insert purchase-return record
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
