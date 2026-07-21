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
import { cn, parseSheetDate } from "@/lib/utils";

const formatDateDash = (date: any) => {
  if (!date || date === "-" || date === "—") return "-";
  const d = date instanceof Date ? date : parseSheetDate(date);
  if (!d || isNaN(d.getTime())) return typeof date === 'string' ? date : "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
};

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
    <div className="border rounded-lg overflow-auto flex-1 shadow-sm relative h-full">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
        <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm">
          <TableRow className="bg-slate-200 hover:bg-slate-200">
            <TableHead className="w-12 sticky top-0 z-20 bg-slate-200 shadow-sm border-none">
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
                <TableHead key={col.key} className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">
                  <div className="flex items-center gap-2">
                    {col.icon && <col.icon className="w-4 h-4" />}
                    {col.label}
                  </div>
                </TableHead>
              ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pending.length === 0 ? (
            <TableRow>
              <TableCell colSpan={selectedColumns.length + 1} className="h-24 text-center">
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
                    "cursor-pointer transition-colors duration-150",
                    isSelected ? "bg-slate-50" : "hover:bg-slate-50/50"
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
                      <TableCell key={col.key}>
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
