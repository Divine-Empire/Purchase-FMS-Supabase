import { NextResponse } from "next/server";

// Stock Analysis (IMS) — backed by the real IMS ledger in OTP_Supabase
// (see OTP_Supabase/Database/49_/50_ims_*.sql), not the old Google Sheet.
// Purchase-FMS-Supabase (zpkikvgmmbtekbcuqahf) and OTP_Supabase
// (nfwtbrmqvsejwwvraanf) are separate Supabase projects, so this is an
// HTTP call to OTP_Supabase's own balance endpoint — same cross-project
// pattern as the Tally Entry -> IMS receive hook (see
// app/api/tally-entry/route.ts's recordImsReceipt).
//
// Passed through as-is (one row per item+location) — stage-pages/ims/
// ims.tsx mirrors OTP_Supabase's own /inventory page UI/shape directly,
// so no pivoting is needed here anymore.
//
// Note: `balance` is LIVE STOCK, not the old sheet's pre-computed
// "Reorder Quantity" (Max Level - Live Stock - Indent Raised) --
// "Indent Raised" isn't tracked in the new IMS, so that derived figure
// isn't available here.
export async function GET() {
  try {
    const baseUrl = process.env.OTP_SUPABASE_APP_URL || "https://otp-supabase.vercel.app"
    const response = await fetch(`${baseUrl}/api/otp-supabase/ims/balances`, {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch IMS balances: ${response.statusText}`)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || "OTP_Supabase IMS balances API returned success=false")
    }

    return NextResponse.json({ success: true, data: result.data || [] })
  } catch (err: any) {
    console.error("GET /api/ims error:", err)
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch IMS tracker data" },
      { status: 500 }
    )
  }
}
