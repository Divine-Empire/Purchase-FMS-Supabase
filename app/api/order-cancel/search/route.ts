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
      .from("pfms_indent_generation")
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

    const results: any[] = [];

    for (const row of (indents || [])) {
      const approval = Array.isArray(row.approval) ? row.approval[0] : row.approval;
      const lifts = row.lifts || [];
      const poEntry = Array.isArray(row.poEntry) ? row.poEntry[0] : row.poEntry;
      const update3Vendors = Array.isArray(row.update3Vendors) ? row.update3Vendors[0] : row.update3Vendors;
      const negotiation = Array.isArray(row.negotiation) ? row.negotiation[0] : row.negotiation;

      // 1. Skip any indents where ANY lift has a transporter follow-up record with status "received"
      const hasCompletedDelivery = lifts.some((l: any) => {
        const tfuArray = l.transporterFollowUp;
        const tfu = Array.isArray(tfuArray) ? tfuArray[0] : tfuArray;
        return tfu && tfu.status === "received";
      });
      if (hasCompletedDelivery) {
        continue;
      }

      // 2. Determine current pending stage
      let currentPendingStage = "create-indent";
      if (!approval) {
        currentPendingStage = "indent-approval";
      } else if (!update3Vendors) {
        currentPendingStage = "update-3-vendors";
      } else if (!negotiation) {
        currentPendingStage = "negotiation";
      } else if (!poEntry) {
        currentPendingStage = "po-entry";
      } else if (lifts.length === 0) {
        currentPendingStage = "follow-up-vendor";
      } else {
        // Lifts exist; check if any lift has status 'intransit' in transporter follow-up
        const hasIntransit = lifts.some((l: any) => {
          const tfuArray = l.transporterFollowUp;
          const tfu = Array.isArray(tfuArray) ? tfuArray[0] : tfuArray;
          return tfu && tfu.status === "intransit";
        });

        if (hasIntransit) {
          currentPendingStage = "transporter-follow-up";
        } else {
          currentPendingStage = "follow-up-vendor";
        }
      }

      // Calculate remaining quantity that can be cancelled
      const totalLifted = lifts.reduce((sum: number, l: any) => sum + (parseFloat(l.liftingQty) || 0), 0);
      const approvedQty = approval && approval.approvedQty !== null ? approval.approvedQty : row.quantity;
      const remainingQty = Math.max(0, approvedQty - totalLifted);

      results.push({
        id: row.id,
        indentNumber: row.indentNo,
        poNumber: poEntry ? poEntry.poNumber : "—",
        itemName: row.itemName,
        remainingQty: remainingQty,
        currentPendingStage: currentPendingStage,
        purchaser: row.purchaser || null
      });
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error("Error searching active indents:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
