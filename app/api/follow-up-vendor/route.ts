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
    // 1. Fetch indents that have POs (Stage 5 completed)
    const { data: indents, error: indentError } = await supabase
      .from("pfms_indent-generation")
      .select(`
        *,
        approval:pfms_indent-approval (
          approvedQty,
          status,
          remarks,
          imgOptional,
          approvedBy
        ),
        update3Vendors:pfms_update-3-vendors (
          vendor1Name, vendor1Rate, vendor1Terms, vendor1DeliveryDate, vendor1WarrantyType, vendor1Attachment,
          vendor2Name, vendor2Rate, vendor2Terms, vendor2DeliveryDate, vendor2WarrantyType, vendor2Attachment,
          vendor3Name, vendor3Rate, vendor3Terms, vendor3DeliveryDate, vendor3WarrantyType, vendor3Attachment
        ),
        negotiation:pfms_negotiation!inner (
          selectedVendorName,
          finalApprovedBy,
          negotiationRemarks
        ),
        poEntry:pfms_po-entry!inner (
          poNumber,
          basicValue,
          totalWithTax,
          hsn,
          poCopy,
          gst,
          pkgAmount,
          pkgGST,
          plannedFollowUpVendor,
          estimatedFollowUpVendor,
          remarksFollowUpVendor
        ),
        lifts:pfms_lift (*)
      `)
      .order("timestamp", { ascending: false });

    if (indentError) throw indentError;

    // Fetch cancellations
    const { data: cancelledList } = await supabase
      .from("pfms_order-cancellation")
      .select("indentNo");
    const cancelledNos = new Set((cancelledList || []).map((c: any) => c.indentNo));

    const sheetRecords = indents
      .map((row: any) => {
        const negotiation = Array.isArray(row.negotiation) ? (row.negotiation[0] || {}) : (row.negotiation || {});
        const poEntry = Array.isArray(row.poEntry) ? (row.poEntry[0] || {}) : (row.poEntry || {});
        const approval = Array.isArray(row.approval) ? (row.approval[0] || {}) : (row.approval || {});
        const vendors = Array.isArray(row.update3Vendors) ? (row.update3Vendors[0] || {}) : (row.update3Vendors || {});
        const lifts = row.lifts || [];

        const totalLifted = lifts.reduce((sum: number, l: any) => sum + (parseFloat(l.liftingQty) || 0), 0);
        const approvedQty = approval.approvedQty !== null ? approval.approvedQty : row.quantity;
        const pendingLifted = Math.max(0, approvedQty - totalLifted);

        // Status is pending if there is still quantity left to lift (pendingLifted > 0)
        const status = pendingLifted > 0 ? "pending" : "completed";

        return {
          id: row.indentNo,
          rowIndex: null,
          stage: 6,
          status: status,
          createdAt: row.timestamp,
          history: lifts.length > 0 ? lifts.map((l: any) => ({ stage: 6, date: l.timestamp, data: {} })) : [],
          data: {
            indentNumber: row.indentNo,
            createdBy: row.createdBy,
            category: row.category,
            itemName: row.itemName,
            quantity: row.quantity,
            warehouseLocation: row.warehouseLocation,
            deliveryDate: row.deliveryDate || "",
            leadTime: row.leadTime || null,
            approvedBy: approval.approvedBy || "Auto-Approved",
            approvedQty: approvedQty,
            vendorType: approval.vendorType || "",
            indentRemarks: approval.remarks || "",
            img: approval.imgOptional || "",

            selectedVendor: row.selectedVendor || "vendor1",
            vendor1Name: vendors.vendor1Name || "",
            vendor1Rate: vendors.vendor1Rate || "",
            vendor1Terms: vendors.vendor1Terms || "",
            vendor1DeliveryDate: vendors.vendor1DeliveryDate || "",
            vendor1WarrantyType: vendors.vendor1WarrantyType || "",
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
            vendor3WarrantyType: vendors.vendor3WarrantyType || "",
            vendor3Attachment: vendors.vendor3Attachment || "",

            poNumber: poEntry.poNumber || "",
            basicValue: poEntry.basicValue || "",
            totalWithTax: poEntry.totalWithTax || "",
            poCopy: poEntry.poCopy || "",
            gst: poEntry.gst || "",
            hsn: poEntry.hsn || "",
            pkgAmount: poEntry.pkgAmount || "",
            pkgGST: poEntry.pkgGST || "",

            planned5: poEntry.plannedFollowUpVendor || "",
            actual5: lifts.length > 0 ? lifts[0].timestamp : null,
            status: status,
            totalLifted: totalLifted,
            pendingLifted: pendingLifted,
            finalVendorName: negotiation.selectedVendorName || "",
            estimatedDate: poEntry.estimatedFollowUpVendor || null,
            remarksFollowUp: poEntry.remarksFollowUpVendor || "",
            liftingData: lifts.length > 0 ? {
              liftNumber: lifts[0].liftNo,
              liftingQty: lifts[0].liftingQty,
              transporterName: lifts[0].transporterName,
              vehicleNumber: lifts[0].vehicleNo,
              contactNumber: lifts[0].contactNo,
              lrNumber: lifts[0].lrNo,
              dispatchDate: lifts[0].dispatchDate,
              freightAmount: lifts[0].freightAmount,
              advanceAmount: lifts[0].advanceAmount,
              paymentDate: lifts[0].paymentDate,
              biltyCopy: lifts[0].biltyCopy,
            } : {
              liftNumber: "",
              liftingQty: pendingLifted,
              transporterName: "",
              vehicleNumber: "",
              contactNumber: "",
              lrNumber: "",
              dispatchDate: "",
              freightAmount: "",
              advanceAmount: "",
              paymentDate: "",
              biltyCopy: null,
            }
          }
        };
      })
      .filter((row: any) => {
        if (row.status === "pending" && cancelledNos.has(row.id)) {
          return false;
        }
        return true;
      });

    // 2. Fetch history records (all lifts)
    const { data: lifts, error: liftError } = await supabase
      .from("pfms_lift")
      .select(`
        *,
        indent:pfms_indent-generation!inner (
          itemName,
          negotiation:pfms_negotiation (
            selectedVendorName
          ),
          poEntry:pfms_po-entry (
            poNumber
          )
        )
      `)
      .order("timestamp", { ascending: false });

    if (liftError) throw liftError;

    const receivingAccountsData = lifts.map((l: any) => {
      const indent = l.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const poEntry = Array.isArray(indent.poEntry) ? (indent.poEntry[0] || {}) : (indent.poEntry || {});

      return {
        id: l.id,
        indentNumber: l.indentNo,
        liftNo: l.liftNo,
        vendorName: negotiation.selectedVendorName || "-",
        poNumber: poEntry.poNumber || "-",
        nextFollowUpDate: l.followUpDate,
        remarks: l.remarks || "",
        itemName: indent.itemName || "",
        liftingQty: l.liftingQty,
        transporterName: l.transporterName || "",
        vehicleNo: l.vehicleNo || "",
        contactNo: l.contactNo || "",
        lrNo: l.lrNo || "",
        dispatchDate: l.dispatchDate,
        freightAmount: l.freightAmount || "",
        advanceAmount: l.advanceAmount || "",
        paymentDate: l.paymentDate,
        paymentStatus: l.paymentStatus || "",
        biltyCopy: l.biltyCopy || "",
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        sheetRecords,
        receivingAccountsData
      }
    });

  } catch (error: any) {
    console.error("Error in follow-up-vendor GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, records } = body;

    if (!records || records.length === 0) {
      return NextResponse.json({ success: false, error: "No records provided" }, { status: 400 });
    }

    const now = getLocalTimestamp();

    if (action === "logFollowUp") {
      // Update po-entry for each record
      for (const item of records) {
        const indentNo = item.indentNumber || item.indentNo || item.recordId;
        const followUpDateVal = item.followUpDate ? getLocalTimestamp(item.followUpDate) : null;

        const { error: updateError } = await supabase
          .from("pfms_po-entry")
          .update({
            plannedFollowUpVendor: followUpDateVal,
            estimatedFollowUpVendor: followUpDateVal,
            remarksFollowUpVendor: item.remarks || null,
            updatedAt: now
          })
          .eq("indentNo", indentNo);

        if (updateError) throw updateError;
      }

      return NextResponse.json({ success: true });
    }

    if (action === "insertLift") {
      // 1. Generate liftNos using RPC sequence function
      const { data: generatedLiftNos, error: seqError } = await supabase
        .rpc("pfms_generate_next_lift_nos", { batch_size: records.length });

      if (seqError) {
        console.error("Sequence error:", seqError);
        throw new Error("Failed to generate Lift IDs: " + seqError.message);
      }

      // 2. Insert each lift record
      const liftsToInsert = [];
      const transporterFollowUpsToInsert = [];
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const indentNo = record.indentNumber || record.indentNo || record.recordId;
        const lift = record.liftingData || {};

        // Fetch parent po-entry to get follow-up details to merge if available
        const { data: poData } = await supabase
          .from("pfms_po-entry")
          .select("estimatedFollowUpVendor, remarksFollowUpVendor")
          .eq("indentNo", indentNo)
          .maybeSingle();

        const formFilledTime = new Date();

        const plannedTransporterFlwUp = await calculatePlannedTime("transporter-flw-up", formFilledTime);
        const plannedMaterialRcd = await calculatePlannedTime("material-received", formFilledTime);
        const plannedSerialGen = await calculatePlannedTime("serial-generation", formFilledTime);

        liftsToInsert.push({
          id: randomUUID(),
          liftNo: generatedLiftNos[i],
          indentNo: indentNo,
          liftingQty: parseFloat(lift.liftingQty) || 0,
          transporterName: lift.transporterName || null,
          vehicleNo: lift.vehicleNo || lift.vehicleNumber || null,
          contactNo: lift.contactNo || lift.contactNumber || null,
          lrNo: lift.lrNo || lift.lrNumber || null,
          dispatchDate: lift.dispatchDate ? getLocalTimestamp(lift.dispatchDate) : now,
          freightAmount: parseFloat(lift.freightAmount) || null,
          advanceAmount: parseFloat(lift.advanceAmount) || null,
          paymentDate: lift.paymentDate ? getLocalTimestamp(lift.paymentDate) : null,
          paymentStatus: lift.paymentStatus || null,
          biltyCopy: lift.biltyCopy || null,
          followUpDate: now, // Stores the current timestamp when the form was filled (User Request #5)
          remarks: record.remarks || null,
          estimatedDate: poData?.estimatedFollowUpVendor || null,
          remarksFollowUp: poData?.remarksFollowUpVendor || null,
          plannedTransporterFlwUp,
          plannedMaterialRcd,
          plannedSerialGen,
          timestamp: now,
          createdAt: now,
          updatedAt: now
        });

        transporterFollowUpsToInsert.push({
          id: randomUUID(),
          timestamp: now,
          liftNo: generatedLiftNos[i],
          status: "intransit",
          expectedDeliveryDate: lift.expectedDeliveryDate ? getLocalTimestamp(lift.expectedDeliveryDate) : null,
          nextFollowUpDate: null,
          remarks: null,
          lastFollowUpDate: null,
          totalFollowUps: 0,
          createdAt: now,
          updatedAt: now
        });
      }

      const { error: insertError } = await supabase
        .from("pfms_lift")
        .insert(liftsToInsert);

      if (insertError) throw insertError;

      const { error: tfuError } = await supabase
        .from("pfms_transporter-follow-up")
        .insert(transporterFollowUpsToInsert);

      if (tfuError) throw tfuError;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    console.error("Error in follow-up-vendor POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
