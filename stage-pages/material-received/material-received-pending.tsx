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
import { FileText } from "lucide-react";
import { parseSheetDate, cn, formatDateTimeDash } from "@/lib/utils";

const formatDateDash = (date: any) => formatDateTimeDash(date);

interface MaterialReceivedPendingProps {
  pending: any[];
  selectedRecordIds: string[];
  setSelectedRecordIds: React.Dispatch<React.SetStateAction<string[]>>;
  openModal: (id: string) => void;
  selectedPendingColumns: string[];
  PENDING_COLUMNS: readonly { readonly key: string; readonly label: string }[];
}

export default function MaterialReceivedPending({
  pending,
  selectedRecordIds,
  setSelectedRecordIds,
  openModal,
  selectedPendingColumns,
  PENDING_COLUMNS,
}: MaterialReceivedPendingProps) {
  return (
    <div className="border rounded-lg overflow-x-auto h-[70vh] relative">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
        <TableHeader className="sticky top-0 z-30 bg-slate-900 shadow-sm border-none [&_th]:h-12 border-b-0">
          <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
            <TableHead className="sticky left-0 z-40 bg-slate-900 w-[50px] border-b text-center text-white">
              <Checkbox
                checked={
                  pending.length > 0 &&
                  selectedRecordIds.length === pending.length
                }
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedRecordIds(pending.map((r) => r.id));
                  } else {
                    setSelectedRecordIds([]);
                  }
                }}
                className="border-slate-300 data-[state=checked]:bg-white data-[state=checked]:text-slate-900"
              />
            </TableHead>
            <TableHead className="sticky left-[50px] z-40 bg-slate-900 w-[150px] border-b text-center whitespace-nowrap px-4 text-white font-semibold uppercase">
              Actions
            </TableHead>
            {PENDING_COLUMNS.filter((c) =>
              selectedPendingColumns.includes(c.key)
            ).map((c) => (
              <TableHead
                key={c.key}
                className="bg-slate-900 border-b text-center px-4 py-3 font-semibold text-white whitespace-nowrap uppercase"
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pending.map((rec) => {
            const isSelected = selectedRecordIds.includes(rec.id);
            return (
              <TableRow 
                key={rec.id} 
                className={cn(
                  "hover:bg-indigo-50/15 transition-colors border-b border-slate-100",
                  isSelected ? "bg-indigo-50/30" : "even:bg-slate-50/30"
                )}
              >
                <TableCell className={cn("sticky left-0 z-20 border-b text-center transition-colors", isSelected ? "bg-indigo-50/40" : "bg-white")}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      setSelectedRecordIds((prev) =>
                        checked
                          ? [...prev, rec.id]
                          : prev.filter((id) => id !== rec.id)
                      );
                    }}
                  />
                </TableCell>
                <TableCell className={cn("sticky left-[50px] z-20 border-b text-center px-4 py-2 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]", isSelected ? "bg-indigo-50/40" : "bg-white")}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openModal(rec.id)}
                    className="h-8 px-3 text-xs font-bold border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50/50 hover:text-indigo-800 transition-colors shadow-xs"
                  >
                    Record Receipt
                  </Button>
                </TableCell>

              {PENDING_COLUMNS.filter((c) =>
                selectedPendingColumns.includes(c.key)
              ).map((col) => {
                const val = rec.data[col.key];

                if (col.key === "biltyCopy") {
                  const biltyRaw = rec.data.biltyCopy;
                  let biltyUrl = biltyRaw;
                  if (biltyUrl && biltyUrl.includes("drive.google.com/uc")) {
                    const m = biltyUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                    if (m?.[1]) biltyUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                  }
                  return (
                    <TableCell key={col.key} className="border-b px-4 py-2 text-center">
                      {biltyUrl ? (
                        <a
                          href={biltyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 text-xs text-green-600 hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Bilty</span>
                        </a>
                      ) : "-"}
                    </TableCell>
                  );
                }

                if (col.key === "poCopy") {
                  const poRaw = rec.data.poCopy;
                  let poUrl = poRaw;
                  if (poUrl && poUrl.includes("drive.google.com/uc")) {
                    const m = poUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                    if (m?.[1]) poUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                  }
                  return (
                    <TableCell key={col.key} className="border-b px-4 py-2 text-center">
                      {poUrl ? (
                        <a
                          href={poUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View PO</span>
                        </a>
                      ) : "-"}
                    </TableCell>
                  );
                }

                if (
                  col.key === "nextFollowUpDate" ||
                  col.key === "dispatchDate" ||
                  col.key === "paymentDate" ||
                  col.key === "planned6"
                ) {
                  return (
                    <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                      {val ? formatDateDash(val) : "-"}
                    </TableCell>
                  );
                }

                if (col.key === "freightAmount" || col.key === "advanceAmount") {
                  return (
                    <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                      {val ? `₹${val}` : "-"}
                    </TableCell>
                  );
                }

                return (
                  <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                    {val || "-"}
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
