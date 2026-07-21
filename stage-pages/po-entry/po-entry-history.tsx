"use client";

import React from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Shield, ShieldCheck } from "lucide-react";
import { parseSheetDate, formatDate } from "@/lib/utils";

const formatDateDash = (date: any) => {
  if (!date || date === "-" || date === "—") return "-";
  const d = date instanceof Date ? date : parseSheetDate(date);
  if (!d || isNaN(d.getTime())) return typeof date === 'string' ? date : "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
};

const formatGSTDisplay = (gst: any) => {
  if (!gst || gst === "-" || gst === "") return "-";
  const s = String(gst);
  if (s.includes("%")) return s;
  const n = parseFloat(s);
  if (!isNaN(n) && n > 0 && n < 1) {
    return `${Math.round(n * 100)}%`;
  }
  return s;
};

interface PoEntryHistoryProps {
  completed: any[];
  getVendorData: (record: any) => any;
  paymentTermsList: { value: string; label: string }[];
  poTotalMap: Map<string, number>;
}

export default function PoEntryHistory({
  completed,
  getVendorData,
  paymentTermsList,
  poTotalMap,
}: PoEntryHistoryProps) {
  return (
    <div className="border rounded-lg flex-1 overflow-auto shadow-sm relative h-full">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
        <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
          <TableRow className="bg-slate-200 hover:bg-slate-200 border-none">
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase">Item Details</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Planned</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Actual</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase">Vendor Info</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Terms & Delivery</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Warranty/Quot.</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Approved By</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase">PO Details (Incl. HSN)</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase">Financials (Incl. GST%)</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Total Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {completed.map((record) => {
            const v = getVendorData(record);
            return (
              <TableRow key={record.id} className="bg-green-50/50 hover:bg-green-100/50">
                <TableCell className="max-w-[200px] px-4">
                  <div className="space-y-1">
                    <div className="font-semibold text-blue-900">{record.data.indentNumber || "-"}</div>
                    <div className="text-sm font-medium truncate" title={record.data.itemName}>{record.data.itemName}</div>
                    <div className="text-xs text-gray-500">Qty: {record.data.quantity}</div>
                  </div>
                </TableCell>
                <TableCell className="px-4 text-slate-700 whitespace-nowrap">
                  {formatDateDash(record.data.planned4)}
                </TableCell>
                <TableCell className="px-4 text-slate-700 whitespace-nowrap">
                  {formatDateDash(record.data.actual4)}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium text-gray-900">{v.name}</div>
                    <div className="text-xs text-gray-500">Rate: ₹{v.rate || "-"}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">Terms:</span>
                      <span>{paymentTermsList.find((t) => t.value === v.terms)?.label || v.terms || "-"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">Delivery:</span>
                      <span className={!v.delivery ? "text-gray-400" : ""}>
                        {v.delivery ? formatDate(parseSheetDate(v.delivery)) : "-"}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
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
                      <span className="text-xs text-gray-400">-</span>
                    )}
                    {v.attachment && (
                      <a
                        href={typeof v.attachment === 'string' ? v.attachment : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline text-[10px]"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Quot.</span>
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex flex-col">
                      <span className="text-gray-400">Approved:</span>
                      <span className="font-medium truncate max-w-[100px]">{v.approvedBy}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="bg-white/50">
                  <div className="space-y-1">
                    <div className="font-mono text-sm font-bold text-green-700">{record.data.poNumber || "-"}</div>
                    <div className="text-[11px] text-gray-500">HSN: {record.data.hsn || "-"}</div>
                    {record.data.poCopy && (
                      <a
                        href={typeof record.data.poCopy === 'string' ? record.data.poCopy : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-green-600 hover:underline text-[11px]"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View PO Copy</span>
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell className="bg-white/50">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-xs text-gray-500">Basic:</span>
                      <span className="font-medium">₹{record.data.basicValue || "-"}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-t pt-1">
                      <span className="text-xs text-gray-500 font-semibold text-green-700">GST: {formatGSTDisplay(record.data.gst)}</span>
                      <span className="font-bold text-green-800">Total: ₹{record.data.totalWithTax || "-"}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="bg-white/50 border-l">
                  <div className="font-bold text-green-800 text-sm">
                    ₹{poTotalMap.get(record.data.poNumber)?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "-"}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </table>
    </div>
  );
}
