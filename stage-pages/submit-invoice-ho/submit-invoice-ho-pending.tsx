"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface SubmitInvoiceHOPendingProps {
  pending: any[];
  selectedRows: Set<string>;
  toggleRow: (id: string) => void;
  toggleAll: () => void;
  handleOpenForm: (id?: string) => void;
  selectedPendingColumns: string[];
  pendingColumns: readonly { readonly key: string; readonly label: string }[];
  safeValue: (record: any, key: string) => React.ReactNode;
  isLoading: boolean;
}

export default function SubmitInvoiceHOPending({
  pending,
  selectedRows,
  toggleRow,
  toggleAll,
  handleOpenForm,
  selectedPendingColumns,
  pendingColumns,
  safeValue,
  isLoading,
}: SubmitInvoiceHOPendingProps) {
  return (
    <div>
      {isLoading && pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg border-dashed">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
          <p className="text-lg animate-pulse text-blue-900 font-medium">
            Loading pending invoices...
          </p>
        </div>
      ) : pending.length === 0 ? (
        <div className="text-center py-24 bg-white border rounded-lg border-dashed">
          <p className="text-lg text-slate-500">
            No pending submissions found
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm bg-white">
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
                  />
                </th>
                <th className="sticky left-[50px] z-40 bg-slate-200 w-[100px] border-b text-center px-4 py-3 font-semibold text-slate-900">
                  Actions
                </th>
                {pendingColumns
                  .filter((c) => selectedPendingColumns.includes(c.key))
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
              {pending.map((rec) => (
                <tr
                  key={rec.id}
                  className="hover:bg-blue-50/30 transition-colors group"
                >
                  <td className="sticky left-0 z-20 bg-white group-hover:bg-blue-50/50 border-b text-center py-2">
                    <Checkbox
                      checked={selectedRows.has(rec.id)}
                      onCheckedChange={() => toggleRow(rec.id)}
                    />
                  </td>
                  <td className="sticky left-[50px] z-20 bg-white group-hover:bg-blue-50/50 border-b text-center px-4 py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenForm(rec.id)}
                      className="h-8 px-3 text-xs border-slate-200 hover:bg-white hover:text-blue-600 transition-colors"
                    >
                      Submit
                    </Button>
                  </td>
                  {pendingColumns
                    .filter((c) => selectedPendingColumns.includes(c.key))
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
