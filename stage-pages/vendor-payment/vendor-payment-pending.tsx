"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface VendorPaymentPendingProps {
  filteredRecords: any[];
  visiblePendingColumns: readonly { readonly key: string; readonly label: string }[];
  isDueDateOverdueOrToday: (dueDate: string) => boolean;
  formatAmount: (val: any) => string;
  formatToDdMonYyyy: (dateVal: any) => string;
  safeValue: (val: any) => React.ReactNode;
}

export default function VendorPaymentPending({
  filteredRecords,
  visiblePendingColumns,
  isDueDateOverdueOrToday,
  formatAmount,
  formatToDdMonYyyy,
  safeValue,
}: VendorPaymentPendingProps) {
  if (filteredRecords.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 transition-transform hover:scale-105 duration-300">
          <span className="text-4xl text-slate-300">📄</span>
        </div>
        <h3 className="text-2xl font-bold text-slate-900">All clear!</h3>
        <p className="text-slate-500 mt-2 max-w-sm mx-auto">
          No pending invoices found matching your criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
      <table className="w-full text-sm text-left border-collapse min-w-[1500px]">
        <thead className="sticky top-0 z-10 shadow-sm">
          <tr className="bg-slate-200 border-b border-slate-300">
            {visiblePendingColumns.map((c) => (
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
          {filteredRecords.map((rec) => {
            const isOverdue = isDueDateOverdueOrToday(rec.data.dueDate);
            return (
              <tr
                key={rec.id}
                className={cn(
                  "hover:bg-slate-50/80 transition-all group duration-150",
                  isOverdue && "bg-red-50/30 hover:bg-red-100/40"
                )}
              >
                {visiblePendingColumns.map((c) => {
                  const isAmountCol =
                    c.key === "totalVal" ||
                    c.key === "totalPaid" ||
                    c.key === "pendingAmount";
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        "px-5 py-4 whitespace-nowrap transition-colors",
                        isOverdue
                          ? c.key === "invoiceNo"
                            ? "text-red-950 font-bold"
                            : "text-red-800 font-medium"
                          : c.key === "invoiceNo"
                          ? "text-slate-900 font-bold"
                          : "text-slate-600 font-medium",
                        c.key === "pendingAmount" && rec.data[c.key] > 0
                          ? isOverdue
                            ? "text-red-700 font-bold bg-red-100/30"
                            : "text-red-600 font-bold bg-red-50/30"
                          : ""
                      )}
                    >
                      {isAmountCol ? (
                        formatAmount(rec.data[c.key])
                      ) : c.key === "dueDate" ? (
                        formatToDdMonYyyy(rec.data[c.key])
                      ) : (
                        safeValue(rec.data[c.key])
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
