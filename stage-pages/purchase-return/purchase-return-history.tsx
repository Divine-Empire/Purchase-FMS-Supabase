"use client";

import React from "react";

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
              ).map((col) => (
                <td
                  key={col.key}
                  className="px-4 py-2.5 text-slate-600 whitespace-nowrap border-b border-slate-100"
                >
                  {safeValue(record, col.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
