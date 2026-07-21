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
import { parseSheetDate, cn } from "@/lib/utils";

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
    <div className="flex-1 overflow-auto border rounded-xl bg-white shadow-sm scrollbar-thin scrollbar-thumb-slate-200">
      <table className="w-full caption-bottom text-sm border-collapse">
        <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
          <TableRow className="bg-slate-200 hover:bg-slate-200 border-none">
            <TableHead className="w-[50px] sticky top-0 z-30 bg-slate-200 border-none px-4">
              <Checkbox
                checked={pending.length > 0 && selectedIndents.length === pending.length}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3">
              <div className="flex items-center gap-2 font-bold text-slate-700 truncate uppercase text-[13px] tracking-wider">
                Actions
              </div>
            </TableHead>
            {baseColumns
              .filter((c) => ["indentNumber", "itemName", "quantity", "planned3"].includes(c.key) || (c.key !== "actual3" && selectedColumns.includes(c.key)))
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
                Terms
              </div>
            </TableHead>
            <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3">
              <div className="flex items-center gap-2 font-bold text-slate-700 truncate uppercase text-[13px] tracking-wider">
                Exp. Delivery
              </div>
            </TableHead>
            <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3">
              <div className="flex items-center gap-2 font-bold text-slate-700 truncate uppercase text-[13px] tracking-wider">
                Warranty
              </div>
            </TableHead>
            <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3">
              <div className="flex items-center gap-2 font-bold text-slate-700 truncate uppercase text-[13px] tracking-wider">
                Attachment
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pending.map((record) => {
            const vendors = getVendors(record);
            const isSelected = selectedIndents.includes(record.id);
            const displayVendors = vendors.length > 0 ? vendors : [null];
            const vCount = displayVendors.length;

            return displayVendors.map((v, idx) => {
              return (
                <TableRow key={`${record.id}-v${idx + 1}`} className={`hover:bg-muted/50 odd:bg-white even:bg-slate-50/80 group ${isSelected ? "bg-blue-50" : ""}`}>
                  {idx === 0 && (
                    <TableCell rowSpan={vCount} className="px-4">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleIndentSelection(record.id)}
                        />
                      </div>
                    </TableCell>
                  )}
                  {idx === 0 && (
                    <TableCell rowSpan={vCount} className="px-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenForm(record.id)}
                        className="h-8 text-xs font-semibold px-3 border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors"
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
                          <TableCell key={col.key} rowSpan={vCount} className="text-sm text-slate-700 px-4">
                            {col.key === "planned3" || col.key === "actual3"
                              ? formatDateDash(record.data[col.key])
                              : String(record.data[col.key] ?? "-")}
                          </TableCell>
                        ))}
                    </>
                  )}
                  <TableCell className="text-sm text-slate-700 px-4 font-medium">{v?.name || "-"}</TableCell>
                  <TableCell className="text-sm text-slate-700 px-4">{v?.rate ? `₹${v.rate}` : "-"}</TableCell>
                  <TableCell className="text-sm text-slate-700 px-4">
                    {v ? (paymentTerms.find((t) => t.value === v.terms)?.label || v.terms || "-") : "-"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-700 px-4">
                    {v?.delivery ? formatDateDash(v.delivery) : "-"}
                  </TableCell>
                  <TableCell className="px-4">
                    {v?.warrantyType ? (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100/50 px-2 py-1 rounded-full w-fit">
                        {v.warrantyType === "warranty" ? (
                          <Shield className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                        )}
                        <span className="capitalize font-medium">{v.warrantyType}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    {v?.attachment ? (
                      <a
                        href={typeof v.attachment === 'string' ? v.attachment : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 hover:underline text-xs font-medium"
                      >
                        <FileText className="w-3.5 h-3.5" />
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
