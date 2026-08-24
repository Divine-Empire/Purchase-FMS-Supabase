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
    // 1. Fetch all lift dispatches (Stage 6 completed)
    const { data: lifts, error: liftError } = await supabase
      .from("pfms_lift")
      .select(`
        *,
        materialReceived:pfms_material-received (*),
        transporterFollowUp:pfms_transporter-follow-up(status),
        indent:pfms_indent-generation!inner (
          indentNo,
          warehouseLocation,
          itemName,
          itemCode,
          quantity,
          negotiation:pfms_negotiation (
            selectedVendorName
          ),
          poEntry:pfms_po-entry (
            poNumber,
            poCopy,
            pkgAmount,
            pkgGST
          )
        )
      `)
      .order("timestamp", { ascending: false });

    if (liftError) throw liftError;

    // Fetch cancellations
    const { data: cancelledList } = await supabase
      .from("pfms_order-cancellation")
      .select("indentNo");
    const cancelledNos = new Set((cancelledList || []).map((c: any) => c.indentNo));

    const mappedData = (lifts || [])
      .filter((row: any) => row.plannedMaterialRcd !== null)
      .map((row: any) => {
        const indent = row.indent || {};
        const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
        const poEntry = Array.isArray(indent.poEntry) ? (indent.poEntry[0] || {}) : (indent.poEntry || {});
        const matRecd = Array.isArray(row.materialReceived) ? (row.materialReceived[0] || null) : (row.materialReceived || null);
        const tfuArray = row.transporterFollowUp;
        const tfu = Array.isArray(tfuArray) ? (tfuArray[0] || null) : (tfuArray || null);

        let status = null;
        if (matRecd) {
          status = "completed";
        } else if (tfu && tfu.status === "received") {
          status = "pending";
        }

        if (!status) return null;

        return {
          id: `${indent.indentNo || ""}_${row.liftNo || ""}`,
          rowIndex: null,
          stage: 7,
          status: status,
          data: {
            indentNumber: indent.indentNo || "",
            liftNo: row.liftNo || "",
            vendorName: negotiation.selectedVendorName || "-",
            poNumber: poEntry.poNumber || "-",
            nextFollowUpDate: row.followUpDate || "",
            remarks: row.remarks || "",
            itemName: indent.itemName || "",
            liftingQty: row.liftingQty || 0,
            transporterName: row.transporterName || "",
            vehicleNo: row.vehicleNo || "",
            contactNo: row.contactNo || "",
            lrNo: row.lrNo || "",
            dispatchDate: row.dispatchDate || "",
            freightAmount: row.freightAmount || "",
            advanceAmount: row.advanceAmount || "",
            paymentDate: row.paymentDate || "",
            paymentStatus: row.paymentStatus || "",
            biltyCopy: row.biltyCopy || "",
            poCopy: poEntry.poCopy || "",
            warehouse: indent.warehouseLocation || "",

            invoiceNumber: matRecd ? (matRecd.invoiceNumber || "") : "",
            qcRequirement: matRecd ? (matRecd.qcRequired || "") : "",
            planned6: row.plannedMaterialRcd || "",
            actual6: matRecd ? matRecd.timestamp : null,

            invoiceType: matRecd ? (matRecd.invoiceType || "") : "",
            receivedQty: matRecd ? (matRecd.receivedQty || "") : "",
            invoiceDate: matRecd ? (matRecd.invoiceDate || "") : "",
            extraFreight: matRecd ? (matRecd.extraFreight || "") : "",
            receivedItemImage: matRecd ? (matRecd.receivedItemImage || "") : "",
            billAttachment: matRecd ? (matRecd.billAttachment || "") : "",
            paymentAmountHydra: matRecd ? (matRecd.hydraAmt || "") : "",
            paymentAmountLabour: matRecd ? (matRecd.labourAmt || "") : "",
            paymentAmountHamali: matRecd ? (matRecd.hamaliAmt || "") : "",
            receiptLiftNumber: row.liftNo || "",
            damagedQty: matRecd ? (matRecd.damagedQty || "") : "",
            damageReason: matRecd ? (matRecd.damageReason || "") : "",
            damageImage: matRecd ? (matRecd.damageImage || "") : "",
            productClaim: matRecd ? (matRecd.productExpiry || "") : "",
            warrantyClaim: matRecd ? (matRecd.warranty || "") : "",
            duration: matRecd ? (matRecd.warrantyDuration || "") : "",
            warrantyExpiry: matRecd ? (matRecd.warrantyExpiry || "") : "",
            productExpiry: matRecd ? (matRecd.productExpiryDate || "") : "",
          }
        };
      })
      .filter((row: any) => row !== null)
      .filter((row: any) => {
        if (row.status === "pending" && cancelledNos.has(row.data.indentNumber)) {
          return false;
        }
        return true;
      });

    return NextResponse.json({ success: true, data: mappedData });

  } catch (error: any) {
    console.error("Error in material-received GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, records } = body;

    if (!records || records.length === 0) {
      return NextResponse.json({ success: false, error: "No records to process" }, { status: 400 });
    }

    const now = getLocalTimestamp();

    if (action === "recordMaterialReceived") {

      for (const item of records) {
        const liftNo = item.liftNo || item.data?.liftNo;
        const form = item.form || item;

        // Calculate plannedMaterialTesting and plannedTallyEntry
        const plannedMaterialTesting = await calculatePlannedTime("material-testing");
        const plannedTallyEntry = await calculatePlannedTime("receipt-in-tally");

        // A. Insert into material-received table
        const { error: insertError } = await supabase
          .from("pfms_material-received")
          .insert({
            id: randomUUID(),
            liftNo: liftNo,
            invoiceType: form.invoiceType || "independent",
            invoiceNumber: form.invoiceNumber,
            invoiceDate: form.invoiceDate ? getLocalTimestamp(form.invoiceDate) : now,
            receivedQty: parseFloat(form.receivedQty) || 0,
            receivedItemImage: form.receivedItemImage || null,
            billAttachment: form.billAttachment || null,
            qcRequired: form.qcRequirement || "no",
            extraFreight: parseFloat(form.extraFreight) || null,
            hydraAmt: parseFloat(form.paymentAmountHydra) || null,
            labourAmt: parseFloat(form.paymentAmountLabour) || null,
            hamaliAmt: parseFloat(form.paymentAmountHamali) || null,
            damagedQty: parseFloat(form.damagedQty) || null,
            damageReason: form.damageReason || null,
            damageImage: form.damageImage || null,
            plannedMaterialTesting: plannedMaterialTesting,
            plannedTallyEntry: plannedTallyEntry,
            productExpiry: form.productClaim || null,
            productExpiryDate: form.productExpiry ? getLocalTimestamp(form.productExpiry) : null,
            warranty: form.warrantyClaim || null,
            warrantyDuration: parseInt(form.duration) || null,
            warrantyExpiry: form.warrantyExpiry ? getLocalTimestamp(form.warrantyExpiry) : null,
            timestamp: now,
            createdAt: now,
            updatedAt: now
          });

        if (insertError) throw insertError;

        // Clean up any leftover incomplete/orphan records for this liftNo in downstream tables
        const { error: delTestingError } = await supabase
          .from("pfms_material-testing")
          .delete()
          .eq("liftNo", liftNo);
        if (delTestingError) throw delTestingError;

        const { error: delPaymentError } = await supabase
          .from("pfms_vendor-payment-details")
          .delete()
          .eq("liftNo", liftNo);
        if (delPaymentError) throw delPaymentError;

        const { error: delDamageError } = await supabase
          .from("pfms_damaged-record")
          .delete()
          .eq("liftNo", liftNo);
        if (delDamageError) throw delDamageError;

        // Populate initial record in material-testing table if QC is required
        if (form.qcRequirement === "yes") {
          const receivedQtyVal = parseFloat(form.receivedQty) || 0;
          const { error: testingError } = await supabase
            .from("pfms_material-testing")
            .insert({
              id: randomUUID(),
              timestamp: now,
              liftNo: liftNo,
              pendingQty: receivedQtyVal,
              approvedQty: 0,
              rejectedQty: 0,
              qcBy: null,
              qcDate: null,
              workingCondition: null,
              remarks: null,
              createdAt: now,
              updatedAt: now
            });

          if (testingError) throw testingError;
        }

        // Populate initial record in vendor-payment-details table
        const { data: liftData, error: liftFetchError } = await supabase
          .from("pfms_lift")
          .select(`
            indentNo,
            indent:"pfms_indent-generation"!inner (
              negotiation:pfms_negotiation (
                selectedVendorName
              ),
              update3Vendors:"pfms_update-3-vendors" (
                vendor1Name, vendor1Terms,
                vendor2Name, vendor2Terms,
                vendor3Name, vendor3Terms
              ),
              poEntry:"pfms_po-entry" (
                totalWithTax
              )
            )
          `)
          .eq("liftNo", liftNo)
          .maybeSingle() as any;

        if (liftFetchError) throw liftFetchError;

        const indent = liftData?.indent || {};
        const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
        const poEntry = Array.isArray(indent.poEntry) ? (indent.poEntry[0] || {}) : (indent.poEntry || {});
        const update3Vendors = Array.isArray(indent.update3Vendors) ? (indent.update3Vendors[0] || {}) : (indent.update3Vendors || {});

        const selectedVendorName = negotiation.selectedVendorName;
        const totalAmount = poEntry.totalWithTax || 0;

        let selectedTerms = null;
        if (selectedVendorName && update3Vendors) {
          if (selectedVendorName === update3Vendors.vendor1Name) selectedTerms = update3Vendors.vendor1Terms;
          else if (selectedVendorName === update3Vendors.vendor2Name) selectedTerms = update3Vendors.vendor2Terms;
          else if (selectedVendorName === update3Vendors.vendor3Name) selectedTerms = update3Vendors.vendor3Terms;
        }

        const invDate = form.invoiceDate ? new Date(form.invoiceDate) : new Date();
        let creditDays = 0;
        if (selectedTerms) {
          const digits = selectedTerms.match(/\d+/);
          if (digits) {
            creditDays = parseInt(digits[0], 10);
          }
        }
        const dueDate = new Date(invDate.getTime() + creditDays * 24 * 60 * 60 * 1000);

        const { error: paymentInitError } = await supabase
          .from("pfms_vendor-payment-details")
          .insert({
            id: randomUUID(),
            timestamp: now,
            liftNo: liftNo,
            totalAmount: parseFloat(totalAmount) || 0,
            paidAmount: 0,
            dueDate: getLocalTimestamp(dueDate),
            createdAt: now,
            updatedAt: now
          });

        if (paymentInitError) throw paymentInitError;

        // B. If damagedQty > 0, insert into damaged-record table
        if (parseFloat(form.damagedQty) > 0) {
          const { error: damageError } = await supabase
            .from("pfms_damaged-record")
            .insert({
              id: randomUUID(),
              liftNo: liftNo,
              timestamp: now,
              createdAt: now,
              updatedAt: now
            });

          if (damageError) throw damageError;
        }

        // C. If pkgAmount or pkgGST is updated, write to po-entry
        if (form.pkgAmount !== undefined && form.pkgAmount !== null && form.pkgAmount !== "") {
          // Fetch indentNo from lift
          const { data: liftData } = await supabase
            .from("pfms_lift")
            .select("indentNo")
            .eq("liftNo", liftNo)
            .maybeSingle();

          if (liftData?.indentNo) {
            const { error: poError } = await supabase
              .from("pfms_po-entry")
              .update({
                pkgAmount: parseFloat(form.pkgAmount) || 0,
                pkgGST: form.pkgGST || null,
                updatedAt: now
              })
              .eq("indentNo", liftData.indentNo);

            if (poError) throw poError;
          }
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    console.error("Error in material-received POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
