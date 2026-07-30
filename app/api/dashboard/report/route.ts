import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";

const RESPONSIBLE_MAP: Record<string, string> = {
  "Indent Approval": "NAMRATA RAJAK, HARISH KUMAR, THAKUR GOUR",
  "Update 3 Vendors": "NAMRATA RAJAK",
  "Negotiation": "NAMRATA RAJAK",
  "PO Entry": "NAMRATA RAJAK",
  "Follow-Up Vendor": "NAMRATA RAJAK",
  "Transporter Follow-Up": "AKASH NANDI",
  "Material Received": "AKASH NANDI",
  "Serial Generation": "ROHAN PAL",
  "Warranty Claim": "Shailesh Machhirke",
};

export async function GET(request: NextRequest) {
  try {
    // 1. Fetch indents and their stage relations
    const { data: indents, error: indentError } = await supabase
      .from("pfms_indent-generation")
      .select(`
        *,
        approval:"pfms_indent-approval"(*),
        update3Vendors:"pfms_update-3-vendors"(*),
        negotiation:pfms_negotiation(*),
        poEntry:"pfms_po-entry"(*),
        lifts:pfms_lift(
          *,
          transporterFollowUp:"pfms_transporter-follow-up"(*)
        )
      `)
      .order("timestamp", { ascending: false }) as any;

    if (indentError) throw indentError;

    // 2. Fetch list of cancelled indents
    const { data: cancelledList } = await supabase
      .from("pfms_order-cancellation")
      .select("indentNo");
    const cancelledNos = new Set((cancelledList || []).map((c: any) => c.indentNo));

    const overdueCounts: Record<string, number> = {
      "Indent Approval": 0,
      "PO Entry": 0,
      "Follow-Up Vendor": 0,
      "Transporter Follow-Up": 0,
    };

    const detailed: any[] = [];
    const now = new Date();

    const isPast = (dateStr: any) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && d < now;
    };

    const getDelayHours = (plannedDateStr: string) => {
      const plannedDate = new Date(plannedDateStr);
      if (isNaN(plannedDate.getTime())) return 0;
      const diffMs = now.getTime() - plannedDate.getTime();
      return Math.max(0, diffMs / (1000 * 60 * 60)); // Return delay in hours
    };

    const followUpVendorPOs = new Set<string>();

    for (const row of (indents || [])) {
      const indentNo = row.indentNo;
      if (cancelledNos.has(indentNo)) continue;

      const approval = Array.isArray(row.approval) ? row.approval[0] : row.approval;
      const update3Vendors = Array.isArray(row.update3Vendors) ? row.update3Vendors[0] : row.update3Vendors;
      const negotiation = Array.isArray(row.negotiation) ? row.negotiation[0] : row.negotiation;
      const poEntry = Array.isArray(row.poEntry) ? row.poEntry[0] : row.poEntry;
      const lifts = row.lifts || [];

      // 1. Indent Approval Overdue check
      if (!approval) {
        if (isPast(row.plannedIndentApproval)) {
          overdueCounts["Indent Approval"]++;
          detailed.push({
            indent: indentNo,
            party: row.createdBy || "-",
            item: row.itemName || "-",
            qty: row.quantity || 0,
            stage: "Indent Approval",
            delay: getDelayHours(row.plannedIndentApproval).toFixed(2),
            poNumber: "-",
          });
        }
      }

      // 2. PO Entry Overdue check
      if (negotiation && !poEntry) {
        if (isPast(negotiation.plannedPOEntry)) {
          overdueCounts["PO Entry"]++;
          detailed.push({
            indent: indentNo,
            party: negotiation.selectedVendorName || "-",
            item: row.itemName || "-",
            qty: row.quantity || 0,
            stage: "PO Entry",
            delay: getDelayHours(negotiation.plannedPOEntry).toFixed(2),
            poNumber: "-",
          });
        }
      }

      // 3. Follow-Up Vendor Overdue check
      if (poEntry) {
        const approvedQty = approval?.approvedQty !== null && approval?.approvedQty !== undefined ? approval.approvedQty : row.quantity;
        const totalLifted = lifts.reduce((sum: number, l: any) => sum + (parseFloat(l.liftingQty) || 0), 0);

        if (totalLifted < approvedQty) {
          if (isPast(poEntry.plannedFollowUpVendor)) {
            overdueCounts["Follow-Up Vendor"]++;
            const poNumKey = (poEntry.poNumber || "").toUpperCase().replace(/\s+/g, '');
            
            if (!followUpVendorPOs.has(poNumKey)) {
              followUpVendorPOs.add(poNumKey);
              detailed.push({
                indent: indentNo,
                party: negotiation?.selectedVendorName || "-",
                item: row.itemName || "-",
                qty: approvedQty - totalLifted,
                stage: "Follow-Up Vendor",
                delay: getDelayHours(poEntry.plannedFollowUpVendor).toFixed(2),
                poNumber: poEntry.poNumber || "-",
                plannedDate: poEntry.plannedFollowUpVendor || "-",
              });
            }
          }
        }
      }

      // 4. Transporter Follow-Up Overdue check
      for (const lift of lifts) {
        const tfuArray = lift.transporterFollowUp;
        const tfu = Array.isArray(tfuArray) ? tfuArray[0] : tfuArray;

        if (tfu && tfu.status === "intransit") {
          if (isPast(lift.plannedTransporterFlwUp)) {
            overdueCounts["Transporter Follow-Up"]++;
            detailed.push({
              indent: indentNo,
              party: negotiation?.selectedVendorName || "-",
              item: row.itemName || "-",
              qty: lift.liftingQty || 0,
              stage: "Transporter Follow-Up",
              delay: getDelayHours(lift.plannedTransporterFlwUp).toFixed(2),
              poNumber: poEntry?.poNumber || "-",
              expectedDate: tfu.expectedDeliveryDate || lift.plannedTransporterFlwUp || "-",
              transporterName: lift.transporterName || "-",
            });
          }
        }
      }
    }

    const allowedStages = ["Indent Approval", "PO Entry", "Follow-Up Vendor", "Transporter Follow-Up"];
    const summaryData = allowedStages
      .filter(name => overdueCounts[name] > 0)
      .map(name => ({
        stage: name,
        pending: overdueCounts[name],
        responsible: RESPONSIBLE_MAP[name] || "-",
        uniquePoCount: name === "Follow-Up Vendor" ? followUpVendorPOs.size : undefined,
      }));

    // Sort detailed data by stage sequence to match summary
    detailed.sort((a, b) => {
      const indexA = allowedStages.indexOf(a.stage);
      const indexB = allowedStages.indexOf(b.stage);
      return indexA - indexB;
    });

    return NextResponse.json({
      success: true,
      summaryData,
      detailedData: detailed,
    });
  } catch (error: any) {
    console.error("Report API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
