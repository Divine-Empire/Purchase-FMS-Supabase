import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { calculatePlannedTime, getLocalTimestamp } from "@/app/api/helper/plannedCalculator";

export async function GET() {
  try {
    // Fetch parent indents with inner join on negotiation to ensure Stage 4 completed
    const { data: indents, error } = await supabase
      .from("pfms_indent_generation")
      .select(`
        *,
        approval:pfms_indent-approval (
          approvedQty
        ),
        update3Vendors:pfms_update-3-vendors (
          vendor1Name, vendor1Rate, vendor1Terms, vendor1DeliveryDate, vendor1Attachment,
          vendor2Name, vendor2Rate, vendor2Terms, vendor2DeliveryDate, vendor2Attachment,
          vendor3Name, vendor3Rate, vendor3Terms, vendor3DeliveryDate, vendor3Attachment
        ),
        negotiation:pfms_negotiation!inner(*),
        poEntry:pfms_po-entry(*)
      `)
      .order("timestamp", { ascending: false });

    if (error) throw error;

    // Fetch cancellations
    const { data: cancelledList } = await supabase
      .from("pfms_order-cancellation")
      .select("indentNo");
    const cancelledNos = new Set((cancelledList || []).map((c: any) => c.indentNo));

    const mappedData = indents
      .map((row: any) => {
        const negotiationArray = row.negotiation;
        const negotiationData = Array.isArray(negotiationArray) ? (negotiationArray[0] || {}) : (negotiationArray || {});

        const approvalArray = row.approval;
        const approval = Array.isArray(approvalArray) ? (approvalArray[0] || {}) : (approvalArray || {});

        const vendorsArray = row.update3Vendors;
        const vendors = Array.isArray(vendorsArray) ? (vendorsArray[0] || {}) : (vendorsArray || {});

        const poArray = row.poEntry;
        const hasPOEntry = Array.isArray(poArray) ? poArray.length > 0 : !!poArray;
        const poData = hasPOEntry ? (Array.isArray(poArray) ? poArray[0] : poArray) : {};

        const status = hasPOEntry ? "completed" : "pending";

        return {
          id: `${row.indentNo}-${negotiationData.id}`,
          dbId: negotiationData.id,
          rowIndex: null,
          stage: 5,
          status: status,
          createdAt: negotiationData.timestamp, // actual completion date of Stage 4
          history: hasPOEntry ? [{ stage: 5, date: poData.timestamp || negotiationData.timestamp, data: {} }] : [],
          data: {
            indentNumber: row.indentNo,
            timestamp: row.timestamp || negotiationData.timestamp,
            itemName: row.itemName || "",
            quantity: approval.approvedQty || 0, // approvedQty from Stage 2
            planned4: negotiationData.plannedPOEntry, // plannedPOEntry from negotiation table
            actual4: hasPOEntry ? poData.timestamp : null, // actual PO entry date
            delay4: null,

            approvedBy: negotiationData.finalApprovedBy || "",
            selectedVendor: negotiationData.selectedVendorName || "",
            finalApprovedBy: negotiationData.finalApprovedBy || "",
            negotiationRemarks: negotiationData.negotiationRemarks || "",

            // Vendor comparison fields for display/selection
            vendor1Name: vendors.vendor1Name || "",
            vendor1Rate: vendors.vendor1Rate || "",
            vendor1Terms: vendors.vendor1Terms || "",
            vendor1DeliveryDate: vendors.vendor1DeliveryDate || "",
            vendor1Attachment: vendors.vendor1Attachment || "",

            vendor2Name: vendors.vendor2Name || "",
            vendor2Rate: vendors.vendor2Rate || "",
            vendor2Terms: vendors.vendor2Terms || "",
            vendor2DeliveryDate: vendors.vendor2DeliveryDate || "",
            vendor2Attachment: vendors.vendor2Attachment || "",

            vendor3Name: vendors.vendor3Name || "",
            vendor3Rate: vendors.vendor3Rate || "",
            vendor3Terms: vendors.vendor3Terms || "",
            vendor3DeliveryDate: vendors.vendor3DeliveryDate || "",
            vendor3Attachment: vendors.vendor3Attachment || "",

            // PO info (if completed)
            poNumber: hasPOEntry ? (poData.poNumber || "") : "",
            basicValue: hasPOEntry ? (poData.basicValue || "") : "",
            totalWithTax: hasPOEntry ? (poData.totalWithTax || "") : "",
            hsn: hasPOEntry ? (poData.hsn || "") : "",
            poCopy: hasPOEntry ? (poData.poCopy || "") : "",
            gst: hasPOEntry ? (poData.gst || "") : "",
            pkgAmount: hasPOEntry ? (poData.pkgAmount || "") : "",
            pkgGST: hasPOEntry ? (poData.pkgGST || "") : "",
            estimatedFollowUpVendor: hasPOEntry ? (poData.estimatedFollowUpVendor || null) : null,
            remarksFollowUpVendor: hasPOEntry ? (poData.remarksFollowUpVendor || "") : "",
            purchaser: row.purchaser || null
          }
        };
      })
      .filter((row: any) => {
        if (row.status === "pending" && cancelledNos.has(row.data.indentNumber)) {
          return false;
        }
        return true;
      });

    return NextResponse.json({ success: true, data: mappedData });
  } catch (error: any) {
    console.error("Error fetching PO entries:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Edit an already-completed PO Entry record (admin-only, from the History tab).
    // These are leaf-level values — nothing downstream reads them live, so no cascade needed.
    if (action === "editHistory") {
      const { indentNo, poNumber, poCopy, basicValue, totalWithTax } = body;

      if (!indentNo) {
        return NextResponse.json({ success: false, error: "Missing indentNo" }, { status: 400 });
      }

      const now = getLocalTimestamp();
      const { error: updateError } = await supabase
        .from("pfms_po-entry")
        .update({
          poNumber: poNumber !== undefined ? poNumber : undefined,
          poCopy: poCopy !== undefined ? poCopy : undefined,
          basicValue: basicValue !== undefined ? parseFloat(basicValue) || 0 : undefined,
          totalWithTax: totalWithTax !== undefined ? parseFloat(totalWithTax) || 0 : undefined,
          updatedAt: now,
        })
        .eq("indentNo", indentNo);

      if (updateError) throw updateError;
      return NextResponse.json({ success: true });
    }

    if (action === "insertPOEntry") {
      const { poNumber, poCopy, pkgAmount, pkgGST, records } = body;

      if (!records || records.length === 0) {
        return NextResponse.json({ success: false, error: "No records to process" }, { status: 400 });
      }

      // 1. Calculate planned time for follow-up-vendor
      const now = getLocalTimestamp();
      const plannedFollowUpVendor = await calculatePlannedTime("follow-up-vendor");

      // 2. Prepare PO entry records
      const poEntriesToInsert = records.map((item: any) => {
        // Robustly parse indentNo and UUID based on UUID's 36-char fixed length
        const recordId = item.recordId;
        const recordIndentNo = recordId.length > 36 ? recordId.substring(0, recordId.length - 37) : recordId;

        return {
          id: randomUUID(),
          indentNo: recordIndentNo,
          poNumber,
          basicValue: parseFloat(item.basicValue) || 0,
          totalWithTax: parseFloat(item.totalWithTax) || 0,
          hsn: item.hsn || null,
          poCopy: poCopy || null,
          gst: item.gst || null,
          pkgAmount: parseFloat(pkgAmount) || null,
          pkgGST: pkgGST || null,
          plannedFollowUpVendor,
          timestamp: now,
          createdAt: now,
          updatedAt: now
        };
      });

      const { error: insertError } = await supabase
        .from("pfms_po-entry")
        .insert(poEntriesToInsert);

      if (insertError) throw insertError;

      // 3. Optional: Update poNumber in indent-generation as metadata reference
      for (const item of records) {
        const recordId = item.recordId;
        const recordIndentNo = recordId.length > 36 ? recordId.substring(0, recordId.length - 37) : recordId;
        await supabase
          .from("pfms_indent_generation")
          .update({
            remarks: `PO Entry done: ${poNumber}`, // or keep legacy column PO No. sync if needed
            updatedAt: now
          })
          .eq("indentNo", recordIndentNo);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in PO entry API:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
