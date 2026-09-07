import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const searchType = searchParams.get("searchType") || "indent-no";
    const q = searchParams.get("query") || "";

    if (!q.trim()) {
      return NextResponse.json({ success: true, data: [] });
    }

    let queryBuilder = supabase
      .from("pfms_indent-generation")
      .select(`
        *,
        approval:"pfms_indent-approval"(approvedQty),
        update3Vendors:"pfms_update-3-vendors"(id),
        negotiation:pfms_negotiation(id),
        poEntry:"pfms_po-entry"(poNumber),
        lifts:pfms_lift(
          liftNo,
          liftingQty,
          transporterFollowUp:"pfms_transporter-follow-up"(status),
          materialReceived:"pfms_material-received"(id)
        )
      `);

    // Handle search query criteria
    if (searchType === "indent-no") {
      queryBuilder = queryBuilder.ilike("indentNo", `%${q}%`);
    } else if (searchType === "item-name") {
      queryBuilder = queryBuilder.ilike("itemName", `%${q}%`);
    } else if (searchType === "po-number") {
      // Find matching PO entries and search their parent indents
      const { data: poRows, error: poErr } = await supabase
        .from("pfms_po-entry")
        .select("indentNo")
        .ilike("poNumber", `%${q}%`);

      if (poErr) throw poErr;

      const indentNos = (poRows || []).map((p: any) => p.indentNo);
      if (indentNos.length === 0) {
        return NextResponse.json({ success: true, data: [] });
      }
      queryBuilder = queryBuilder.in("indentNo", indentNos);
    }

    const { data: indents, error } = await queryBuilder;
    if (error) throw error;

    // Fetch existing cancellations
    const { data: cancelledRecords } = await supabase
      .from("pfms_order-cancellation")
      .select("indentNo, liftNo");

    const cancelledLiftNos = new Set(
      (cancelledRecords || []).map((c: any) => c.liftNo).filter(Boolean)
    );
    const cancelledIndentNos = new Set(
      (cancelledRecords || []).filter((c: any) => !c.liftNo).map((c: any) => c.indentNo)
    );

    const results: any[] = [];

    for (const row of (indents || [])) {
      const approval = Array.isArray(row.approval) ? row.approval[0] : row.approval;
      const lifts = row.lifts || [];
      const poEntry = Array.isArray(row.poEntry) ? row.poEntry[0] : row.poEntry;
      const update3Vendors = Array.isArray(row.update3Vendors) ? row.update3Vendors[0] : row.update3Vendors;
      const negotiation = Array.isArray(row.negotiation) ? row.negotiation[0] : row.negotiation;

      const approvedQty = approval && approval.approvedQty !== null ? approval.approvedQty : row.quantity;

      // 1. Add individual un-received, un-cancelled lift entries
      for (const l of lifts) {
        if (cancelledLiftNos.has(l.liftNo)) {
          continue;
        }

        const tfuArray = l.transporterFollowUp;
        const tfu = Array.isArray(tfuArray) ? tfuArray[0] : tfuArray;
        const isReceived = (tfu && tfu.status === "received") || (Array.isArray(l.materialReceived) && l.materialReceived.length > 0);

        if (isReceived) {
          continue;
        }

        const isIntransit = tfu && tfu.status === "intransit";
        const currentPendingStage = isIntransit ? "transporter-follow-up" : "follow-up-vendor";

        results.push({
          id: `${row.id}_${l.liftNo}`,
          indentNumber: row.indentNo,
          liftNo: l.liftNo,
          poNumber: poEntry ? poEntry.poNumber : "—",
          itemName: row.itemName,
          remainingQty: parseFloat(l.liftingQty) || 0,
          currentPendingStage: currentPendingStage
        });
      }

      // 2. Add un-lifted remaining balance entry if balance > 0 and indent is not fully cancelled
      if (!cancelledIndentNos.has(row.indentNo)) {
        const totalLifted = lifts.reduce((sum: number, l: any) => sum + (parseFloat(l.liftingQty) || 0), 0);
        const remainingUnliftedQty = Math.max(0, approvedQty - totalLifted);

        if (remainingUnliftedQty > 0) {
          let currentPendingStage = "create-indent";
          if (!approval) {
            currentPendingStage = "indent-approval";
          } else if (!update3Vendors) {
            currentPendingStage = "update-3-vendors";
          } else if (!negotiation) {
            currentPendingStage = "negotiation";
          } else if (!poEntry) {
            currentPendingStage = "po-entry";
          } else {
            currentPendingStage = "follow-up-vendor";
          }

          results.push({
            id: row.id,
            indentNumber: row.indentNo,
            liftNo: null,
            poNumber: poEntry ? poEntry.poNumber : "—",
            itemName: row.itemName,
            remainingQty: remainingUnliftedQty,
            currentPendingStage: currentPendingStage
          });
        }
      }
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error("Error searching active indents:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
