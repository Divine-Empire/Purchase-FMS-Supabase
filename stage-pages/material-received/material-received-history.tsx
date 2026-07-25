"use client";

import React from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText } from "lucide-react";
import { parseSheetDate, cn } from "@/lib/utils";

const formatDateDash = (date: any) => {
  if (!date || date === "-" || date === "—") return "-";
  const d = date instanceof Date ? date : parseSheetDate(date);
  if (!d || isNaN(d.getTime())) return typeof date === "string" ? date : "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
};

interface MaterialReceivedHistoryProps {
  completed: any[];
  selectedHistoryColumns: string[];
  HISTORY_COLUMNS: readonly { readonly key: string; readonly label: string }[];
}

export default function MaterialReceivedHistory({
  completed,
  selectedHistoryColumns,
  HISTORY_COLUMNS,
}: MaterialReceivedHistoryProps) {
  return (
    <div className="border rounded-lg overflow-x-auto h-[70vh] relative">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
        <TableHeader className="sticky top-0 z-30 bg-slate-900 shadow-sm border-none [&_th]:h-12 border-b-0">
          <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
            {HISTORY_COLUMNS.filter((c) =>
              selectedHistoryColumns.includes(c.key)
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
          {completed.map((record) => {
            const historyData = record.data;

            return (
              <TableRow key={record.id} className="even:bg-slate-50/30 hover:bg-indigo-50/15 transition-colors border-b border-slate-100">
                {HISTORY_COLUMNS.filter((c) =>
                  selectedHistoryColumns.includes(c.key)
                ).map((col) => {
                  const val =
                    historyData[col.key] !== undefined && historyData[col.key] !== ""
                      ? historyData[col.key]
                      : record.data[col.key];

                  if (
                    col.key === "dispatchDate" ||
                    col.key === "paymentDate" ||
                    col.key === "nextFollowUpDate" ||
                    col.key === "invoiceDate" ||
                    col.key === "actual6" ||
                    col.key === "planned6"
                  ) {
                    return (
                      <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                        {formatDateDash(val)}
                      </TableCell>
                    );
                  }

                  if (col.key === "biltyCopy") {
                    const biltyRaw = historyData.biltyCopy;
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
                    const poRaw = historyData.poCopy;
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
                    col.key === "receivedItemImage" ||
                    col.key === "billAttachment" ||
                    col.key === "damageImage"
                  ) {
                    const file = historyData[col.key];
                    let fileUrl = typeof file === "string" ? file : undefined;
                    if (fileUrl && fileUrl.includes("drive.google.com/uc")) {
                      const m = fileUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                      if (m?.[1]) fileUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                    }
                    return (
                      <TableCell key={col.key} className="border-b px-4 py-2 text-center">
                        {fileUrl ? (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="truncate max-w-20">
                              View {col.label}
                            </span>
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    );
                  }

                  if (
                    col.key === "freightAmount" ||
                    col.key === "advanceAmount" ||
                    col.key === "paymentAmountHydra" ||
                    col.key === "paymentAmountLabour" ||
                    col.key === "paymentAmountHamali" ||
                    col.key === "extraFreight"
                  ) {
                    return (
                      <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                        {val ? `₹${val}` : "-"}
                      </TableCell>
                    );
                  }

                  return (
                    <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                      {val ? String(val) : "-"}
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
