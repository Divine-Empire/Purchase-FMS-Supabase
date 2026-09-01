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
import { FileText, Shield, ShieldCheck } from "lucide-react";
import { parseSheetDate, cn, formatDateTimeDash } from "@/lib/utils";

const formatDateDash = (date: any) => formatDateTimeDash(date);

interface PoEntryPendingProps {
  pending: any[];
  selectedRecordIds: string[];
  toggleSelectAll: () => void;
  toggleSelectOne: (id: string) => void;
  selectedColumns: string[];
  baseColumns: any[];
  getVendorData: (record: any) => any;
  paymentTermsList: { value: string; label: string }[];
}

export default function PoEntryPending({
  pending,
  selectedRecordIds,
  toggleSelectAll,
  toggleSelectOne,
  selectedColumns,
  baseColumns,
  getVendorData,
  paymentTermsList,
}: PoEntryPendingProps) {
  return (
    <div className="border border-indigo-100 rounded-xl flex-1 overflow-auto shadow-xs relative h-full bg-white">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
        <TableHeader className="sticky top-0 z-30 bg-slate-900 shadow-xs border-none text-white">
          <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
            <TableHead className="w-12 sticky top-0 z-20 bg-slate-900 border-b border-slate-800 pl-4 py-3">
              <div className="flex items-center justify-start h-full">
                <Checkbox
                  checked={selectedRecordIds.length === pending.length && pending.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </div>
            </TableHead>
            {baseColumns
              .filter((c) => selectedColumns.includes(c.key) && c.key !== "actual4")
              .map((col) => (
                <TableHead key={col.key} className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap tracking-wider">
                  {col.label}
                </TableHead>
              ))}
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase tracking-wider">Vendor</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase tracking-wider">Rate</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap tracking-wider">Payment Terms</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap tracking-wider">Exp. Delivery</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase tracking-wider">Warranty</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase tracking-wider">Attachment</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap tracking-wider">Approved By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pending.map((record, idx) => {
            const v = getVendorData(record);
            const isSelected = selectedRecordIds.includes(record.id);
            return (
              <TableRow
                key={record.id}
                className={cn(
                  "cursor-pointer transition-colors duration-150 border-b border-indigo-50/80 last:border-0",
                  isSelected
                    ? "bg-indigo-50/40 text-indigo-950 font-medium"
                    : `${idx % 2 === 0 ? "bg-white" : "bg-indigo-50/10"} hover:bg-indigo-50/20 text-slate-700`
                )}
              >
                <TableCell className="pl-4 py-3 border-b border-indigo-50/80">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelectOne(record.id)}
                  />
                </TableCell>
                {baseColumns
                  .filter((c) => selectedColumns.includes(c.key) && c.key !== "actual4")
                  .map((col) => (
                    <TableCell key={col.key} className={cn(
                      "text-sm font-medium border-b border-indigo-50/80 px-4 py-3 whitespace-nowrap",
                      col.key === "indentNumber" && "font-bold text-indigo-950",
                      col.key !== "indentNumber" && "text-slate-650"
                    )}>
                      {col.key === "planned4"
                        ? formatDateDash(record.data[col.key])
                        : (record.data[col.key] || "-")}
                    </TableCell>
                  ))}
                <TableCell className="text-sm font-semibold text-indigo-950 border-b border-indigo-50/80 px-4 py-3 whitespace-nowrap">{v.name}</TableCell>
                <TableCell className="text-sm font-semibold text-slate-700 border-b border-indigo-50/80 px-4 py-3">₹{v.rate || "-"}</TableCell>
                <TableCell className="text-sm font-medium text-slate-650 border-b border-indigo-50/80 px-4 py-3 whitespace-nowrap">
                  {paymentTermsList.find((t) => t.value === v.terms)?.label || v.terms || "-"}
                </TableCell>
                <TableCell className="text-sm font-medium text-slate-650 border-b border-indigo-50/80 px-4 py-3 whitespace-nowrap">
                  {v.delivery ? new Date(v.delivery).toLocaleDateString("en-IN") : "-"}
                </TableCell>
                <TableCell className="px-4 border-b border-indigo-50/80">
                  {v.warrantyType ? (
                    <div className="flex items-center gap-1.5 text-xs text-indigo-950 bg-indigo-50/60 px-2.5 py-1 rounded-full w-fit border border-indigo-100 font-semibold">
                      {v.warrantyType === "warranty" ? (
                        <Shield className="w-3.5 h-3.5 text-indigo-650" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span className="capitalize font-semibold text-indigo-950">{v.warrantyType}</span>
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="px-4 border-b border-indigo-50/80">
                  {v.attachment ? (
                    <a
                      href={typeof v.attachment === 'string' ? v.attachment : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-850 hover:underline text-xs font-semibold"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="truncate max-w-20">
                        {typeof v.attachment === 'string' ? "View File" : (v.attachment as any).name}
                      </span>
                    </a>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-sm font-semibold text-indigo-950 border-b border-indigo-50/80 px-4 py-3 whitespace-nowrap">{v.approvedBy}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </table>
    </div>
  );
}
