"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { isWarrantyExpiringSoon } from "@/lib/utils";

// --- Optimized Row Component ---
const RecordRow = React.memo(({ rec, columns, onAction, isHistory = false, renderCell, isCritical = false }: any) => {
    const rowClass = isCritical ? "bg-red-50 hover:bg-red-100" : (isHistory ? "hover:bg-indigo-50/50" : "hover:bg-gray-50");
    const stickyClass = isCritical ? "bg-red-50 group-hover:bg-red-100 border-b" : "bg-white group-hover:bg-gray-50 border-b";

    return (
        <tr className={`group transition-colors ${rowClass}`}>
            {!isHistory && (
                <td className={`sticky left-0 z-20 ${stickyClass} text-center px-4 py-2`}>
                    <Button
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all active:scale-95 h-8 px-3 text-[11px] font-semibold"
                        onClick={() => onAction(rec)}
                    >
                        {columns.length === 7 ? "Update" : "Claim"}
                    </Button>
                </td>
            )}
            {columns.map((col: any) => (
                <td key={col.key} className="border-b px-4 py-2 text-center text-slate-700 whitespace-nowrap">
                    {renderCell(rec.data, col.key)}
                </td>
            ))}
        </tr>
    );
});
RecordRow.displayName = "RecordRow";

interface WarrantyClaimPendingProps {
  pending: any[];
  closurePending: any[];
  activeTab: "pending" | "closurePending" | "history";
  PENDING_COLUMNS: readonly { readonly key: string; readonly label: string }[];
  CLOSURE_PENDING_COLUMNS: readonly { readonly key: string; readonly label: string }[];
  renderCell: (data: any, key: string) => React.ReactNode;
  onAction: (record: any) => void;
  onClosureAction: (record: any) => void;
}

export default function WarrantyClaimPending({
  pending,
  closurePending,
  activeTab,
  PENDING_COLUMNS,
  CLOSURE_PENDING_COLUMNS,
  renderCell,
  onAction,
  onClosureAction,
}: WarrantyClaimPendingProps) {
  if (activeTab === "pending") {
    return (
      <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm">
        <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
          <thead className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
            <tr className="hover:bg-transparent border-none">
              <th className="sticky left-0 z-40 bg-slate-200 w-[100px] border-b text-center px-4 py-3 font-semibold text-slate-900">
                Actions
              </th>
              {PENDING_COLUMNS.map((c) => (
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
            {pending.map((rec) => (
              <RecordRow
                key={rec.id}
                rec={rec}
                columns={PENDING_COLUMNS}
                renderCell={renderCell}
                isCritical={isWarrantyExpiringSoon(rec.data.warrantyEnd)}
                onAction={onAction}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ActiveTab === "closurePending"
  return (
    <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm">
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
        <thead className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
          <tr className="hover:bg-transparent border-none">
            <th className="sticky left-0 z-40 bg-slate-200 w-[100px] border-b text-center px-4 py-3 font-semibold text-slate-900">
              Actions
            </th>
            {CLOSURE_PENDING_COLUMNS.map((c) => (
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
          {closurePending.map((rec) => (
            <RecordRow
              key={rec.id}
              rec={rec}
              columns={CLOSURE_PENDING_COLUMNS}
              renderCell={renderCell}
              onAction={onClosureAction}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
