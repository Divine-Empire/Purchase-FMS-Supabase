// The 5 physical godowns every system agrees on. Labels match
// OTP_Supabase/lib/locations.ts and IMS-Supabase/lib/godown-codes.ts, which
// is how IMS knows which location a PFMS movement belongs to — so this list
// is fixed in code, not freely editable from the Master dropdown page.
export const GODOWN_LABELS = [
  "Warehouse-CG",
  "Head-Office-CG",
  "Service-Inbound-CG",
  "Maniquip-CG",
  "Warehouse-NE",
] as const;

export function isGodownLabel(value: unknown): value is (typeof GODOWN_LABELS)[number] {
  return typeof value === "string" && (GODOWN_LABELS as readonly string[]).includes(value);
}
