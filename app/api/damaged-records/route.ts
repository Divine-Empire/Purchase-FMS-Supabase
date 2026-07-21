import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";

export async function GET() {
  try {
    const { data: records, error } = await supabase
      .from("pfms_material-received")
      .select(`
        id,
        timestamp,
        receivedQty,
        damagedQty,
        damageReason,
        damageImage,
        liftNo,
        lift:pfms_lift!inner (
          liftNo,
          liftingQty,
          indent:pfms_indent-generation!inner (
            indentNo,
            itemName,
            poEntry:pfms_po-entry (
              poNumber
            ),
            negotiation:pfms_negotiation (
              selectedVendorName
            )
          ),
          serials:"pfms_serial-number" (
            serialNo
          )
        )
      `)
      .gt("damagedQty", 0) as any;

    if (error) throw error;

    const rows = (records || []).map((matRecd: any) => {
      const lift = matRecd.lift || {};
      const indent = lift.indent || {};
      const poEntry = indent.poEntry || {};
      const negotiation = indent.negotiation || {};
      const serialList = lift.serials || [];

      return {
        indentNo: indent.indentNo || "-",
        unitTrackingNo: lift.liftNo || "-",
        vendorName: negotiation.selectedVendorName || "-",
        poNumber: poEntry.poNumber || "-",
        itemName: indent.itemName || "-",
        dispatchQty: lift.liftingQty || 0,
        receivedQty: matRecd.receivedQty || 0,
        qrCode: serialList.map((s: any) => s.serialNo).join(", ") || "-",
        damagedQty: matRecd.damagedQty || 0,
        reason: matRecd.damageReason || "-",
        image: matRecd.damageImage || "",
      };
    });

    return NextResponse.json({ success: true, data: rows });

  } catch (error: any) {
    console.error("Error in damaged-records GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
