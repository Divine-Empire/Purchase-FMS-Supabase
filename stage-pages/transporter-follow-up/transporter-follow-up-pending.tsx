"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseSheetDate, cn } from "@/lib/utils";

const formatDateDash = (date: any) => {
  if (!date || date === "-" || date === "—") return "-";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return typeof date === 'string' ? date : "-";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
  } catch (e) {
    return typeof date === 'string' ? date : "-";
  }
};

interface TransporterFollowUpPendingProps {
  pending: any[];
  selectedRows: Set<string>;
  toggleAll: () => void;
  toggleRow: (id: string) => void;
  handleOpenForm: (record: any) => void;
  pendingColumns: { key: string; label: string }[];
  safeValue: (val: any) => string;
}

export default function TransporterFollowUpPending({
  pending,
  selectedRows,
  toggleAll,
  toggleRow,
  handleOpenForm,
  pendingColumns,
  safeValue,
}: TransporterFollowUpPendingProps) {
  return (
    <div className="border rounded-lg flex-1 overflow-auto shadow-sm relative h-full">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
        <TableHeader className="sticky top-0 z-30 bg-slate-900 shadow-sm border-none [&_th]:h-12">
          <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
            <TableHead className="w-[50px] sticky top-0 left-0 z-40 bg-slate-900 border-none pl-4 py-3 text-white">
              <Checkbox
                checked={selectedRows.size === pending.length && pending.length > 0}
                onCheckedChange={toggleAll}
                className="border-slate-300 data-[state=checked]:bg-white data-[state=checked]:text-slate-900"
              />
            </TableHead>
            <TableHead className="w-[120px] sticky top-0 left-[50px] z-40 bg-slate-900 border-none px-4 py-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-center font-semibold text-white uppercase">
              Actions
            </TableHead>
            {pendingColumns.map(c => (
              <TableHead key={c.key} className="sticky top-0 z-20 bg-slate-900 border-none px-4 py-3 text-center font-semibold text-white uppercase whitespace-nowrap">
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pending.map(rec => {
            const isSelected = selectedRows.has(rec.id);
            return (
              <TableRow 
                key={rec.id}
                className={cn(
                  "hover:bg-indigo-50/15 transition-colors border-b border-slate-100",
                  isSelected ? "bg-indigo-50/30" : "even:bg-slate-50/30"
                )}
              >
                <TableCell className={cn("sticky left-0 z-10 border-b border-r px-4 py-2 transition-colors", isSelected ? "bg-indigo-50/40" : "bg-white")}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleRow(rec.id)}
                  />
                </TableCell>
                <TableCell className={cn("sticky left-[50px] z-10 border-b border-r px-4 py-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-center transition-colors", isSelected ? "bg-indigo-50/40" : "bg-white")}>
                  <Button 
                    size="sm" 
                    onClick={() => handleOpenForm(rec)} 
                    className="h-8 text-xs font-bold px-3 border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50/50 hover:text-indigo-800 transition-colors shadow-xs border"
                  >
                    Follow-Up
                  </Button>
                </TableCell>
              {pendingColumns.map((c) => {
                const val = rec.data[c.key];

                if (c.key === "lrCopy") {
                  return (
                    <TableCell key={c.key} className="text-center border-b px-4 py-2">
                      {val && val.trim() !== "" ? (
                        <a
                          href={val}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline"
                        >
                          View
                        </a>
                      ) : "-"}
                    </TableCell>
                  );
                }

                if (["plannedDate", "expectedDeliveryDate", "lastFollowUpDate", "nextFollowUpDate"].includes(c.key)) {
                  return (
                    <TableCell key={c.key} className="text-center border-b px-4 py-2 text-slate-700">
                      {formatDateDash(val)}
                    </TableCell>
                  );
                }

                return (
                  <TableCell key={c.key} className="text-center border-b px-4 py-2 text-slate-700">
                    {safeValue(val)}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
        </TableBody>
      </table>
    </div>
  );
}
