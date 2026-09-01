"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, parseSheetDate, formatDateTimeDash } from "@/lib/utils";

const formatDateDash = (date: any) => formatDateTimeDash(date);

interface IndentApprovalPendingProps {
  pending: any[];
  selectedRecords: string[];
  toggleRecord: (id: string) => void;
  toggleAll: () => void;
  selectedColumns: string[];
  columns: readonly { readonly key: string; readonly label: string; readonly icon: any }[];
}

export default function IndentApprovalPending({
  pending,
  selectedRecords,
  toggleRecord,
  toggleAll,
  selectedColumns,
  columns,
}: IndentApprovalPendingProps) {
  return (
    <div className="border border-indigo-100 rounded-xl overflow-auto flex-1 shadow-xs relative h-full bg-white">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
        <TableHeader className="sticky top-0 z-30 bg-slate-900 shadow-xs text-white">
          <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
            <TableHead className="w-12 sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 whitespace-nowrap text-white">
              <Checkbox
                checked={
                  pending.length > 0 &&
                  selectedRecords.length === pending.length
                }
                onCheckedChange={toggleAll}
              />
            </TableHead>
            {columns
              .filter((c) => selectedColumns.includes(c.key) &&
                !["actualDate", "delay", "status", "remarks", "approvedQty"].includes(c.key))
              .map((col) => (
                <TableHead key={col.key} className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {col.icon && <col.icon className="w-4 h-4 text-white/80" />}
                    {col.label}
                  </div>
                </TableHead>
              ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pending.length === 0 ? (
            <TableRow>
              <TableCell colSpan={selectedColumns.length + 1} className="h-24 text-center text-slate-500 border-b border-indigo-50/80">
                No records found.
              </TableCell>
            </TableRow>
          ) : (
            pending.map((record) => {
              const isSelected = selectedRecords.includes(record.id);
              return (
                <TableRow
                  key={record.id}
                  className={cn(
                    "cursor-pointer transition-colors duration-150 border-b border-indigo-50/80 last:border-0",
                    isSelected 
                      ? "bg-indigo-50/40 text-indigo-950 font-medium" 
                      : "odd:bg-white even:bg-indigo-50/10 hover:bg-indigo-50/20 text-slate-700"
                  )}
                  onClick={() => toggleRecord(record.id)}
                >
                  <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleRecord(record.id)}
                    />
                  </TableCell>
                  {columns
                    .filter((c) => selectedColumns.includes(c.key) &&
                      !["actualDate", "delay", "status", "remarks", "approvedQty"].includes(c.key))
                    .map((col) => (
                      <TableCell key={col.key} className={cn(
                        "text-sm font-medium",
                        col.key === "indentNumber" && "font-bold text-indigo-950",
                        col.key !== "indentNumber" && "text-slate-600"
                      )}>
                        {col.key === "leadTime"
                          ? `${record.data[col.key] || 0} days`
                          : col.key === "plannedDate"
                            ? formatDateDash(record.data[col.key])
                            : record.data[col.key] || "-"}
                      </TableCell>
                    ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </table>
    </div>
  );
}
