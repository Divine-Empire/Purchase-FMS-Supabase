import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { calculatePlannedTime } from "@/app/api/helper/plannedCalculator";

function getLocalTimestamp(dateInput?: Date | string | number | null): string {
  const date = dateInput ? new Date(dateInput) : new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().replace("Z", "");
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = (searchParams.get("status") || searchParams.get("statusFilter") || "all").toLowerCase();

    // Fetch all indents and join with indent-approval
    const { data: indents, error } = await supabase
      .from("pfms_indent-generation")
      .select("*, approval:pfms_indent-approval(*)")
      .order("timestamp", { ascending: false });

    if (error) throw error;

    // Fetch cancellations
    const { data: cancelledList } = await supabase
      .from("pfms_order-cancellation")
      .select("indentNo");
    const cancelledNos = new Set((cancelledList || []).map((c: any) => c.indentNo));

    const mappedData = indents
      .map((row: any) => {
        const approvalArray = row.approval;
        const hasApproval = Array.isArray(approvalArray) ? approvalArray.length > 0 : !!approvalArray;
        const approvalData = hasApproval ? (Array.isArray(approvalArray) ? approvalArray[0] : approvalArray) : {};

        const status = hasApproval ? "completed" : "pending";

        return {
          id: `${row.indentNo}-${row.id}`,
          dbId: row.id,
          rowIndex: null, // Not needed for Supabase
          stage: 2,
          status: status,
          createdAt: row.timestamp,
          history: [],
          data: {
            indentNumber: row.indentNo,
            timestamp: row.timestamp,
            createdBy: row.createdBy,
            category: row.category,
            itemName: row.itemName,
            quantity: row.quantity, // Original requested quantity
            warehouseLocation: row.warehouseLocation,
            itemCode: row.itemCode,
            leadTime: row.leadTime,
            plannedDate: row.plannedIndentApproval, // plannedIndentApproval from generation
            actualDate: hasApproval ? approvalData.timestamp : null, // timestamp from approval
            delay: null, // Delay can be calculated dynamically or left null
            status: hasApproval ? (approvalData.status || "approved") : "pending",
            approvedQty: hasApproval ? approvalData.approvedQty : null,
            vendorType: hasApproval ? approvalData.vendorType : null,
            remarks: hasApproval ? approvalData.remarks : null,
            attachment: hasApproval ? approvalData.imgOptional : null
          }
        };
      })
      .filter((row: any) => {
        if (row.status === "pending" && cancelledNos.has(row.data.indentNumber)) {
          return false;
        }
        if (row.status === "completed" && statusFilter !== "all") {
          return row.data.status?.toLowerCase() === statusFilter;
        }
        return true;
      });

    return NextResponse.json({ success: true, data: mappedData });
  } catch (error: any) {
    console.error("Error fetching approvals:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "insertApproval") {
      const { recordsToSubmit, approvalData } = body;

      if (!recordsToSubmit || recordsToSubmit.length === 0) {
        return NextResponse.json({ success: false, error: "No records selected" }, { status: 400 });
      }

      // 1. Calculate planned time for update-3-vendors
      const now = getLocalTimestamp();
      const plannedUpdateVendors = await calculatePlannedTime("update-3-vendors");

      // 2. Prepare approval rows
      const approvalsToInsert = recordsToSubmit.map((record: any) => {
        const itemLineData = approvalData.lineData?.[record.id] || {};
        const finalStatus = itemLineData.status || approvalData.status || "approved";
        const finalQty = itemLineData.approvedQty !== undefined && itemLineData.approvedQty !== ""
          ? parseFloat(itemLineData.approvedQty) 
          : parseFloat(record.data.quantity);
        const finalVendorType = itemLineData.vendorType || approvalData.vendorType || "regular";

        return {
          id: randomUUID(),
          indentNo: record.data.indentNumber,
          status: finalStatus,
          approvedQty: finalQty,
          vendorType: finalVendorType,
          remarks: approvalData.remarks || null,
          imgOptional: approvalData.attachment || null,
          approvedBy: approvalData.approvedBy || "System",
          plannedUpdateVendors,
          timestamp: now,
          createdAt: now,
          updatedAt: now
        };
      });

      const { error: insertError } = await supabase
        .from("pfms_indent-approval")
        .insert(approvalsToInsert);

      if (insertError) throw insertError;

      // 3. Optional: Update status in indent-generation to approved/rejected if needed
      // (This is not strictly required since GET filters based on approval table presence,
      // but is good metadata consistency practice).
      for (const record of recordsToSubmit) {
        const itemLineData = approvalData.lineData?.[record.id] || {};
        const finalStatus = itemLineData.status || approvalData.status || "approved";

        await supabase
          .from("pfms_indent-generation")
          .update({
            status: finalStatus,
            updatedAt: now
          })
          .eq("indentNo", record.data.indentNumber);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in indent-approval API:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
