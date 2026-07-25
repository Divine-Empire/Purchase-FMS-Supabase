"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, ClipboardList } from "lucide-react";
import type { WorkflowRecord } from "@/lib/workflow-context";

interface StageTableProps {
  title: string;
  stage: number;
  pending: WorkflowRecord[];
  history: WorkflowRecord[];
  onSelectRecord: (record: WorkflowRecord) => void;
  columns: { key: string; label: string }[];
  showPending?: boolean;
  actionLabel?: string;
  hideTableTitle?: boolean;
}

export function StageTable({
  title,
  stage,
  pending,
  history,
  onSelectRecord,
  columns,
  showPending = true,
  hideTableTitle = false,
}: StageTableProps) {
  // Get timestamp when THIS stage was completed
  const getStageTimestamp = (record: WorkflowRecord) => {
    try {
      // Try to find a history entry for this specific stage
      const entry = record.history.find((h) => h.stage === stage);

      // Use the entry's date if available, otherwise fall back to record's creation date
      const timestamp = entry?.date || record.createdAt;

      const d = new Date(timestamp);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      console.error("Error formatting date:", e);
      return "—";
    }
  };

  // Mobile Card (also shows Timestamp first)
  const RecordCard = ({
    record,
    isPending = false,
    onAction,
    actionLabel = "Edit",
  }: {
    record: WorkflowRecord;
    isPending?: boolean;
    onAction: () => void;
    actionLabel?: string;
  }) => (
    <Card className="mb-3 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div
              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide ${record.status === "completed"
                ? "bg-green-100 text-green-800"
                : "bg-amber-100 text-amber-800"
                }`}
            >
              {record.status}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onAction}
            className={`ml-2 flex-shrink-0 transition-all font-semibold ${isPending 
              ? "border-red-200 text-red-700 bg-red-50/30 hover:bg-red-600 hover:text-white hover:border-red-600" 
              : "border-indigo-200 text-indigo-700 bg-indigo-50/30 hover:bg-indigo-600 hover:text-white hover:border-indigo-600"}`}
          >
            {actionLabel}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2 text-sm">
          {/* Timestamp first in mobile too */}
          {!isPending && (
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">
                Timestamp:
              </span>
              <span className="text-right font-medium text-green-700">
                {getStageTimestamp(record)}
              </span>
            </div>
          )}

          {columns.map((col) => (
            <div key={col.key} className="flex justify-between">
              <span className="text-muted-foreground font-medium">
                {col.label}:
              </span>
              <span className="text-right break-words ml-2">
                {col.key === "leadTime"
                  ? `${record.data[col.key] || "-"} days`
                  : String(record.data[col.key] || "-")}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className={`h-full flex flex-col ${!title ? "pt-0 md:pt-0" : "p-4 md:p-6"}`}>
      {/* Header */}
      {title && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 shrink-0">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            {title}
          </h2>
        </div>
      )}

      <div className={hideTableTitle ? "flex-1 overflow-hidden" : "space-y-4 flex-1 overflow-hidden"}>
        {/* Pending Section */}
        {showPending && (
          <div className={hideTableTitle ? "h-full flex flex-col" : "border border-indigo-100/70 rounded-xl overflow-hidden bg-white mb-4 h-full flex flex-col shadow-xs"}>
            {!hideTableTitle && (
              <div className="p-4 bg-transparent border-b border-indigo-50 shrink-0">
                <div className="text-lg font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-950">
                    <ClipboardList className="w-5 h-5 text-indigo-600" />
                    Pending ({pending.length})
                  </div>
                  {pending.length > 5 && (
                    <span className="text-xs font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded-md">
                      Urgent tasks awaiting action
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              {pending.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 bg-white border border-indigo-50 rounded-b-xl">
                  No pending records
                </div>
              ) : (
                <div className="bg-white h-full flex flex-col">
                  {/* Mobile */}
                  <div className="block md:hidden space-y-3 p-4 overflow-auto">
                    {pending.map((record) => (
                      <RecordCard
                        key={record.id}
                        record={record}
                        isPending={true}
                        onAction={() => onSelectRecord(record)}
                        actionLabel="Edit"
                      />
                    ))}
                  </div>

                  {/* Desktop */}
                  <div className="hidden md:block overflow-auto max-h-full scrollbar-thin scrollbar-thumb-indigo-100 relative border border-indigo-100 rounded-lg">
                    <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
                      <TableHeader className="bg-slate-900 sticky top-0 z-30 shadow-xs">
                        <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
                          <TableHead className="w-[100px] font-bold text-white border-b border-slate-800 sticky top-0 z-30 bg-slate-900 px-4 py-3 whitespace-nowrap">Actions</TableHead>
                          {/* Render first column (Indent #) */}
                          <TableHead className="min-w-[120px] font-bold text-white border-b border-slate-800 sticky top-0 z-30 bg-slate-900 px-4 py-3 whitespace-nowrap">
                            {columns[0]?.label}
                          </TableHead>
                          <TableHead className="min-w-[120px] font-bold text-white border-b border-slate-800 sticky top-0 z-30 bg-slate-900 px-4 py-3 whitespace-nowrap">
                            Date
                          </TableHead>
                          {columns.slice(1).map((col) => (
                            <TableHead key={col.key} className="min-w-[120px] font-bold text-white border-b border-slate-800 sticky top-0 z-30 bg-slate-900 px-4 py-3 whitespace-nowrap">
                              {col.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pending.map((record) => (
                          <TableRow
                            key={record.id}
                            className="odd:bg-white even:bg-indigo-50/10 hover:bg-indigo-50/30 transition-colors border-b border-indigo-50/80 last:border-0"
                          >
                            <TableCell className="border-b border-indigo-50/80 px-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onSelectRecord(record)}
                                className="h-8 border-red-200 text-red-700 bg-red-50/30 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all font-semibold shadow-xs"
                              >
                                Edit
                              </Button>
                            </TableCell>
                            <TableCell className="text-sm font-bold text-indigo-950 border-b border-indigo-50/80 px-4">
                              {String(record.data[columns[0]?.key] || "-")}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 border-b border-indigo-50/80 px-4 font-medium">
                              {getStageTimestamp(record)}
                            </TableCell>
                            {columns.slice(1).map((col) => (
                              <TableCell key={col.key} className="text-sm text-slate-600 border-b border-indigo-50/80 px-4 font-medium">
                                {col.key === "leadTime"
                                  ? `${record.data[col.key] || "-"} days`
                                  : col.key === "attachment" && record.data[col.key]
                                    ? <a href={record.data[col.key]} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 font-bold underline-offset-4 hover:underline">View</a>
                                    : String(record.data[col.key] || "-")}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Section */}
        {!showPending && (
          <div className={hideTableTitle ? "h-full flex flex-col" : "border border-indigo-100/70 rounded-xl overflow-hidden bg-white h-full flex flex-col shadow-xs"}>
            {!hideTableTitle && (
              <div className="p-4 bg-transparent border-b border-indigo-50 shrink-0">
                <div className="text-lg font-bold flex items-center gap-2 text-indigo-950">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  History ({history.length})
                </div>
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              {history.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 bg-white border border-indigo-50 rounded-b-xl">
                  No completed records
                </div>
              ) : (
                <div className="bg-white h-full flex flex-col">
                  {/* Mobile */}
                  <div className="block md:hidden space-y-3 p-4 overflow-auto">
                    {history.map((record) => (
                      <RecordCard
                        key={record.id}
                        record={record}
                        isPending={false}
                        onAction={() => { }}
                        actionLabel="View"
                      />
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-auto max-h-full scrollbar-thin scrollbar-thumb-indigo-100 relative border border-indigo-100 rounded-lg">
                    <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
                      <TableHeader className="bg-slate-900 sticky top-0 z-30 shadow-xs">
                        <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
                          <TableHead className="min-w-[180px] font-bold text-white border-b border-slate-800 sticky top-0 z-30 bg-slate-900 px-4 py-3 whitespace-nowrap">
                            Timestamp
                          </TableHead>
                          {columns.map((col) => (
                            <TableHead key={col.key} className="min-w-[120px] font-bold text-white border-b border-slate-800 sticky top-0 z-30 bg-slate-900 px-4 py-3 whitespace-nowrap">
                              {col.label}
                            </TableHead>
                          ))}
                          <TableHead className="w-[100px] font-bold text-white border-b border-slate-800 sticky top-0 z-30 bg-slate-900 px-4 py-3 whitespace-nowrap">Status</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {history.map((record) => (
                          <TableRow
                            key={record.id}
                            className="odd:bg-white even:bg-indigo-50/10 hover:bg-indigo-50/30 transition-colors border-b border-indigo-50/80 last:border-0"
                          >
                            <TableCell className="font-bold text-indigo-950 whitespace-nowrap border-b border-indigo-50/80 px-4 font-mono">
                              {getStageTimestamp(record)}
                            </TableCell>
                            {columns.map((col) => (
                              <TableCell key={col.key} className="text-sm text-slate-600 border-b border-indigo-50/80 px-4 font-medium">
                                {col.key === "leadTime"
                                  ? `${record.data[col.key] || "-"} days`
                                  : col.key === "attachment" && record.data[col.key]
                                    ? <a href={record.data[col.key]} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 font-bold underline-offset-4 hover:underline">View</a>
                                    : String(record.data[col.key] || "-")}
                              </TableCell>
                            ))}
                            <TableCell className="font-extrabold text-green-700 border-b border-indigo-50/80 px-4 uppercase tracking-wide text-xs">
                              Completed
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
