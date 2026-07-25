"use client";

import React from "react";
import { cn } from "@/lib/utils";

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
              {visibleHistoryColumns.map((c) => (
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
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
