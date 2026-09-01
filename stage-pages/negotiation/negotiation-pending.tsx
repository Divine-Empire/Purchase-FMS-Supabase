"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, ShieldCheck, FileText } from "lucide-react";
import { parseSheetDate, cn, formatDateTimeDash } from "@/lib/utils";

const formatDateDash = (dateStr: string) => formatDateTimeDash(dateStr);

interface NegotiationPendingProps {
  pending: any[];
  selectedIndents: string[];
  toggleIndentSelection: (indentId: string) => void;
  toggleSelectAll: () => void;
  selectedColumns: string[];
  baseColumns: any[];
  handleOpenForm: (recordId: string) => void;
  getVendors: (record: any) => any[];
  paymentTerms: { value: string; label: string }[];
}

export default function NegotiationPending({
  pending,
  selectedIndents,
  toggleIndentSelection,
  toggleSelectAll,
  selectedColumns,
  baseColumns,
  handleOpenForm,
  getVendors,
  paymentTerms,
}: NegotiationPendingProps) {
  return (
    <div className="border border-indigo-100 rounded-xl overflow-auto flex-1 shadow-xs relative h-full bg-white">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
        <TableHeader className="sticky top-0 z-30 bg-slate-900 shadow-xs border-none text-white">
          <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
            <TableHead className="w-[50px] sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 whitespace-nowrap text-white">
              <Checkbox
                checked={pending.length > 0 && selectedIndents.length === pending.length}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-[11px] tracking-wider uppercase">
              Actions
            </TableHead>
            {baseColumns
              .filter((c) => ["indentNumber", "itemName", "quantity", "planned3"].includes(c.key) || (c.key !== "actual3" && selectedColumns.includes(c.key)))
              .map((col) => (
                <TableHead key={col.key} className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-[11px] tracking-wider uppercase">
                  <div className="flex items-center gap-2 text-white">
                    {col.label}
                  </div>
                </TableHead>
              ))}
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-[11px] tracking-wider uppercase">Vendor</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-[11px] tracking-wider uppercase">Rate</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-[11px] tracking-wider uppercase">Terms</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-[11px] tracking-wider uppercase">Exp. Delivery</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-[11px] tracking-wider uppercase">Warranty</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-[11px] tracking-wider uppercase">Attachment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pending.map((record, recordIdx) => {
            const vendors = getVendors(record);
            const isSelected = selectedIndents.includes(record.id);
            const displayVendors = vendors.length > 0 ? vendors : [null];
            const vCount = displayVendors.length;

            return displayVendors.map((v, idx) => {
              return (
                <TableRow
                  key={`${record.id}-v${idx + 1}`}
                  className={cn(
                    "cursor-pointer transition-colors duration-150 border-b border-indigo-50/80 last:border-0",
                    isSelected
                      ? "bg-indigo-50/40 text-indigo-950 font-medium"
                      : `${recordIdx % 2 === 0 ? "bg-white" : "bg-indigo-50/10"} hover:bg-indigo-50/20 text-slate-700`
                  )}
                >
                  {idx === 0 && (
                    <TableCell rowSpan={vCount} className="px-4 border-b border-indigo-50/80" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleIndentSelection(record.id)}
                      />
                    </TableCell>
                  )}
                  {idx === 0 && (
                    <TableCell rowSpan={vCount} className="px-4 border-b border-indigo-50/80" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenForm(record.id)}
                        className="h-8 text-xs font-bold px-3 border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50/50 hover:text-indigo-800 transition-colors shadow-xs"
                      >
                        Negotiate
                      </Button>
                    </TableCell>
                  )}
                  {idx === 0 && (
                    <>
                      {baseColumns
                        .filter((c) => ["indentNumber", "itemName", "quantity", "planned3"].includes(c.key) || (c.key !== "actual3" && selectedColumns.includes(c.key)))
                        .map((col) => (
                          <TableCell key={col.key} rowSpan={vCount} className={cn(
                            "text-sm font-medium border-b border-indigo-50/80 px-4 py-3",
                            col.key === "indentNumber" && "font-bold text-indigo-950",
                            col.key !== "indentNumber" && "text-slate-600"
                          )}>
                            {col.key === "planned3" || col.key === "actual3"
                              ? formatDateDash(record.data[col.key])
                              : String(record.data[col.key] ?? "-")}
                          </TableCell>
                        ))}
                    </>
                  )}
                  <TableCell className="text-sm font-semibold text-indigo-950 border-b border-indigo-50/80 px-4 py-3 whitespace-nowrap">{v?.name || "-"}</TableCell>
                  <TableCell className="text-sm font-semibold text-slate-700 border-b border-indigo-50/80 px-4 py-3">
                    {v?.rate ? `₹${v.rate}` : "-"}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-slate-650 border-b border-indigo-50/80 px-4 py-3">
                    {v ? (paymentTerms.find((t) => t.value === v.terms)?.label || v.terms || "-") : "-"}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-slate-650 border-b border-indigo-50/80 px-4 py-3 whitespace-nowrap">
                    {v?.delivery ? formatDateDash(v.delivery) : "-"}
                  </TableCell>
                  <TableCell className="px-4 border-b border-indigo-50/80">
                    {v?.warrantyType ? (
                      <div className="flex items-center gap-1.5 text-xs text-indigo-950 bg-indigo-50/60 px-2.5 py-1 rounded-full w-fit border border-indigo-100 font-semibold">
                        {v.warrantyType === "warranty" ? (
                          <Shield className="w-3.5 h-3.5 text-indigo-650" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span className="capitalize font-semibold text-indigo-950">{v.warrantyType}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 border-b border-indigo-50/80">
                    {v?.attachment ? (
                      <a
                        href={typeof v.attachment === 'string' ? v.attachment : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-850 hover:underline text-xs font-semibold"
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        <span>View File</span>
                      </a>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            });
          })}
        </TableBody>
      </table>
    </div>
  );
}
