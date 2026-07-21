"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface VendorPaymentHistoryProps {
  filteredHistoryRecords: any[];
  HISTORY_COLUMNS: readonly { readonly key: string; readonly label: string }[];
  formatAmount: (val: any) => string;
  safeValue: (val: any) => React.ReactNode;
}

export default function VendorPaymentHistory({
  filteredHistoryRecords,
  HISTORY_COLUMNS,
  formatAmount,
  safeValue,
}: VendorPaymentHistoryProps) {
  if (filteredHistoryRecords.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
          <span className="text-4xl text-slate-300">💰</span>
        </div>
        <h3 className="text-lg font-semibold text-slate-900">
          No transactions recorded
        </h3>
        <p className="text-slate-500 mt-2 max-w-sm mx-auto">
          When you process payments, the history will appear here for tracking
          and audits.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
      <table className="w-full text-sm text-left border-collapse min-w-[1200px]">
        <thead className="sticky top-0 z-10 shadow-sm">
          <tr className="bg-slate-200 border-b border-slate-300">
            {HISTORY_COLUMNS.map((c) => (
              <th
                key={c.key}
                className="px-5 py-4 font-bold text-slate-900 whitespace-nowrap tracking-tight bg-slate-200"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredHistoryRecords.map((rec) => (
            <tr
              key={rec.id}
              className="hover:bg-slate-50/80 transition-all duration-150"
            >
              {HISTORY_COLUMNS.map((c) => (
                <td key={c.key} className="px-5 py-4 whitespace-nowrap">
                  {c.key === "amountPaid" ? (
                    <span className="font-bold text-slate-900 tracking-tight">
                      {formatAmount(rec[c.key])}
                    </span>
                  ) : c.key === "status" ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "px-2.5 py-0.5 rounded-lg font-bold border-2 transition-colors",
                        rec[c.key] === "Paid"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : "bg-amber-50 text-amber-700 border-amber-100"
                      )}
                    >
                      {rec[c.key]}
                    </Badge>
                  ) : c.key === "date" ? (
                    <div className="flex items-center gap-2 font-semibold text-slate-600">
                      <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                      {rec[c.key]}
                    </div>
                  ) : (
                    <span className="font-medium text-slate-600">
                      {safeValue(rec[c.key])}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
