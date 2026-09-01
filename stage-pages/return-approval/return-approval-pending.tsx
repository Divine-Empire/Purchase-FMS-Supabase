"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReturnApprovalPendingProps {
  pending: any[];
  selectedRows: Set<string>;
  toggleRow: (id: string) => void;
  toggleAll: () => void;
  handleOpenForm: (id: string) => void;
  safeValue: (val: any) => React.ReactNode;
  formatDate: (dateStr: string) => string;
}

export default function ReturnApprovalPending({
  pending,
  selectedRows,
  toggleRow,
  toggleAll,
  handleOpenForm,
  safeValue,
  formatDate,
}: ReturnApprovalPendingProps) {
  if (pending.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center bg-white border rounded-2xl shadow-sm">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 transition-transform hover:scale-110">
          <span className="text-3xl text-slate-300">📦</span>
        </div>
        <h3 className="text-xl font-semibold text-slate-900">
          No pending approvals
        </h3>
        <p className="text-slate-500 mt-2 max-w-sm">
          All returns have been approved or there are no pending items at this stage.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar bg-white border rounded-2xl shadow-xs">
      <table className="w-full text-sm text-left border-separate border-spacing-0 min-w-[1200px]">
        <thead className="sticky top-0 z-10 bg-slate-900 border-none text-white text-center">
          <tr className="bg-slate-900 text-white hover:bg-transparent">
            <th className="sticky left-0 z-20 bg-slate-900 px-4 py-3 w-12 border-b border-slate-800 text-center">
              <Checkbox
                checked={selectedRows.size === pending.length && pending.length > 0}
                onCheckedChange={toggleAll}
                className="border-slate-400 data-[state=checked]:bg-white data-[state=checked]:text-indigo-600"
              />
            </th>
            <th className="sticky left-[48px] z-20 bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider w-24 whitespace-nowrap text-center">
              Action
            </th>
            <th className="bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center">
              Indent
            </th>
            <th className="bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center">
              Planned
            </th>
            <th className="bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center">
              Unit Tracking No.
            </th>
            <th className="bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center">
              Item Name
            </th>
            <th className="bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center">
              Invoice
            </th>
            <th className="bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center">
              Return Qty
            </th>
            <th className="bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {pending.map((rec) => {
            const isChecked = selectedRows.has(rec.id);
            return (
              <tr
                key={rec.id}
                className={cn(
                  "group transition-colors border-b border-indigo-50/80 last:border-0 text-center",
                  isChecked
                    ? "bg-indigo-50/40 text-indigo-950 font-medium"
                    : "odd:bg-white even:bg-indigo-50/10 hover:bg-indigo-50/20 text-slate-700"
                )}
              >
                <td
                  className={cn(
                    "sticky left-0 z-10 border-b text-center py-2 transition-colors",
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
                    "sticky left-[48px] z-10 border-b text-center px-4 py-2 transition-colors",
                    isChecked
                      ? "bg-indigo-50/40 group-hover:bg-indigo-100/30"
                      : "bg-white group-hover:bg-indigo-50/10"
                  )}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenForm(rec.id)}
                    className="h-8 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all font-semibold px-3 text-xs shadow-2xs"
                  >
                    Process
                  </Button>
                </td>
                <td className="px-4 py-2.5 text-slate-900 font-bold whitespace-nowrap border-b border-slate-100">
                  {rec.data.indentNumber}
                </td>
                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap border-b border-slate-100">
                  {formatDate(rec.data.plannedDate)}
                </td>
                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap border-b border-slate-100">
                  {rec.data.liftNumber}
                </td>
                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap border-b border-slate-100">
                  {rec.data.itemName}
                </td>
                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap border-b border-slate-100">
                  {safeValue(rec.data.invoiceNumber)}
                </td>
                <td className="px-4 py-2.5 text-slate-600 font-semibold whitespace-nowrap border-b border-slate-100">
                  {safeValue(rec.data.returnQty)}
                </td>
                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap border-b border-slate-100">
                  <span className="px-2 py-1 rounded bg-slate-100 text-[10px] font-bold uppercase tracking-wider">
                    {safeValue(rec.data.returnStatus)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
