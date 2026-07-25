"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubmitInvoicePendingProps {
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

export default function SubmitInvoicePending({
  pending,
  selectedRows,
  toggleRow,
  toggleAll,
  handleOpenForm,
  selectedPendingColumns,
  pendingColumns,
  safeValue,
  isLoading,
}: SubmitInvoicePendingProps) {
  return (
    <div>
      {isLoading && pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg border-dashed">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
          <p className="text-lg animate-pulse text-blue-900 font-medium">
            Loading records...
          </p>
        </div>
      ) : pending.length === 0 ? (
        <div className="text-center py-24 bg-white border rounded-lg border-dashed text-slate-500">
          No pending submissions found
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm bg-white">
          <table className="w-full text-sm border-separate border-spacing-0 min-w-max">
            <thead className="sticky top-0 z-30 bg-slate-900 shadow-xs border-none text-white text-center">
              <tr className="hover:bg-transparent border-none bg-slate-900 text-white">
                <th className="sticky left-0 z-40 bg-slate-900 w-[50px] border-b border-slate-800 text-center py-3">
                  <Checkbox
                    checked={
                      pending.length > 0 &&
                      pending.every((r) => selectedRows.has(r.id))
                    }
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="sticky left-[50px] z-40 bg-slate-900 w-[100px] border-b border-slate-800 text-center px-4 py-3 font-bold text-white uppercase text-[11px] tracking-wider">
                  Actions
                </th>
                {pendingColumns
                  .filter((c) => selectedPendingColumns.includes(c.key))
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
              {pending.map((rec) => {
                const isChecked = selectedRows.has(rec.id);
                return (
                  <tr
                    key={rec.id}
                    className={cn(
                      "group transition-colors border-b border-indigo-50/80 last:border-0",
                      isChecked
                        ? "bg-indigo-50/40 text-indigo-950 font-medium"
                        : "odd:bg-white even:bg-indigo-50/10 hover:bg-indigo-50/20 text-slate-700"
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-20 border-b text-center py-2 transition-colors",
                        isChecked
                          ? "bg-indigo-50/40 group-hover:bg-indigo-100/30"
                          : "bg-white group-hover:bg-indigo-50/10"
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleRow(rec.id)}
                      />
                    </td>
                    <td
                      className={cn(
                        "sticky left-[50px] z-20 border-b text-center px-4 py-2 transition-colors",
                        isChecked
                          ? "bg-indigo-50/40 group-hover:bg-indigo-100/30"
                          : "bg-white group-hover:bg-indigo-50/10"
                      )}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenForm(rec.id)}
                        className="h-8 transition-colors hover:text-blue-600"
                      >
                        Submit
                      </Button>
                    </td>
                    {pendingColumns
                      .filter((c) => selectedPendingColumns.includes(c.key))
                      .map((col) => (
                        <td
                          key={col.key}
                          className="border-b border-slate-100 px-4 py-2 text-center text-slate-700 whitespace-nowrap"
                        >
                          {safeValue(rec, col.key)}
                        </td>
                      ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
