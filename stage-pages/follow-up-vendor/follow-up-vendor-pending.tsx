"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Shield, ShieldCheck } from "lucide-react";
import { parseSheetDate, cn, formatDateTimeDash } from "@/lib/utils";

const formatDateDash = (date: any) => formatDateTimeDash(date);

interface FollowUpVendorPendingProps {
  pending: any[];
  selectedRecordIds: string[];
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  selectedColumns: string[];
  baseColumns: any[];
  handleProcessOption: (recordId: string, mode: "follow-up" | "lift-material") => void;
  getVendorData: (record: any) => any;
}

export default function FollowUpVendorPending({
  pending,
  selectedRecordIds,
  toggleSelect,
  selectAll,
  selectedColumns,
  baseColumns,
  handleProcessOption,
  getVendorData,
}: FollowUpVendorPendingProps) {
  return (
    <div className="border rounded-lg overflow-auto flex-1 flex flex-col min-h-[350px] md:min-h-0 bg-white">
      <Table>
        <TableHeader className="bg-slate-900 sticky top-0 z-10 shadow-sm [&_th]:text-white [&_th]:font-semibold [&_th]:h-12 border-b-0">
          <TableRow className="border-b-0 hover:bg-slate-900">
            <TableHead className="w-12">
              <Checkbox
                checked={
                  selectedRecordIds.length === pending.length &&
                  pending.length > 0
                }
                onCheckedChange={selectAll}
                className="border-slate-300 data-[state=checked]:bg-white data-[state=checked]:text-slate-900"
              />
            </TableHead>
            <TableHead className="text-center">Actions</TableHead>
            {baseColumns
              .filter((c) => selectedColumns.includes(c.key) && c.key !== "actual5")
              .map((col) => (
                <TableHead key={col.key} className={cn((col.key === "totalLifted" || col.key === "pendingLifted") && "text-center")}>
                  {col.label}
                </TableHead>
              ))}
            <TableHead>Vendor</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Terms</TableHead>
            <TableHead>Delivery Date</TableHead>
            <TableHead>Warranty</TableHead>
            <TableHead>Warranty Attach</TableHead>
            <TableHead>Approved By</TableHead>
            <TableHead>PO Number</TableHead>
            <TableHead>Basic Value</TableHead>
            <TableHead>Total w/Tax</TableHead>
            <TableHead>PO Copy</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pending.map((record) => {
            const v = getVendorData(record);
            const isSelected = selectedRecordIds.includes(record.id);
            return (
              <TableRow 
                key={record.id}
                className={cn(
                  "hover:bg-indigo-50/20 transition-colors border-b border-slate-100",
                  isSelected ? "bg-indigo-50/40" : "even:bg-slate-50/30"
                )}
              >
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(record.id)}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8 text-xs font-bold px-3 border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50/50 hover:text-indigo-800 transition-colors shadow-xs"
                      >
                        Process
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white border shadow-md">
                      <DropdownMenuItem
                        onClick={() => handleProcessOption(record.id, "follow-up")}
                        className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-sm text-slate-800"
                      >
                        Follow-Up
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleProcessOption(record.id, "lift-material")}
                        className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-sm text-slate-800"
                      >
                        Material Lifting
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                {baseColumns
                  .filter((c) => selectedColumns.includes(c.key) && c.key !== "actual5")
                  .map((col) => (
                    <TableCell key={col.key} className={cn((col.key === "totalLifted" || col.key === "pendingLifted") && "text-center")}>
                      {col.key === "planned5" || col.key === "estimatedDate"
                        ? formatDateDash(record.data[col.key])
                        : record.data[col.key] || "-"}
                    </TableCell>
                  ))}
                <TableCell className="font-medium">{v.name}</TableCell>
                <TableCell>₹{v.rate || "-"}</TableCell>
                <TableCell>{v.terms || "-"}</TableCell>
                <TableCell>
                  {v.delivery
                    ? new Date(v.delivery).toLocaleDateString("en-IN")
                    : "-"}
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
                <TableCell className="font-mono">{v.poNumber}</TableCell>
                <TableCell>₹{v.basicValue}</TableCell>
                <TableCell>₹{v.totalWithTax}</TableCell>
                <TableCell>
                  {v.poCopy ? (
                    <a
                      href={typeof v.poCopy === 'string' ? v.poCopy : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-green-600 hover:underline text-xs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span className="truncate max-w-20">
                        {typeof v.poCopy === 'string' ? "View PO" : (v.poCopy as any).name}
                      </span>
                    </a>
                  ) : (
                    "-"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
