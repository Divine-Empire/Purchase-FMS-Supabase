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
        <TableHeader className="bg-slate-200 sticky top-0 z-10">
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={
                  selectedRecordIds.length === pending.length &&
                  pending.length > 0
                }
                onCheckedChange={selectAll}
              />
            </TableHead>
            <TableHead className="text-center">Actions</TableHead>
            {baseColumns
              .filter((c) => selectedColumns.includes(c.key))
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
            return (
              <TableRow key={record.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedRecordIds.includes(record.id)}
                    onCheckedChange={() => toggleSelect(record.id)}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
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
                  .filter((c) => selectedColumns.includes(c.key))
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
