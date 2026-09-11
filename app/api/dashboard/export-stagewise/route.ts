import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";

/**
 * Stage-wise "cohort funnel" export for the Dashboard "Export" button.
 *
 * The date range anchors ONE thing only: which indents were CREATED (Create Indent's own
 * `timestamp`) within [startDate, endDate]. That fixed set of indents (the "cohort") is then
 * used, as-is, to slice every downstream stage — PO Entry, Follow-Up Vendor, Transporter
 * Follow-Up, Material Received — regardless of when those downstream stages themselves
 * happened. This answers "of the indents created in this window, how many reached stage X",
 * not "what happened at stage X during this window".
 *
 * Deliberately excludes any planned/estimated/delay columns — only "what actually happened"
 * data, plus identifying context (Indent No / Item Name / Lift No).
 *
 * NOTE: from Follow-Up Vendor onward, records are per-LIFT (an indent can have multiple
 * lifts) — this is intentional per-stage granularity, not a bug. Each stage's list is
 * independent; there is no attempt to merge lifts back into one row per indent.
 */

async function fetchAllRows(tableName: string, selectQuery: string) {
  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectQuery)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...(data as any[]));
    if (data.length < pageSize) break;
    page++;
  }
  return allRows;
}

async function fetchInRange(tableName: string, selectQuery: string, fromTs: string, toTs: string) {
  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectQuery)
      .gte("timestamp", fromTs)
      .lte("timestamp", toTs)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...(data as any[]));
    if (data.length < pageSize) break;
    page++;
  }
  return allRows;
}

