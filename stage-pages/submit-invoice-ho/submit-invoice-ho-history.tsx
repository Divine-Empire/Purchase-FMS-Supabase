"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface SubmitInvoiceHOHistoryProps {
  completed: any[];
  selectedHistoryColumns: string[];
  historyColumns: readonly { readonly key: string; readonly label: string }[];
  safeValue: (record: any, key: string) => React.ReactNode;
  isLoading: boolean;
}

export default function SubmitInvoiceHOHistory({
  completed,
  selectedHistoryColumns,
  historyColumns,
  safeValue,
  isLoading,
}: SubmitInvoiceHOHistoryProps) {
  return (
    <div>
      {isLoading && completed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg border-dashed">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
          <p className="text-lg animate-pulse text-blue-900 font-medium">
            Loading history...
          </p>
        </div>
      ) : completed.length === 0 ? (
        <div className="text-center py-24 bg-white border rounded-lg border-dashed">
          <p className="text-lg text-slate-500">No history found</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm bg-white">
          <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
            <thead className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
              <tr className="hover:bg-transparent border-none">
                {historyColumns
                  .filter((c) => selectedHistoryColumns.includes(c.key))
                  .map((c) => (
                    <th
                      key={c.key}
                      className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap"
                    >
                      {c.label}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {completed.map((rec) => (
                <tr
                  key={rec.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  {historyColumns
                    .filter((c) => selectedHistoryColumns.includes(c.key))
                    .map((col) => (
                      <td
                        key={col.key}
                        className="border-b px-4 py-2 text-center text-slate-700"
                      >
                        {safeValue(rec, col.key)}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
