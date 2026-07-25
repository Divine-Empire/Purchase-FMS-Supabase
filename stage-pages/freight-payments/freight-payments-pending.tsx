"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FreightPaymentsPendingProps {
  filteredPending: any[];
  visiblePendingColumns: any[];
  handleOpenForm: (recordId: string) => void;
  parseNum: (val: any) => number;
  safeValue: (val: any) => React.ReactNode;
}

export default function FreightPaymentsPending({
  filteredPending,
  visiblePendingColumns,
  handleOpenForm,
  parseNum,
  safeValue,
}: FreightPaymentsPendingProps) {
  if (filteredPending.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center bg-white border rounded-2xl shadow-sm">
        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
          <span className="text-4xl text-slate-300">📦</span>
        </div>
        <h3 className="text-2xl font-bold text-slate-900">No pending freight</h3>
        <p className="text-slate-500 mt-2">
          All transporter payments are up to date.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar bg-white border rounded-2xl shadow-xs">
      <table className="w-full text-sm text-left border-separate border-spacing-0 min-w-[1800px]">
        <thead className="sticky top-0 z-30 bg-slate-900 border-none text-white text-center">
          <tr className="bg-slate-900 text-white hover:bg-transparent">
            <th className="sticky left-0 z-40 bg-slate-900 px-5 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider text-center">
              Action
            </th>
            {visiblePendingColumns.map((c) => (
              <th
                key={c.key}
                className="bg-slate-900 px-5 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredPending.map((rec) => (
            <tr
              key={rec.id}
              className="even:bg-slate-50/30 hover:bg-indigo-50/20 transition-colors border-b border-slate-100 last:border-0 text-center"
            >
              <td className="sticky left-0 z-20 bg-white group-hover:bg-indigo-50/10 px-5 py-2.5 whitespace-nowrap border-b border-slate-100 text-center">
                <Button
                  size="sm"
                  onClick={() => handleOpenForm(rec.id)}
                  className="bg-indigo-600 hover:bg-indigo-700 h-8 px-4 rounded-lg shadow-sm text-white font-semibold text-xs transition-colors"
                >
                  Pay
                </Button>
              </td>
              {visiblePendingColumns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-5 py-2.5 whitespace-nowrap transition-colors border-b border-slate-100",
                    c.key === "lrNo" ? "text-slate-900 font-bold" : "text-slate-600",
                    c.key === "pendingAmount" && rec.data[c.key] > 0
                      ? "text-red-600 font-bold bg-red-50/30"
                      : ""
                  )}
                >
                  {c.key === "pendingAmount" ||
                    c.key === "freightAmount" ||
                    c.key === "advanceAmount"
                    ? `₹ ${parseNum(rec.data[c.key]).toLocaleString()}`
                    : safeValue(rec.data[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
