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
    <div className="border rounded-lg flex-1 overflow-auto shadow-sm relative h-full">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
        <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
          <TableRow className="bg-slate-200 hover:bg-slate-200 border-none">
            <TableHead className="w-12 sticky top-0 z-20 bg-slate-200 border-none pl-4 py-3">
              <div className="flex items-center justify-start h-full">
                <Checkbox
                  checked={selectedRecordIds.length === pending.length && pending.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </div>
            </TableHead>
            {baseColumns
              .filter((c) => selectedColumns.includes(c.key))
              .map((col) => (
                <TableHead key={col.key} className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">
                  {col.label}
                </TableHead>
              ))}
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase">Vendor</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase">Rate</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Payment Terms</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Exp. Delivery</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase">Warranty</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase">Attachment</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Approved By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pending.map((record) => {
            const v = getVendorData(record);
            const isSelected = selectedRecordIds.includes(record.id);
            return (
              <TableRow
                key={record.id}
                className={isSelected ? "bg-blue-50" : ""}
              >
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelectOne(record.id)}
                  />
                </TableCell>
                {baseColumns
                  .filter((c) => selectedColumns.includes(c.key))
                  .map((col) => (
                    <TableCell key={col.key} className="px-4 whitespace-nowrap">
                      {col.key === "planned4"
                        ? formatDateDash(record.data[col.key])
                        : (record.data[col.key] || "-")}
                    </TableCell>
                  ))}
                <TableCell className="font-medium">{v.name}</TableCell>
                <TableCell>₹{v.rate || "-"}</TableCell>
                <TableCell>
                  {paymentTermsList.find((t) => t.value === v.terms)?.label || v.terms || "-"}
                </TableCell>
                <TableCell>
                  {v.delivery ? new Date(v.delivery).toLocaleDateString("en-IN") : "-"}
                </TableCell>
                <TableCell>
                  {v.warrantyType ? (
                    <div className="flex items-center gap-1 text-xs">
                      {v.warrantyType === "warranty" ? (
                        <Shield className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                      )}
                      <span className="capitalize">{v.warrantyType}</span>
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  {v.attachment ? (
                    <a
                      href={typeof v.attachment === 'string' ? v.attachment : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span className="truncate max-w-20">
                        {typeof v.attachment === 'string' ? "View File" : (v.attachment as any).name}
                      </span>
                    </a>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{v.approvedBy}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </table>
    </div>
  );
}
