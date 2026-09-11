"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Loader2, Search, Wrench, RefreshCw, ClipboardList, History } from "lucide-react";
import { toast } from "sonner";
import { getFmsTimestamp, cn, formatDateTimeDash, canViewPurchaserRecord, parseSheetDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import RepairProcessPending from "./repair-process-pending";
import RepairProcessHistory from "./repair-process-history";

const PENDING_COLUMNS = [
  { key: "indentNumber", label: "Indent No." },
  { key: "liftNo", label: "Unit Tracking No." },
  { key: "itemName", label: "Item" },
  { key: "partName", label: "Part Name" },
  { key: "totalRepairQty", label: "Total Repair Qty" },
  { key: "repairedQty", label: "Repaired So Far" },
  { key: "failedQty", label: "Failed So Far" },
  { key: "pendingQty", label: "Pending Qty" },
  { key: "vendorName", label: "Vendor" },
  { key: "invoiceNumber", label: "Invoice No" },
] as const;

const HISTORY_COLUMNS = [
  { key: "indentNumber", label: "Indent No." },
  { key: "liftNo", label: "Unit Tracking No." },
  { key: "itemName", label: "Item" },
  { key: "partName", label: "Part Name" },
  { key: "repairDate", label: "Repair Date" },
  { key: "repairBy", label: "Repaired By" },
  { key: "repairedQty", label: "Repaired Qty" },
  { key: "failedQty", label: "Unrepairable Qty" },
  { key: "images", label: "Photos" },
  { key: "remarks", label: "Remarks" },
] as const;

export default function RepairProcess() {
  const { role, records: recordsAccess } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [engineerList, setEngineerList] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    repairDate: "",
    repairBy: "",
    repairedQty: "",
    failedQty: "",
    remarks: "",
    images: [] as File[],
  });

  const [selectedPendingColumns, setSelectedPendingColumns] = useState<string[]>(
    PENDING_COLUMNS.map((c) => c.key)
  );
  const [selectedHistoryColumns, setSelectedHistoryColumns] = useState<string[]>(
    HISTORY_COLUMNS.map((c) => c.key)
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dropRes, dataRes] = await Promise.all([
        fetch("/api/dropdowns"),
        fetch("/api/repair-process"),
      ]);

      const dropJson = await dropRes.json();
      const dataJson = await dataRes.json();

      if (dropJson.success && dropJson.data) {
        setEngineerList(dropJson.data.engineersOptions || []);
      }

      if (dataJson.success) {
        setSheetRecords([...(dataJson.pending || []), ...(dataJson.history || [])]);
      } else {
        toast.error(dataJson.error || "Failed to load repair records");
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedRecord = useMemo(
    () => sheetRecords.find((r) => r.id === selectedRecordId) ?? null,
    [sheetRecords, selectedRecordId]
  );

  // Purchaser-based record access: only show records this user is allowed to see.
  const visibleRecords = useMemo(
    () => sheetRecords.filter((r) => canViewPurchaserRecord(r.data?.purchaser, recordsAccess, role)),
    [sheetRecords, recordsAccess, role]
  );

  const pending = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return visibleRecords.filter((r) => {
      if (r.status !== "pending") return false;
      if (!searchLower) return true;
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendorName?.toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    });
  }, [visibleRecords, searchTerm]);

  const history = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return visibleRecords.filter((r) => {
      if (r.status !== "completed") return false;
      if (!searchLower) return true;
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendorName?.toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    });
  }, [visibleRecords, searchTerm]);

  const handleOpenForm = useCallback((recordId: string) => {
    const record = sheetRecords.find((r) => r.id === recordId);
    if (!record) return;

    setSelectedRecordId(recordId);
    setFormData({
      repairDate: getFmsTimestamp().split(" ")[0],
      repairBy: "",
      repairedQty: "",
      failedQty: "",
      remarks: "",
      images: [],
    });
    setOpen(true);
  }, [sheetRecords]);

  const maxQty = parseFloat(selectedRecord?.data?.pendingQty) || 0;
  const roundTotal = (parseFloat(formData.repairedQty) || 0) + (parseFloat(formData.failedQty) || 0);

  const isFormValid = useMemo(() => {
    if (!formData.repairDate) return false;
    const repaired = parseFloat(formData.repairedQty) || 0;
    const failed = parseFloat(formData.failedQty) || 0;
    if (repaired <= 0 && failed <= 0) return false;
    if (repaired + failed > maxQty) return false;
    return true;
  }, [formData, maxQty]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    setIsSubmitting(true);
    try {
      const uploadFile = async (file: File) => {
        const formDataUpload = new FormData();
        formDataUpload.append("file", file);
        const uploadRes = await fetch("/api/upload-supabase", {
          method: "POST",
          body: formDataUpload,
        });
        const uploadJson = await uploadRes.json();
        if (!uploadJson.success) throw new Error(uploadJson.error || "Failed to upload file");
        return uploadJson.url;
      };

      const imageUrls = formData.images.length > 0
        ? await Promise.all(formData.images.map((f) => uploadFile(f)))
        : [];

      const payload = {
        liftNo: selectedRecord.data.liftNo,
        repairDate: formData.repairDate,
        repairBy: formData.repairBy,
        repairedQty: parseFloat(formData.repairedQty) || 0,
        failedQty: parseFloat(formData.failedQty) || 0,
        remarks: formData.remarks,
        images: imageUrls,
      };

      const res = await fetch("/api/repair-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
      }

      toast.success("Repair round recorded successfully.");
      setOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedRecord, formData, fetchData]);

  const formatDateDash = (dateStr: any) => formatDateTimeDash(dateStr);

  const safeValue = useCallback((record: any, key: string) => {
    try {
      const data = record?.data || record;
      if (!data) return "-";

      if (key === "images") {
        const val = data.images;
        if (!val || String(val).trim() === "" || val === "-") return "-";
        const urls = String(val).split(",").map((u) => u.trim()).filter(Boolean);
        if (urls.length === 0) return "-";
        return (
          <a href={urls[0]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline justify-center">
            <FileText className="w-3.5 h-3.5" />
            <span>{urls.length > 1 ? `View (${urls.length})` : "View"}</span>
          </a>
        );
      }

      const val = data[key];
      const lowKey = key.toLowerCase();
      if (lowKey.includes("date") || lowKey.includes("plan") || lowKey.includes("actual")) {
        return formatDateDash(val);
      }

      if (val === undefined || val === null || String(val).trim() === "") return "-";
      return String(val);
    } catch {
      return "-";
    }
  }, []);

  const ColumnSelector = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-40 justify-start border-amber-100/80 text-amber-700 bg-white hover:bg-amber-50/50 hover:text-amber-800 shadow-2xs rounded-lg font-semibold text-xs transition-colors h-9">
          {activeTab === "pending"
            ? selectedPendingColumns.length === PENDING_COLUMNS.length
              ? "All columns"
              : `${selectedPendingColumns.length} columns selected`
            : selectedHistoryColumns.length === HISTORY_COLUMNS.length
              ? "All columns"
              : `${selectedHistoryColumns.length} columns selected`
          }
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 max-h-96 overflow-y-auto">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Checkbox
              id="select-all-cols"
              checked={
                activeTab === "pending"
                  ? selectedPendingColumns.length === PENDING_COLUMNS.length
                  : selectedHistoryColumns.length === HISTORY_COLUMNS.length
              }
              onCheckedChange={(checked) => {
                if (activeTab === "pending") {
                  setSelectedPendingColumns(checked ? PENDING_COLUMNS.map(c => c.key) : []);
                } else {
                  setSelectedHistoryColumns(checked ? HISTORY_COLUMNS.map(c => c.key) : []);
                }
              }}
            />
            <Label htmlFor="select-all-cols" className="text-sm font-semibold cursor-pointer">Select All</Label>
          </div>
          {(activeTab === "pending" ? PENDING_COLUMNS : HISTORY_COLUMNS).map((c) => (
            <div key={c.key} className="flex items-center space-x-2 py-1.5 hover:bg-slate-50 px-1 rounded">
              <Checkbox
                id={`col-${c.key}`}
                checked={
                  activeTab === "pending"
                    ? selectedPendingColumns.includes(c.key)
                    : selectedHistoryColumns.includes(c.key)
                }
                onCheckedChange={(checked) => {
                  if (activeTab === "pending") {
                    setSelectedPendingColumns(prev => checked ? [...prev, c.key] : prev.filter(k => k !== c.key));
                  } else {
                    setSelectedHistoryColumns(prev => checked ? [...prev, c.key] : prev.filter(k => k !== c.key));
                  }
                }}
              />
              <Label htmlFor={`col-${c.key}`} className="text-xs cursor-pointer flex-1">{c.label}</Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/30 p-6 overflow-hidden">
      {/* Header Card */}
      <div className="mb-6 p-6 bg-gradient-to-r from-amber-50/50 via-orange-50/20 to-white border border-amber-100/60 rounded-xl shadow-xs shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-700 rounded-lg shadow-amber-100 shadow-xl text-white">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-amber-950 tracking-tight">Repair Process</h2>
              <p className="text-xs text-slate-500 mt-1">Repair items rejected as "Repair" from Material Testing</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-amber-500" />
              <Input
                placeholder="Search records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border-amber-100 focus-visible:ring-amber-500"
              />
            </div>
            <div className="h-8 w-px bg-amber-100/60 hidden md:block" />
            <div className="flex items-center gap-2">
              <div className="flex flex-col text-right leading-none hidden md:block">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Show</span>
                <span className="text-[11px] font-extrabold text-amber-950">Columns:</span>
              </div>
              <ColumnSelector />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchData}
              disabled={isLoading}
              className="bg-white hover:bg-slate-50 shrink-0 border-amber-100/80 text-amber-700"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full flex-1 flex flex-col overflow-hidden">
        <div className="mb-4">
          <TabsList className="bg-amber-50/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1.5 border border-amber-100/50 w-[420px] shadow-2xs">
            <TabsTrigger
              value="pending"
              className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-3 transition-all cursor-pointer text-slate-700"
            >
              <ClipboardList className="w-5 h-5 opacity-80" />
              <div className="flex flex-col items-start leading-none gap-1 text-left">
                <span className="font-bold">Pending</span>
                <span className="text-[10px] opacity-70 font-medium">Awaiting repair</span>
              </div>
              <Badge variant="secondary" className={cn(
                "px-2.5 py-0.5 font-extrabold rounded-full text-xs min-w-[24px] text-center border-none transition-all",
                activeTab === "pending"
                  ? "bg-white text-red-600 shadow-xs"
                  : "bg-red-100 text-red-700"
              )}>
                {pending.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-3 transition-all cursor-pointer text-slate-700"
            >
              <History className="w-5 h-5 opacity-80" />
              <div className="flex flex-col items-start leading-none gap-1 text-left">
                <span className="font-bold">History</span>
                <span className="text-[10px] opacity-70 font-medium">Completed repairs</span>
              </div>
              <Badge variant="secondary" className={cn(
                "px-2.5 py-0.5 font-bold rounded-full text-xs min-w-[24px] text-center border-none transition-all",
                activeTab === "history"
                  ? "bg-white text-emerald-600 shadow-xs"
                  : "bg-green-100 text-green-800"
              )}>
                {history.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          {isLoading && sheetRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-slate-500 bg-white m-6 rounded-xl border border-dashed">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-amber-100 rounded-full animate-pulse"></div>
                <Loader2 className="w-12 h-12 animate-spin text-amber-600 absolute inset-0" />
              </div>
              <p className="mt-4 font-medium text-slate-900">Fetching records...</p>
            </div>
          ) : (
            <div className="h-full overflow-auto p-4 lg:p-6">
              <TabsContent value="pending" className="mt-0 focus-visible:outline-none">
                <RepairProcessPending
                  pending={pending}
                  handleOpenForm={handleOpenForm}
                  selectedPendingColumns={selectedPendingColumns}
                  PENDING_COLUMNS={PENDING_COLUMNS}
                  safeValue={safeValue}
                />
              </TabsContent>

              <TabsContent value="history" className="mt-0 focus-visible:outline-none">
                <RepairProcessHistory
                  history={history}
                  selectedHistoryColumns={selectedHistoryColumns}
                  HISTORY_COLUMNS={HISTORY_COLUMNS}
                  safeValue={safeValue}
                />
              </TabsContent>
            </div>
          )}
        </div>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-xl bg-white">
          <DialogHeader className="p-6 bg-gradient-to-br from-amber-600 to-orange-700">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
              <Wrench className="w-5 h-5" />
              Process Repair
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Indent No.</dt>
                <dd className="text-sm font-semibold text-slate-900">{selectedRecord?.data?.indentNumber || "-"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Item</dt>
                <dd className="text-sm font-semibold text-slate-900 truncate">{selectedRecord?.data?.itemName || "-"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Part Name</dt>
                <dd className="text-sm font-semibold text-slate-900 truncate">{selectedRecord?.data?.partName || "-"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pending Qty</dt>
                <dd className="text-sm font-semibold text-slate-900">{selectedRecord?.data?.pendingQty || "0"} units</dd>
              </div>
            </div>

            <form onSubmit={handleSubmit} id="repair-form" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">Repair Date *</Label>
                  <Input
                    type="date"
                    className="bg-white border-slate-200 rounded-lg shadow-sm h-10"
                    value={formData.repairDate}
                    onChange={(e) => setFormData({ ...formData, repairDate: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">Repaired By</Label>
                  <Select value={formData.repairBy} onValueChange={(v) => setFormData({ ...formData, repairBy: v })}>
                    <SelectTrigger className="bg-white border-slate-200 rounded-lg shadow-sm h-10">
                      <SelectValue placeholder="Select engineer" />
                    </SelectTrigger>
                    <SelectContent>
                      {engineerList.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">Repaired Qty (this round)</Label>
                  <Input
                    type="number"
                    min="0"
                    max={maxQty}
                    className="bg-white border-slate-200 rounded-lg shadow-sm h-10"
                    placeholder={`Pending: ${maxQty}`}
                    value={formData.repairedQty}
                    onChange={(e) => setFormData({ ...formData, repairedQty: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">Unrepairable / Failed Qty (this round)</Label>
                  <Input
                    type="number"
                    min="0"
                    max={maxQty}
                    className="bg-white border-slate-200 rounded-lg shadow-sm h-10"
                    placeholder={`Pending: ${maxQty}`}
                    value={formData.failedQty}
                    onChange={(e) => setFormData({ ...formData, failedQty: e.target.value })}
                  />
                </div>
              </div>

              {roundTotal > maxQty && (
                <p className="text-red-500 text-xs">
                  Repaired + Failed qty ({roundTotal}) cannot exceed pending qty ({maxQty}).
                </p>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">Photos</Label>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  className="bg-white border-slate-200 rounded-lg shadow-sm h-10 file:mr-3 file:text-xs"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setFormData({ ...formData, images: files });
                  }}
                />
                {formData.images.length > 0 && (
                  <p className="text-[11px] text-slate-500">{formData.images.length} file(s) selected</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">Remarks</Label>
                <textarea
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl resize-none text-sm focus:ring-amber-500 h-24"
                  rows={3}
                  placeholder="Remarks..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>
            </form>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t flex items-center justify-between sm:justify-between w-full">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
              className="px-8 border-slate-200 rounded-lg bg-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || isSubmitting}
              form="repair-form"
              className="px-10 bg-amber-600 hover:bg-amber-700 rounded-lg shadow-md transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Save Repair Round"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
