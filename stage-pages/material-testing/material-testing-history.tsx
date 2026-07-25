"use client";

import React from "react";

interface MaterialTestingHistoryProps {
  history: any[];
  selectedHistoryColumns: string[];
  HISTORY_COLUMNS: readonly { readonly key: string; readonly label: string }[];
  safeValue: (record: any, key: string) => React.ReactNode;
}

export default function MaterialTestingHistory({
  history,
  selectedHistoryColumns,
  HISTORY_COLUMNS,
  safeValue,
}: MaterialTestingHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="bg-white border rounded-xl p-12 text-center shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">
          No QC history found
        </h3>
        <p className="text-slate-500 mt-1">Recent QC records will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl shadow-xs overflow-hidden min-w-full">
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
        <table className="w-full text-sm text-left border-separate border-spacing-0 min-w-[1200px]">
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
            {history.map((record: any) => (
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
    </div>
  );
}
