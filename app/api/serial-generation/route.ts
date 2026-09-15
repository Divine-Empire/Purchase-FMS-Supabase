import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { calculatePlannedTime, getLocalTimestamp } from "@/app/api/helper/plannedCalculator";

export async function GET(request: NextRequest) {
  try {
    const prefix = request.nextUrl.searchParams.get("prefix");
    const isDirectParam = request.nextUrl.searchParams.get("isDirect") === "true" || (prefix && prefix.startsWith("SN-DIR-"));

    if (prefix) {
      const tableName = isDirectParam ? "pfms_direct_serial_numbers" : "pfms_serial-number";
      const { data: serials, error } = await supabase
        .from(tableName)
        .select("serialNo")
        .ilike("serialNo", `${prefix}%`);
      if (error) throw error;
      let maxSeq = 0;
      for (const s of (serials || [])) {
        if (!s.serialNo) continue;
        const suffix = s.serialNo.startsWith(prefix)
          ? s.serialNo.slice(prefix.length)
          : (s.serialNo.split("/").pop() || "");
        const match = suffix.match(/^\d+/);
        if (match) {
          const seqNum = parseInt(match[0], 10);
          if (!isNaN(seqNum) && seqNum > maxSeq) {
            maxSeq = seqNum;
          }
        } else {
          const parts = s.serialNo.split("/");
          if (parts.length >= 3) {
            const seqNum = parseInt(parts[2], 10);
            if (!isNaN(seqNum) && seqNum > maxSeq) {
              maxSeq = seqNum;
            }
          }
        }
      }
      return NextResponse.json({ success: true, nextSequence: maxSeq + 1 });
    }

    const liftNo = request.nextUrl.searchParams.get("liftNo");
    if (liftNo) {
      const { data: serials, error } = await supabase
        .from("pfms_serial-number")
        .select("serialNo")
        .eq("liftNo", liftNo);
      if (error) throw error;
      return NextResponse.json({ success: true, serials: (serials || []).map(s => s.serialNo) });
    }

    // 1. Fetch all material received records
    const { data: receipts, error: receiptError } = await supabase
      .from("pfms_material-received")
      .select(`
        *,
        lift:pfms_lift!inner (
          liftNo,
          plannedSerialGen,
          indent:pfms_indent_generation!inner (
            indentNo,
            itemName,
            purchaser,
            negotiation:pfms_negotiation (
              selectedVendorName
            ),
            poEntry:pfms_po-entry (
              poNumber,
              poCopy
            )
          )
        )
      `) as any;

    if (receiptError) throw receiptError;

    // 2. Fetch all serial numbers using pagination to bypass PostgREST default limit
    const serials: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data: pageSerials, error: pageError } = await supabase
        .from("pfms_serial-number")
        .select("*")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (pageError) throw pageError;
      if (!pageSerials || pageSerials.length === 0) {
        hasMore = false;
      } else {
        serials.push(...pageSerials);
        if (pageSerials.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    // 3. Fetch item codes
    const { data: itemsMaster } = await supabase
      .from("pfms_item_master")
      .select('"ITEM CODE", "ITEM NAME"');

    // 4. Fetch vendor codes
    const { data: vendorsMaster } = await supabase
      .from("pfms_vendor-master")
      .select('"Vendor Code", "Vendor List"');

    // Group serials by liftNo
    const serialsByLift = new Map<string, any[]>();
    for (const s of (serials || [])) {
      const list = serialsByLift.get(s.liftNo) || [];
      list.push(s);
      serialsByLift.set(s.liftNo, list);
    }

    // Serial Generation no longer waits on Material Testing/Repair Process to resolve QC —
    // a lift becomes eligible as soon as Material Received is recorded, regardless of
    // qcRequired. We still read the ledger (where it exists) purely to report how much of
    // the lift's qty has been QC-passed so far; it no longer gates pending/history inclusion.
    // NOTE: removing this gate also removes the only practical guard against generating more
    // serials than have actually passed QC for qcRequired="yes" lifts — see plannedCalculator/
    // serial-generation POST handler, which performs no quantity validation of its own.
    const { data: ledgerRows, error: ledgerError } = await supabase
      .from("pfms_lift_qc_resolution")
      .select("liftNo, passedQty, repairedQty, isFullyResolved, releasedAt");
    if (ledgerError) throw ledgerError;
    const ledgerMap = new Map((ledgerRows || []).map((l: any) => [l.liftNo, l]));

    const pending: any[] = [];
    const history: any[] = [];

    for (const receipt of (receipts || [])) {
      const lift = receipt.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const poEntry = Array.isArray(indent.poEntry) ? (indent.poEntry[0] || {}) : (indent.poEntry || {});

      const liftNo = lift.liftNo;
      const liftSerials = serialsByLift.get(liftNo) || [];

      // readyQty is informational only now. For QC-required lifts still mid-QC, it reflects
      // however much has passed/been repaired so far (0 if QC hasn't started); it no longer
      // blocks the lift from appearing here.
      let readyQty = receipt.receivedQty || 0;
      if (receipt.qcRequired === "yes") {
        const ledger: any = ledgerMap.get(liftNo);
        readyQty = ledger ? (ledger.passedQty || 0) + (ledger.repairedQty || 0) : 0;
      }

      const record = {
        id: `${indent.indentNo || ""}_${liftNo || ""}`,
        raIndex: null,
        data: {
          indentNo: indent.indentNo || "",
          liftNo: liftNo || "",
          vendorName: negotiation.selectedVendorName || "-",
          poNumber: poEntry.poNumber || "-",
          itemName: indent.itemName || "",
          receivedQty: receipt.receivedQty || 0,
          readyQty: readyQty,
          invoiceDate: receipt.invoiceDate || "",
          invoiceNo: receipt.invoiceNumber || "",
          invoiceCopy: receipt.billAttachment || "",
          poCopy: poEntry.poCopy || "",
          warrantyExpiry: receipt.warrantyExpiry || "",
          productExpiry: receipt.productExpiryDate || "",
          planned: lift.plannedSerialGen || "",
          actual: liftSerials.length > 0 ? liftSerials[0].timestamp : null,
          serials: liftSerials.map(s => ({
            serialNo: s.serialNo,
            qrLink: s.qrLink
          })),
          purchaser: indent.purchaser || null,
        }
      };

      if (liftSerials.length > 0) {
        history.push(record);
      } else {
        pending.push(record);
      }
    }

    // 5. Fetch direct serial numbers from pfms_direct_serial_numbers and group by batchId
    const { data: directSerials, error: directErr } = await supabase
      .from("pfms_direct_serial_numbers")
      .select("*")
      .order("createdAt", { ascending: false });

    if (!directErr && directSerials && directSerials.length > 0) {
      const groupedDirectMap = new Map<string, any[]>();
      for (const ds of directSerials) {
        const key = ds.batchId || ds.id;
        const list = groupedDirectMap.get(key) || [];
        list.push(ds);
        groupedDirectMap.set(key, list);
      }

      for (const [batchId, items] of groupedDirectMap.entries()) {
        const first = items[0];
        history.push({
          id: `direct_${batchId}`,
          raIndex: null,
          isDirect: true,
          data: {
            indentNo: "DIRECT",
            liftNo: "-",
            vendorName: first.vendorName || "-",
            poNumber: "-",
            itemName: first.itemName || "",
            receivedQty: items.length,
            invoiceDate: first.invoiceDate || "",
            invoiceNo: "Direct",
            invoiceCopy: "-",
            poCopy: "-",
            warrantyExpiry: first.warrantyExpiry || "",
            productExpiry: first.productExpiry || "",
            planned: "-",
            actual: first.timestamp || first.createdAt || null,
            serials: items.map(s => ({
              serialNo: s.serialNo,
              qrLink: s.qrLink
            }))
          }
        });
      }
    }

    const itemCodeMap: Record<string, string> = {};
    (itemsMaster || []).forEach((row: any) => {
      const name = row["ITEM NAME"]?.trim();
      const code = row["ITEM CODE"]?.trim();
      if (name && code) itemCodeMap[name] = code;
    });

    const vendorCodeMap: Record<string, string> = {};
    const validMasters = (vendorsMaster || []).filter(
      (m: any) => m["Vendor Code"] && m["Vendor Code"] !== "null" && m["Vendor Code"] !== ""
    );

    // Populate exact matches
    validMasters.forEach((row: any) => {
      const name = row["Vendor List"]?.trim();
      const code = row["Vendor Code"]?.trim();
      if (name && code) vendorCodeMap[name] = code;
    });

    // Helper functions for name cleaning and matching
    const cleanName = (name: string) => {
      if (!name) return "";
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .replace(/\b(ms|limited|ltd|pvt|co|company|private)\b/g, "")
        .trim();
    };

    const findBestMatch = (negName: string) => {
      const nameLower = negName.trim().toLowerCase();
      
      let best = validMasters.find((m: any) => m["Vendor List"]?.trim().toLowerCase() === nameLower);
      if (best) return best;

      const cleanNeg = cleanName(negName);
      if (!cleanNeg) return null;

      best = validMasters.find((m: any) => cleanName(m["Vendor List"]) === cleanNeg);
      if (best) return best;

      if (cleanNeg.length >= 6) {
        best = validMasters.find((m: any) => {
          const cleanMaster = cleanName(m["Vendor List"]);
          return cleanMaster && cleanMaster.length >= 6 && 
                 (cleanMaster.includes(cleanNeg) || cleanNeg.includes(cleanMaster));
        });
        if (best) return best;
      }

      best = validMasters.find((m: any) => {
        const cleanMaster = cleanName(m["Vendor List"]);
        if (!cleanMaster || cleanMaster.length < 8 || cleanNeg.length < 8) return false;
        return cleanMaster.substring(0, 8) === cleanNeg.substring(0, 8);
      });

      return best || null;
    };

    for (const receipt of (receipts || [])) {
      const lift = receipt.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const vendorName = negotiation.selectedVendorName;
      if (vendorName && !vendorCodeMap[vendorName]) {
        const match = findBestMatch(vendorName);
        if (match) {
          vendorCodeMap[vendorName] = match["Vendor Code"].trim();
        }
      }
    }

    // Fetch cancellations
    const { data: cancelledList } = await supabase
      .from("pfms_order-cancellation")
      .select("indentNo");
    const cancelledNos = new Set((cancelledList || []).map((c: any) => c.indentNo));

    const filteredPending = pending.filter((row: any) => !cancelledNos.has(row.data.indentNo));

    return NextResponse.json({
      success: true,
      pending: filteredPending,
      history,
      itemCodeMap,
      vendorCodeMap
    });

  } catch (error: any) {
    console.error("Error in serial-generation GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { records, isDirect, directForm, serials } = body;

    const now = getLocalTimestamp();

    if (isDirect) {
      if (!directForm || !serials || serials.length === 0) {
        return NextResponse.json({ success: false, error: "Missing direct form data" }, { status: 400 });
      }

      const batchId = `DIR-BATCH-${Date.now()}`;

      // Calculate warranty expiration
      let formattedWarrantyEnd = null;
      if (directForm.invoiceDate && directForm.duration) {
        const d = new Date(directForm.invoiceDate);
        const months = parseInt(directForm.duration, 10);
        if (!isNaN(d.getTime()) && !isNaN(months)) {
          d.setMonth(d.getMonth() + months);
          formattedWarrantyEnd = getLocalTimestamp(d);
        }
      }

      const invoiceDateTs = directForm.invoiceDate ? getLocalTimestamp(directForm.invoiceDate) : now;

      const directSerialsToInsert = serials.map((s: any) => ({
        id: randomUUID(),
        batchId: batchId,
        timestamp: now,
        itemName: directForm.itemName,
        vendorName: directForm.vendorName,
        invoiceDate: invoiceDateTs,
        warrantyDuration: parseInt(directForm.duration, 10) || 12,
        serialNo: s.serialNo,
        qrLink: s.qrLink || null,
        warrantyExpiry: formattedWarrantyEnd,
        productExpiry: null,
        createdAt: now,
        updatedAt: now
      }));

      // Check duplicates in both pfms_direct_serial_numbers and pfms_serial-number
      const serialNosToCheck = directSerialsToInsert.map((s: any) => s.serialNo).filter(Boolean);
      if (serialNosToCheck.length > 0) {
        const { data: dupDirect } = await supabase
          .from("pfms_direct_serial_numbers")
          .select("serialNo")
          .in("serialNo", serialNosToCheck);

        const { data: dupStandard } = await supabase
          .from("pfms_serial-number")
          .select("serialNo")
          .in("serialNo", serialNosToCheck);

        const existingSerials = [...(dupDirect || []), ...(dupStandard || [])];
        if (existingSerials.length > 0) {
          const dupes = existingSerials.map(e => e.serialNo).join(", ");
          return NextResponse.json({
            success: false,
            error: `Duplicate serial number(s) detected: ${dupes}. Please regenerate serial numbers.`
          }, { status: 400 });
        }
      }

      const { error: insertError } = await supabase
        .from("pfms_direct_serial_numbers")
        .insert(directSerialsToInsert);

      if (insertError) throw insertError;

      return NextResponse.json({ success: true });
    }

    // --- STANDARD PO SERIAL GENERATION ---
    if (!records || records.length === 0) {
      return NextResponse.json({ success: false, error: "No records to process" }, { status: 400 });
    }

    // Calculate planned time for warranty-claim
    const plannedWarrantyClaim = await calculatePlannedTime("warranty-claim");
    const serialsToInsert = [];

    for (const record of records) {
      const liftNo = record.liftNo;
      for (const s of record.serials) {
        serialsToInsert.push({
          id: randomUUID(),
          timestamp: now,
          liftNo: liftNo,
          serialNo: s.serialNo,
          qrLink: s.qrLink || null,
          warrantyExpiry: s.warrantyExpiry ? getLocalTimestamp(s.warrantyExpiry) : null,
          productExpiry: s.productExpiry ? getLocalTimestamp(s.productExpiry) : null,
          plannedWarrantyClaim: plannedWarrantyClaim,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    const serialNosToCheck = serialsToInsert.map(s => s.serialNo).filter(Boolean);
    if (serialNosToCheck.length > 0) {
      const { data: dupDirect } = await supabase
        .from("pfms_direct_serial_numbers")
        .select("serialNo")
        .in("serialNo", serialNosToCheck);

      const { data: dupStandard } = await supabase
        .from("pfms_serial-number")
        .select("serialNo")
        .in("serialNo", serialNosToCheck);

      const existingSerials = [...(dupDirect || []), ...(dupStandard || [])];
      if (existingSerials.length > 0) {
        const dupes = existingSerials.map(e => e.serialNo).join(", ");
        return NextResponse.json({
          success: false,
          error: `Duplicate serial number(s) detected: ${dupes}. Please regenerate serial numbers.`
        }, { status: 400 });
      }
    }

    const { error: insertError } = await supabase
      .from("pfms_serial-number")
      .insert(serialsToInsert);

    if (insertError) throw insertError;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error in serial-generation POST:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
