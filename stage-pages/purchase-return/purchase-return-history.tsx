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
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar bg-white border rounded-2xl shadow-sm">
      <table className="w-full text-sm text-left border-collapse min-w-[1400px]">
        <thead className="sticky top-0 z-10 shadow-sm">
          <tr className="bg-slate-200 border-b border-slate-300">
            {HISTORY_COLUMNS.filter((col) =>
              selectedHistoryColumns.includes(col.key)
            ).map((col) => (
              <th
                key={col.key}
                className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap"
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
              className="hover:bg-slate-50/80 transition-colors"
            >
              {HISTORY_COLUMNS.filter((col) =>
                selectedHistoryColumns.includes(col.key)
              ).map((col) => (
                <td
                  key={col.key}
                  className="px-4 py-3 text-slate-600 whitespace-nowrap"
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
