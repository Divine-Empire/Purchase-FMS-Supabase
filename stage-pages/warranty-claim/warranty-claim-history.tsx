"use client";

import React from "react";

// --- Optimized Row Component ---
const RecordRow = React.memo(({ rec, columns, renderCell }: any) => {
    return (
        <tr className="group transition-colors hover:bg-indigo-50/50">
            {columns.map((col: any) => (
                <td key={col.key} className="border-b px-4 py-2 text-center text-slate-700 whitespace-nowrap">
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
        <thead className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
          <tr className="hover:bg-transparent border-none">
            {HISTORY_COLUMNS.map((c) => (
              <th
                key={c.key}
                className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap"
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
