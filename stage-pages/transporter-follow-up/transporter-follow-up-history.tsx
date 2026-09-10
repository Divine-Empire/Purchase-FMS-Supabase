"use client";

import React from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface TransporterFollowUpHistoryProps {
  completed: any[];
  historyColumns: { key: string; label: string }[];
  safeValue: (val: any) => string;
}

export default function TransporterFollowUpHistory({
  completed,
  historyColumns,
  safeValue,
}: TransporterFollowUpHistoryProps) {
  return (
    <div className="border rounded-lg overflow-auto shadow-sm flex-1 relative h-full">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
        <TableHeader className="sticky top-0 z-30 bg-slate-900 shadow-sm border-none [&_th]:h-12">
          <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
            {historyColumns.map(c => (
              <TableHead key={c.key} className="sticky top-0 z-20 bg-slate-900 border-none px-4 py-3 text-center font-semibold text-white uppercase whitespace-nowrap">
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {completed.map(rec => (
            <TableRow key={rec.id} className="even:bg-slate-50/30 hover:bg-indigo-50/15 transition-colors border-b border-slate-100">
              {historyColumns.map((c) => {
                const val = rec.data[c.key];

                if (c.key === "delay") {
                  const delayVal = calculateDelay(rec.data.plannedDate, rec.data.actualDate);
                  return (
                    <TableCell key={c.key} className={cn(
                      "text-center border-b px-4 py-2 font-medium",
                      delayVal !== "0" && delayVal !== "-" && "text-amber-700 font-bold",
                      delayVal === "0" && "text-emerald-700 font-semibold"
                    )}>
                      {delayVal}
                    </TableCell>
                  );
                }

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

                if (["plannedDate", "actualDate", "expectedDeliveryDate", "lastFollowUpDate", "nextFollowUpDate"].includes(c.key)) {
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
          ))}
        </TableBody>
      </table>
    </div>
  );
}
