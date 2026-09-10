"use client";

import React from "react";
import { cn } from "@/lib/utils";

const parseDate = (dateInput: any): Date | null => {
  if (!dateInput || dateInput === "-" || dateInput === "—" || dateInput === "Invalid Date") return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;
  
  const str = String(dateInput).replace('T', ' ').replace('Z', '').trim();
  if (!str) return null;

  const parts = str.includes(", ") ? str.split(", ") : str.split(' ');
  const datePart = parts[0];
  const sep = datePart.includes('-') ? '-' : datePart.includes('/') ? '/' : null;

  if (sep) {
    const dp = datePart.split(sep);
    if (dp.length === 3) {
      let y = 0, m = 0, d = 0;
      if (dp[0].length === 4) {
        y = parseInt(dp[0], 10);
        m = parseInt(dp[1], 10) - 1;
        d = parseInt(dp[2], 10);
      } else if (dp[2].length === 4) {
        d = parseInt(dp[0], 10);
        m = parseInt(dp[1], 10) - 1;
        y = parseInt(dp[2], 10);
      }

      if (y > 0 && !isNaN(m) && !isNaN(d)) {
        let hours = 0, mins = 0, secs = 0;
        if (parts[1]) {
          const tp = parts[1].split(':');
          if (tp.length >= 2) {
            hours = parseInt(tp[0], 10);
            mins = parseInt(tp[1], 10);
            if (tp[2]) secs = parseFloat(tp[2]);
            if (parts[1].toLowerCase().includes("pm") && hours < 12) hours += 12;
            if (parts[1].toLowerCase().includes("am") && hours === 12) hours = 0;
          }
        }
        const res = new Date(y, m, d, hours, mins, secs);
        if (!isNaN(res.getTime())) return res;
      }
    }
  }

  const res = new Date(dateInput);
  return isNaN(res.getTime()) ? null : res;
};

const calculateDelay = (planned: any, actual: any) => {
  if (!planned || !actual) return "-";
  const pDate = parseDate(planned);
  const aDate = parseDate(actual);
  if (!pDate || !aDate) return "-";

  const diffMs = aDate.getTime() - pDate.getTime();
  if (diffMs <= 0) return "0";

  const diffHours = diffMs / (1000 * 60 * 60);
  const days = Math.floor(diffHours / 24);
  const hours = Math.floor(diffHours % 24);

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days} day${days > 1 ? "s" : ""}`;
  }
  if (hours > 0) {
    return `${hours} hr${hours > 1 ? "s" : ""}`;
  }
  const mins = Math.floor(diffMs / (1000 * 60));
  return `${mins} min${mins !== 1 ? "s" : ""}`;
};

interface PurchaseReturnHistoryProps {
  completed: any[];
  selectedHistoryColumns: string[];
  HISTORY_COLUMNS: readonly { readonly key: string; readonly label: string }[];
  safeValue: (record: any, key: string) => React.ReactNode;
}

export default function PurchaseReturnHistory({
  completed,
  selectedHistoryColumns,
  HISTORY_COLUMNS,
  safeValue,
}: PurchaseReturnHistoryProps) {
  if (completed.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center bg-white border rounded-2xl shadow-sm">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 transition-transform hover:scale-110">
          <span className="text-3xl text-slate-300">🔍</span>
        </div>
        <h3 className="text-xl font-semibold text-slate-900">
          No history found
        </h3>
        <p className="text-slate-500 mt-2 max-w-sm">
          Processed purchase returns will appear here once they are submitted.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar bg-white border rounded-2xl shadow-xs">
      <table className="w-full text-sm text-left border-separate border-spacing-0 min-w-[1400px]">
        <thead className="sticky top-0 z-10 bg-slate-900 border-none text-white text-center">
          <tr className="bg-slate-900 text-white hover:bg-transparent">
            {HISTORY_COLUMNS.filter((col) =>
              selectedHistoryColumns.includes(col.key)
            ).map((col) => (
              <th
                key={col.key}
                className="bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {completed.map((record) => (
            <tr
              key={record.id}
              className="even:bg-slate-50/30 hover:bg-indigo-50/20 transition-colors border-b border-slate-100 last:border-0 text-center"
            >
              {HISTORY_COLUMNS.filter((col) =>
                selectedHistoryColumns.includes(col.key)
              ).map((col) => {
                if (col.key === "delay6" || col.key === "delay") {
                  const pVal = record.data?.plan6 || record.data?.planned6 || record.data?.plannedDate || record.data?.planned;
                  const aVal = record.data?.actual6 || record.data?.actualDate || record.data?.returnDate || record.data?.timestamp;
                  const delayVal = calculateDelay(pVal, aVal);
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-2.5 text-center font-medium whitespace-nowrap border-b border-slate-100",
                        delayVal !== "0" && delayVal !== "-" && "text-amber-700 font-bold",
                        delayVal === "0" && "text-emerald-700 font-semibold"
                      )}
                    >
                      {delayVal}
                    </td>
                  );
                }

                return (
                  <td
                    key={col.key}
                    className="px-4 py-2.5 text-slate-600 whitespace-nowrap border-b border-slate-100"
                  >
                    {safeValue(record, col.key)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
