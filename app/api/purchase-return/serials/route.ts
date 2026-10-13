import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";

// Serials of a lift that can still be returned — feeds the serial picker on
// the Purchase Return form. PFMS and IMS share one database, so a serial's
// current state is read straight from ims_serial_number: anything IMS already
// shows as OUT / RETURNED is left out, and a serial IMS hasn't seen yet
// (never synced) is still offered.
export async function GET(request: NextRequest) {
  try {
    const liftNo = request.nextUrl.searchParams.get("liftNo");
    if (!liftNo) return NextResponse.json({ success: false, error: "Missing liftNo" }, { status: 400 });

    const { data: pfmsSerials, error } = await supabase
      .from("pfms_serial-number")
      .select("serialNo")
      .eq("liftNo", liftNo)
      .order("serialNo");
    if (error) throw error;

    const serialNos = (pfmsSerials || []).map((s: any) => s.serialNo as string);
    const imsBySerial = new Map<string, { status: string; locationCode: string | null }>();

    const { data: locations } = await supabase.from("ims_location_master").select("id, locationCode");
    const codeById = new Map((locations || []).map((l: any) => [l.id, l.locationCode as string]));

    for (let i = 0; i < serialNos.length; i += 100) {
      const { data: rows, error: imsError } = await supabase
        .from("ims_serial_number")
        .select("serialNo, status, currentLocationId")
        .in("serialNo", serialNos.slice(i, i + 100));
      if (imsError) throw imsError;
      for (const r of rows || []) {
        imsBySerial.set(r.serialNo, { status: r.status, locationCode: r.currentLocationId ? codeById.get(r.currentLocationId) ?? null : null });
      }
    }

    const serials = serialNos
      .map((serialNo) => ({ serialNo, imsStatus: imsBySerial.get(serialNo)?.status ?? null, locationCode: imsBySerial.get(serialNo)?.locationCode ?? null }))
      .filter((s) => s.imsStatus === null || s.imsStatus === "IN_STOCK");

    return NextResponse.json({ success: true, serialized: serialNos.length > 0, serials });
  } catch (error: any) {
    console.error("Error in purchase-return serials GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
