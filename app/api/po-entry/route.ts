import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { calculatePlannedTime, getLocalTimestamp } from "@/app/api/helper/plannedCalculator";
import { canViewPurchaserRecord, sortByIndentNumber } from "@/lib/utils";

// Same lazy-history pattern used across other stages: `view=pending` (default) only
// builds Pending + a cheap `historyCount`; `view=history` is only requested once the
// user opens that tab, and returns at most `limit` (100 default, 200 once searched)
// rows, filtered/sorted server-side. `poTotals` (per-PO grand total, shown in the
// History table's "Total Amount" column) is aggregated across ALL completed records —
// not just the returned page — so it stays correct regardless of pagination.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") === "history" ? "history" : "pending";
    const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10) || 0);
    const search = (searchParams.get("search") || "").toLowerCase().trim();
    const sortDir = searchParams.get("sort") === "desc" ? "desc" : "asc";
    const limit = search ? 200 : 100;
    const role = searchParams.get("role");
    const records = searchParams.get("records");

    // Admin History-edit tool: every indent sharing one PO Number, with enough context
    // (approvedQty, selected vendor + its Update-3-Vendors rate) to edit Basic Value/GST%
    // per item and cascade the resulting rate back into Update-3-Vendors — see
    // "editHistoryGroup" below.
    const poNumberParam = searchParams.get("poNumber");
    if (poNumberParam) {
      const { data: poRows, error: poError } = await supabase
        .from("pfms_po-entry")
        .select("*")
        .eq("poNumber", poNumberParam);
      if (poError) throw poError;
      if (!poRows || poRows.length === 0) {
        return NextResponse.json({ success: false, error: "No PO Entry rows found for that PO Number" }, { status: 404 });
      }

      const indentNos = poRows.map((r: any) => r.indentNo);
      const { data: indentRows, error: indentErr } = await supabase
        .from("pfms_indent_generation")
        .select(`
          indentNo, itemName,
          approval:pfms_indent-approval(approvedQty),
          negotiation:pfms_negotiation(selectedVendorName),
          update3Vendors:pfms_update-3-vendors(vendor1Name, vendor1Rate, vendor2Name, vendor2Rate, vendor3Name, vendor3Rate)
        `)
        .in("indentNo", indentNos);
      if (indentErr) throw indentErr;

      const indentByNo = new Map((indentRows || []).map((r: any) => [r.indentNo, r]));

      const groupItems = poRows.map((po: any) => {
        const indentRow = indentByNo.get(po.indentNo) || {};
        const approval = Array.isArray(indentRow.approval) ? (indentRow.approval[0] || {}) : (indentRow.approval || {});
        const negotiation = Array.isArray(indentRow.negotiation) ? (indentRow.negotiation[0] || {}) : (indentRow.negotiation || {});
        const vendors = Array.isArray(indentRow.update3Vendors) ? (indentRow.update3Vendors[0] || {}) : (indentRow.update3Vendors || {});
        const selected = negotiation.selectedVendorName || "";
        let vendorName = "-";
        let vendorRate: number | null = null;
        if (selected === vendors.vendor1Name) { vendorName = vendors.vendor1Name; vendorRate = vendors.vendor1Rate; }
        else if (selected === vendors.vendor2Name) { vendorName = vendors.vendor2Name; vendorRate = vendors.vendor2Rate; }
        else if (selected === vendors.vendor3Name) { vendorName = vendors.vendor3Name; vendorRate = vendors.vendor3Rate; }

        return {
          indentNo: po.indentNo,
          itemName: indentRow.itemName || "",
          quantity: approval.approvedQty || 0,
          vendorName,
          vendorRate,
          basicValue: po.basicValue,
          gst: po.gst,
          totalWithTax: po.totalWithTax,
        };
      });

      return NextResponse.json({
        success: true,
        poNumber: poNumberParam,
        poCopy: poRows[0].poCopy || "",
        pkgAmount: poRows[0].pkgAmount || "",
        pkgGST: poRows[0].pkgGST || "",
        items: groupItems,
      });
    }

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
      })
      .filter((row: any) => canViewPurchaserRecord(row.data.purchaser, records, role));

    const pendingAll = mappedData.filter((r: any) => r.status === "pending");
    const completedAll = mappedData.filter((r: any) => r.status === "completed");

    if (view === "pending") {
      return NextResponse.json({
        success: true,
        pending: pendingAll,
        historyCount: completedAll.length,
      });
    }

    // Per-PO grand total across every completed record (not just this page).
    const poTotals: Record<string, number> = {};
    for (const r of completedAll) {
      const po = r.data.poNumber;
      if (po && po !== "-") {
        const amount = parseFloat(String(r.data.totalWithTax || "0").replace(/[^0-9.]/g, "")) || 0;
        poTotals[po] = (poTotals[po] || 0) + amount;
      }
    }

    let filteredHistory = completedAll;
    if (search) {
      filteredHistory = filteredHistory.filter((r: any) => {
        const selectedId = String(r.data.selectedVendor || "1");
        const idx = parseInt(selectedId.toLowerCase().replace("vendor", "").trim(), 10) || 1;
        const vName = r.data[`vendor${idx}Name`] || "";
        return (
          r.data.indentNumber?.toLowerCase().includes(search) ||
          r.data.itemName?.toLowerCase().includes(search) ||
          vName.toLowerCase().includes(search) ||
          String(r.data.poNumber || "").toLowerCase().includes(search)
        );
      });
    }

    filteredHistory = sortByIndentNumber(filteredHistory, sortDir);

    const totalCount = filteredHistory.length;
    const pageStart = page * limit;
    const pagedHistory = filteredHistory.slice(pageStart, pageStart + limit);

    return NextResponse.json({
      success: true,
      history: pagedHistory,
      totalCount,
      poTotals,
    });
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

    // Edit every indent under one PO Number at once (admin-only, from the History tab) —
    // mirrors the original Bulk PO creation form. Basic Value/GST% are per-item; Pkg
    // Amount/Pkg GST%/PO Copy are shared across the whole PO (same as at creation time).
    // Basic Value changes cascade into Update-3-Vendors' rate for that indent's selected
    // vendor (rate = basicValue / approvedQty), so the two stay consistent — see the
    // reverse cascade (rate -> basicValue) in app/api/update-3-vendors/route.ts.
    if (action === "editHistoryGroup") {
      const { poNumber, poCopy, pkgAmount, pkgGST, items } = body;

      if (!poNumber || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ success: false, error: "Missing poNumber or items" }, { status: 400 });
      }

      const now = getLocalTimestamp();
      const pkgAmountNum = parseFloat(pkgAmount) || 0;
      const pkgGstRate = (parseFloat(String(pkgGST || "").replace("%", "").trim()) || 0) / 100;
      const perItemPkgTotal = (pkgAmountNum * (1 + pkgGstRate)) / items.length;

      for (const item of items) {
        const { indentNo, basicValue, gst } = item;
        if (!indentNo) continue;

        const basicValueNum = parseFloat(basicValue) || 0;
        const gstRate = (parseFloat(String(gst || "").replace("%", "").trim()) || 0) / 100;
        const totalWithTax = parseFloat((basicValueNum * (1 + gstRate) + perItemPkgTotal).toFixed(2));

        const { error: poUpdateError } = await supabase
          .from("pfms_po-entry")
          .update({
            basicValue: basicValueNum,
            gst,
            totalWithTax,
            pkgAmount: pkgAmountNum || null,
            pkgGST: pkgGST || null,
            poCopy: poCopy !== undefined ? poCopy : undefined,
            updatedAt: now,
          })
          .eq("indentNo", indentNo);
        if (poUpdateError) throw poUpdateError;

        // Cascade: keep Update-3-Vendors' rate for the selected vendor consistent with the
        // new Basic Value (rate = basicValue / approvedQty).
        const { data: approvalRow } = await supabase
          .from("pfms_indent-approval")
          .select("approvedQty")
          .eq("indentNo", indentNo)
          .maybeSingle();
        const quantity = parseFloat(approvalRow?.approvedQty) || 0;
        if (quantity <= 0) continue;
        const newRate = parseFloat((basicValueNum / quantity).toFixed(2));

        const { data: negotiation } = await supabase
          .from("pfms_negotiation")
          .select("selectedVendorName")
          .eq("indentNo", indentNo)
          .maybeSingle();
        if (!negotiation?.selectedVendorName) continue;

        const { data: vendorsRow } = await supabase
          .from("pfms_update-3-vendors")
          .select("vendor1Name, vendor2Name, vendor3Name")
          .eq("indentNo", indentNo)
          .maybeSingle();
        if (!vendorsRow) continue;

        const selected = negotiation.selectedVendorName;
        let rateColumn: string | null = null;
        if (selected === vendorsRow.vendor1Name) rateColumn = "vendor1Rate";
        else if (selected === vendorsRow.vendor2Name) rateColumn = "vendor2Rate";
        else if (selected === vendorsRow.vendor3Name) rateColumn = "vendor3Rate";

        if (rateColumn) {
          const { error: vendorUpdateError } = await supabase
            .from("pfms_update-3-vendors")
            .update({ [rateColumn]: newRate, updatedAt: now })
            .eq("indentNo", indentNo);
          if (vendorUpdateError) throw vendorUpdateError;
        }
      }

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
