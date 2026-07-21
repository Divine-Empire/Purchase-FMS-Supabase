"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface VerificationPendingProps {
  pending: any[];
  selectedRows: Set<string>;
  toggleRow: (id: string) => void;
  toggleAll: () => void;
  handleOpenForm: (id?: string) => void;
  selectedPendingColumns: string[];
  pendingColumns: readonly { readonly key: string; readonly label: string }[];
  safeValue: (record: any, key: string) => React.ReactNode;
  isLoading: boolean;
}

export default function VerificationPending({
  pending,
  selectedRows,
  toggleRow,
  toggleAll,
  handleOpenForm,
  selectedPendingColumns,
  pendingColumns,
  safeValue,
  isLoading,
}: VerificationPendingProps) {
  return (
    <div>
      {isLoading && pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg border-dashed">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
          <p className="text-lg animate-pulse text-blue-900 font-medium">
            Loading records...
          </p>
        </div>
      ) : pending.length === 0 ? (
        <div className="text-center py-24 bg-white border rounded-lg border-dashed text-slate-500">
          No pending verifications found
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm bg-white">
          <table className="w-full text-sm border-separate border-spacing-0 min-w-max">
            <thead className="sticky top-0 z-30 bg-slate-200 shadow-sm">
              <tr>
                <th className="sticky left-0 z-40 bg-slate-200 w-[50px] border-b text-center py-3">
                  <Checkbox
                    checked={
                      pending.length > 0 &&
                      pending.every((r) => selectedRows.has(r.id))
                    }
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="sticky left-[50px] z-40 bg-slate-200 w-[100px] border-b text-center px-4 py-3 font-semibold text-slate-900">
                  Actions
                </th>
                {pendingColumns
                  .filter((c) => selectedPendingColumns.includes(c.key))
                  .map((c) => (
                    <th
                      key={c.key}
                      className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900"
                    >
                      {c.label}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {pending.map((rec) => (
                <tr
                  key={rec.id}
                  className="hover:bg-blue-50/30 transition-colors group"
                >
                  <td className="sticky left-0 z-20 bg-white group-hover:bg-blue-50/50 border-b text-center py-2">
                    <Checkbox
                      checked={selectedRows.has(rec.id)}
                      onCheckedChange={() => toggleRow(rec.id)}
                    />
                  </td>
                  <td className="sticky left-[50px] z-20 bg-white group-hover:bg-blue-50/50 border-b text-center px-4 py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenForm(rec.id)}
                      className="h-8 transition-colors hover:text-blue-600"
                    >
                      Verify
                    </Button>
                  </td>
                  {pendingColumns
                    .filter((c) => selectedPendingColumns.includes(c.key))
                    .map((col) => (
                      <td
                        key={col.key}
                        className="border-b px-4 py-2 text-center text-slate-700"
                      >
                        {safeValue(rec, col.key)}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
