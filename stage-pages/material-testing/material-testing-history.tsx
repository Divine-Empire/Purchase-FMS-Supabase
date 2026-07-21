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
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden min-w-full">
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
        <table className="w-full text-sm text-left border-collapse min-w-[1200px]">
          <thead className="sticky top-0 z-10">
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
            {history.map((record: any) => (
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
    </div>
  );
}
