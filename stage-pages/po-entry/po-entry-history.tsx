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
import { parseSheetDate, formatDate, cn, formatDateTimeDash } from "@/lib/utils";

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
    <div className="border border-indigo-100 rounded-xl flex-1 overflow-auto shadow-xs relative h-full bg-white">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
        <TableHeader className="sticky top-0 z-30 bg-slate-900 shadow-xs border-none text-white">
          <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase tracking-wider">Item Details</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap tracking-wider">Planned</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap tracking-wider">Actual</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap tracking-wider">Delay</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase tracking-wider">Vendor Info</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap tracking-wider">Terms & Delivery</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap tracking-wider">Warranty/Quot.</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap tracking-wider">Approved By</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase tracking-wider">PO Details (Incl. HSN)</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase tracking-wider">Financials (Incl. GST%)</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap tracking-wider">Total Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {completed.map((record) => {
            const v = getVendorData(record);
            const delayVal = calculateDelay(record.data.planned4 || record.data.plannedDate, record.data.actual4 || record.data.actualDate);
            return (
              <TableRow key={record.id} className="odd:bg-emerald-50/10 even:bg-white hover:bg-emerald-50/20 border-b border-indigo-50/80 last:border-0 transition-colors text-slate-700">
                <TableCell className="max-w-[200px] px-4 py-3 border-b border-indigo-50/80">
                  <div className="space-y-1">
                    <div className="font-bold text-indigo-950">{record.data.indentNumber || "-"}</div>
                    <div className="text-sm font-semibold truncate text-slate-750" title={record.data.itemName}>{record.data.itemName}</div>
                    <div className="text-xs font-semibold text-slate-550">Qty: {record.data.quantity}</div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3 text-slate-650 font-medium whitespace-nowrap border-b border-indigo-50/80">
                  {formatDateDash(record.data.planned4)}
                </TableCell>
                <TableCell className="px-4 py-3 text-slate-650 font-medium whitespace-nowrap border-b border-indigo-50/80">
                  {formatDateDash(record.data.actual4)}
                </TableCell>
                <TableCell className={cn(
                  "px-4 py-3 font-medium whitespace-nowrap border-b border-indigo-50/80",
                  delayVal !== "0" && delayVal !== "-" && "text-amber-700 font-bold",
                  delayVal === "0" && "text-emerald-700 font-semibold"
                )}>
                  {delayVal}
                </TableCell>
                <TableCell className="px-4 py-3 border-b border-indigo-50/80">
                  <div className="space-y-1">
                    <div className="font-semibold text-indigo-950">{v.name}</div>
                    <div className="text-xs font-semibold text-slate-550">Rate: ₹{v.rate || "-"}</div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3 border-b border-indigo-50/80">
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-550">Terms:</span>
                      <span className="font-medium text-slate-700">{paymentTermsList.find((t) => t.value === v.terms)?.label || v.terms || "-"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-550">Delivery:</span>
                      <span className={cn("font-medium text-slate-700", !v.delivery && "text-slate-400")}>
                        {v.delivery ? formatDate(parseSheetDate(v.delivery)) : "-"}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3 border-b border-indigo-50/80">
                  <div className="space-y-1">
                    {v.warrantyType ? (
                      <div className="flex items-center gap-1.5 text-xs text-indigo-950 bg-indigo-50/60 px-2 py-0.5 rounded-full w-fit border border-indigo-100 font-semibold">
                        {v.warrantyType === "warranty" ? (
                          <Shield className="w-3.5 h-3.5 text-indigo-650" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span className="capitalize font-semibold text-indigo-950">{v.warrantyType}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                    {v.attachment && (
                      <a
                        href={typeof v.attachment === 'string' ? v.attachment : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-850 hover:underline text-[11px] font-semibold"
                      >
                        <FileText className="w-3 h-3 text-indigo-600" />
                        <span>Quot.</span>
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3 border-b border-indigo-50/80">
                  <div className="space-y-1 text-[11px]">
                    <div className="flex flex-col">
                      <span className="text-slate-400 font-medium">Approved:</span>
                      <span className="font-semibold text-indigo-950 truncate max-w-[100px]">{v.approvedBy}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3 border-b border-indigo-50/80 bg-slate-50/50">
                  <div className="space-y-1">
                    <div className="font-mono text-sm font-extrabold text-indigo-900">{record.data.poNumber || "-"}</div>
                    <div className="text-[11px] font-semibold text-slate-550">HSN: {record.data.hsn || "-"}</div>
                    {record.data.poCopy && (
                      <a
                        href={typeof record.data.poCopy === 'string' ? record.data.poCopy : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-850 hover:underline text-[11px] font-semibold"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        <span>View PO Copy</span>
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3 border-b border-indigo-50/80 bg-slate-50/50">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-xs text-slate-550">Basic:</span>
                      <span className="font-semibold text-slate-700">₹{record.data.basicValue || "-"}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-slate-100 pt-1">
                      <span className="text-xs font-bold text-emerald-700">GST: {formatGSTDisplay(record.data.gst)}</span>
                      <span className="font-extrabold text-emerald-800">Total: ₹{record.data.totalWithTax || "-"}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3 border-b border-indigo-50/80 bg-slate-50/50 border-l border-indigo-50/80">
                  <div className="font-extrabold text-indigo-950 text-sm">
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
