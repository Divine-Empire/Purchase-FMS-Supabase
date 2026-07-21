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
import { parseSheetDate } from "@/lib/utils";

const formatDateDash = (dateStr: string) => {
  if (!dateStr || dateStr === "-" || dateStr === "—") return "-";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  } catch {
    return dateStr;
  }
};

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
    <div className="flex-1 overflow-auto border rounded-xl bg-white shadow-sm scrollbar-thin scrollbar-thumb-slate-200">
      <table className="w-full caption-bottom text-sm border-collapse">
        <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
          <TableRow className="bg-slate-200 hover:bg-slate-200 border-none">
            {baseColumns
              .filter((c) => selectedColumns.includes(c.key))
              .map((col) => (
                <TableHead key={col.key} className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3">
                  <div className="flex items-center gap-2 font-bold text-slate-700 truncate uppercase text-[13px] tracking-wider">
                    {col.label}
                  </div>
                </TableHead>
              ))}
            <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3">
              <div className="flex items-center gap-2 font-bold text-slate-700 truncate uppercase text-[13px] tracking-wider">
                Vendor
              </div>
            </TableHead>
            <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3">
              <div className="flex items-center gap-2 font-bold text-slate-700 truncate uppercase text-[13px] tracking-wider">
                Rate
              </div>
            </TableHead>
            <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3">
              <div className="flex items-center gap-2 font-bold text-slate-700 truncate uppercase text-[13px] tracking-wider">
                Approved By
              </div>
            </TableHead>
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
              <TableRow key={record.id} className="hover:bg-muted/50 odd:bg-white even:bg-slate-50/80 group">
                {baseColumns
                  .filter((c) => selectedColumns.includes(c.key))
                  .map((col) => (
                    <TableCell key={col.key} className="text-sm text-slate-700 px-4">
                      {col.key === "planned3" || col.key === "actual3"
                        ? formatDateDash(record.data[col.key])
                        : String(record.data[col.key] ?? "-")}
                    </TableCell>
                  ))}
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-slate-900">{v.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-slate-700 px-4 font-medium">₹{v.rate || "-"}</TableCell>
                <TableCell className="px-4">
                  <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-medium">
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
