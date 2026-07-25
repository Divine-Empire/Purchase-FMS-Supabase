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
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar bg-white border rounded-2xl shadow-xs">
      <table className="w-full text-sm text-left border-separate border-spacing-0 min-w-[1400px]">
        <thead className="sticky top-0 z-10 bg-slate-900 border-none text-white text-center">
          <tr className="bg-slate-900 text-white hover:bg-transparent">
            <th className="bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center">
              Indent
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
            <th className="bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center">
              Planned
            </th>
            <th className="bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center">
              Actual
            </th>
            <th className="bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center">
              Delay
            </th>
            <th className="bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center">
              DN Number
            </th>
            <th className="bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center">
              Image
            </th>
            <th className="bg-slate-900 px-4 py-3 font-bold text-white border-b border-slate-800 text-[11px] uppercase tracking-wider whitespace-nowrap text-center">
              Remarks
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {completed.map((rec) => (
            <tr
              key={rec.id}
              className="even:bg-slate-50/30 hover:bg-indigo-50/20 transition-colors border-b border-slate-100 last:border-0 text-center"
            >
              <td className="px-4 py-2.5 text-slate-900 font-bold whitespace-nowrap border-b border-slate-100">
                {rec.data.indentNumber}
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
              <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap border-b border-slate-100">
                {formatDate(rec.data.plannedDate)}
              </td>
              <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap font-medium text-blue-600 border-b border-slate-100">
                {formatDate(rec.data.actualDate)}
              </td>
              <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap border-b border-slate-100">
                {rec.data.delay}
              </td>
              <td className="px-4 py-2.5 text-slate-600 font-semibold whitespace-nowrap border-b border-slate-100">
                {rec.data.dnNumber}
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap border-b border-slate-100">
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
              <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate whitespace-nowrap border-b border-slate-100">
                {rec.data.remarks}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
