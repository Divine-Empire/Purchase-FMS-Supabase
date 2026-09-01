"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2 } from "lucide-react";
import { parseSheetDate, cn, formatDateTimeDash } from "@/lib/utils";

const formatDateDash = (dateStr: string) => formatDateTimeDash(dateStr);

interface NegotiationHistoryProps {
  completed: any[];
  selectedColumns: string[];
  baseColumns: any[];
}

export default function NegotiationHistory({
  completed,
  selectedColumns,
  baseColumns,
}: NegotiationHistoryProps) {
  return (
    <div className="border border-indigo-100 rounded-xl overflow-auto flex-1 shadow-xs relative h-full bg-white">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
        <TableHeader className="sticky top-0 z-30 bg-slate-900 shadow-xs border-none text-white">
          <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
            {baseColumns
              .filter((c) => selectedColumns.includes(c.key))
              .map((col) => (
                <TableHead key={col.key} className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-[11px] tracking-wider uppercase">
                  <div className="flex items-center gap-2 text-white">
                    {col.label}
                  </div>
                </TableHead>
              ))}
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-[11px] tracking-wider uppercase">Vendor</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-[11px] tracking-wider uppercase">Rate</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-[11px] tracking-wider uppercase">Approved By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {completed.map((record) => {
            const selectedName = record.data.selectedVendorName;
            let idx = 1;
            if (selectedName === record.data.vendor2Name) idx = 2;
            else if (selectedName === record.data.vendor3Name) idx = 3;

            const v = {
              name: record.data[`vendor${idx}Name`] || "-",
              rate: record.data[`vendor${idx}Rate`],
              terms: record.data[`vendor${idx}Terms`],
              delivery: record.data[`vendor${idx}DeliveryDate`],
              warrantyType: record.data[`vendor${idx}WarrantyType`],
              warrantyFrom: record.data[`vendor${idx}WarrantyFrom`],
              warrantyTo: record.data[`vendor${idx}WarrantyTo`],
              attachment: record.data[`vendor${idx}Attachment`],
              approvedBy: record.data.finalApprovedBy || "Auto-Approved",
            };

            return (
              <TableRow key={record.id} className="odd:bg-white even:bg-indigo-50/10 hover:bg-indigo-50/30 transition-colors border-b border-indigo-50/80 last:border-0">
                {baseColumns
                  .filter((c) => selectedColumns.includes(c.key))
                  .map((col) => (
                    <TableCell key={col.key} className={cn(
                      "text-sm font-medium border-b border-indigo-50/80 px-4 py-3",
                      col.key === "indentNumber" && "font-bold text-indigo-950",
                      col.key !== "indentNumber" && "text-slate-600"
                    )}>
                      {col.key === "planned3" || col.key === "actual3"
                        ? formatDateDash(record.data[col.key])
                        : String(record.data[col.key] ?? "-")}
                    </TableCell>
                  ))}
                <TableCell className="px-4 py-3 border-b border-indigo-50/80">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-indigo-950">{v.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-semibold text-slate-700 border-b border-indigo-50/80 px-4 py-3">
                  {v.rate ? `₹${v.rate}` : "-"}
                </TableCell>
                <TableCell className="px-4 border-b border-indigo-50/80">
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold">
                    {v.approvedBy}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </table>
    </div>
  );
}
