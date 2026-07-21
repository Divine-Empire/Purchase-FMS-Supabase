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
import { cn, parseSheetDate } from "@/lib/utils";

const formatDateDash = (date: any) => {
  if (!date || date === "-" || date === "—") return "-";
  const d = date instanceof Date ? date : parseSheetDate(date);
  if (!d || isNaN(d.getTime())) return typeof date === 'string' ? date : "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
};

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
    <div className="border rounded-lg overflow-auto flex-1 shadow-sm relative h-full">
      <table className="w-full caption-bottom text-sm border-collapse">
        <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
          <TableRow className="bg-slate-200 hover:bg-slate-200 border-none">
            <TableHead className="w-[50px] sticky top-0 z-20 bg-slate-200 border-none">
              <Checkbox
                checked={pending.length > 0 && pending.every(r => selectedIds.has(r.id))}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            {baseColumns
              .filter((c) => ["indentNumber", "createdBy", "category", "itemName", "quantity", "approvedQty", "warehouseLocation", "itemCode", "leadTime", "planned2"].includes(c.accessorKey) || (c.accessorKey !== "actual2" && selectedColumns.includes(c.accessorKey)))
              .map((col) => (
                <TableHead key={col.accessorKey} className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3">
                  <div className="flex items-center gap-2 font-bold text-slate-600 truncate uppercase text-[11px] tracking-wider">
                    {col.header}
                  </div>
                </TableHead>
              ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pending.map((record) => (
            <TableRow key={record.id} className="hover:bg-muted/50 odd:bg-white even:bg-slate-50/80 group">
              <TableCell className="w-[50px]">
                <Checkbox
                  checked={selectedIds.has(record.id)}
                  onCheckedChange={() => toggleSelection(record.id)}
                />
              </TableCell>
              {baseColumns
                .filter((c) => ["indentNumber", "createdBy", "category", "itemName", "quantity", "approvedQty", "warehouseLocation", "itemCode", "leadTime", "planned2"].includes(c.accessorKey) || (c.accessorKey !== "actual2" && selectedColumns.includes(c.accessorKey)))
                .map((col) => {
                  const isEditingApprovedQty = col.accessorKey === "approvedQty" && selectedIds.has(record.id);
                  return (
                    <TableCell key={col.accessorKey} className="text-sm text-slate-700 px-4">
                      {isEditingApprovedQty ? (
                        <Input
                          type="number"
                          className="w-24 h-8 text-sm px-2 bg-white"
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
          ))}
        </TableBody>
      </table>
    </div>
  );
}
