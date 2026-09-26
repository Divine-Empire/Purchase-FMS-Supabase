"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, X, Loader2, ClipboardList, History, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, parseSheetDate, getFmsTimestamp, cn, sortByIndentNumber } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import BackgroundSyncBanner from "@/components/background-sync-banner";
import PoEntryPending from "./po-entry-pending";
import PoEntryHistory from "./po-entry-history";

const HISTORY_DEFAULT_LIMIT = 100;
const HISTORY_FILTERED_LIMIT = 200;

export default function Stage5() {
  const { role, records: recordsAccess } = useAuth();
  const isAdmin = role?.toUpperCase() === "ADMIN";
  const [open, setOpen] = useState(false);

  // Admin-only History edit modal — mirrors the Bulk PO creation form: every indent
  // sharing the clicked record's PO Number opens together, Basic Value/GST% are edited
  // per item, and Pkg Amount/Pkg GST%/PO Copy are shared across the whole group (same as
  // at creation time). Editing Basic Value cascades into Update-3-Vendors' rate for that
  // indent (rate = basicValue / approvedQty) so the two never drift apart again.
  const [openEditModal, setOpenEditModal] = useState(false);
  const [isLoadingEditGroup, setIsLoadingEditGroup] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editGroupPoNumber, setEditGroupPoNumber] = useState("");
  const [editGroupItems, setEditGroupItems] = useState<Array<{
    indentNo: string;
    itemName: string;
    quantity: number;
    vendorName: string;
    vendorRate: number | null;
    basicValue: string;
    gst: string;
  }>>([]);
  const [editGroupPkgAmount, setEditGroupPkgAmount] = useState("");
  const [editGroupPkgGST, setEditGroupPkgGST] = useState("");
  const [editGroupPoCopy, setEditGroupPoCopy] = useState<File | string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [bulkFormData, setBulkFormData] = useState<Record<string, any>>({});
  // Pending stays fully loaded (small, bounded by open indents at PO Entry stage) —
  // History is fetched lazily, only once that tab is opened, and paginated server-side
  // (100 default, 200 once searched) since it only ever grows over time.
  const [pendingRaw, setPendingRaw] = useState<any[]>([]);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [poTotalMap, setPoTotalMap] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Shared fields for bulk PO
  const [commonPONumber, setCommonPONumber] = useState("");
  const [commonPOCopy, setCommonPOCopy] = useState<File | null>(null);

  // Shared Packaging/Forwarding fields
  const [commonPkgAmount, setCommonPkgAmount] = useState("");
  const [commonPkgGST, setCommonPkgGST] = useState("");

  // Derived: total packaging (base + gst)
  const getPkgTotals = (pkgAmount: string, pkgGST: string, count: number) => {
    const base = parseFloat(pkgAmount) || 0;
    let gstRate = 0;
    if (pkgGST === "5%") gstRate = 0.05;
    if (pkgGST === "12%") gstRate = 0.12;
    if (pkgGST === "18%") gstRate = 0.18;
    if (pkgGST === "28%") gstRate = 0.28;
    const totalPkg = base + base * gstRate;
    const perItemPkgTotal = count > 0 ? totalPkg / count : 0;
    const perItemPkgBase = count > 0 ? base / count : 0;
    return { totalPkg, perItemPkgTotal, perItemPkgBase };
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [indentFilter, setIndentFilter] = useState<"no_filter" | "increasing" | "decreasing">("no_filter");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ view: "pending", _t: String(Date.now()) });
      if (role) params.set("role", role);
      if (recordsAccess) params.set("records", recordsAccess);

      const res = await fetch(`/api/po-entry?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setPendingRaw(json.pending || []);
        setHistoryCount(json.historyCount || 0);
      }
    } catch (e) {
      console.error("Fetch error Stage 5:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const historyLoadedRef = React.useRef(false);
  const hasHistoryFilter = !!searchTerm;
  const historyLimit = hasHistoryFilter ? HISTORY_FILTERED_LIMIT : HISTORY_DEFAULT_LIMIT;

  const fetchHistory = React.useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        view: "history",
        page: String(historyPage),
        sort: indentFilter === "decreasing" ? "desc" : "asc",
      });
      if (searchTerm) params.set("search", searchTerm);
      if (role) params.set("role", role);
      if (recordsAccess) params.set("records", recordsAccess);

      const res = await fetch(`/api/po-entry?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setHistoryRecords(json.history || []);
        setHistoryTotalCount(json.totalCount || 0);
        setPoTotalMap(new Map(Object.entries(json.poTotals || {})));
      } else {
        toast.error(json.error || "Failed to load history");
      }
    } catch (e) {
      console.error("History fetch error:", e);
      toast.error("Failed to load history");
    }
    setIsHistoryLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyPage, searchTerm, indentFilter, role, recordsAccess]);

  useEffect(() => {
    if (activeTab !== "history") return;
    const debounceMs = historyLoadedRef.current ? 350 : 0;
    const timer = setTimeout(() => {
      historyLoadedRef.current = true;
      fetchHistory();
    }, debounceMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, historyPage, searchTerm, indentFilter]);

  useEffect(() => {
    setHistoryPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, indentFilter]);

  // ---- Admin: edit every indent under a completed record's PO Number ----
  const handleOpenEditHistory = async (record: any) => {
    const poNumber = record.data.poNumber;
    if (!poNumber) {
      toast.error("This record has no PO Number to group by");
      return;
    }
    setOpenEditModal(true);
    setIsLoadingEditGroup(true);
    try {
      const res = await fetch(`/api/po-entry?poNumber=${encodeURIComponent(poNumber)}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load PO group");

      setEditGroupPoNumber(json.poNumber);
      setEditGroupPoCopy(json.poCopy || null);
      setEditGroupPkgAmount(json.pkgAmount != null && json.pkgAmount !== "" ? String(json.pkgAmount) : "");
      setEditGroupPkgGST(json.pkgGST || "");
      setEditGroupItems(
        (json.items || []).map((it: any) => ({
          ...it,
          basicValue: it.basicValue != null && it.basicValue !== "" ? String(it.basicValue) : "",
          gst: it.gst || "",
        }))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to load PO group");
      setOpenEditModal(false);
    } finally {
      setIsLoadingEditGroup(false);
    }
  };

  const updateEditGroupItem = (indentNo: string, field: "basicValue" | "gst", value: string) => {
    setEditGroupItems((prev) =>
      prev.map((it) => (it.indentNo === indentNo ? { ...it, [field]: value } : it))
    );
  };

  // Live preview only — mirrors the server's own formula in editHistoryGroup so what the
  // admin sees before saving matches what actually gets written.
  const previewTotalWithTax = (basicValue: string, gst: string) => {
    const basic = parseFloat(basicValue) || 0;
    const gstRate = (parseFloat(String(gst || "").replace("%", "")) || 0) / 100;
    const { perItemPkgTotal } = getPkgTotals(editGroupPkgAmount, editGroupPkgGST, editGroupItems.length || 1);
    return basic * (1 + gstRate) + perItemPkgTotal;
  };

  const handleSaveEditGroupHistory = async () => {
    setIsSavingEdit(true);
    try {
      let poCopyUrl: string | null = typeof editGroupPoCopy === "string" ? editGroupPoCopy : null;
      if (editGroupPoCopy instanceof File) {
        const fileData = new FormData();
        fileData.append("file", editGroupPoCopy);
        const uploadRes = await fetch("/api/upload-supabase", { method: "POST", body: fileData });
        const uploadJson = await uploadRes.json();
        if (!uploadJson.success) throw new Error(uploadJson.error || "PO Copy upload failed");
        poCopyUrl = uploadJson.url;
      }

      const res = await fetch("/api/po-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "editHistoryGroup",
          poNumber: editGroupPoNumber,
          poCopy: poCopyUrl,
          pkgAmount: editGroupPkgAmount,
          pkgGST: editGroupPkgGST,
          items: editGroupItems.map((it) => ({
            indentNo: it.indentNo,
            basicValue: it.basicValue,
            gst: it.gst,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to save changes");

      toast.success(`PO ${editGroupPoNumber} updated (${editGroupItems.length} item${editGroupItems.length === 1 ? "" : "s"})`);
      setOpenEditModal(false);
      await fetchHistory();
    } catch (err: any) {
      toast.error(err.message || "Failed to save changes");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Pending is a small, always-fully-loaded dataset (server already applies
  // purchaser-visibility), so search/sort filtering here stays client-side — only
  // History needs server-side filtering/sorting + pagination.
  const pending = useMemo(() => {
    const records = pendingRaw.filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      const selectedId = String(r.data.selectedVendor || "1");
      const idx = parseInt(selectedId.toLowerCase().replace("vendor", "").trim(), 10) || 1;
      const vName = r.data[`vendor${idx}Name`] || "";

      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        vName.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower)
      );
    });

    return sortByIndentNumber(records, indentFilter === "decreasing" ? "desc" : "asc");
  }, [pendingRaw, searchTerm, indentFilter]);

  // historyRecords/poTotalMap are already filtered/searched/sorted/paginated
  // server-side (see fetchHistory above) — used as-is, no client-side re-filtering.
  const completed = historyRecords;

  const baseColumns = [
    { key: "indentNumber", label: "Indent-No", icon: null },
    { key: "planned4", label: "Planned", icon: null },
    { key: "actual4", label: "Actual", icon: null },
    { key: "itemName", label: "Item", icon: null },
    { key: "quantity", label: "Qty", icon: null },
  ];

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    baseColumns.map((c) => c.key)
  );

  const paymentTermsList = [
    { value: "15", label: "15 days" },
    { value: "30", label: "30 days" },
    { value: "60", label: "60 days" },
    { value: "90", label: "90 days" },
    { value: "advance", label: "Advance" },
    { value: "PI", label: "PI (Proforma Invoice)" },
  ];

  const handleOpenBulkForm = () => {
    if (selectedRecordIds.length === 0) return;

    const initialData: Record<string, any> = {};
    selectedRecordIds.forEach((id) => {
      const record = pending.find((r) => r.id === id);
      const vendorData = record ? getVendorData(record) : { rate: 0 };
      const rate = parseFloat(vendorData.rate) || 0;
      const quantity = parseFloat(record?.data?.quantity) || 0;
      const basicValue = (rate * quantity).toFixed(2);

      initialData[id] = {
        basicValue: basicValue,
        totalWithTax: basicValue,
        hsn: "",
        gst: "",
      };
    });
    setBulkFormData(initialData);
    setCommonPONumber("");
    setCommonPOCopy(null);
    setCommonPkgAmount("");
    setCommonPkgGST("");
    setOpen(true);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRecordIds.length === 0) return;

    if (!commonPONumber.trim()) {
      toast.error("Please enter the PO Number.");
      return;
    }

    if (!commonPOCopy) {
      toast.error("Please upload the PO Copy.");
      return;
    }

    let allValid = true;
    selectedRecordIds.forEach((id) => {
      const data = bulkFormData[id];
      if (!data || !data.basicValue || !data.totalWithTax || !data.hsn || !data.gst) {
        allValid = false;
      }
    });

    if (!allValid) {
      toast.error("Please fill all required fields for selected records.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const recordsToProcess = selectedRecordIds.map((id) => {
      const record = pending.find((r) => r.id === id);
      const data = bulkFormData[id];
      return { record, data };
    }).filter((item) => item.record);

    const processPromise = (async () => {
      try {
        let finalFileUrl = "";

        if (commonPOCopy instanceof File) {
          try {
            const fileData = new FormData();
            fileData.append("file", commonPOCopy);
            fileData.append("folder", "pos");

            const uploadRes = await fetch("/api/upload-supabase", {
              method: "POST",
              body: fileData
            });

            if (!uploadRes.ok) throw new Error(`Upload failed with status ${uploadRes.status}`);
            const uploadJson = await uploadRes.json();

            if (uploadJson.success && uploadJson.url) {
              finalFileUrl = uploadJson.url;
            } else {
              throw new Error(uploadJson.error || "Upload failed");
            }
          } catch (err: any) {
            console.error("PO Copy upload error:", err);
            throw new Error(`PO Copy attachment upload failed: ${err.message}`);
          }
        }

        const recordsPayload = recordsToProcess.map(({ record, data }) => {
          const { perItemPkgTotal } = getPkgTotals(
            commonPkgAmount,
            commonPkgGST,
            recordsToProcess.length
          );

          const basicVal = parseFloat(data.basicValue) || 0;
          const existingTax = parseFloat(data.totalWithTax) - basicVal;
          const finalTotalWithTax = (basicVal + existingTax + perItemPkgTotal).toFixed(2);

          return {
            recordId: record.id,
            basicValue: data.basicValue,
            totalWithTax: finalTotalWithTax,
            hsn: data.hsn,
            gst: data.gst
          };
        });

        const res = await fetch("/api/po-entry", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "insertPOEntry",
            poNumber: commonPONumber,
            poCopy: finalFileUrl,
            pkgAmount: commonPkgAmount || null,
            pkgGST: commonPkgGST || null,
            records: recordsPayload
          })
        });

        const result = await res.json();
        if (!result.success) throw new Error(result.error || "Failed to submit PO Entry");

        await fetchData();
        setOpen(false);
        setSelectedRecordIds([]);
        setBulkFormData({});
        return { successCount: recordsToProcess.length, total: recordsToProcess.length };
      } finally {
        setIsSubmitting(false);
      }
    })();

    toast.promise(processPromise, {
      loading: `Processing ${recordsToProcess.length} POs...`,
      success: (data) => `Successfully processed ${data.successCount} of ${data.total} POs.`,
      error: (err) => `Error during bulk processing: ${err.message}`,
    });
  };

  const handleCommonFileChange = (file: File | null) => {
    setCommonPOCopy(file);
  };

  const handleCommonFileRemove = () => {
    setCommonPOCopy(null);
  };

  const getVendorData = (record: any) => {
    const selName = String(record.data.selectedVendor || "").trim().toLowerCase();
    let idx = 1;
    if (String(record.data.vendor2Name || "").trim().toLowerCase() === selName) idx = 2;
    else if (String(record.data.vendor3Name || "").trim().toLowerCase() === selName) idx = 3;

    return {
      name: record.data[`vendor${idx}Name`] || "-",
      rate: record.data[`vendor${idx}Rate`],
      terms: record.data[`vendor${idx}Terms`],
      delivery: record.data[`vendor${idx}DeliveryDate`],
      warrantyType: record.data[`vendor${idx}WarrantyType`],
      attachment: record.data[`vendor${idx}Attachment`],
      approvedBy: record.data.approvedBy || "Auto-Approved",
    };
  };

  const toggleSelectAll = () => {
    if (selectedRecordIds.length === pending.length) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(pending.map((r) => r.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const ColumnSelector = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-40 justify-start border-indigo-150 text-indigo-700 bg-white hover:bg-indigo-50/50 hover:text-indigo-800 shadow-xs">
          {selectedColumns.length === baseColumns.length
            ? "All columns"
            : `${selectedColumns.length} column${selectedColumns.length > 1 ? "s" : ""} selected`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-2">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 pb-2 border-b border-indigo-100">
            <Checkbox
              checked={selectedColumns.length === baseColumns.length}
              onCheckedChange={(c) => {
                if (c) setSelectedColumns(baseColumns.map((col) => col.key));
                else setSelectedColumns([]);
              }}
            />
            <Label className="text-sm font-medium">All Columns</Label>
          </div>
          {baseColumns.map((col) => (
            <div key={col.key} className="flex items-center space-x-2 py-1">
              <Checkbox
                checked={selectedColumns.includes(col.key)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedColumns((prev) => [...prev, col.key]);
                  } else {
                    setSelectedColumns((prev) => prev.filter((c) => c !== col.key));
                  }
                }}
              />
              <Label className="text-sm">{col.label}</Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="p-6 h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-6 p-6 bg-gradient-to-r from-indigo-50/50 via-blue-50/20 to-white border border-indigo-100/60 rounded-xl shadow-xs shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg shadow-indigo-100 shadow-xl text-white">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-extrabold text-indigo-950 tracking-tight">Stage 5: PO Creation</h2>
              </div>
              {submitError && (
                <p className="text-red-650 text-sm mt-2 font-semibold bg-red-50 p-2 rounded border border-red-100 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                  {submitError}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-indigo-500" />
              <Input
                placeholder="Search by Indent, Item, Vendor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border-indigo-100 focus-visible:ring-indigo-500"
              />
            </div>
            <div className="h-8 w-px bg-indigo-100/60 mx-2" />
            <div className="flex items-center gap-4">
              <Label className="text-sm font-semibold text-indigo-900 hidden md:inline-block">Show Columns:</Label>
              <ColumnSelector />
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <TabsList className="bg-indigo-50/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1.5 border border-indigo-100/50 w-[420px] shadow-2xs">
              <TabsTrigger
                value="pending"
                className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-3 transition-all cursor-pointer text-slate-700"
              >
                <ClipboardList className="w-5 h-5 opacity-80" />
                <div className="flex flex-col items-start leading-none gap-1 text-left">
                  <span className="font-bold">Pending</span>
                  <span className="text-[10px] opacity-70">Awaiting processing</span>
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
                className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-3 transition-all cursor-pointer text-slate-700"
              >
                <History className="w-5 h-5 opacity-80" />
                <div className="flex flex-col items-start leading-none gap-1 text-left">
                  <span className="font-bold">History</span>
                  <span className="text-[10px] opacity-70 font-medium">Completed records</span>
                </div>
                <Badge variant="secondary" className={cn(
                  "px-2.5 py-0.5 font-bold rounded-full text-xs min-w-[24px] text-center border-none transition-all",
                  activeTab === "history"
                    ? "bg-white text-emerald-600 shadow-xs"
                    : "bg-green-100 text-green-800"
                )}>
                  {historyLoadedRef.current ? historyTotalCount : historyCount}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-semibold text-slate-700">Indent Wise Filter:</span>
              <Select value={indentFilter} onValueChange={(val) => setIndentFilter(val as any)}>
                <SelectTrigger className="w-[180px] bg-white border border-indigo-100 hover:border-indigo-200 focus:ring-2 focus:ring-indigo-500 rounded-lg text-slate-700 font-semibold shadow-xs">
                  <SelectValue placeholder="No Filter" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-indigo-100 rounded-lg shadow-md">
                  <SelectItem value="no_filter" className="text-slate-700 hover:bg-indigo-50 focus:bg-indigo-50 font-medium">No Filter</SelectItem>
                  <SelectItem value="increasing" className="text-slate-700 hover:bg-indigo-50 focus:bg-indigo-50 font-medium">Increasing</SelectItem>
                  <SelectItem value="decreasing" className="text-slate-700 hover:bg-indigo-50 focus:bg-indigo-50 font-medium">Decreasing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedRecordIds.length > 0 && activeTab === "pending" && (
            <Button
              onClick={handleOpenBulkForm}
              className="animate-in fade-in zoom-in duration-200 shadow-md shadow-green-100 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white px-6 py-3 h-auto text-sm font-bold rounded-lg"
            >
              Create PO ({selectedRecordIds.length})
            </Button>
          )}
        </div>

        {/* PENDING */}
        <TabsContent value="pending" className="mt-0 flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading...</p>
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border rounded-lg bg-gray-50">
              <p className="text-lg">No pending PO entries</p>
              <p className="text-sm mt-1">All purchase orders are created!</p>
            </div>
          ) : (
            <PoEntryPending
              pending={pending}
              selectedRecordIds={selectedRecordIds}
              toggleSelectAll={toggleSelectAll}
              toggleSelectOne={toggleSelectOne}
              selectedColumns={selectedColumns}
              baseColumns={baseColumns}
              getVendorData={getVendorData}
              paymentTermsList={paymentTermsList}
            />
          )}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="mt-0 flex-1 flex flex-col overflow-hidden">
          {isHistoryLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading History...</p>
              <p className="text-sm text-gray-500 mt-1">Fetching completed orders</p>
            </div>
          ) : completed.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border rounded-lg bg-gray-50">
              <p className="text-lg">No completed POs</p>
            </div>
          ) : (
            <>
              <PoEntryHistory
                completed={completed}
                getVendorData={getVendorData}
                paymentTermsList={paymentTermsList}
                poTotalMap={poTotalMap}
                isAdmin={isAdmin}
                onEdit={handleOpenEditHistory}
              />
              {historyTotalCount > historyLimit && (
                <div className="flex items-center justify-between mt-3 text-sm text-slate-600 shrink-0">
                  {hasHistoryFilter ? (
                    <>
                      <span>
                        Showing {historyPage * historyLimit + 1}-
                        {Math.min((historyPage + 1) * historyLimit, historyTotalCount)} of {historyTotalCount}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={historyPage === 0 || isHistoryLoading}
                          onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={(historyPage + 1) * historyLimit >= historyTotalCount || isHistoryLoading}
                          onClick={() => setHistoryPage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </>
                  ) : (
                    <span>
                      Showing first {historyLimit} of {historyTotalCount} — search to see more
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* BULK PO MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-xl border border-indigo-150">
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-6 py-4 flex flex-col gap-1 flex-shrink-0">
            <DialogTitle className="text-white text-lg font-bold">Bulk PO Creation ({selectedRecordIds.length} items)</DialogTitle>
            <p className="text-slate-400 text-xs">Fill PO details for all selected items</p>
          </div>

          <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto space-y-6 p-6">
            {selectedRecordIds.length > 1 && (
              <div className="flex items-center gap-2 max-w-sm bg-indigo-50/40 p-3 rounded-xl border border-indigo-100 shadow-2xs">
                <Label htmlFor="grand-total-display" className="text-xs font-bold uppercase tracking-wider text-indigo-950 whitespace-nowrap">
                  Grand Total (w/ Tax):
                </Label>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-indigo-950 font-bold">₹</span>
                  <Input
                    id="grand-total-display"
                    type="text"
                    readOnly
                    value={(selectedRecordIds.reduce((sum, recordId) => {
                      const data = bulkFormData[recordId] || {};
                      return sum + (parseFloat(data.totalWithTax) || 0);
                    }, 0) + getPkgTotals(commonPkgAmount, commonPkgGST, selectedRecordIds.length).totalPkg).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                    className="pl-7 bg-white border-indigo-150 cursor-not-allowed font-extrabold text-emerald-700 h-9 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}
            {/* SHARED PO NUMBER - AT TOP */}
            <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/15 shadow-2xs">
              <div className="space-y-2">
                <Label htmlFor="common-poNumber" className="text-sm font-bold text-indigo-950 uppercase tracking-wider">
                  PO Number <span className="text-red-500">*</span>
                  <span className="text-xs font-normal text-slate-500 ml-2">(applies to all items)</span>
                </Label>
                <Input
                  id="common-poNumber"
                  value={commonPONumber}
                  onChange={(e) => setCommonPONumber(e.target.value)}
                  required
                  placeholder="PO-2025-001"
                  className="bg-white border-indigo-150 focus-visible:ring-indigo-500"
                />
              </div>
            </div>

            {/* SHARED PACKAGING/FORWARDING SECTION */}
            <div className="border border-indigo-100 rounded-xl p-4 bg-amber-50/15 shadow-2xs">
              <div className="space-y-3">
                <Label className="text-sm font-bold text-indigo-950 uppercase tracking-wider">
                  Packaging / Forwarding
                  <span className="text-xs font-normal text-slate-500 ml-2">(applies to all items, divided equally)</span>
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="common-pkgAmount" className="text-xs font-semibold text-slate-700">Amount</Label>
                    <Input
                      id="common-pkgAmount"
                      type="number"
                      step="0.01"
                      value={commonPkgAmount}
                      onChange={(e) => setCommonPkgAmount(e.target.value)}
                      placeholder="0.00"
                      className="bg-white border-indigo-150 focus-visible:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="common-pkgGST" className="text-xs font-semibold text-slate-700">GST on Packaging</Label>
                    <Select value={commonPkgGST} onValueChange={setCommonPkgGST}>
                      <SelectTrigger id="common-pkgGST" className="bg-white border-indigo-150 focus-visible:ring-indigo-500">
                        <SelectValue placeholder="Select GST" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0%">0%</SelectItem>
                        <SelectItem value="5%">5%</SelectItem>
                        <SelectItem value="12%">12%</SelectItem>
                        <SelectItem value="18%">18%</SelectItem>
                        <SelectItem value="28%">28%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700">Total Packaging / Forwarding</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={getPkgTotals(commonPkgAmount, commonPkgGST, selectedRecordIds.length).totalPkg.toFixed(2)}
                      readOnly
                      className="bg-indigo-50/30 border-indigo-100 text-indigo-950 font-bold cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* PER-ITEM SECTIONS */}
            {selectedRecordIds.map((recordId) => {
              const record = pending.find((r) => r.id === recordId);
              if (!record) return null;
              const v = getVendorData(record);
              const data = bulkFormData[recordId] || {};

              return (
                <div key={recordId} className="border border-indigo-100 rounded-xl p-4 bg-white shadow-2xs">
                  <div className="mb-4 pb-3 border-b border-indigo-50/80">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><strong className="text-indigo-950">Indent-No:</strong> <span className="font-bold text-indigo-950">{record.data.indentNumber}</span></div>
                      <div><strong className="text-indigo-950">Item:</strong> <span className="font-bold text-indigo-950">{record.data.itemName}</span></div>
                      <div><strong className="text-indigo-950">Qty:</strong> <span className="font-bold text-indigo-950">{record.data.quantity}</span></div>
                    </div>
                    <div className="mt-1 text-xs text-slate-550">
                      Vendor: <span className="font-bold text-indigo-950">{v.name}</span> | Rate: <span className="font-bold text-slate-700">₹{v.rate}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`${recordId}-basicValue`} className="text-xs font-semibold text-slate-700">
                        Basic Value <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`${recordId}-basicValue`}
                        type="number"
                        step="0.01"
                        value={data.basicValue || ""}
                        readOnly
                        className="bg-indigo-50/20 border-indigo-100 text-indigo-950 font-semibold cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${recordId}-gst`}>
                        GST <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={data.gst || ""}
                        onValueChange={(val) => {
                          const basic = parseFloat(data.basicValue) || 0;
                          let taxRate = 0;
                          if (val === "5%") taxRate = 0.05;
                          if (val === "12%") taxRate = 0.12;
                          if (val === "18%") taxRate = 0.18;
                          if (val === "28%") taxRate = 0.28;

                          const total = (basic + (basic * taxRate)).toFixed(2);

                          setBulkFormData((prev) => ({
                            ...prev,
                            [recordId]: {
                              ...prev[recordId],
                              gst: val,
                              totalWithTax: total
                            },
                          }))
                        }}
                      >
                        <SelectTrigger id={`${recordId}-gst`} className="border-indigo-150 focus:ring-indigo-500">
                          <SelectValue placeholder="Select GST" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5%">5%</SelectItem>
                          <SelectItem value="12%">12%</SelectItem>
                          <SelectItem value="18%">18%</SelectItem>
                          <SelectItem value="28%">28%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-700">Pkg/Fwd Share</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={getPkgTotals(commonPkgAmount, commonPkgGST, selectedRecordIds.length).perItemPkgTotal.toFixed(2)}
                        readOnly
                        className="bg-indigo-50/20 border-indigo-100 text-indigo-950 font-bold cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${recordId}-totalWithTax`} className="text-xs font-semibold text-slate-700">
                        Total With Tax <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`${recordId}-totalWithTax`}
                        type="number"
                        step="0.01"
                        value={(
                          (parseFloat(data.totalWithTax) || 0) +
                          getPkgTotals(commonPkgAmount, commonPkgGST, selectedRecordIds.length).perItemPkgTotal
                        ).toFixed(2)}
                        readOnly
                        className="bg-indigo-50/30 border-indigo-100 text-indigo-950 font-bold cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${recordId}-hsn`} className="text-xs font-semibold text-slate-700">
                        HSN <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`${recordId}-hsn`}
                        value={data.hsn || ""}
                        onChange={(e) =>
                          setBulkFormData((prev) => ({
                            ...prev,
                            [recordId]: { ...prev[recordId], hsn: e.target.value },
                          }))
                        }
                        required
                        placeholder="HSN Code"
                        className="border-indigo-150 focus-visible:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* SHARED PO COPY - AT BOTTOM */}
            <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/15 shadow-2xs">
              <div className="space-y-2">
                <Label className="text-sm font-bold text-indigo-950 uppercase tracking-wider">
                  PO Copy <span className="text-red-500">*</span>
                  <span className="text-xs font-normal text-slate-500 ml-2">(applies to all items)</span>
                </Label>
                <div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => handleCommonFileChange(e.target.files?.[0] || null)}
                    className="hidden"
                    id="common-file"
                  />
                  <label
                    htmlFor="common-file"
                    className="flex items-center justify-center w-full p-4 border-2 border-dashed border-indigo-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/10 transition-all rounded-xl cursor-pointer text-indigo-900 font-bold text-sm"
                  >
                    <Upload className="w-4 h-4 mr-2 text-indigo-600" />
                    Upload PO copy
                  </label>
                  {commonPOCopy && (
                    <div className="mt-2 p-2 bg-white border border-indigo-100 rounded-xl flex items-center justify-between text-sm text-indigo-950 font-medium shadow-2xs">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-650" />
                        <span>{commonPOCopy?.name}</span>
                        <span className="text-slate-500 font-medium">
                          ({commonPOCopy ? (commonPOCopy.size / 1024).toFixed(1) : 0} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCommonFileRemove}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>

          <DialogFooter className="flex-shrink-0 border-t border-indigo-100 p-4 gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-indigo-100 hover:bg-indigo-50/50 hover:text-indigo-600">
              Cancel
            </Button>
            <Button
              onClick={handleBulkSubmit}
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold shadow-md shadow-indigo-200 px-6 py-2.5 h-auto rounded-lg"
              disabled={
                isSubmitting ||
                selectedRecordIds.length === 0 ||
                !commonPONumber.trim() ||
                !commonPOCopy ||
                !selectedRecordIds.every((id) => {
                  const d = bulkFormData[id];
                  return d?.basicValue && d?.totalWithTax && d?.hsn && d?.gst;
                })
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating POs...
                </>
              ) : (
                `Create ${selectedRecordIds.length} PO${selectedRecordIds.length > 1 ? "s" : ""}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin: Edit History PO group modal — every indent under this PO Number, same
          shape as the Bulk PO creation form above. */}
      <Dialog open={openEditModal} onOpenChange={setOpenEditModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-xl border border-indigo-150">
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-6 py-4 flex flex-col gap-1 flex-shrink-0">
            <DialogTitle className="text-white text-lg font-bold">
              Edit PO {editGroupPoNumber} ({editGroupItems.length} item{editGroupItems.length === 1 ? "" : "s"})
            </DialogTitle>
            <p className="text-slate-400 text-xs">Every indent under this PO Number — Basic Value edits also update Update-3-Vendors' rate</p>
          </div>

          {isLoadingEditGroup ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
              <p className="font-medium">Loading PO group...</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-6 p-6">
                {/* SHARED PACKAGING/FORWARDING SECTION */}
                <div className="border border-indigo-100 rounded-xl p-4 bg-amber-50/15 shadow-2xs">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-indigo-950 uppercase tracking-wider">
                      Packaging / Forwarding
                      <span className="text-xs font-normal text-slate-500 ml-2">(applies to all items, divided equally)</span>
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700">Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editGroupPkgAmount}
                          onChange={(e) => setEditGroupPkgAmount(e.target.value)}
                          placeholder="0.00"
                          className="bg-white border-indigo-150 focus-visible:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700">GST on Packaging</Label>
                        <Select value={editGroupPkgGST} onValueChange={setEditGroupPkgGST}>
                          <SelectTrigger className="bg-white border-indigo-150 focus-visible:ring-indigo-500">
                            <SelectValue placeholder="Select GST" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0%">0%</SelectItem>
                            <SelectItem value="5%">5%</SelectItem>
                            <SelectItem value="12%">12%</SelectItem>
                            <SelectItem value="18%">18%</SelectItem>
                            <SelectItem value="28%">28%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700">Total Packaging / Forwarding</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={getPkgTotals(editGroupPkgAmount, editGroupPkgGST, editGroupItems.length || 1).totalPkg.toFixed(2)}
                          readOnly
                          className="bg-indigo-50/30 border-indigo-100 text-indigo-950 font-bold cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* PER-ITEM SECTIONS */}
                {editGroupItems.map((item) => (
                  <div key={item.indentNo} className="border border-indigo-100 rounded-xl p-4 bg-white shadow-2xs">
                    <div className="mb-4 pb-3 border-b border-indigo-50/80">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div><strong className="text-indigo-950">Indent-No:</strong> <span className="font-bold text-indigo-950">{item.indentNo}</span></div>
                        <div><strong className="text-indigo-950">Item:</strong> <span className="font-bold text-indigo-950">{item.itemName}</span></div>
                        <div><strong className="text-indigo-950">Qty:</strong> <span className="font-bold text-indigo-950">{item.quantity}</span></div>
                      </div>
                      <div className="mt-1 text-xs text-slate-550">
                        Vendor: <span className="font-bold text-indigo-950">{item.vendorName}</span>
                        {" | "}Current Rate: <span className="font-bold text-slate-700">₹{item.vendorRate ?? "-"}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700">
                          Basic Value <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.basicValue}
                          onChange={(e) => updateEditGroupItem(item.indentNo, "basicValue", e.target.value)}
                          className="border-indigo-150 focus-visible:ring-indigo-500"
                        />
                        <p className="text-[10px] text-slate-500">
                          New rate: ₹{item.quantity > 0 ? ((parseFloat(item.basicValue) || 0) / item.quantity).toFixed(2) : "-"}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700">
                          GST <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={item.gst}
                          onValueChange={(val) => updateEditGroupItem(item.indentNo, "gst", val)}
                        >
                          <SelectTrigger className="border-indigo-150 focus:ring-indigo-500">
                            <SelectValue placeholder="Select GST" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5%">5%</SelectItem>
                            <SelectItem value="12%">12%</SelectItem>
                            <SelectItem value="18%">18%</SelectItem>
                            <SelectItem value="28%">28%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700">Pkg/Fwd Share</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={getPkgTotals(editGroupPkgAmount, editGroupPkgGST, editGroupItems.length || 1).perItemPkgTotal.toFixed(2)}
                          readOnly
                          className="bg-indigo-50/20 border-indigo-100 text-indigo-950 font-bold cursor-not-allowed"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700">Total With Tax</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={previewTotalWithTax(item.basicValue, item.gst).toFixed(2)}
                          readOnly
                          className="bg-indigo-50/30 border-indigo-100 text-indigo-950 font-bold cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* SHARED PO COPY */}
                <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/15 shadow-2xs">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-indigo-950 uppercase tracking-wider">
                      PO Copy
                      <span className="text-xs font-normal text-slate-500 ml-2">(applies to all items)</span>
                    </Label>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => setEditGroupPoCopy(e.target.files?.[0] || editGroupPoCopy)}
                      className="h-9 text-sm bg-white"
                    />
                    {typeof editGroupPoCopy === "string" && editGroupPoCopy && (
                      <a href={editGroupPoCopy} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">
                        View current PO Copy
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-shrink-0 border-t border-indigo-100 p-4 gap-2">
                <Button type="button" variant="outline" onClick={() => setOpenEditModal(false)} disabled={isSavingEdit}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEditGroupHistory}
                  disabled={
                    isSavingEdit ||
                    editGroupItems.some((it) => !it.basicValue || !it.gst)
                  }
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <BackgroundSyncBanner visible={isSavingEdit} />
    </div>
  );
}
