"use client";

import React from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { parseSheetDate, cn, formatDateTimeDash } from "@/lib/utils";

const formatDateDash = (date: any) => formatDateTimeDash(date);

const calculateDelay = (planned: any, actual: any) => {
  if (!planned || !actual) return "-";
  const pDate = parseSheetDate(planned);
  const aDate = parseSheetDate(actual);
  if (!pDate || !aDate) return "-";

  const diffMs = aDate.getTime() - pDate.getTime();
  if (diffMs <= 0) return "0";

  const diffHours = diffMs / (1000 * 60 * 60);
  const days = Math.floor(diffHours / 24);
  const hours = Math.floor(diffHours % 24);

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days} day${days > 1 ? "s" : ""}`;
  }
  if (hours > 0) {
    return `${hours} hr${hours > 1 ? "s" : ""}`;
  }
  const mins = Math.floor(diffMs / (1000 * 60));
  return `${mins} min${mins !== 1 ? "s" : ""}`;
};

interface IndentApprovalHistoryProps {
  history: any[];
  selectedColumns: string[];
  columns: readonly { readonly key: string; readonly label: string; readonly icon: any }[];
  statusFilter?: "all" | "approved" | "rejected";
  onStatusFilterChange?: (status: "all" | "approved" | "rejected") => void;
  isAdmin?: boolean;
  onEdit?: (record: any) => void;
}

export default function IndentApprovalHistory({
  history,
  selectedColumns,
  columns,
  statusFilter = "all",
  onStatusFilterChange,
  isAdmin,
  onEdit,
}: IndentApprovalHistoryProps) {
  return (
    <div className="flex flex-col h-full space-y-3 overflow-hidden">
      {/* Top Status Filter Bar */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">Status:</span>
          <Select
            value={statusFilter}
            onValueChange={(val) => onStatusFilterChange?.(val as "all" | "approved" | "rejected")}
          >
            <SelectTrigger className="w-[180px] bg-white border border-indigo-100 hover:border-indigo-200 focus:ring-2 focus:ring-indigo-500 rounded-lg text-slate-700 font-semibold shadow-xs">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent className="bg-white border border-indigo-100 rounded-lg shadow-md">
              <SelectItem value="all" className="text-slate-700 hover:bg-indigo-50 focus:bg-indigo-50 font-medium">All</SelectItem>
              <SelectItem value="approved" className="text-slate-700 hover:bg-indigo-50 focus:bg-indigo-50 font-medium">Approved</SelectItem>
              <SelectItem value="rejected" className="text-slate-700 hover:bg-indigo-50 focus:bg-indigo-50 font-medium">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-700">{history.length}</span> record{history.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Table Container */}
      <div className="border border-indigo-100 rounded-xl overflow-auto flex-1 shadow-xs relative bg-white">
        {history.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg font-medium">No completed records found</p>
            {statusFilter !== "all" && (
              <p className="text-sm text-slate-400 mt-1">Try changing the status filter</p>
            )}
          </div>
        ) : (
          <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
            <TableHeader className="bg-slate-900 sticky top-0 z-30 shadow-xs border-none text-white">
              <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
                {isAdmin && (
                  <TableHead className="text-center text-sm font-bold text-white sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 whitespace-nowrap">Actions</TableHead>
                )}
                <TableHead className="w-12 text-center text-sm font-bold text-white sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 whitespace-nowrap">#</TableHead>
                {columns
                  .filter((c) => selectedColumns.includes(c.key))
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
                  {isAdmin && (
                    <TableCell className="text-center border-b border-indigo-50/80 px-4 py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit?.(record)}
                        className="h-7 px-2.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3 mr-1" /> Edit
                      </Button>
                    </TableCell>
                  )}
                  <TableCell className="text-center font-bold text-indigo-950 text-sm border-b border-indigo-50/80 px-4 py-3">
                    {index + 1}
                  </TableCell>
                  {columns
                    .filter((c) => selectedColumns.includes(c.key))
                    .map((col) => {
                      const isDelay = col.key === "delay";
                      const delayVal = isDelay ? calculateDelay(record.data.plannedDate, record.data.actualDate) : null;
                      return (
                        <TableCell key={col.key} className={cn(
                          "text-sm font-medium border-b border-indigo-50/80 px-4 py-3",
                          col.key === "indentNumber" && "font-bold text-indigo-950",
                          col.key === "status" && record.data[col.key]?.toLowerCase() === "approved" && "text-emerald-700 font-extrabold uppercase text-xs tracking-wider",
                          col.key === "status" && record.data[col.key]?.toLowerCase() === "rejected" && "text-rose-700 font-extrabold uppercase text-xs tracking-wider",
                          col.key === "delay" && delayVal !== "0" && delayVal !== "-" && "text-amber-700 font-bold",
                          col.key === "delay" && delayVal === "0" && "text-emerald-700 font-semibold",
                          col.key !== "status" && col.key !== "indentNumber" && col.key !== "delay" && "text-slate-600"
                        )}>
                          {col.key === "leadTime"
                            ? `${record.data[col.key] || 0} days`
                            : col.key === "delay"
                              ? delayVal
                              : (col.key === "plannedDate" || col.key === "actualDate")
                                ? formatDateDash(record.data[col.key])
                                : record.data[col.key] || "-"}
                        </TableCell>
                      );
                    })}
                </TableRow>
              ))}
            </TableBody>
          </table>
        )}
      </div>
    </div>
  );
}
