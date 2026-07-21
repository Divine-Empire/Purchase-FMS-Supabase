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
import { parseSheetDate } from "@/lib/utils";

const formatDateDash = (date: any) => {
  if (!date || date === "-" || date === "—") return "-";
  const d = date instanceof Date ? date : parseSheetDate(date);
  if (!d || isNaN(d.getTime())) return typeof date === "string" ? date : "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
};

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
        <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
          <TableRow className="hover:bg-transparent border-none">
            <TableHead className="sticky left-0 z-40 bg-slate-200 w-[50px] border-b text-center">
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
              />
            </TableHead>
            <TableHead className="sticky left-[50px] z-40 bg-slate-200 w-[150px] border-b text-center whitespace-nowrap px-4">
              Actions
            </TableHead>
            {PENDING_COLUMNS.filter((c) =>
              selectedPendingColumns.includes(c.key)
            ).map((c) => (
              <TableHead
                key={c.key}
                className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap"
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pending.map((rec) => (
            <TableRow key={rec.id} className="hover:bg-gray-50 group">
              <TableCell className="sticky left-0 z-20 bg-white group-hover:bg-gray-50 border-b text-center">
                <Checkbox
                  checked={selectedRecordIds.includes(rec.id)}
                  onCheckedChange={(checked) => {
                    setSelectedRecordIds((prev) =>
                      checked
                        ? [...prev, rec.id]
                        : prev.filter((id) => id !== rec.id)
                    );
                  }}
                />
              </TableCell>
              <TableCell className="sticky left-[50px] z-20 bg-white group-hover:bg-gray-50 border-b text-center px-4 py-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openModal(rec.id)}
                  className="h-8 px-3 text-xs font-medium border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors"
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
          ))}
        </TableBody>
      </table>
    </div>
  );
}
