"use client";

import React from "react";

// --- Optimized Row Component ---
const RecordRow = React.memo(({ rec, columns, renderCell }: any) => {
    return (
        <tr className="group transition-colors even:bg-slate-50/30 hover:bg-indigo-50/20 border-b border-slate-100">
            {columns.map((col: any) => (
                <td key={col.key} className="border-b border-slate-100 px-4 py-2 text-center text-slate-700 whitespace-nowrap">
                    {renderCell(rec.data, col.key)}
                </td>
            ))}
        </tr>
    );
});
RecordRow.displayName = "RecordRow";

interface WarrantyClaimHistoryProps {
  history: any[];
  HISTORY_COLUMNS: readonly { readonly key: string; readonly label: string }[];
  renderCell: (data: any, key: string) => React.ReactNode;
}

export default function WarrantyClaimHistory({
  history,
  HISTORY_COLUMNS,
  renderCell,
}: WarrantyClaimHistoryProps) {
  return (
    <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm">
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
        <tbody className="bg-white">
          {history.map((rec) => (
            <RecordRow
              key={rec.id}
              rec={rec}
              columns={HISTORY_COLUMNS}
              renderCell={renderCell}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
