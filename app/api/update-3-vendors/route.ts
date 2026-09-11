import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { calculatePlannedTime, getLocalTimestamp } from "@/app/api/helper/plannedCalculator";

export async function GET() {
  try {
    // Fetch all indent approvals and join with indent-generation + update-3-vendors
    const { data: approvals, error } = await supabase
      .from("pfms_indent-approval")
      .select(`
        *,
        indent:pfms_indent_generation (
          *,
          update3Vendors:pfms_update-3-vendors(*)
        )
      `)
      .ilike("status", "approved")
      .order("timestamp", { ascending: false });

    if (error) throw error;

    // Fetch cancellations
    const { data: cancelledList } = await supabase
      .from("pfms_order-cancellation")
      .select("indentNo");
    const cancelledNos = new Set((cancelledList || []).map((c: any) => c.indentNo));

    const mappedData = approvals
      .filter((app: any) => app.indent && app.status?.toLowerCase() === "approved") // ensure generation row exists and status is approved
      .map((app: any) => {
        const row = app.indent;
        const vendorArray = row.update3Vendors;
        const hasVendorData = Array.isArray(vendorArray) ? vendorArray.length > 0 : !!vendorArray;
        const vendorData = hasVendorData ? (Array.isArray(vendorArray) ? vendorArray[0] : vendorArray) : {};

        const status = hasVendorData ? "completed" : "pending";

        return {
          id: `${row.indentNo}-${row.id}`,
          dbId: row.id,
          rowIndex: null,
          stage: 3,
          status: status,
          createdAt: app.timestamp, // completed date of Stage 2 (approved date)
          history: hasVendorData ? [{ stage: 3, date: vendorData.timestamp || app.timestamp, data: {} }] : [],
          data: {
            indentNumber: row.indentNo,
            timestamp: row.timestamp,
            createdBy: row.createdBy,
            category: row.category,
            itemName: row.itemName,
            quantity: row.quantity,
            warehouseLocation: row.warehouseLocation,
            itemCode: row.itemCode,
            leadTime: row.leadTime,
            planned2: app.plannedUpdateVendors, // plannedUpdateVendors from approval table
            actual2: hasVendorData ? vendorData.timestamp : null, // timestamp from update-3-vendors
            delay2: null,

            status: app.status,
            approvedQty: app.approvedQty,
            vendorType: app.vendorType,
            remarks: app.remarks,
            img: row.attachment || app.imgOptional || "",

            // Vendor 1
            vendor1Name: hasVendorData ? (vendorData.vendor1Name || "") : "",
            vendor1Rate: hasVendorData ? (vendorData.vendor1Rate || "") : "",
            vendor1Terms: hasVendorData ? (vendorData.vendor1Terms || "") : "",
            vendor1DeliveryDate: hasVendorData ? (vendorData.vendor1DeliveryDate || "") : "",
            vendor1Attachment: hasVendorData ? (vendorData.vendor1Attachment || "") : "",

            // Vendor 2
            vendor2Name: hasVendorData ? (vendorData.vendor2Name || "") : "",
            vendor2Rate: hasVendorData ? (vendorData.vendor2Rate || "") : "",
            vendor2Terms: hasVendorData ? (vendorData.vendor2Terms || "") : "",
            vendor2DeliveryDate: hasVendorData ? (vendorData.vendor2DeliveryDate || "") : "",
            vendor2Attachment: hasVendorData ? (vendorData.vendor2Attachment || "") : "",

            // Vendor 3
            vendor3Name: hasVendorData ? (vendorData.vendor3Name || "") : "",
            vendor3Rate: hasVendorData ? (vendorData.vendor3Rate || "") : "",
            vendor3Terms: hasVendorData ? (vendorData.vendor3Terms || "") : "",
            vendor3DeliveryDate: hasVendorData ? (vendorData.vendor3DeliveryDate || "") : "",
            vendor3Attachment: hasVendorData ? (vendorData.vendor3Attachment || "") : "",
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
    console.error("Error fetching Stage 3 vendors:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // --- CASE 1: INSERT VENDORS ---
    if (action === "insertVendors") {
      const { idsToProcess, submissionData, bulkVendorData, vendorImageUrls } = body;

      if (!idsToProcess || idsToProcess.length === 0) {
        return NextResponse.json({ success: false, error: "No records to process" }, { status: 400 });
      }

      // 1. Calculate planned time for negotiation
      const now = getLocalTimestamp();
      const plannedNegotiation = await calculatePlannedTime("negotiation");

      // 2. Insert vendor comparison records
      const vendorsToInsert = idsToProcess.map((recordId: string) => {
        // Robustly parse indentNo and UUID based on UUID's 36-char fixed length
        const recordIndentNo = recordId.length > 36 ? recordId.substring(0, recordId.length - 37) : recordId;

        const v1Bulk = bulkVendorData[1]?.[recordId] || {};
        const v2Bulk = bulkVendorData[2]?.[recordId] || {};
        const v3Bulk = bulkVendorData[3]?.[recordId] || {};

        return {
          id: randomUUID(),
          indentNo: recordIndentNo,
          vendor1Name: submissionData.vendor1Name || null,
          vendor1Rate: v1Bulk.rate !== undefined && v1Bulk.rate !== "" ? parseFloat(v1Bulk.rate) : (submissionData.vendor1Rate ? parseFloat(submissionData.vendor1Rate) : null),
          vendor1Terms: v1Bulk.terms || submissionData.vendor1Terms || null,
          vendor1DeliveryDate: v1Bulk.deliveryDate || submissionData.vendor1DeliveryDate || null,
          vendor1Attachment: vendorImageUrls[0] || null,

          vendor2Name: submissionData.vendor2Name || null,
          vendor2Rate: v2Bulk.rate !== undefined && v2Bulk.rate !== "" ? parseFloat(v2Bulk.rate) : (submissionData.vendor2Rate ? parseFloat(submissionData.vendor2Rate) : null),
          vendor2Terms: v2Bulk.terms || submissionData.vendor2Terms || null,
          vendor2DeliveryDate: v2Bulk.deliveryDate || submissionData.vendor2DeliveryDate || null,
          vendor2Attachment: vendorImageUrls[1] || null,

          vendor3Name: submissionData.vendor3Name || null,
          vendor3Rate: v3Bulk.rate !== undefined && v3Bulk.rate !== "" ? parseFloat(v3Bulk.rate) : (submissionData.vendor3Rate ? parseFloat(submissionData.vendor3Rate) : null),
          vendor3Terms: v3Bulk.terms || submissionData.vendor3Terms || null,
          vendor3DeliveryDate: v3Bulk.deliveryDate || submissionData.vendor3DeliveryDate || null,
          vendor3Attachment: vendorImageUrls[2] || null,

          plannedNegotiation,
          timestamp: now,
          createdAt: now,
          updatedAt: now
        };
      });

      const { error: insertError } = await supabase
        .from("pfms_update-3-vendors")
        .insert(vendorsToInsert);

      if (insertError) throw insertError;

      return NextResponse.json({ success: true });
    }

    // --- CASE 2: SAVE NEW VENDORS TO CATALOG ---
    if (action === "saveNewVendors") {
      const { names } = body;
      if (!names || names.length === 0) {
        return NextResponse.json({ success: true });
      }

      const vendorsToInsert = names.map((name: string) => ({
        "Vendor List": name
      }));

      const { error } = await supabase
        .from("pfms_vendor-master")
        .insert(vendorsToInsert);

      if (error) {
        console.error("Error inserting catalog vendors:", error);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in update-3-vendors API:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
