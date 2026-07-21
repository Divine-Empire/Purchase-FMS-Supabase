"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface TallyEntryHistoryProps {
  completed: any[];
  selectedHistoryColumns: string[];
  historyColumns: readonly { readonly key: string; readonly label: string }[];
  safeValue: (record: any, key: string) => React.ReactNode;
  isLoading: boolean;
}

export default function TallyEntryHistory({
  completed,
  selectedHistoryColumns,
  historyColumns,
  safeValue,
  isLoading,
}: TallyEntryHistoryProps) {
  return (
    <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm overflow-y-auto">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
        <thead className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
          <tr className="hover:bg-transparent border-none">
            {historyColumns
              .filter((c) => selectedHistoryColumns.includes(c.key))
              .map((col) => (
                <th
                  key={col.key}
                  className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {isLoading ? (
            <tr>
              <td
                colSpan={
                  historyColumns.filter((c) =>
                    selectedHistoryColumns.includes(c.key)
                  ).length
                }
                className="h-48 text-center"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <span className="text-slate-500 font-medium">
                    Loading history...
                  </span>
                </div>
              </td>
            </tr>
          ) : completed.length === 0 ? (
            <tr>
              <td
                colSpan={
                  historyColumns.filter((c) =>
                    selectedHistoryColumns.includes(c.key)
                  ).length
                }
                className="h-32 text-center text-gray-500"
              >
                No Tally history
              </td>
            </tr>
          ) : (
            completed.map((record: any) => (
              <tr
                key={record.id}
                className="hover:bg-indigo-50/50 transition-colors"
              >
                {historyColumns
                  .filter((c) => selectedHistoryColumns.includes(c.key))
                  .map((col) => (
                    <td
                      key={col.key}
                      className="border-b px-4 py-2 text-center text-slate-700"
                    >
                      {safeValue(record, col.key)}
                    </td>
                  ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
