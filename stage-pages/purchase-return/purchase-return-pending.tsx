"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface PurchaseReturnPendingProps {
  pending: any[];
  handleOpenForm: (id: string) => void;
  selectedPendingColumns: string[];
  PENDING_COLUMNS: readonly { readonly key: string; readonly label: string }[];
  safeValue: (record: any, key: string) => React.ReactNode;
}

export default function PurchaseReturnPending({
  pending,
  handleOpenForm,
  selectedPendingColumns,
  PENDING_COLUMNS,
  safeValue,
}: PurchaseReturnPendingProps) {
  if (pending.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center bg-white border rounded-2xl shadow-sm">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 transition-transform hover:scale-110">
          <span className="text-3xl text-slate-300">📦</span>
        </div>
        <h3 className="text-xl font-semibold text-slate-900">
          No pending returns
        </h3>
        <p className="text-slate-500 mt-2 max-w-sm">
          All rejected items have been processed or there are no QC rejections
          currently.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar bg-white border rounded-2xl shadow-sm">
      <table className="w-full text-sm text-left border-collapse min-w-[1200px]">
        <thead className="sticky top-0 z-10 shadow-sm">
          <tr className="bg-slate-200 border-b border-slate-300">
            <th className="px-4 py-4 font-semibold text-slate-900 w-24">
              Actions
            </th>
            {PENDING_COLUMNS.filter((col) =>
              selectedPendingColumns.includes(col.key)
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
          {pending.map((record) => (
            <tr
              key={record.id}
              className="hover:bg-slate-50/80 transition-colors group"
            >
              <td className="px-4 py-3 whitespace-nowrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenForm(record.id)}
                  className="h-8 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all font-medium"
                >
                  Process
                </Button>
              </td>
              {PENDING_COLUMNS.filter((col) =>
                selectedPendingColumns.includes(col.key)
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
