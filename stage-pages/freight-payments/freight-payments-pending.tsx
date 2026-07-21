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
      <div className="py-24 flex flex-col items-center justify-center text-center">
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
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
      <table className="w-full text-sm text-left border-separate border-spacing-0 min-w-[1800px]">
        <thead className="sticky top-0 z-30">
          <tr className="bg-slate-200">
            <th className="px-5 py-4 font-bold text-slate-900 bg-slate-200 sticky left-0 top-0 z-40 border-b border-r border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
              Action
            </th>
            {visiblePendingColumns.map((c) => (
              <th
                key={c.key}
                className="px-5 py-4 font-bold text-slate-900 whitespace-nowrap tracking-tight bg-slate-200 sticky top-0 z-30 border-b border-slate-300"
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
              className="hover:bg-blue-50/30 transition-all duration-150 group"
            >
              <td className="px-5 py-4 sticky left-0 z-20 bg-white border-b border-r border-slate-100 group-hover:bg-blue-50 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                <Button
                  size="sm"
                  onClick={() => handleOpenForm(rec.id)}
                  className="bg-blue-600 hover:bg-blue-700 h-8 px-4 rounded-lg shadow-sm text-white"
                >
                  Pay
                </Button>
              </td>
              {visiblePendingColumns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-5 py-4 whitespace-nowrap font-medium transition-colors border-b border-slate-100",
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
