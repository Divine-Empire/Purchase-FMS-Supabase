import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";

function getLocalTimestamp(dateInput?: Date | string | number | null): string {
  const date = dateInput ? new Date(dateInput) : new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().replace("Z", "");
}

export async function GET(request: NextRequest) {
  try {
    const prefix = request.nextUrl.searchParams.get("prefix");
    if (prefix) {
      const { data: serials, error } = await supabase
        .from("pfms_serial-number")
        .select("serialNo")
        .ilike("serialNo", `${prefix}%`);
      if (error) throw error;
      let maxSeq = 0;
      for (const s of (serials || [])) {
        const parts = s.serialNo.split("/");
        if (parts.length >= 3) {
          const seqNum = parseInt(parts[2], 10);
          if (!isNaN(seqNum) && seqNum > maxSeq) {
            maxSeq = seqNum;
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
          indent:pfms_indent-generation!inner (
            indentNo,
            itemName,
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
      .from("pfms_item-master")
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

    const pending: any[] = [];
    const history: any[] = [];

    for (const receipt of (receipts || [])) {
      const lift = receipt.lift || {};
      const indent = lift.indent || {};
      const negotiation = Array.isArray(indent.negotiation) ? (indent.negotiation[0] || {}) : (indent.negotiation || {});
      const poEntry = Array.isArray(indent.poEntry) ? (indent.poEntry[0] || {}) : (indent.poEntry || {});

      const liftNo = lift.liftNo;
      const liftSerials = serialsByLift.get(liftNo) || [];

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
          }))
        }
      };

      if (liftSerials.length > 0) {
        history.push(record);
      } else {
        pending.push(record);
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

    // 1. Populate exact matches
    validMasters.forEach((row: any) => {
      const name = row["Vendor List"]?.trim();
      const code = row["Vendor Code"]?.trim();
      if (name && code) vendorCodeMap[name] = code;
    });

    // 2. Helper functions for name cleaning and matching
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
      
      // Exact case-insensitive match
      let best = validMasters.find((m: any) => m["Vendor List"]?.trim().toLowerCase() === nameLower);
      if (best) return best;

      const cleanNeg = cleanName(negName);
      if (!cleanNeg) return null;

      // Exact clean match
      best = validMasters.find((m: any) => cleanName(m["Vendor List"]) === cleanNeg);
      if (best) return best;

      // Substring containment match
      if (cleanNeg.length >= 6) {
        best = validMasters.find((m: any) => {
          const cleanMaster = cleanName(m["Vendor List"]);
          return cleanMaster && cleanMaster.length >= 6 && 
                 (cleanMaster.includes(cleanNeg) || cleanNeg.includes(cleanMaster));
        });
        if (best) return best;
      }

      // Shared prefix match (8 chars)
      best = validMasters.find((m: any) => {
        const cleanMaster = cleanName(m["Vendor List"]);
        if (!cleanMaster || cleanMaster.length < 8 || cleanNeg.length < 8) return false;
        return cleanMaster.substring(0, 8) === cleanNeg.substring(0, 8);
      });

      return best || null;
    };

    // 3. Match active negotiation vendors dynamically
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

    // Fetch TAT for warranty-claim
    const { data: tatData } = await supabase
      .from("pfms_tat")
      .select("actionTime")
      .eq("stageName", "warranty-claim")
      .single();
    const tatHours = tatData?.actionTime || 24;

    const plannedWarrantyClaim = getLocalTimestamp(new Date(Date.now() + tatHours * 60 * 60 * 1000));

    const serialsToInsert = [];

    if (isDirect) {
      if (!directForm || !serials) {
        return NextResponse.json({ success: false, error: "Missing direct form data" }, { status: 400 });
      }

      // Calculate next direct indent number
      const { data: directIndents, error: indentError } = await supabase
        .from("pfms_indent-generation")
        .select("indentNo")
        .like("indentNo", "IN-DIR-%");
      if (indentError) throw indentError;

      let maxIndentNum = 0;
      (directIndents || []).forEach((row: any) => {
        const match = row.indentNo.match(/^IN-DIR-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxIndentNum) maxIndentNum = num;
        }
      });
      const nextIndentSeq = maxIndentNum + 1;
      const nextIndentNo = `IN-DIR-${String(nextIndentSeq).padStart(4, "0")}`;
      const nextLiftNo = `LIFT-DIR-${String(nextIndentSeq).padStart(4, "0")}`;

      // 1. Insert placeholder indent
      const { error: insIndentErr } = await supabase
        .from("pfms_indent-generation")
        .insert({
          id: randomUUID(),
          timestamp: now,
          indentNo: nextIndentNo,
          createdBy: "Direct",
          category: "Direct",
          itemName: directForm.itemName,
          quantity: parseFloat(directForm.quantity) || 0,
          warehouseLocation: "Main Warehouse",
          status: "completed",
          createdAt: now,
          updatedAt: now
        });
      if (insIndentErr) throw insIndentErr;

      // 2. Insert placeholder lift
      const { error: insLiftErr } = await supabase
        .from("pfms_lift")
        .insert({
          id: randomUUID(),
          timestamp: now,
          liftNo: nextLiftNo,
          indentNo: nextIndentNo,
          liftingQty: parseFloat(directForm.quantity) || 0,
          createdAt: now,
          updatedAt: now
        });
      if (insLiftErr) throw insLiftErr;

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

      // 3. Insert placeholder material-received
      const { error: insReceiptErr } = await supabase
        .from("pfms_material-received")
        .insert({
          id: randomUUID(),
          timestamp: now,
          liftNo: nextLiftNo,
          invoiceType: "direct",
          invoiceNumber: "Direct",
          invoiceDate: directForm.invoiceDate ? getLocalTimestamp(directForm.invoiceDate) : now,
          receivedQty: parseFloat(directForm.quantity) || 0,
          qcRequired: "no",
          warranty: "yes",
          warrantyDuration: parseInt(directForm.duration) || 12,
          warrantyExpiry: formattedWarrantyEnd,
          productExpiryDate: formattedWarrantyEnd,
          createdAt: now,
          updatedAt: now
        });
      if (insReceiptErr) throw insReceiptErr;

      // 4. Construct serial numbers list
      for (const s of serials) {
        serialsToInsert.push({
          id: randomUUID(),
          timestamp: now,
          liftNo: nextLiftNo,
          serialNo: s.serialNo,
          qrLink: s.qrLink || null,
          warrantyExpiry: formattedWarrantyEnd,
          productExpiry: formattedWarrantyEnd,
          plannedWarrantyClaim: plannedWarrantyClaim,
          createdAt: now,
          updatedAt: now
        });
      }
    } else {
      if (!records || records.length === 0) {
        return NextResponse.json({ success: false, error: "No records to process" }, { status: 400 });
      }

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
