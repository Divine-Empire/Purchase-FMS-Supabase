"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SerialGenerationPendingProps {
  pendingGroups: any[];
  selectedPendingIds: Set<string>;
  expandedInvoices: Record<string, boolean>;
  toggleInvoiceExpanded: (invoiceNo: string) => void;
  handleCheckboxChange: (rec: any, checked: boolean) => void;
  openForm: (records: any[]) => void;
  PENDING_COLUMNS: readonly { readonly key: string; readonly label: string }[];
  renderCell: (data: any, key: string) => React.ReactNode;
  formatDateDash: (date: any) => string;
}

export default function SerialGenerationPending({
  pendingGroups,
  selectedPendingIds,
  expandedInvoices,
  toggleInvoiceExpanded,
  handleCheckboxChange,
  openForm,
  PENDING_COLUMNS,
  renderCell,
  formatDateDash,
}: SerialGenerationPendingProps) {
  return (
    <div className="border rounded-lg overflow-x-auto h-[70vh] relative">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
        <thead className="sticky top-0 z-30 bg-slate-900 shadow-xs border-none text-center">
          <tr className="hover:bg-transparent border-none bg-slate-900 text-white">
            <th className="sticky left-0 z-40 bg-slate-900 w-[170px] border-b border-slate-800 text-center whitespace-nowrap px-4 py-3 font-bold text-white uppercase text-[11px] tracking-wider">
              Actions
            </th>
            {PENDING_COLUMNS.map((c) => (
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
          {pendingGroups.map((group) => {
            const isExpanded = !!expandedInvoices[group.invoiceNo];
            return (
              <React.Fragment key={group.invoiceNo}>
                {/* Group Header Row */}
                <tr
                  className="bg-slate-100/80 cursor-pointer hover:bg-slate-200/60"
                  onClick={() => toggleInvoiceExpanded(group.invoiceNo)}
                >
                  <td className="sticky left-0 z-20 bg-slate-100/80 hover:bg-slate-200/60 border-b px-4 py-3 font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 w-4 text-center">
                        {isExpanded ? "▼" : "▶"}
                      </span>
                      <span>Invoice: {group.invoiceNo}</span>
                    </div>
                  </td>
                  <td
                    colSpan={PENDING_COLUMNS.length}
                    className="border-b px-4 py-3 font-semibold text-slate-700"
                  >
                    <div className="flex gap-6 text-sm">
                      <span>
                        Date:{" "}
                        <span className="text-slate-900">
                          {formatDateDash(group.invoiceDate)}
                        </span>
                      </span>
                      <span>
                        Vendor:{" "}
                        <span className="text-slate-900">
                          {group.vendorName}
                        </span>
                      </span>
                      <span className="text-slate-500 font-normal">
                        ({group.records.length} lift
                        {group.records.length > 1 ? "s" : ""})
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Child Rows */}
                {isExpanded &&
                  group.records.map((rec: any) => {
                    const isChecked = selectedPendingIds.has(rec.id);
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
                            "sticky left-0 z-20 border-b text-center px-4 py-2 transition-colors",
                            isChecked
                              ? "bg-indigo-50/40 group-hover:bg-indigo-100/30"
                              : "bg-white group-hover:bg-indigo-50/10"
                          )}
                        >
                          <div className="flex items-center justify-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) =>
                                handleCheckboxChange(rec, e.target.checked)
                              }
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openForm([rec])}
                              className="h-8 px-3 text-xs font-medium border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap"
                            >
                              Serial Generation
                            </Button>
                          </div>
                        </td>
                        {PENDING_COLUMNS.map((col) => (
                          <td
                            key={col.key}
                            className="border-b border-slate-100 px-4 py-2 text-center text-slate-700 whitespace-nowrap"
                          >
                            {renderCell(rec.data, col.key)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
