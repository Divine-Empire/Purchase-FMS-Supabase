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
    // Fetch all indents and join with indent-approval (1-to-1 relation)
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
        // Supabase left-joins return arrays of relations, so row.approval is an array
        const approvalArray = row.approval;
        const hasApproval = Array.isArray(approvalArray) ? approvalArray.length > 0 : !!approvalArray;
        const approvalData = hasApproval ? (Array.isArray(approvalArray) ? approvalArray[0] : approvalArray) : {};

        // Determine status: completed if approval exists
        const status = hasApproval ? "completed" : "pending";

        return {
          id: `${row.indentNo}-${row.id}`,
          dbId: row.id,
          rowIndex: null, // Spreadsheet specific - not needed for Supabase
          stage: 1,
          status: status,
          createdAt: row.timestamp,
          history: hasApproval ? [{ stage: 1, date: approvalData.timestamp || row.timestamp, data: {} }] : [],
          data: {
            indentNumber: row.indentNo,
            createdBy: row.createdBy,
            category: row.category,
            warehouseLocation: row.warehouseLocation,
            leadTime: row.leadTime,
            itemName: row.itemName,
            // If approved, use approvedQty from approval, else use requested quantity
            quantity: hasApproval && approvalData.approvedQty !== null ? approvalData.approvedQty : row.quantity,
            itemCode: row.itemCode,
            uom: row.uom || "",
            // If approved, use status from approval, else use generation status
            status: hasApproval ? (approvalData.status || "approved") : "pending",
            remarks: hasApproval && approvalData.remarks ? approvalData.remarks : row.remarks,
            attachment: hasApproval && approvalData.imgOptional ? approvalData.imgOptional : (row.attachment || "")
          }
        };
      })
      .filter((row: any) => {
        // Only exclude if it is pending and is cancelled
        if (row.status === "pending" && cancelledNos.has(row.data.indentNumber)) {
          return false;
        }
        return true;
      });

    return NextResponse.json({ success: true, data: mappedData });
  } catch (error: any) {
    console.error("Error fetching indents:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // --- CASE 1: INSERT INDENT ---
    if (action === "insertIndent") {
      const { createdBy, warehouseLocation, leadTime, attachment, items } = body;

      if (!items || items.length === 0) {
        return NextResponse.json({ success: false, error: "No items provided" }, { status: 400 });
      }

      // 1. Fetch next sequence indent number batch from Supabase sequence procedure
      const { data: generatedIds, error: seqError } = await supabase
        .rpc("pfms_generate_next_indent_no", { batch_size: items.length });

      if (seqError) {
        console.error("Sequence error:", seqError);
        throw new Error("Failed to generate Indent IDs: " + seqError.message);
      }

      // 2. Fetch TAT for indent-approval to calculate planned time
      const { data: tatData } = await supabase
        .from("pfms_tat")
        .select("actionTime")
        .eq("stageName", "indent-approval")
        .single();
      const tatHours = tatData?.actionTime || 2; // Default to 2 hours if not configured

      const plannedIndentApproval = getLocalTimestamp(new Date(Date.now() + tatHours * 60 * 60 * 1000));
      const now = getLocalTimestamp();

      // 3. Prepare generation rows with generated UUIDs and required timestamps
      const rowsToInsert = items.map((item: any, idx: number) => ({
        id: randomUUID(),
        timestamp: now,
        createdAt: now,
        updatedAt: now,
        indentNo: generatedIds[idx],
        createdBy,
        category: item.category,
        itemName: item.itemName,
        quantity: item.quantity,
        warehouseLocation,
        itemCode: item.itemCode || null,
        leadTime: leadTime || null,
        uom: item.uom || null,
        attachment: attachment || null,
        status: "pending",
        plannedIndentApproval
      }));

      const { error: insertError } = await supabase
        .from("pfms_indent-generation")
        .insert(rowsToInsert);

      if (insertError) throw insertError;

      return NextResponse.json({ success: true, generatedIds });
    }

    // --- CASE 2: UPDATE INDENT ---
    if (action === "updateIndent") {
      const { id, createdBy, warehouseLocation, leadTime, category, itemName, quantity, uom, itemCode, attachment } = body;

      const { error: updateError } = await supabase
        .from("pfms_indent-generation")
        .update({
          createdBy,
          warehouseLocation,
          leadTime: leadTime || null,
          category,
          itemName,
          quantity,
          uom: uom || null,
          itemCode: itemCode || null,
          attachment: attachment || null,
          updatedAt: getLocalTimestamp()
        })
        .eq("id", id);

      if (updateError) throw updateError;

      return NextResponse.json({ success: true });
    }

    // --- CASE 3: SAVE NEW ITEMS TO CATALOG ---
    if (action === "saveNewItems") {
      const { items } = body;
      if (!items || items.length === 0) {
        return NextResponse.json({ success: true });
      }

      // Filter properties to match item-master exactly
      const itemsToInsert = items.map((item: any) => ({
        "ITEM CODE": item.itemCode,
        "ITEM CATEGORY": item.category,
        "ITEM NAME": item.itemName
      }));

      const { error: itemError } = await supabase
        .from("pfms_item-master")
        .insert(itemsToInsert);

      if (itemError) {
        console.error("Error inserting catalog items:", itemError);
        // Do not crash the entire process since catalog save is supplementary
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in create-indent API:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
