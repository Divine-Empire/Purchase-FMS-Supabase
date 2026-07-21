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

interface Update3VendorsHistoryProps {
  completed: any[];
  selectedColumns: string[];
  baseColumns: any[];
}

export default function Update3VendorsHistory({
  completed,
  selectedColumns,
  baseColumns,
}: Update3VendorsHistoryProps) {
  return (
    <div className="border rounded-lg overflow-auto flex-1 shadow-sm relative h-full">
      <table className="w-full caption-bottom text-sm border-collapse">
        <TableHeader className="sticky top-0 z-30 bg-slate-55 shadow-sm border-none">
          <TableRow className="bg-slate-50 hover:bg-slate-50 border-none">
            <TableHead className="w-12 text-center text-sm font-bold text-slate-400 sticky top-0 z-20 bg-slate-50 border-none">#</TableHead>
            {baseColumns
              .filter((c) => selectedColumns.includes(c.accessorKey))
              .map((col) => (
                <TableHead key={col.accessorKey} className="sticky top-0 z-20 bg-slate-50 border-none">
                  <div className="flex items-center gap-2 font-bold text-slate-600 truncate">
                    {col.header}
                  </div>
                </TableHead>
              ))}
            <TableHead className="sticky top-0 z-20 bg-slate-50 border-none font-bold text-slate-600 whitespace-nowrap">Vendor</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-50 border-none font-bold text-slate-600 whitespace-nowrap">Rate/Qty</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-50 border-none font-bold text-slate-600 whitespace-nowrap">Payment Terms</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-50 border-none font-bold text-slate-600 whitespace-nowrap">Exp. Delivery</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-50 border-none font-bold text-slate-600 whitespace-nowrap">Warranty/Guarantee</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-50 border-none font-bold text-slate-600 whitespace-nowrap">Attachment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {completed.map((record, recordIdx) => {
            const rowBg = recordIdx % 2 === 0 ? "bg-white" : "bg-slate-50/80";
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
              <TableRow key={`${record.id}-v${idx + 1}`} className={cn(rowBg, "hover:bg-slate-100/50 transition-colors")}>
                {idx === 0 && (
                  <>
                    <TableCell rowSpan={vendors.length} className="text-center font-medium text-slate-500 text-sm">
                      {recordIdx + 1}
                    </TableCell>
                    {baseColumns
                      .filter((c) => selectedColumns.includes(c.accessorKey))
                      .map((col) => (
                        <TableCell key={col.accessorKey} rowSpan={vendors.length} className="text-sm text-slate-700">
                          {col.accessorKey === "leadTime"
                            ? `${record.data[col.accessorKey] || 0} days`
                            : (col.accessorKey === "planned2" || col.accessorKey === "actual2")
                              ? formatDateDash(record.data[col.accessorKey])
                              : (col.cell ? col.cell({ getValue: () => record.data[col.accessorKey] }) : String(record.data[col.accessorKey] ?? "-"))}
                        </TableCell>
                      ))}
                  </>
                )}
                <TableCell className="text-sm text-slate-700 whitespace-nowrap">{v.name}</TableCell>
                <TableCell className="text-sm text-slate-700 whitespace-nowrap">
                  {v.rate ? `₹${parseFloat(v.rate).toFixed(2)}` : "-"}
                </TableCell>
                <TableCell className="text-sm text-slate-700">{v.terms || "-"}</TableCell>
                <TableCell className="text-sm text-slate-700 whitespace-nowrap">
                  {v.delivery ? formatDateDash(v.delivery) : "-"}
                </TableCell>
                <TableCell className="text-sm text-slate-700">
                  {v.warrantyType ? (
                    <div className="flex flex-col text-xs min-w-[120px]">
                      <div className="flex items-center gap-1">
                        {v.warrantyType === "warranty" ? (
                          <Shield className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                        )}
                        <span className="font-medium capitalize">{v.warrantyType}</span>
                      </div>
                      {v.warrantyFrom && v.warrantyTo && (
                        <span className="text-gray-500">
                          {formatDateDash(v.warrantyFrom)} – {formatDateDash(v.warrantyTo)}
                        </span>
                      )}
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-sm text-slate-700">
                  {v.attachment ? (
                    <a
                      href={v.attachment}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 text-xs hover:underline"
                    >
                      <FileText className="w-3.5 h-3.5" />
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
