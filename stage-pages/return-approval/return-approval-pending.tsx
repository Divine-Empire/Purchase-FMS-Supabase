"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

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
      <div className="py-20 flex flex-col items-center justify-center text-center">
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
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar bg-white">
      <table className="w-full text-sm text-left border-collapse min-w-[1200px]">
        <thead className="sticky top-0 z-10 shadow-sm">
          <tr className="bg-slate-200 border-b border-slate-300">
            <th className="px-4 py-4 w-12 bg-slate-200">
              <Checkbox
                checked={selectedRows.size === pending.length && pending.length > 0}
                onCheckedChange={toggleAll}
                className="border-slate-400 data-[state=checked]:bg-blue-600"
              />
            </th>
            <th className="px-4 py-4 font-semibold text-slate-900 w-24 whitespace-nowrap">
              Action
            </th>
            <th className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
              Indent
            </th>
            <th className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
              Unit Tracking No.
            </th>
            <th className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
              Item Name
            </th>
            <th className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
              Invoice
            </th>
            <th className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
              Return Qty
            </th>
            <th className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
              Status
            </th>
            <th className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
              Planned
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {pending.map((rec) => (
            <tr
              key={rec.id}
              className="hover:bg-slate-50/80 transition-colors group"
            >
              <td className="px-4 py-3 whitespace-nowrap">
                <Checkbox
                  checked={selectedRows.has(rec.id)}
                  onCheckedChange={() => toggleRow(rec.id)}
                  className="border-slate-300 transition-all data-[state=checked]:bg-blue-600"
                />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenForm(rec.id)}
                  className="h-8 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all font-medium"
                >
                  Process
                </Button>
              </td>
              <td className="px-4 py-3 text-slate-900 font-medium whitespace-nowrap">
                {rec.data.indentNumber}
              </td>
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                {rec.data.liftNumber}
              </td>
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                {rec.data.itemName}
              </td>
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                {safeValue(rec.data.invoiceNumber)}
              </td>
              <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">
                {safeValue(rec.data.returnQty)}
              </td>
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                <span className="px-2 py-1 rounded bg-slate-100 text-[10px] font-bold uppercase tracking-wider">
                  {safeValue(rec.data.returnStatus)}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                {formatDate(rec.data.plannedDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
