"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface SubmitInvoiceHistoryProps {
  completed: any[];
  selectedHistoryColumns: string[];
  historyColumns: readonly { readonly key: string; readonly label: string }[];
  safeValue: (record: any, key: string) => React.ReactNode;
  isLoading: boolean;
}

export default function SubmitInvoiceHistory({
  completed,
  selectedHistoryColumns,
  historyColumns,
  safeValue,
  isLoading,
}: SubmitInvoiceHistoryProps) {
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
        <div className="text-center py-24 bg-white border rounded-lg border-dashed text-slate-500">
          No history found
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm bg-white">
          <table className="w-full text-sm border-separate border-spacing-0 min-w-max">
            <thead className="sticky top-0 z-30 bg-slate-900 shadow-xs border-none text-white text-center">
              <tr className="hover:bg-transparent border-none bg-slate-900 text-white">
                {historyColumns
                  .filter((c) => selectedHistoryColumns.includes(c.key))
                  .map((c) => (
                    <th
                      key={c.key}
                      className="bg-slate-900 border-b border-slate-800 text-center px-4 py-3 font-bold text-white whitespace-nowrap uppercase text-[11px] tracking-wider"
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
                  className="even:bg-slate-50/30 hover:bg-indigo-50/20 transition-colors border-b border-slate-100"
                >
                  {historyColumns
                    .filter((c) => selectedHistoryColumns.includes(c.key))
                    .map((col) => (
                      <td
                        key={col.key}
                        className="border-b border-slate-100 px-4 py-2 text-center text-slate-700 whitespace-nowrap"
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
