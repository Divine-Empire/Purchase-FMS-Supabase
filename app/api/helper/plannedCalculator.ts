import { supabase } from "@/utils/supabase/server";

/**
 * Returns a local timestamp string formatted as YYYY-MM-DDTHH:mm:ss.sss
 * compatible with the rest of the application.
 */
export function getLocalTimestamp(dateInput?: Date | string | number | null): string {
  const date = dateInput ? new Date(dateInput) : new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().replace("Z", "");
}

/**
 * Daily working shift bounds used by calculatePlannedTime() below. Hardcoded on purpose
 * (not admin-configurable) — exported so the frontend (Stage Master tab) can display the
 * exact same value the backend actually calculates with, instead of a separately hand-typed value.
 */
export const OFFICE_HOURS = {
  startHour: 9,
  startMinute: 30,
  endHour: 18,
  endMinute: 30,
  label: "9:30 AM – 6:30 PM",
};

/**
 * Normalizes a stage name string for robust matching.
 * Converts to lowercase, trims, and replaces spaces & underscores with hyphens.
 */
export function normalizeStageKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Known stage aliases to map route or workflow names to the pfms_tat stage_name database row.
 */
const STAGE_ALIASES: Record<string, string> = {
  "create-indent": "indent-approval",
  "indent-generation": "indent-approval",
  "transporter-follow-up": "transporter-flw-up",
  "tally-entry": "receipt-in-tally",
  "receipt-in-tally": "receipt-in-tally",
  "verification": "acc-verification",
  "acc-verification": "acc-verification",
  "vendor-payment": "vendor-payments",
  "vendor-payments": "vendor-payments",
  "freight-payment": "freight-payments",
  "freight-payments": "freight-payments",
  "warranty-claimed": "warranty-claim",
};

/**
 * Checks if a given Date object is a non-working day (Sunday or present in the holidays table).
 */
function isNonWorkingDay(date: Date, holidaySet: Set<string>): boolean {
  // Sunday is day 0
  if (date.getDay() === 0) return true;

  // Format date as YYYY-MM-DD for holiday checking
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  return holidaySet.has(dateStr);
}

/**
 * Advances a Date object to the shift start time (see OFFICE_HOURS) on the next valid
 * working day (skipping Sundays and holidays).
 */
function advanceToNextWorkingDayStart(date: Date, holidaySet: Set<string>): void {
  // Move to next calendar day at shift start
  date.setDate(date.getDate() + 1);
  date.setHours(OFFICE_HOURS.startHour, OFFICE_HOURS.startMinute, 0, 0);

  // Keep advancing if it falls on a Sunday or holiday
  while (isNonWorkingDay(date, holidaySet)) {
    date.setDate(date.getDate() + 1);
  }
}

/**
 * Snaps a Date object into the OFFICE_HOURS working shift window.
 * - If on a Sunday or holiday: advances to shift start on the next working day.
 * - If before shift start: snaps to shift start of the same working day.
 * - If at or after shift end: advances to shift start on the next working day.
 */
function snapToWorkingShiftWindow(date: Date, holidaySet: Set<string>): void {
  if (isNonWorkingDay(date, holidaySet)) {
    advanceToNextWorkingDayStart(date, holidaySet);
    return;
  }

  const minutesOfDay = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  const shiftStartMinutes = OFFICE_HOURS.startHour * 60 + OFFICE_HOURS.startMinute;
  const shiftEndMinutes = OFFICE_HOURS.endHour * 60 + OFFICE_HOURS.endMinute;

  if (minutesOfDay < shiftStartMinutes) {
    date.setHours(OFFICE_HOURS.startHour, OFFICE_HOURS.startMinute, 0, 0);
  } else if (minutesOfDay >= shiftEndMinutes) {
    advanceToNextWorkingDayStart(date, holidaySet);
  }
}

/**
 * Dynamically calculates the planned completion timestamp for a stage.
 *
 * Takes into account:
 * - TAT duration_in_minutes queried from the `pfms_tat` table
 * - Daily working shift bounds (see OFFICE_HOURS above)
 * - Shift overflow rollover to subsequent working days
 * - Exclusions of Sundays and official holidays queried from the `pfms_holidays` table (`holiday_date` column)
 *
 * @param stageName Name or identifier of the target stage
 * @param baseTimestamp Starting timestamp (defaults to current time Date.now() if null/omitted)
 * @param customTatMinutes Optional default/fallback TAT in minutes if pfms_tat query returns no result
 * @returns Promise<string> Formatted local timestamp string (YYYY-MM-DDTHH:mm:ss.sss)
 */
export async function calculatePlannedTime(
  stageName: string,
  baseTimestamp?: Date | string | number | null,
  customTatMinutes?: number | null
): Promise<string> {
  // 1. Normalize stage key and resolve aliases
  const normKey = normalizeStageKey(stageName);
  const targetStage = STAGE_ALIASES[normKey] || normKey;

  // 2. Fetch pfms_tat for duration_in_minutes
  let tatMinutes: number = customTatMinutes || 0;

  try {
    const { data: tatData } = await supabase
      .from("pfms_tat")
      .select("stage_name, duration_in_minutes");

    if (tatData && tatData.length > 0) {
      const match = tatData.find((row: any) => {
        const rowNorm = normalizeStageKey(row.stage_name || "");
        return rowNorm === targetStage || rowNorm === normKey;
      });

      if (match && typeof match.duration_in_minutes === "number") {
        tatMinutes = match.duration_in_minutes;
      }
    }
  } catch (err) {
    console.error("Error fetching TAT in calculatePlannedTime:", err);
  }

  // Fallback default if duration_in_minutes is missing or invalid
  if (!tatMinutes || tatMinutes <= 0) {
    tatMinutes = customTatMinutes || 24 * 60;
  }

  // 3. Fetch holiday dates from the `pfms_holidays` table
  const holidaySet = new Set<string>();
  try {
    const { data: holidayData } = await supabase
      .from("pfms_holidays")
      .select("holiday_date");

    if (holidayData) {
      holidayData.forEach((row: any) => {
        if (row.holiday_date) {
          const dStr = String(row.holiday_date).split("T")[0].trim();
          if (dStr) holidaySet.add(dStr);
        }
      });
    }
  } catch (err) {
    console.error("Error fetching holidays in calculatePlannedTime:", err);
  }

  // 4. Initialize working date
  const curr = baseTimestamp ? new Date(baseTimestamp) : new Date();

  // 5. Snap to valid working shift start if outside shift or on non-working day
  snapToWorkingShiftWindow(curr, holidaySet);

  // 6. Calculate working shift consumption (see OFFICE_HOURS)
  const shiftEndMinutesOfDay = OFFICE_HOURS.endHour * 60 + OFFICE_HOURS.endMinute;
  let remainingTatMinutes = Math.round(tatMinutes);

  while (remainingTatMinutes > 0) {
    const currMinutesOfDay = curr.getHours() * 60 + curr.getMinutes() + curr.getSeconds() / 60;

    const availableMinutesToday = Math.max(0, shiftEndMinutesOfDay - currMinutesOfDay);

    if (remainingTatMinutes <= availableMinutesToday) {
      curr.setMinutes(curr.getMinutes() + remainingTatMinutes);
      remainingTatMinutes = 0;
    } else {
      remainingTatMinutes -= availableMinutesToday;
      advanceToNextWorkingDayStart(curr, holidaySet);
    }
  }

  return getLocalTimestamp(curr);
}
