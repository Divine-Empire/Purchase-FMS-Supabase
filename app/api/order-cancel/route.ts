import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";

function getLocalTimestamp(dateInput?: Date | string | number | null): string {
  const date = dateInput ? new Date(dateInput) : new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().replace("Z", "");
}

export async function GET() {
  try {
    const { data: cancellations, error } = await supabase
      .from("pfms_order-cancellation")
      .select("*")
      .order("timestamp", { ascending: false });

    if (error) throw error;

    const mappedData = (cancellations || []).map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
      indentNo: row.indentNo,
      liftNo: row.liftNo || null,
      poNumber: row.poNumber || "—",
      itemName: row.itemName,
      cancelStage: row.cancelStage,
      cancelReason: row.cancelReason,
      qty: row.qty
    }));

    return NextResponse.json({ success: true, data: mappedData });
  } catch (error: any) {
    console.error("Error fetching order cancellations:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { indentNo, liftNo, poNumber, itemName, cancelStage, cancelReason, qty } = body;

    if (!indentNo || !itemName || !cancelStage || !cancelReason || qty === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields for cancellation" },
        { status: 400 }
      );
    }

    const now = getLocalTimestamp();

    const insertData = {
      id: randomUUID(),
      timestamp: now,
      indentNo,
      liftNo: liftNo || null,
      poNumber: poNumber || null,
      itemName,
      cancelStage,
      cancelReason,
      qty: parseFloat(qty),
      createdAt: now,
      updatedAt: now
    };

    const { error: insertError } = await supabase
      .from("pfms_order-cancellation")
      .insert([insertData]);

    if (insertError) throw insertError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error inserting order cancellation:", error);
    return NextResponse.json({ success: false, error: error.message || "Request failed" }, { status: 500 });
  }
}
