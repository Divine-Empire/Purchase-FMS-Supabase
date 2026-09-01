"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { isWarrantyExpiringSoon } from "@/lib/utils";

// --- Optimized Row Component ---
const RecordRow = React.memo(({ rec, columns, onAction, isHistory = false, renderCell, isCritical = false }: any) => {
  const rowClass = isCritical ? "bg-red-50/70 hover:bg-red-100/70" : "even:bg-slate-50/30 hover:bg-indigo-50/20";
  const stickyClass = isCritical ? "bg-red-50/70 group-hover:bg-red-100/70 border-b border-slate-100" : "bg-white group-hover:bg-indigo-50/20 border-b border-slate-100";

  return (
    <tr className={`group transition-colors ${rowClass}`}>
      {!isHistory && (
        <td className={`sticky left-0 z-20 ${stickyClass} text-center px-4 py-2`}>
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all active:scale-95 h-8 px-3 text-[11px] font-semibold"
            onClick={() => onAction(rec)}
          >
            {columns.some((c: any) => c.key === "status") ? "Update" : "Claim"}
          </Button>
        </td>
      )}
      {columns.map((col: any) => (
        <td key={col.key} className="border-b border-slate-100 px-4 py-2 text-center text-slate-700 whitespace-nowrap">
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
          <thead className="sticky top-0 z-30 bg-slate-900 shadow-xs border-none text-white text-center">
            <tr className="hover:bg-transparent border-none bg-slate-900 text-white">
              <th className="sticky left-0 z-40 bg-slate-900 w-[100px] border-b border-slate-800 text-center px-4 py-3 font-bold text-white uppercase text-[11px] tracking-wider">
                Actions
              </th>
              {PENDING_COLUMNS.map((c) => (
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
        <thead className="sticky top-0 z-30 bg-slate-900 shadow-xs border-none text-white text-center">
          <tr className="hover:bg-transparent border-none bg-slate-900 text-white">
            <th className="sticky left-0 z-40 bg-slate-900 w-[100px] border-b border-slate-800 text-center px-4 py-3 font-bold text-white uppercase text-[11px] tracking-wider">
              Actions
            </th>
            {CLOSURE_PENDING_COLUMNS.map((c) => (
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
