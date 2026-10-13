import { supabase } from "@/utils/supabase/server";
import { isGodownLabel } from "@/lib/godowns";

// Server-only helpers for the PFMS -> IMS stock movements (IN at Material
// Received, serials at Serial Generation, OUT at Purchase Return).

/**
 * The godown a movement should be booked against. The logged-in user's own
 * godown (Settings) always wins and is re-read from pfms_User here — the
 * browser only tells us the username, never which godown to trust. Only if
 * the user has none configured is the form's own pick used. null = unset,
 * and IMS then falls back to the indent's warehouse.
 */
export async function resolveGodown(username: unknown, clientValue: unknown): Promise<string | null> {
  if (typeof username === "string" && username.trim()) {
    const { data } = await supabase.from("pfms_User").select("defaultGodown").eq("username", username.trim()).maybeSingle();
    if (isGodownLabel(data?.defaultGodown)) return data.defaultGodown;
  }
  return isGodownLabel(clientValue) ? clientValue : null;
}

/**
 * Best-effort call into IMS (/api/integrations/<path>). Never throws and
 * never blocks the PFMS save that triggered it: if IMS_API_URL / IMS_API_KEY
 * aren't set, or IMS is down, the movement is simply picked up later by
 * IMS's own Sync buttons (they are idempotent per PFMS row).
 */
export async function pushToIms(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; data?: any; error?: string }> {
  const baseUrl = process.env.IMS_API_URL;
  const apiKey = process.env.IMS_API_KEY;
  if (!baseUrl || !apiKey) return { ok: false, error: "IMS_API_URL / IMS_API_KEY not configured" };

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/integrations/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    if (json.success) return { ok: true, data: json };
    console.warn(`IMS ${path} did not succeed:`, json.error);
    return { ok: false, error: json.error };
  } catch (err: any) {
    console.warn(`IMS ${path} call failed (non-blocking):`, err?.message || err);
    return { ok: false, error: err?.message || "IMS unreachable" };
  }
}
