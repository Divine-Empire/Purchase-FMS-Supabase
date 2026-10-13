"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Which godown this receipt / return moves stock in or out of. A user whose
// profile has a godown (Settings) is locked to it — the stock movement then
// lands in their own location with no extra step. A user without one can
// optionally pick; left blank, IMS falls back to the indent's own warehouse.
export function GodownField({
  label,
  value,
  onChange,
  options,
  lockedTo,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  lockedTo?: string | null;
}) {
  if (lockedTo) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <div className="h-9 flex items-center rounded-md border bg-gray-50 px-3 text-sm font-medium text-slate-700">
          {lockedTo}
          <span className="ml-2 text-[11px] font-normal text-slate-400">(from your profile)</span>
        </div>
      </div>
    );
  }

  if (options.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value || "NONE"} onValueChange={(v) => onChange(v === "NONE" ? "" : v)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Not set" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NONE">Not set (use indent warehouse)</SelectItem>
          {options.map((g) => (
            <SelectItem key={g} value={g}>
              {g}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