const fmt = (v: any) => (v === null || v === undefined ? "" : v);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: "startDate and endDate are required" }, { status: 400 });
    }

    const fromTs = `${startDate}T00:00:00.000`;
    const toTs = `${endDate}T23:59:59.999`;

    // Cancellation exclusion set — same pattern used across every other stage route.
    const { data: cancelledRows, error: cancelError } = await supabase
      .from("pfms_order-cancellation")
      .select("indentNo, liftNo");
    if (cancelError) throw cancelError;
    const cancelledIndentNos = new Set(
      (cancelledRows || []).filter((c: any) => !c.liftNo).map((c: any) => c.indentNo)
    );
    const cancelledLiftNos = new Set(
      (cancelledRows || []).filter((c: any) => c.liftNo).map((c: any) => c.liftNo)
    );
    const isIndentCancelled = (indentNo: string) => cancelledIndentNos.has(indentNo);
    const isLiftCancelled = (liftNo: string, indentNo: string) =>
      cancelledLiftNos.has(liftNo) || cancelledIndentNos.has(indentNo);

    // ---- 1. Create Indent (pfms_indent_generation) — the cohort anchor. ALL business columns. ----
    const createIndentRaw = await fetchInRange(
      "pfms_indent_generation",
      "timestamp, indentNo, createdBy, category, itemName, quantity, warehouseLocation, itemCode, leadTime, uom, attachment, status, remarks, purchaser",
      fromTs,
      toTs
    );
    const createIndentFiltered = createIndentRaw.filter((r: any) => !isIndentCancelled(r.indentNo));

    // The cohort: every indentNo created in the date range (this is the ONLY place the date
    // range is applied — everything below slices by cohort membership, not by its own timestamp).
    const cohortIndentNos = new Set(createIndentFiltered.map((r: any) => r.indentNo));

    const indentMap = new Map(createIndentFiltered.map((r: any) => [r.indentNo, r]));

    const createIndent = createIndentFiltered.map((r: any) => ({
      "Timestamp": fmt(r.timestamp),
      "Indent No": fmt(r.indentNo),
      "Created By": fmt(r.createdBy),
      "Category": fmt(r.category),
      "Item Name": fmt(r.itemName),
      "Quantity": fmt(r.quantity),
      "UOM": fmt(r.uom),
      "Warehouse Location": fmt(r.warehouseLocation),
      "Item Code": fmt(r.itemCode),
      "Lead Time (days)": fmt(r.leadTime),
      "Purchaser": fmt(r.purchaser),
      "Attachment": fmt(r.attachment),
      "Status": fmt(r.status),
      "Remarks": fmt(r.remarks),
    }));

    // Lift-level context map (liftNo -> indentNo) for the two lift-keyed stage tables that
    // don't carry indentNo themselves (Transporter Follow-Up, Material Received). Only needs
    // to cover lifts belonging to cohort indents.
    const liftRows = await fetchAllRows("pfms_lift", "liftNo, indentNo");
    const liftToIndent = new Map((liftRows || []).map((r: any) => [r.liftNo, r.indentNo]));

    // ---- 2. PO Entry — of the cohort, which indents reached PO Entry's history (any time) ----
    const poEntryRaw = await fetchAllRows(
      "pfms_po-entry",
      "timestamp, indentNo, poNumber, basicValue, totalWithTax, hsn, gst, pkgAmount, pkgGST"
    );
    const poEntry = poEntryRaw
      .filter((r: any) => cohortIndentNos.has(r.indentNo) && !isIndentCancelled(r.indentNo))
      .map((r: any) => ({
        "Indent No": fmt(r.indentNo),
        "Item Name": fmt(indentMap.get(r.indentNo)?.itemName),
        "Timestamp": fmt(r.timestamp),
        "PO Number": fmt(r.poNumber),
        "Basic Value": fmt(r.basicValue),
        "Total With Tax": fmt(r.totalWithTax),
        "HSN": fmt(r.hsn),
        "GST": fmt(r.gst),
        "Package Amount": fmt(r.pkgAmount),
        "Package GST": fmt(r.pkgGST),
      }));

    // ---- 3. Follow-Up Vendor (pfms_lift — this is where a lift first exists; 1 row per lift) ----
    const followUpVendorRaw = await fetchAllRows(
      "pfms_lift",
      "timestamp, liftNo, indentNo, liftingQty, transporterName, vehicleNo, contactNo, lrNo, dispatchDate, freightAmount, advanceAmount, paymentDate, paymentStatus, remarks"
    );
    const followUpVendor = followUpVendorRaw
      .filter((r: any) => cohortIndentNos.has(r.indentNo) && !isLiftCancelled(r.liftNo, r.indentNo))
      .map((r: any) => ({
        "Indent No": fmt(r.indentNo),
        "Item Name": fmt(indentMap.get(r.indentNo)?.itemName),
        "Lift No": fmt(r.liftNo),
        "Timestamp": fmt(r.timestamp),
        "Lifting Qty": fmt(r.liftingQty),
        "Transporter Name": fmt(r.transporterName),
        "Vehicle No": fmt(r.vehicleNo),
        "Contact No": fmt(r.contactNo),
        "LR No": fmt(r.lrNo),
        "Dispatch Date": fmt(r.dispatchDate),
        "Freight Amount": fmt(r.freightAmount),
        "Advance Amount": fmt(r.advanceAmount),
        "Payment Date": fmt(r.paymentDate),
        "Payment Status": fmt(r.paymentStatus),
        "Remarks": fmt(r.remarks),
      }));

    // ---- 4. Transporter Follow-Up ----
    const transporterFollowUpRaw = await fetchAllRows(
      "pfms_transporter-follow-up",
      "timestamp, liftNo, status, lastFollowUpDate, totalFollowUps, remarks"
    );
    const transporterFollowUp = transporterFollowUpRaw
      .filter((r: any) => {
        const indentNo = liftToIndent.get(r.liftNo) || "";
        return cohortIndentNos.has(indentNo) && !isLiftCancelled(r.liftNo, indentNo);
      })
      .map((r: any) => {
        const indentNo = liftToIndent.get(r.liftNo) || "";
        return {
          "Indent No": fmt(indentNo),
          "Item Name": fmt(indentMap.get(indentNo)?.itemName),
          "Lift No": fmt(r.liftNo),
          "Timestamp": fmt(r.timestamp),
          "Status": fmt(r.status),
          "Last Follow-Up Date": fmt(r.lastFollowUpDate),
          "Total Follow-Ups": fmt(r.totalFollowUps),
          "Remarks": fmt(r.remarks),
        };
      });

    // ---- 5. Material Received ----
    const materialReceivedRaw = await fetchAllRows(
      "pfms_material-received",
      "timestamp, liftNo, invoiceType, invoiceNumber, invoiceDate, receivedQty, qcRequired, damagedQty, damageReason, extraFreight, hydraAmt, labourAmt, hamaliAmt, warranty, warrantyDuration, warrantyExpiry, productExpiryDate"
    );
    const materialReceived = materialReceivedRaw
      .filter((r: any) => {
        const indentNo = liftToIndent.get(r.liftNo) || "";
        return cohortIndentNos.has(indentNo) && !isLiftCancelled(r.liftNo, indentNo);
      })
      .map((r: any) => {
        const indentNo = liftToIndent.get(r.liftNo) || "";
        return {
          "Indent No": fmt(indentNo),
          "Item Name": fmt(indentMap.get(indentNo)?.itemName),
          "Lift No": fmt(r.liftNo),
          "Timestamp": fmt(r.timestamp),
          "Invoice Type": fmt(r.invoiceType),
          "Invoice Number": fmt(r.invoiceNumber),
          "Invoice Date": fmt(r.invoiceDate),
          "Received Qty": fmt(r.receivedQty),
          "QC Required": fmt(r.qcRequired),
          "Damaged Qty": fmt(r.damagedQty),
          "Damage Reason": fmt(r.damageReason),
          "Extra Freight": fmt(r.extraFreight),
          "Hydra Amount": fmt(r.hydraAmt),
          "Labour Amount": fmt(r.labourAmt),
          "Hamali Amount": fmt(r.hamaliAmt),
          "Warranty": fmt(r.warranty),
          "Warranty Duration (months)": fmt(r.warrantyDuration),
          "Warranty Expiry": fmt(r.warrantyExpiry),
          "Product Expiry Date": fmt(r.productExpiryDate),
        };
      });

    return NextResponse.json({
      success: true,
      cohortSize: cohortIndentNos.size,
      stages: {
        "Create Indent": createIndent,
        "PO Entry": poEntry,
        "Follow-Up Vendor": followUpVendor,
        "Transporter Follow-Up": transporterFollowUp,
        "Material Received": materialReceived,
      },
    });
  } catch (error: any) {
    console.error("Error in dashboard export-stagewise GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
