"use client";

import React from "react";
import {
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

interface MaterialReceivedHistoryProps {
  completed: any[];
  selectedHistoryColumns: string[];
  HISTORY_COLUMNS: readonly { readonly key: string; readonly label: string }[];
  isAdmin?: boolean;
  onEdit?: (record: any) => void;
}

export default function MaterialReceivedHistory({
  completed,
  selectedHistoryColumns,
  HISTORY_COLUMNS,
  isAdmin,
  onEdit,
}: MaterialReceivedHistoryProps) {
  return (
    <div className="border rounded-lg overflow-x-auto h-[70vh] relative">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
        <TableHeader className="sticky top-0 z-30 bg-slate-900 shadow-sm border-none [&_th]:h-12 border-b-0">
          <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
            {isAdmin && (
              <TableHead className="bg-slate-900 border-b text-center px-4 py-3 font-semibold text-white whitespace-nowrap uppercase">
                Edit
              </TableHead>
            )}
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
                {isAdmin && (
                  <TableCell className="border-b px-4 py-2 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit?.(record)}
                      className="h-7 px-2.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                  </TableCell>
                )}
                {HISTORY_COLUMNS.filter((c) =>
                  selectedHistoryColumns.includes(c.key)
                ).map((col) => {
                  const val =
                    historyData[col.key] !== undefined && historyData[col.key] !== ""
                      ? historyData[col.key]
                      : record.data[col.key];

                  if (col.key === "delay6" || col.key === "delay") {
                    const delayVal = calculateDelay(historyData.planned6 || record.data.planned6 || record.data.plannedDate, historyData.actual6 || record.data.actual6 || record.data.actualDate);
                    return (
                      <TableCell key={col.key} className={cn(
                        "border-b px-4 py-2 text-center font-medium",
                        delayVal !== "0" && delayVal !== "-" && "text-amber-700 font-bold",
                        delayVal === "0" && "text-emerald-700 font-semibold"
                      )}>
                        {delayVal}
                      </TableCell>
                    );
                  }

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
