"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
        <thead className="sticky top-0 z-30 bg-slate-900 shadow-xs border-none text-white text-center">
          <tr className="hover:bg-transparent border-none bg-slate-900 text-white">
            <th className="sticky left-0 z-40 bg-slate-900 w-12 border-b border-slate-800 text-center px-4 py-3 font-bold text-white uppercase text-[11px] tracking-wider">
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
                  className="bg-slate-900 border-b border-slate-800 text-center px-4 py-3 font-bold text-white whitespace-nowrap uppercase text-[11px] tracking-wider"
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
            pending.map((record: any) => {
              const isChecked = selectedRows.has(record.id);
              return (
                <tr
                  key={record.id}
                  className={cn(
                    "group transition-colors border-b border-indigo-50/80 last:border-0",
                    isChecked
                      ? "bg-indigo-50/40 text-indigo-950 font-medium"
                      : "odd:bg-white even:bg-indigo-50/10 hover:bg-indigo-50/20 text-slate-700"
                  )}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-20 border-b text-center px-4 py-2 transition-colors",
                      isChecked
                        ? "bg-indigo-50/40 group-hover:bg-indigo-100/30"
                        : "bg-white group-hover:bg-indigo-50/10"
                    )}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleRow(record.id)}
                      className="translate-y-[2px]"
                    />
                  </td>
                  {pendingColumns
                    .filter((c) => selectedPendingColumns.includes(c.key))
                    .map((col) => (
                      <td
                        key={col.key}
                        className="border-b border-slate-100 px-4 py-2 text-center text-slate-700 whitespace-nowrap"
                      >
                        {safeValue(record, col.key)}
                      </td>
                    ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
