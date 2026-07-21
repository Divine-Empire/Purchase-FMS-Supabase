"use client";

import React from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseSheetDate } from "@/lib/utils";

const formatDateDash = (date: any) => {
  if (!date || date === "-" || date === "—") return "-";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return typeof date === 'string' ? date : "-";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
  } catch (e) {
    return typeof date === 'string' ? date : "-";
  }
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
        <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
          <TableRow className="bg-slate-200 hover:bg-slate-200 border-none">
            {historyColumns.map(c => (
              <TableHead key={c.key} className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-center font-bold text-slate-700 uppercase whitespace-nowrap">
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {completed.map(rec => (
            <TableRow key={rec.id}>
              {historyColumns.map((c) => {
                const val = rec.data[c.key];

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

                if (c.key === "plannedDate" || c.key === "actualDate" || c.key === "expectedDate") {
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
