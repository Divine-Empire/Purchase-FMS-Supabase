"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseSheetDate, cn, formatDateTimeDash } from "@/lib/utils";

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

interface FollowUpVendorHistoryProps {
  filteredHistoryData: any[];
  sheetRecords: any[];
  isAdmin?: boolean;
  onEdit?: (row: any) => void;
}

export default function FollowUpVendorHistory({
  filteredHistoryData,
  sheetRecords,
  isAdmin,
  onEdit,
}: FollowUpVendorHistoryProps) {
  return (
    <div className="border rounded-lg overflow-auto flex-1 flex flex-col min-h-[350px] md:min-h-0 bg-white">
      <Table>
        <TableHeader className="bg-slate-900 sticky top-0 z-10 shadow-sm [&_th]:text-white [&_th]:font-semibold [&_th]:h-12 border-b-0">
          <TableRow className="border-b-0 hover:bg-slate-900">
            {isAdmin && <TableHead>Edit</TableHead>}
            <TableHead>Indent No.</TableHead>
            <TableHead>Planned</TableHead>
            <TableHead>Actual</TableHead>
            <TableHead>Delay</TableHead>
            <TableHead>Lift No.</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>PO No.</TableHead>
            <TableHead>Follow-Up Date</TableHead>
            <TableHead>Remarks</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Qty Lifted</TableHead>
            <TableHead>Transporter</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>LR No</TableHead>
            <TableHead>Dispatch Date</TableHead>
            <TableHead>Freight</TableHead>
            <TableHead>Advance</TableHead>
            <TableHead>Payment Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Bilty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredHistoryData.map((row) => {
            const formatDisplayDate = (d: any) => {
              if (!d || d === "" || d === "-") return "-";
              const date = new Date(d);
              if (isNaN(date.getTime())) return d;
              return date.toLocaleDateString("en-IN");
            };

            const indentRecord = sheetRecords.find((r) =>
              String(r.data.indentNumber).trim().toLowerCase() ===
              String(row.indentNumber).trim().toLowerCase()
            );

            const delayVal = calculateDelay(indentRecord?.data?.planned5 || indentRecord?.data?.plannedDate, indentRecord?.data?.actual5 || indentRecord?.data?.actualDate);

            return (
              <TableRow key={row.id} className="even:bg-slate-50/30 hover:bg-indigo-50/15 transition-colors border-b border-slate-100">
                {isAdmin && (
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit?.(row)}
                      className="h-7 px-2.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                  </TableCell>
                )}
                <TableCell className="font-medium">{row.indentNumber || "-"}</TableCell>
                <TableCell>{indentRecord ? formatDateDash(indentRecord.data.planned5) : "-"}</TableCell>
                <TableCell>{indentRecord ? formatDateDash(indentRecord.data.actual5) : "-"}</TableCell>
                <TableCell className={cn(
                  delayVal !== "0" && delayVal !== "-" && "text-amber-700 font-bold",
                  delayVal === "0" && "text-emerald-700 font-semibold"
                )}>
                  {delayVal}
                </TableCell>
                <TableCell>{row.liftNo || "-"}</TableCell>
                <TableCell>{row.vendorName || "-"}</TableCell>
                <TableCell className="font-mono">{row.poNumber || "-"}</TableCell>
                <TableCell>{formatDisplayDate(row.nextFollowUpDate)}</TableCell>
                <TableCell>{row.remarks || "-"}</TableCell>
                <TableCell>{row.itemName || "-"}</TableCell>
                <TableCell>{row.liftingQty || "-"}</TableCell>
                <TableCell>{row.transporterName || "-"}</TableCell>
                <TableCell>{row.vehicleNo || "-"}</TableCell>
                <TableCell>{row.contactNo || "-"}</TableCell>
                <TableCell>{row.lrNo || "-"}</TableCell>
                <TableCell>{formatDisplayDate(row.dispatchDate)}</TableCell>
                <TableCell>{row.freightAmount ? `₹${row.freightAmount}` : "-"}</TableCell>
                <TableCell>{row.advanceAmount ? `₹${row.advanceAmount}` : "-"}</TableCell>
                <TableCell>{formatDisplayDate(row.paymentDate)}</TableCell>
                <TableCell>{row.paymentStatus || "-"}</TableCell>
                <TableCell>
                  {row.biltyCopy ? (
                    <a
                      href={row.biltyCopy}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-green-600 hover:underline text-xs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Bilty</span>
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
