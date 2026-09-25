import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { calculatePlannedTime, getLocalTimestamp } from "@/app/api/helper/plannedCalculator";
import { canViewPurchaserRecord } from "@/lib/utils";

// `view=pending` (default) is what loads on every page open/poll — it only builds the
// Pending array plus a cheap `historyCount` (for the History tab badge), and never
// builds or returns the (potentially much larger) History row objects. `view=history`
// is only requested once the user actually opens that tab, and returns at most `limit`
// (default 200) rows already filtered by search/warehouse/purchaser-visibility, plus
// `totalCount` for that filtered set — so History no longer rides along on every
// Pending load/poll, and its payload is capped regardless of how many records exist.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") === "history" ? "history" : "pending";
    const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10) || 0);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "200", 10) || 200));
    const search = (searchParams.get("search") || "").toLowerCase().trim();
    const warehouse = searchParams.get("warehouse") || "All";
    const role = searchParams.get("role");
    const records = searchParams.get("records");

    // 1. Fetch all material received records that have plannedTallyEntry populated
    const { data: materials, error: matError } = await supabase
      .from("pfms_material-received")
      .select(`
        *,
        lift:pfms_lift!inner (
          *,
          tallyEntry:"pfms_tally-entry" (
            id,
            timestamp,
            doneBy,
            doneDate,
            remarks,
            checkedStatus,
            checkedByAcc
          ),
          indent:"pfms_indent_generation"!inner (
            indentNo,
            itemName,
            category,
            warehouseLocation,
            quantity,
            createdBy,
            purchaser,
            negotiation:pfms_negotiation (
              selectedVendorName
            ),
            poEntry:"pfms_po-entry" (
              poNumber,
              poCopy,
              basicValue,
              totalWithTax,
              pkgAmount,
              pkgGST
            )
          )
        )
      `)
      .not("plannedTallyEntry", "is", null)
      .order("timestamp", { ascending: false }) as any;

    if (matError) throw matError;

    // Qty-resolution ledger, only relevant for lifts where QC was required. A QC=Yes lift
    // stays locked out of this stage entirely until Material Testing (and Repair Process,
    // if any qty was routed there) fully resolve it.
    const { data: ledgerRows, error: ledgerError } = await supabase
      .from("pfms_lift_qc_resolution")
      .select("liftNo, passedQty, repairedQty, isFullyResolved, releasedAt");
    if (ledgerError) throw ledgerError;
    const ledgerMap = new Map((ledgerRows || []).map((l: any) => [l.liftNo, l]));

    const pending = [];
    const history = [];
    let historyCount = 0;

    for (const mat of (materials || [])) {
      const lift = mat.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const poEntry = Array.isArray(indent.poEntry) ? (indent.poEntry[0] || {}) : (indent.poEntry || {});

      const tally = Array.isArray(lift.tallyEntry) ? lift.tallyEntry[0] : lift.tallyEntry;

      // If QC was required for this lift, it isn't ready for Receipt in Tally until Material
      // Testing/Repair Process have fully resolved it (ledger released). Skip it entirely
      // (not pending, not history) until then.
      let readyQty = mat.receivedQty || 0;
      if (mat.qcRequired === "yes") {
        const ledger: any = ledgerMap.get(lift.liftNo);
        if (!ledger || !ledger.isFullyResolved || !ledger.releasedAt) {
          continue;
        }
        readyQty = (ledger.passedQty || 0) + (ledger.repairedQty || 0);
      }

      const vendorName = negotiation.selectedVendorName || "-";
      const basicValue = poEntry.basicValue !== undefined && poEntry.basicValue !== null ? poEntry.basicValue : "-";
      const totalWithTax = poEntry.totalWithTax !== undefined && poEntry.totalWithTax !== null ? poEntry.totalWithTax : "-";

      const itemData = {
        indentNumber: indent.indentNo || "",
        liftNumber: lift.liftNo || "",
        vendorName: vendorName,
        poNumber: poEntry.poNumber || "-",
        remarksStage6: lift.remarks || "",
        itemName: indent.itemName || "",
        quantity: lift.quantity || "",
        indentQty: indent.quantity || "",
        transporterName: lift.transporterName || "",
        vehicleNo: lift.vehicleNo || "",
        contactNo: lift.contactNo || "",
        lrNo: lift.lrNo || "",
        dispatchDate: lift.dispatchDate || "",
        freightAmount: lift.freightAmount || "",
        advanceAmount: lift.advanceAmount || "",
        paymentDate: lift.paymentDate || "",
        paymentStatus: lift.paymentStatus || "",
        biltyCopy: lift.biltyCopy || "",
        invoiceType: mat.invoiceType || "-",
        invoiceDate: mat.invoiceDate || "-",
        invoiceNumber: mat.invoiceNumber || "-",
        receivedQty: mat.receivedQty || "-",
        readyQty: readyQty,
        receivedItemImage: mat.receivedItemImage || "",
        srnNumber: "-", // populated downstream in testing
        qcRequirement: mat.qcRequired || "-",
        billAttachment: mat.billAttachment || lift.biltyCopy || "",
        paymentAmountHydra: mat.hydraAmt || "",
        paymentAmountLabour: mat.labourAmt || "",
        paymentAmountHamali: mat.hamaliAmt || "",
        remarks7: mat.damageReason || "",

        plan8: mat.plannedTallyEntry || "",
        actual8: tally ? tally.timestamp : "",
        doneBy: tally ? tally.doneBy : "-",
        doneDate: tally ? tally.doneDate : "",
        remarks: tally ? tally.remarks : "",
        checkedStatus: tally ? tally.checkedStatus : "",
        checkedByAcc: tally ? tally.checkedByAcc : "",
        tallyStatus: tally ? tally.checkedStatus : "",

        createdBy: indent.createdBy || "-",
        category: indent.category || "-",
        warehouse: indent.warehouseLocation || "-",
        basicValue: basicValue,
        totalWithTax: totalWithTax,
        poCopy: poEntry.poCopy || "",
        purchaser: indent.purchaser || null,
      };

      if (!canViewPurchaserRecord(itemData.purchaser, records, role)) continue;

      const mappedRecord = {
        id: lift.liftNo,
        rowIndex: lift.liftNo, // placeholder for legacy key
        stage: 9,
        status: tally ? "completed" : "pending",
        data: itemData
      };

      if (tally) {
        // On a `view=pending` request we only need the count for the History tab's
        // badge, not the (often much larger) row objects — those are built and sent
        // only when the user actually opens History (see `view === "history"` below).
        if (view === "history") {
          history.push(mappedRecord);
        } else {
          historyCount++;
        }
      } else {
        pending.push(mappedRecord);
      }
    }

    // Fetch cancellations
    const { data: cancelledList } = await supabase
      .from("pfms_order-cancellation")
      .select("indentNo");
    const cancelledNos = new Set((cancelledList || []).map((c: any) => c.indentNo));

    const filteredPending = pending.filter((row: any) => !cancelledNos.has(row.data.indentNumber));

    if (view === "pending") {
      return NextResponse.json({
        success: true,
        pending: filteredPending,
        historyCount,
      });
    }

    // view === "history": apply the same search/warehouse filters the page used to run
    // client-side over the full list, then page the result server-side (default 200/page)
    // so at most `limit` rows ever go over the wire, however large History actually is.
    const filteredHistory = history.filter((row: any) => {
      if (warehouse === "NE Warehouse" && row.data.warehouse !== "NE Warehouse") return false;
      if (warehouse === "Others" && row.data.warehouse === "NE Warehouse") return false;
      if (!search) return true;
      return (
        row.data.indentNumber?.toLowerCase().includes(search) ||
        row.data.itemName?.toLowerCase().includes(search) ||
        row.data.vendorName?.toLowerCase().includes(search) ||
        String(row.data.poNumber || "").toLowerCase().includes(search) ||
        String(row.data.invoiceNumber || "").toLowerCase().includes(search)
      );
    });

    const totalCount = filteredHistory.length;
    const pageStart = page * limit;
    const pagedHistory = filteredHistory.slice(pageStart, pageStart + limit);

    return NextResponse.json({
      success: true,
      history: pagedHistory,
      totalCount,
    });

  } catch (error: any) {
    console.error("Error in tally-entry GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Records this lift's item into OTP_Supabase's IMS as one INN batch (FIFO,
// keyed by invoice_date) — best-effort: a failure here never blocks the
// Tally Entry submission itself, it just gets logged.
//
// Purchase-FMS-Supabase (this project, zpkikvgmmbtekbcuqahf) and
// OTP_Supabase (nfwtbrmqvsejwwvraanf) are SEPARATE Supabase projects — the
// IMS schema only exists in OTP_Supabase's DB, so this can't be a direct
// Postgres RPC; it's an HTTP call to OTP_Supabase's own IMS sync endpoint
// instead (mirrors the existing PFMS-indent / webhook integration pattern
// already used elsewhere between these two apps).
async function recordImsReceipt(liftNo: string, createdBy: string | null) {
  try {
    const { data: mat, error: matError } = await supabase
      .from("pfms_material-received")
      .select(`
        receivedQty, invoiceDate, invoiceNumber, qcRequired,
        lift:pfms_lift!inner (
          liftNo,
          indent:"pfms_indent_generation"!inner ( itemName, warehouseLocation )
        )
      `)
      .eq("liftNo", liftNo)
      .maybeSingle() as any;
    if (matError || !mat) {
      console.error(`IMS receipt skipped for lift ${liftNo}: material-received row not found`, matError);
      return;
    }

    const indent = mat.lift?.indent || {};
    let qty = mat.receivedQty || 0;
    if (mat.qcRequired === "yes") {
      const { data: ledger } = await supabase
        .from("pfms_lift_qc_resolution")
        .select("passedQty, repairedQty, isFullyResolved")
        .eq("liftNo", liftNo)
        .maybeSingle();
      if (!ledger?.isFullyResolved) {
        console.error(`IMS receipt skipped for lift ${liftNo}: QC not yet fully resolved`);
        return;
      }
      qty = (ledger.passedQty || 0) + (ledger.repairedQty || 0);
    }

    if (!indent.itemName || !qty) {
      console.error(`IMS receipt skipped for lift ${liftNo}: missing item name or qty`);
      return;
    }

    const imsBaseUrl = process.env.OTP_SUPABASE_APP_URL || "https://otp-supabase.vercel.app";
    const response = await fetch(`${imsBaseUrl}/api/otp-supabase/ims/receive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.IMS_SYNC_SECRET ? { "x-ims-secret": process.env.IMS_SYNC_SECRET } : {}),
      },
      body: JSON.stringify({
        itemName: indent.itemName,
        locationLabel: indent.warehouseLocation,
        invoiceDate: mat.invoiceDate || null,
        qty,
        sourceType: "tally_entry",
        sourceRef: `lift:${liftNo}|invoice:${mat.invoiceNumber || ""}`,
        createdBy: createdBy || null,
      }),
    });
    const result = await response.json();
    if (!result.success) console.error(`IMS receipt failed for lift ${liftNo}:`, result.error);
  } catch (err) {
    console.error(`IMS receipt exception for lift ${liftNo}:`, err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { records } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ success: false, error: "No records to process" }, { status: 400 });
    }

    const now = getLocalTimestamp();

    // Calculate planned time for submit-invoice-ho
    const plannedInvoiceHO = await calculatePlannedTime("submit-invoice-ho");

    // Batch insert tally entries
    const inserts = records.map((rec: any) => ({
      id: randomUUID(),
      timestamp: now,
      liftNo: rec.liftNo,
      doneBy: rec.doneBy,
      doneDate: rec.doneDate ? getLocalTimestamp(rec.doneDate) : null,
      remarks: rec.remarks || null,
      checkedStatus: rec.checkedStatus,
      checkedByAcc: rec.checkedStatus === "Yes" ? rec.checkedByAcc : null,
      plannedInvoiceHO: plannedInvoiceHO,
      createdAt: now,
      updatedAt: now
    }));

    const { error: insertError } = await supabase
      .from("pfms_tally-entry")
      .insert(inserts);

    if (insertError) throw insertError;

    // IMS INN — one stock batch per lift, best-effort (see recordImsReceipt).
    await Promise.all(records.map((rec: any) => recordImsReceipt(rec.liftNo, rec.doneBy)));

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in tally-entry POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
