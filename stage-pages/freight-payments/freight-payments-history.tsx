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
      <div className="py-24 flex flex-col items-center justify-center text-center">
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
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
      <table className="w-full text-sm text-left border-separate border-spacing-0 min-w-[1800px]">
        <thead className="sticky top-0 z-30">
          <tr className="bg-slate-200">
            {visibleHistoryColumns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "px-5 py-4 font-bold text-slate-900 whitespace-nowrap tracking-tight bg-slate-200 sticky top-0 z-30 border-b border-slate-300",
                  c.key === "lrNo"
                    ? "!z-40 left-0 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
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
              className="hover:bg-slate-50/80 transition-all duration-150 group"
            >
              {visibleHistoryColumns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-5 py-4 whitespace-nowrap font-medium transition-colors border-b border-slate-100",
                    c.key === "lrNo"
                      ? "text-slate-900 font-bold sticky left-0 z-20 bg-white border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                      : "text-slate-600 group-hover:bg-slate-50 transition-colors"
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
