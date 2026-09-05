"use client";

import React from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, ShieldCheck, FileText } from "lucide-react";
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

interface Update3VendorsHistoryProps {
  completed: any[];
  selectedColumns: string[];
  baseColumns: any[];
}

export default function Update3VendorsHistory({
  completed,
  selectedColumns,
  baseColumns,
}: Update3VendorsHistoryProps) {  return (
    <div className="border border-indigo-100 rounded-xl overflow-auto flex-1 shadow-xs relative h-full bg-white">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
        <TableHeader className="sticky top-0 z-30 bg-slate-900 shadow-xs border-none text-white">
          <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
            <TableHead className="w-12 text-center text-sm font-bold text-white sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 whitespace-nowrap">#</TableHead>
            {baseColumns
              .filter((c) => selectedColumns.includes(c.accessorKey))
              .map((col) => (
                <TableHead key={col.accessorKey} className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2 text-white">
                    {col.header}
                  </div>
                </TableHead>
              ))}
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-sm">Vendor</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-sm">Rate/Qty</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-sm">Payment Terms</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-sm">Exp. Delivery</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-sm">Warranty/Guarantee</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-sm">Attachment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {completed.map((record, recordIdx) => {
            const rowBg = recordIdx % 2 === 0 ? "bg-white" : "bg-indigo-50/10";
            const vendors = [];
            for (let i = 1; i <= 3; i++) {
              const name = record.data[`vendor${i}Name`];
              if (name) {
                vendors.push({
                  name,
                  rate: record.data[`vendor${i}Rate`],
                  terms: record.data[`vendor${i}Terms`],
                  delivery: record.data[`vendor${i}DeliveryDate`],
                  warrantyType: record.data[`vendor${i}WarrantyType`],
                  warrantyFrom: record.data[`vendor${i}WarrantyFrom`],
                  warrantyTo: record.data[`vendor${i}WarrantyTo`],
                  attachment: record.data[`vendor${i}Attachment`],
                });
              }
            }

            if (vendors.length === 0) return null;

            return vendors.map((v, idx) => (
              <TableRow key={`${record.id}-v${idx + 1}`} className={cn(rowBg, "hover:bg-indigo-50/30 transition-colors border-b border-indigo-50/80 last:border-0")}>
                {idx === 0 && (
                  <>
                    <TableCell rowSpan={vendors.length} className="text-center font-bold text-indigo-950 text-sm border-b border-indigo-50/80 px-4 py-3">
                      {recordIdx + 1}
                    </TableCell>
                    {baseColumns
                      .filter((c) => selectedColumns.includes(c.accessorKey))
                      .map((col) => {
                        const isDelay = col.accessorKey === "delay2" || col.accessorKey === "delay";
                        const delayVal = isDelay ? calculateDelay(record.data.planned2 || record.data.plannedDate, record.data.actual2 || record.data.actualDate) : null;
                        return (
                          <TableCell key={col.accessorKey} rowSpan={vendors.length} className={cn(
                            "text-sm font-medium border-b border-indigo-50/80 px-4 py-3",
                            col.accessorKey === "indentNumber" && "font-bold text-indigo-950",
                            isDelay && delayVal !== "0" && delayVal !== "-" && "text-amber-700 font-bold",
                            isDelay && delayVal === "0" && "text-emerald-700 font-semibold",
                            col.accessorKey !== "indentNumber" && !isDelay && "text-slate-600"
                          )}>
                            {col.accessorKey === "leadTime"
                              ? `${record.data[col.accessorKey] || 0} days`
                              : isDelay
                                ? delayVal
                                : (col.accessorKey === "planned2" || col.accessorKey === "actual2" || col.accessorKey === "plannedDate" || col.accessorKey === "actualDate")
                                  ? formatDateDash(record.data[col.accessorKey])
                                  : (col.cell ? col.cell({ getValue: () => record.data[col.accessorKey] }) : String(record.data[col.accessorKey] ?? "-"))}
                          </TableCell>
                        );
                      })}
                  </>
                )}
                <TableCell className="text-sm font-semibold text-indigo-950 border-b border-indigo-50/80 px-4 py-3 whitespace-nowrap">{v.name}</TableCell>
                <TableCell className="text-sm font-semibold text-slate-700 border-b border-indigo-50/80 px-4 py-3 whitespace-nowrap">
                  {v.rate ? `₹${parseFloat(v.rate).toFixed(2)}` : "-"}
                </TableCell>
                <TableCell className="text-sm font-medium text-slate-650 border-b border-indigo-50/80 px-4 py-3">{v.terms || "-"}</TableCell>
                <TableCell className="text-sm font-medium text-slate-650 border-b border-indigo-50/80 px-4 py-3 whitespace-nowrap">
                  {v.delivery ? formatDateDash(v.delivery) : "-"}
                </TableCell>
                <TableCell className="text-sm font-medium text-slate-650 border-b border-indigo-50/80 px-4 py-3">
                  {v.warrantyType ? (
                    <div className="flex flex-col text-xs min-w-[120px]">
                      <div className="flex items-center gap-1">
                        {v.warrantyType === "warranty" ? (
                          <Shield className="w-3.5 h-3.5 text-indigo-600" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span className="font-semibold capitalize text-indigo-950">{v.warrantyType}</span>
                      </div>
                      {v.warrantyFrom && v.warrantyTo && (
                        <span className="text-slate-500 font-medium">
                          {formatDateDash(v.warrantyFrom)} – {formatDateDash(v.warrantyTo)}
                        </span>
                      )}
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-sm font-medium border-b border-indigo-50/80 px-4 py-3">
                  {v.attachment ? (
                    <a
                      href={v.attachment}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-indigo-600 text-xs font-semibold hover:underline hover:text-indigo-800"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>View</span>
                    </a>
                  ) : (
                    "-"
                  )}
                </TableCell>
              </TableRow>
            ));
          })}
        </TableBody>
      </table>
    </div>
  );
}
