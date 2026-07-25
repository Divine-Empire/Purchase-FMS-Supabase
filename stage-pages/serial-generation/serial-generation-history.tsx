"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, Download } from "lucide-react";

interface SerialGenerationHistoryProps {
  history: any[];
  HISTORY_COLUMNS: readonly { readonly key: string; readonly label: string }[];
  openHistoryDetails: (record: any) => void;
  handleDownloadAllPDF: (record: any) => void;
  pdfGeneratingId: string | null;
  renderCell: (data: any, key: string) => React.ReactNode;
}

export default function SerialGenerationHistory({
  history,
  HISTORY_COLUMNS,
  openHistoryDetails,
  handleDownloadAllPDF,
  pdfGeneratingId,
  renderCell,
}: SerialGenerationHistoryProps) {
  return (
    <div className="border rounded-lg overflow-x-auto h-[70vh] relative">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
        <thead className="sticky top-0 z-30 bg-slate-900 shadow-xs border-none text-white text-center">
          <tr className="hover:bg-transparent border-none bg-slate-900 text-white">
            {HISTORY_COLUMNS.map((c) => (
              <th
                key={c.key}
                className="bg-slate-900 border-b border-slate-800 text-center px-4 py-3 font-bold text-white whitespace-nowrap uppercase text-[11px] tracking-wider"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map((rec) => (
            <tr
              key={rec.id}
              className="even:bg-slate-50/30 hover:bg-indigo-50/20 transition-colors border-b border-slate-100"
            >
              {HISTORY_COLUMNS.map((col) => (
                <td
                  key={col.key}
                  className="border-b border-slate-100 px-4 py-2 text-center text-slate-700 whitespace-nowrap"
                >
                  {col.key === "actions" ? (
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        onClick={() => openHistoryDetails(rec)}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
                        onClick={() => handleDownloadAllPDF(rec)}
                        disabled={pdfGeneratingId !== null}
                        title="Download PDF"
                      >
                        {pdfGeneratingId === rec.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    renderCell(rec.data, col.key)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
