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

interface FreightPaymentsHistoryProps {
  filteredHistory: any[];
  visibleHistoryColumns: any[];
  parseNum: (val: any) => number;
  safeValue: (val: any) => React.ReactNode;
}

export default function FreightPaymentsHistory({
  filteredHistory,
  visibleHistoryColumns,
  parseNum,
  safeValue,
}: FreightPaymentsHistoryProps) {
  if (filteredHistory.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center bg-white border rounded-2xl shadow-sm">
        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
          <span className="text-4xl text-slate-200">🔍</span>
        </div>
        <h3 className="text-lg font-semibold text-slate-900">
          No history found
        </h3>
        <p className="text-slate-500 mt-2">Processed payments will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar bg-white border rounded-2xl shadow-xs">
      <table className="w-full text-sm text-left border-separate border-spacing-0 min-w-[1800px]">
        <thead className="sticky top-0 z-30 bg-slate-900 border-none text-white text-center">
          <tr className="bg-slate-900 text-white hover:bg-transparent">
            {visibleHistoryColumns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "bg-slate-900 px-5 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center",
                  c.key === "lrNo"
                    ? "sticky left-0 z-40 bg-slate-900"
                    : ""
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredHistory.map((rec) => (
            <tr
              key={rec.id}
              className="even:bg-slate-50/30 hover:bg-indigo-50/20 transition-colors border-b border-slate-100 last:border-0 text-center"
            >
              {visibleHistoryColumns.map((c) => {
                if (c.key === "delay") {
                  const pVal = (rec as any).planned || (rec as any).plan1;
                  const aVal = (rec as any).actual || (rec as any).date;
                  const delayVal = calculateDelay(pVal, aVal);
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        "px-5 py-2.5 whitespace-nowrap text-center font-medium border-b border-slate-100",
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
                    key={c.key}
                    className={cn(
                      "px-5 py-2.5 whitespace-nowrap transition-colors border-b border-slate-100",
                      c.key === "lrNo"
                        ? "text-slate-900 font-bold sticky left-0 z-20 bg-white group-hover:bg-indigo-50/10"
                        : "text-slate-600"
                    )}
                  >
                    {c.key === "planned" || c.key === "actual"
                      ? safeValue((rec as any)[c.key])
                      : c.key === "amountPaid"
                        ? `₹ ${parseNum((rec as any)[c.key]).toLocaleString()}`
                        : safeValue((rec as any)[c.key])}
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

