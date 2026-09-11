import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { calculatePlannedTime, getLocalTimestamp } from "@/app/api/helper/plannedCalculator";

// Looks up each item's purchaser from the catalog (pfms_item_master.purchaser) so it
// can be copied onto the indent row at creation time. Falls back to null when the
// item isn't in the catalog yet, or its purchaser hasn't been set there.
async function getPurchaserMap(itemNames: string[]): Promise<Record<string, string | null>> {
  const uniqueNames = Array.from(new Set(itemNames.filter(Boolean)));
  const map: Record<string, string | null> = {};
  if (uniqueNames.length === 0) return map;

  const { data, error } = await supabase
    .from("pfms_item_master")
    .select('"ITEM NAME", purchaser')
    .in("ITEM NAME", uniqueNames);

  if (error) {
    console.error("Error fetching purchaser map:", error);
    return map;
  }

  for (const row of data || []) {
    const name = (row as any)["ITEM NAME"]?.trim();
    if (name && !(name in map)) {
      map[name] = (row as any).purchaser?.trim() || null;
    }
  }
  return map;
}

export async function GET() {
  try {
    // Fetch all indents and join with indent-approval (1-to-1 relation)
    const { data: indents, error } = await supabase
      .from("pfms_indent_generation")
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
            attachment: hasApproval && approvalData.imgOptional ? approvalData.imgOptional : (row.attachment || ""),
            purchaser: row.purchaser || null
          }
        };
      })
      .filter((row: any) => {
        if (row.data.indentNumber?.startsWith("IN-DIR-") || row.data.category === "Direct") {
          return false;
        }
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

      // 2. Calculate planned time for indent-approval
      const plannedIndentApproval = await calculatePlannedTime("indent-approval");
      const now = getLocalTimestamp();

      // 2b. Look up each item's purchaser from the catalog (one indent-creation batch
      // can contain multiple items with different purchasers, e.g. IN-123A/B/C).
      const purchaserMap = await getPurchaserMap(items.map((item: any) => item.itemName));

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
        plannedIndentApproval,
        purchaser: purchaserMap[item.itemName?.trim()] ?? null
      }));

      const { error: insertError } = await supabase
        .from("pfms_indent_generation")
        .insert(rowsToInsert);

      if (insertError) throw insertError;

      return NextResponse.json({ success: true, generatedIds });
    }

    // --- CASE 2: UPDATE INDENT ---
    if (action === "updateIndent") {
      const { id, createdBy, warehouseLocation, leadTime, category, itemName, quantity, uom, itemCode, attachment } = body;

      // Re-resolve the purchaser in case the item was changed during edit.
      const purchaserMap = await getPurchaserMap([itemName]);

      const { error: updateError } = await supabase
        .from("pfms_indent_generation")
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
          purchaser: purchaserMap[itemName?.trim()] ?? null,
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
        .from("pfms_item_master")
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
