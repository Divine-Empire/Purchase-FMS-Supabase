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
import { Input } from "@/components/ui/input";
import { cn, parseSheetDate, formatDateTimeDash } from "@/lib/utils";

const formatDateDash = (date: any) => formatDateTimeDash(date);

interface Update3VendorsPendingProps {
  pending: any[];
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  toggleSelectAll: () => void;
  selectedColumns: string[];
  baseColumns: any[];
  editedQuantities: Record<string, string>;
  setEditedQuantities: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export default function Update3VendorsPending({
  pending,
  selectedIds,
  toggleSelection,
  toggleSelectAll,
  selectedColumns,
  baseColumns,
  editedQuantities,
  setEditedQuantities,
}: Update3VendorsPendingProps) {
  return (
    <div className="border border-indigo-100 rounded-xl overflow-auto flex-1 shadow-xs relative h-full bg-white">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
        <TableHeader className="sticky top-0 z-30 bg-slate-900 shadow-xs text-white">
          <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
            <TableHead className="w-[50px] sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 whitespace-nowrap text-white">
              <Checkbox
                checked={pending.length > 0 && pending.every(r => selectedIds.has(r.id))}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            {baseColumns
              .filter((c) => ["indentNumber", "createdBy", "category", "itemName", "quantity", "approvedQty", "warehouseLocation", "itemCode", "leadTime", "planned2"].includes(c.accessorKey) || (c.accessorKey !== "actual2" && selectedColumns.includes(c.accessorKey)))
              .map((col) => (
                <TableHead key={col.accessorKey} className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 text-white font-bold whitespace-nowrap text-[11px] tracking-wider uppercase">
                  <div className="flex items-center gap-2 text-white">
                    {col.header}
                  </div>
                </TableHead>
              ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pending.map((record) => {
            const isSelected = selectedIds.has(record.id);
            return (
              <TableRow
                key={record.id}
                className={cn(
                  "cursor-pointer transition-colors duration-150 border-b border-indigo-50/80 last:border-0",
                  isSelected
                    ? "bg-indigo-50/40 text-indigo-950 font-medium"
                    : "odd:bg-white even:bg-indigo-50/10 hover:bg-indigo-50/20 text-slate-700"
                )}
                onClick={() => toggleSelection(record.id)}
              >
                <TableCell className="w-[50px] px-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelection(record.id)}
                  />
                </TableCell>
                {baseColumns
                  .filter((c) => ["indentNumber", "createdBy", "category", "itemName", "quantity", "approvedQty", "warehouseLocation", "itemCode", "leadTime", "planned2"].includes(c.accessorKey) || (c.accessorKey !== "actual2" && selectedColumns.includes(c.accessorKey)))
                  .map((col) => {
                    const isEditingApprovedQty = col.accessorKey === "approvedQty" && isSelected;
                    return (
                      <TableCell
                        key={col.accessorKey}
                        className={cn(
                          "text-sm font-medium border-b border-indigo-50/80 px-4 py-3",
                          col.accessorKey === "indentNumber" && "font-bold text-indigo-950",
                          col.accessorKey !== "indentNumber" && "text-slate-650"
                        )}
                        onClick={(e) => {
                          if (isEditingApprovedQty) {
                            e.stopPropagation();
                          }
                        }}
                      >
                        {isEditingApprovedQty ? (
                          <Input
                            type="number"
                            className="w-24 h-8 text-sm px-2 bg-white border-indigo-200 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                            value={editedQuantities[record.id] !== undefined ? editedQuantities[record.id] : (record.data.approvedQty || "")}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditedQuantities((prev) => ({
                                ...prev,
                                [record.id]: val,
                              }));
                            }}
                          />
                        ) : col.accessorKey === "leadTime"
                          ? `${record.data[col.accessorKey] || 0} days`
                          : (col.accessorKey === "planned2" || col.accessorKey === "actual2")
                            ? formatDateDash(record.data[col.accessorKey])
                            : (col.cell ? col.cell({ getValue: () => record.data[col.accessorKey] }) : String(record.data[col.accessorKey] ?? "-"))}
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
