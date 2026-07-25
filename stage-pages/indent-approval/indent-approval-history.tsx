"use client";

import React from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseSheetDate, cn } from "@/lib/utils";

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
    <div className="border border-indigo-100 rounded-xl overflow-auto flex-1 shadow-xs relative h-full bg-white">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
        <TableHeader className="bg-slate-900 sticky top-0 z-30 shadow-xs border-none text-white">
          <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
            <TableHead className="w-12 text-center text-sm font-bold text-white sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 whitespace-nowrap">#</TableHead>
            {columns
              .filter((c) => selectedColumns.includes(c.key) && c.key !== "delay")
              .map((col) => (
                <TableHead key={col.key} className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2 text-white">
                    {col.icon && <col.icon className="w-4 h-4 text-white/80" />}
                    {col.label}
                  </div>
                </TableHead>
              ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((record, index) => (
            <TableRow key={record.id} className="odd:bg-white even:bg-indigo-50/10 hover:bg-indigo-50/30 transition-colors border-b border-indigo-50/80 last:border-0">
              <TableCell className="text-center font-bold text-indigo-950 text-sm border-b border-indigo-50/80 px-4 py-3">
                {index + 1}
              </TableCell>
              {columns
                .filter((c) => selectedColumns.includes(c.key) && c.key !== "delay")
                .map((col) => (
                  <TableCell key={col.key} className={cn(
                    "text-sm font-medium border-b border-indigo-50/80 px-4 py-3",
                    col.key === "indentNumber" && "font-bold text-indigo-950",
                    col.key === "status" && record.data[col.key]?.toLowerCase() === "approved" && "text-emerald-700 font-extrabold uppercase text-xs tracking-wider",
                    col.key === "status" && record.data[col.key]?.toLowerCase() === "rejected" && "text-rose-700 font-extrabold uppercase text-xs tracking-wider",
                    col.key !== "status" && col.key !== "indentNumber" && "text-slate-600"
                  )}>
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
