"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface TallyEntryPendingProps {
  pending: any[];
  selectedRows: Set<string>;
  toggleRow: (id: string) => void;
  toggleAll: () => void;
  selectedPendingColumns: string[];
  pendingColumns: readonly { readonly key: string; readonly label: string }[];
  safeValue: (record: any, key: string) => React.ReactNode;
  isLoading: boolean;
}

export default function TallyEntryPending({
  pending,
  selectedRows,
  toggleRow,
  toggleAll,
  selectedPendingColumns,
  pendingColumns,
  safeValue,
  isLoading,
}: TallyEntryPendingProps) {
  return (
    <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm overflow-y-auto">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
        <thead className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
          <tr className="hover:bg-transparent border-none">
            <th className="sticky left-0 z-40 bg-slate-200 w-12 border-b text-center px-4 py-3">
              <Checkbox
                checked={
                  selectedRows.size === pending.length &&
                  pending.length > 0
                }
                onCheckedChange={toggleAll}
                className="translate-y-[2px]"
              />
            </th>
            {pendingColumns
              .filter((c) => selectedPendingColumns.includes(c.key))
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
                  pendingColumns.filter((c) =>
                    selectedPendingColumns.includes(c.key)
                  ).length + 1
                }
                className="h-48 text-center"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <span className="text-slate-500 font-medium">
                    Loading records...
                  </span>
                </div>
              </td>
            </tr>
          ) : pending.length === 0 ? (
            <tr>
              <td
                colSpan={
                  pendingColumns.filter((c) =>
                    selectedPendingColumns.includes(c.key)
                  ).length + 1
                }
                className="h-32 text-center text-gray-500"
              >
                No pending Tally entries
              </td>
            </tr>
          ) : (
            pending.map((record: any) => (
              <tr
                key={record.id}
                className="hover:bg-gray-50 transition-colors group"
              >
                <td className="sticky left-0 z-20 bg-white group-hover:bg-gray-50 border-b text-center px-4 py-2">
                  <Checkbox
                    checked={selectedRows.has(record.id)}
                    onCheckedChange={() => toggleRow(record.id)}
                    className="translate-y-[2px]"
                  />
                </td>
                {pendingColumns
                  .filter((c) => selectedPendingColumns.includes(c.key))
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
