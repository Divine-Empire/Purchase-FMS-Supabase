"use client";

import React from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseSheetDate } from "@/lib/utils";

const formatDateDash = (date: any) => {
  if (!date || date === "-" || date === "—") return "-";
  const d = date instanceof Date ? date : parseSheetDate(date);
  if (!d || isNaN(d.getTime())) return typeof date === 'string' ? date : "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
};

interface IndentApprovalHistoryProps {
  history: any[];
  selectedColumns: string[];
  columns: readonly { readonly key: string; readonly label: string; readonly icon: any }[];
}

export default function IndentApprovalHistory({
  history,
  selectedColumns,
  columns,
}: IndentApprovalHistoryProps) {
  return (
    <div className="border rounded-lg overflow-auto flex-1 shadow-sm relative h-full">
      <table className="w-full caption-bottom text-sm border-collapse">
        <TableHeader className="bg-slate-200 sticky top-0 z-30 shadow-sm border-none">
          <TableRow className="bg-slate-200 hover:bg-slate-200 border-none">
            <TableHead className="w-12 text-center text-sm font-bold text-slate-400 sticky top-0 z-20 bg-slate-200 border-none">#</TableHead>
            {columns
              .filter((c) => selectedColumns.includes(c.key) && c.key !== "delay")
              .map((col) => (
                <TableHead key={col.key} className="sticky top-0 z-20 bg-slate-200 border-none">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    {col.icon && <col.icon className="w-4 h-4" />}
                    {col.label}
                  </div>
                </TableHead>
              ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((record, index) => (
            <TableRow key={record.id} className="hover:bg-slate-50/50 transition-colors">
              <TableCell className="text-center font-medium text-slate-500 text-sm">
                {index + 1}
              </TableCell>
              {columns
                .filter((c) => selectedColumns.includes(c.key) && c.key !== "delay")
                .map((col) => (
                  <TableCell key={col.key} className="text-sm text-slate-700">
                    {col.key === "leadTime"
                      ? `${record.data[col.key] || 0} days`
                      : (col.key === "plannedDate" || col.key === "actualDate")
                        ? formatDateDash(record.data[col.key])
                        : record.data[col.key] || "-"}
                  </TableCell>
                ))}
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  );
}
