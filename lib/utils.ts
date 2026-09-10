import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parses dates from Google Sheets, handling DD/MM/YYYY and other common formats.
 */
export function parseSheetDate(dateStr: string | Date | null | undefined): Date | null {
  if (!dateStr || dateStr === "-" || dateStr === "—" || dateStr === "Invalid Date") return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  
  // Try parsing YYYY-MM-DD first to avoid UTC timezone mismatch issues
  const normalizedStr = typeof dateStr === 'string' ? dateStr.replace('T', ' ').replace('Z', '') : dateStr;

  if (typeof normalizedStr === 'string' && normalizedStr.includes('-')) {
    const parts = normalizedStr.trim().split(' ');
    const dateParts = parts[0].split('-');
    if (dateParts.length === 3 && dateParts[0].length === 4) {
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[2], 10);
      
      let hours = 0, mins = 0, secs = 0;
      if (parts[1]) {
        const timeParts = parts[1].split(':');
        if (timeParts.length >= 2) {
          hours = parseInt(timeParts[0], 10);
          mins = parseInt(timeParts[1], 10);
          if (timeParts[2]) secs = parseFloat(timeParts[2]);
        }
      }
      
      const parsed = new Date(year, month, day, hours, mins, secs);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  // Try standard parsing
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  // Try parsing DD/MM/YYYY
  const dateTimeParts = dateStr.includes(", ") ? dateStr.split(", ") : dateStr.split(" ");
  const dateParts = dateTimeParts[0].split("/");
  if (dateParts.length === 3) {
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);

    let hours = 0, mins = 0, secs = 0;
    if (dateTimeParts[1]) {
      const timeParts = dateTimeParts[1].split(":");
      if (timeParts.length >= 2) {
        hours = parseInt(timeParts[0], 10);
        mins = parseInt(timeParts[1], 10);
        if (timeParts[2]) secs = parseInt(timeParts[2], 10);

        if (dateTimeParts[1].toLowerCase().includes("pm") && hours < 12) hours += 12;
        if (dateTimeParts[1].toLowerCase().includes("am") && hours === 12) hours = 0;
      }
    }

    const parsed = new Date(year, month, day, hours, mins, secs);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Formats a date to DD/MM/YYYY for display.
 */
export function formatDate(date?: Date | string | null): string {
  if (!date || date === "-" || date === "—") return "";
  const d = date instanceof Date ? date : parseSheetDate(date);
  if (!d || isNaN(d.getTime())) return typeof date === 'string' ? date : "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Formats a date/timestamp to DD-MM-YYYY HH:mm (24-hour format) for display.
 */
export function formatDateTimeDash(date: any): string {
  if (!date || date === "-" || date === "—") return "-";
  const d = date instanceof Date ? date : parseSheetDate(date);
  if (!d || isNaN(d.getTime())) return typeof date === "string" ? date : "-";
  
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${dd}-${mm}-${yyyy} ${hours}:${minutes}`;
}
/**
 * Generates a timestamp compatible with FMS sheets (YYYY-MM-DD HH:mm:ss).
 */
export function getFmsTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
/**
 * Purchaser-based record access check. `records` (on pfms_User) holds a single value —
 * a Purchaser name (e.g. "HARISH") or "ALL" — controlling which purchaser's indents a
 * user may see across the app. Mirrors the existing `pageAccess` pattern (client-side
 * enforcement only, see lib/auth-context.tsx / components/sidebar.tsx).
 *
 * Rules:
 * - ADMIN always sees everything, regardless of their `records` value.
 * - `records` of "ALL" (or unset) sees everything.
 * - A record with no purchaser set (null/empty) is visible ONLY to "ALL"-access users —
 *   it should never silently show to a restricted user just because it has no owner yet.
 * - Otherwise, the record's purchaser must case-insensitively match the user's `records`.
 */
export function canViewPurchaserRecord(
  recordPurchaser: string | null | undefined,
  userRecords: string | null | undefined,
  role: string | null | undefined
): boolean {
  if (role?.toUpperCase() === "ADMIN") return true;

  const access = (userRecords || "ALL").trim().toUpperCase();
  if (access === "ALL") return true;

  const purchaser = recordPurchaser?.trim();
  if (!purchaser) return false;

  return purchaser.toUpperCase() === access;
}

export type IndentSortDirection = "asc" | "desc";

/**
 * Sorts records by their indent number field (`indentNumber` on most stage pages,
 * `indentNo` on a few) using a natural (numeric-aware) comparison, so IN-9 sorts before
 * IN-10, and multi-item batches (IN-123A, IN-123B, IN-123C...) stay grouped together in
 * order. Used as the default ordering across all stage pages, so indent groups stay
 * together regardless of which "Indent Wise Filter" option is active — "asc"/"desc" only
 * flip the direction, they never fall back to unsorted/raw order.
 */
export function sortByIndentNumber<T extends { data?: { indentNumber?: string; indentNo?: string } }>(
  records: T[],
  direction: IndentSortDirection = "asc"
): T[] {
  const getValue = (r: T) => r.data?.indentNumber || r.data?.indentNo || "";
  const sorted = [...records].sort((a, b) =>
    getValue(a).localeCompare(getValue(b), undefined, { numeric: true, sensitivity: "base" })
  );
  return direction === "desc" ? sorted.reverse() : sorted;
}

/**
 * Checks if a warranty expiry date is within one month from today.
 */
export function isWarrantyExpiringSoon(expiryDate: string | Date | null | undefined): boolean {
  if (!expiryDate || expiryDate === "-" || expiryDate === "—") return false;
  try {
    const d = expiryDate instanceof Date ? expiryDate : parseSheetDate(expiryDate);
    if (!d || isNaN(d.getTime())) return false;
    const today = new Date();
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(today.getMonth() + 1);
    return d <= oneMonthFromNow;
  } catch (e) {
    return false;
  }
}
