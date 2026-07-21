"use client";

import React from "react";
import { FileText } from "lucide-react";

interface ReturnApprovalHistoryProps {
  completed: any[];
  safeValue: (val: any) => React.ReactNode;
  formatDate: (dateStr: string) => string;
}

export default function ReturnApprovalHistory({
  completed,
  safeValue,
  formatDate,
}: ReturnApprovalHistoryProps) {
  if (completed.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 transition-transform hover:scale-110">
          <span className="text-3xl text-slate-300">🔍</span>
        </div>
        <h3 className="text-xl font-semibold text-slate-900">
          No history found
        </h3>
        <p className="text-slate-500 mt-2 max-w-sm">
          Processed approvals will appear here once they are submitted.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar bg-white">
      <table className="w-full text-sm text-left border-collapse min-w-[1400px]">
        <thead className="sticky top-0 z-10 shadow-sm">
          <tr className="bg-slate-200 border-b border-slate-300">
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
            <th className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
              Actual
            </th>
            <th className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
              Delay
            </th>
            <th className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
              DN Number
            </th>
            <th className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
              Image
            </th>
            <th className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
              Remarks
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {completed.map((rec) => (
            <tr
              key={rec.id}
              className="hover:bg-slate-50/80 transition-colors"
            >
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
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-medium text-blue-600">
                {formatDate(rec.data.actualDate)}
              </td>
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                {rec.data.delay}
              </td>
              <td className="px-4 py-3 text-slate-600 font-semibold whitespace-nowrap">
                {rec.data.dnNumber}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {rec.data.returnImage ? (
                  <a
                    href={rec.data.returnImage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-xs font-medium whitespace-nowrap justify-center"
                  >
                    <FileText className="w-3.5 h-3.5" /> View
                  </a>
                ) : (
                  "-"
                )}
              </td>
              <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate whitespace-nowrap">
                {rec.data.remarks}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
