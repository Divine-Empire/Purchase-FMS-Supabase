"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MaterialTestingPendingProps {
  pending: any[];
  handleOpenForm: (id: string) => void;
  selectedPendingColumns: string[];
  PENDING_COLUMNS: readonly { readonly key: string; readonly label: string }[];
  safeValue: (record: any, key: string) => React.ReactNode;
}

export default function MaterialTestingPending({
  pending,
  handleOpenForm,
  selectedPendingColumns,
  PENDING_COLUMNS,
  safeValue,
}: MaterialTestingPendingProps) {
  if (pending.length === 0) {
    return (
      <div className="bg-white border rounded-xl p-12 text-center shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">
          No pending QC checks
        </h3>
        <p className="text-slate-500 mt-1 max-w-xs mx-auto">
          All items have been inspected or are not yet ready for QC.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl shadow-xs overflow-hidden min-w-full">
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
        <table className="w-full text-sm text-left border-separate border-spacing-0 min-w-[1200px]">
          <thead className="bg-slate-900 border-none text-white text-center">
            <tr className="bg-slate-900 text-white hover:bg-transparent">
              <th className="sticky top-0 left-0 z-30 bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider w-24">
                Actions
              </th>
              {PENDING_COLUMNS.filter((col) =>
                selectedPendingColumns.includes(col.key)
              ).map((col) => (
                <th
                  key={col.key}
                  className="sticky top-0 z-20 bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pending.map((record: any) => (
              <tr
                key={record.id}
                className="even:bg-slate-50/30 hover:bg-indigo-50/20 transition-colors border-b border-slate-100 last:border-0 text-center"
              >
                <td className="sticky left-0 z-10 bg-white group-hover:bg-indigo-50/10 px-4 py-2 whitespace-nowrap border-b border-slate-100 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenForm(record.id)}
                    className="h-8 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all font-semibold px-3 text-xs shadow-2xs"
                  >
                    Perform QC
                  </Button>
                </td>
                {PENDING_COLUMNS.filter((col) =>
                  selectedPendingColumns.includes(col.key)
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
