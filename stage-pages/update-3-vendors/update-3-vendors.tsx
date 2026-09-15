"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useWorkflow } from "@/lib/workflow-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  FileText,
  Upload,
  X,
  Loader2,
  ClipboardList,
  History,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import {
  formatDate,
  parseSheetDate,
  getFmsTimestamp,
  cn,
  sortByIndentNumber,
  canViewPurchaserRecord
} from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import BackgroundSyncBanner from "@/components/background-sync-banner";
import Update3VendorsPending from "./update-3-vendors-pending";
import Update3VendorsHistory from "./update-3-vendors-history";

const fuzzyFilter = (list: string[], search: string): string[] => {
  if (!search.trim()) return list.slice(0, 50);
  const normalizedSearch = search.toLowerCase().replace(/\s+/g, "");
  return list
    .filter((item) => item.toLowerCase().replace(/\s+/g, "").includes(normalizedSearch))
    .slice(0, 50);
};

export default function Stage3() {
  const {
    moveToNextStage,
    updateRecord,
  } = useWorkflow();
  const { role, records: recordsAccess } = useAuth();
  const isAdmin = role?.toUpperCase() === "ADMIN";

  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Admin-only History edit modal
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editFormData, setEditFormData] = useState({
    vendor1Name: "", vendor1Rate: "", vendor1Terms: "",
    vendor2Name: "", vendor2Rate: "", vendor2Terms: "",
    vendor3Name: "", vendor3Rate: "", vendor3Terms: "",
  });

  const [open, setOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentRecord, setCurrentRecord] = useState<any>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editedQuantities, setEditedQuantities] = useState<Record<string, string>>({});
  const [isSavingQuantities, setIsSavingQuantities] = useState(false);

  // Vendor list fetched from Dropdown sheet
  const [vendorList, setVendorList] = useState<string[]>([]);
  // Search state for each vendor combobox
  const [vendorSearch1, setVendorSearch1] = useState("");
  const [vendorSearch2, setVendorSearch2] = useState("");
  const [vendorSearch3, setVendorSearch3] = useState("");
  const [showVendorDropdown1, setShowVendorDropdown1] = useState(false);
  const [showVendorDropdown2, setShowVendorDropdown2] = useState(false);
  const [showVendorDropdown3, setShowVendorDropdown3] = useState(false);
  // Payment Terms
  const [paymentTermsList, setPaymentTermsList] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    vendor1Name: "",
    vendor1Rate: "",
    vendor1Terms: "",
    vendor1DeliveryDate: "",
    vendor1Attachment: null as File | null,
    vendor2Name: "",
    vendor2Rate: "",
    vendor2Terms: "",
    vendor2DeliveryDate: "",
    vendor2Attachment: null as File | null,
    vendor3Name: "",
    vendor3Rate: "",
    vendor3Terms: "",
    vendor3DeliveryDate: "",
    vendor3Attachment: null as File | null,
  });

  const [bulkVendorData, setBulkVendorData] = useState<
    Record<number, Record<string, { rate: string; terms: string; deliveryDate: string }>>
  >({ 1: {}, 2: {}, 3: {} });

  const handleBulkVendorChange = (vendorNum: number, recordId: string, field: "rate" | "terms" | "deliveryDate", value: string) => {
    setBulkVendorData((prev) => ({
      ...prev,
      [vendorNum]: {
        ...prev[vendorNum],
        [recordId]: {
          ...(prev[vendorNum]?.[recordId] || { rate: "", terms: "", deliveryDate: "" }),
          [field]: value,
        },
      },
    }));
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [indentFilter, setIndentFilter] = useState<"no_filter" | "increasing" | "decreasing">("no_filter");

  // Purchaser-based record access: only show records this user is allowed to see.
  const visibleRecords = useMemo(
    () => sheetRecords.filter((r) => canViewPurchaserRecord(r.data?.purchaser, recordsAccess, role)),
    [sheetRecords, recordsAccess, role]
  );

  const pending = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    const records = visibleRecords.filter((r) => {
      if (r.status !== "pending") return false;
      if (!lower) return true;
      return (
        r.data.indentNumber?.toLowerCase().includes(lower) ||
        r.data.itemName?.toLowerCase().includes(lower) ||
        r.data.vendor1Name?.toLowerCase().includes(lower) ||
        r.data.vendor2Name?.toLowerCase().includes(lower) ||
        r.data.vendor3Name?.toLowerCase().includes(lower) ||
        r.data.vendorType?.toLowerCase().includes(lower) ||
        String(r.data.poNumber || "").toLowerCase().includes(lower)
      );
    });

    return sortByIndentNumber(records, indentFilter === "decreasing" ? "desc" : "asc");
  }, [visibleRecords, searchTerm, indentFilter]);

  const completed = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    const records = visibleRecords.filter((r) => {
      if (r.status !== "completed") return false;
      if (!lower) return true;
      return (
        r.data.indentNumber?.toLowerCase().includes(lower) ||
        r.data.itemName?.toLowerCase().includes(lower) ||
        r.data.vendor1Name?.toLowerCase().includes(lower) ||
        r.data.vendor2Name?.toLowerCase().includes(lower) ||
        r.data.vendor3Name?.toLowerCase().includes(lower) ||
        r.data.vendorType?.toLowerCase().includes(lower) ||
        String(r.data.poNumber || "").toLowerCase().includes(lower)
      );
    });

    return sortByIndentNumber(records, indentFilter === "decreasing" ? "desc" : "asc");
  }, [visibleRecords, searchTerm, indentFilter]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/update-3-vendors?_t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSheetRecords(json.data);
      }

      const dropRes = await fetch("/api/dropdowns");
      if (dropRes.ok) {
        const dropJson = await dropRes.json();
        if (dropJson.success && dropJson.data) {
          setVendorList(dropJson.data.vendorListOptions || []);
          setPaymentTermsList(dropJson.data.paymentTermsOptions || []);
        }
      }
    } catch (e: any) {
      console.error("Stage 3 Fetch error details:", e.message || e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ---- Admin: edit a completed History record ----
  const handleOpenEditHistory = useCallback((record: any) => {
    setEditingRecord(record);
    setEditFormData({
      vendor1Name: record.data.vendor1Name || "",
      vendor1Rate: record.data.vendor1Rate || "",
      vendor1Terms: record.data.vendor1Terms || "",
      vendor2Name: record.data.vendor2Name || "",
      vendor2Rate: record.data.vendor2Rate || "",
      vendor2Terms: record.data.vendor2Terms || "",
      vendor3Name: record.data.vendor3Name || "",
      vendor3Rate: record.data.vendor3Rate || "",
      vendor3Terms: record.data.vendor3Terms || "",
    });
    setOpenEditModal(true);
  }, []);

  const handleSaveEditHistory = useCallback(async () => {
    if (!editingRecord) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch("/api/update-3-vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "editHistory",
          indentNo: editingRecord.data.indentNumber,
          ...editFormData,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to save changes");

      toast.success("Record updated — related PO Entry values (if any) have been synced.");
      setOpenEditModal(false);
      setEditingRecord(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save changes");
    } finally {
      setIsSavingEdit(false);
    }
  }, [editingRecord, editFormData]);

  const isThirdParty = true;
  const numVendors = 3;

  const baseColumns = [
    { header: "Indent", accessorKey: "indentNumber" },
    { header: "Planned", accessorKey: "planned2" },
    { header: "Actual", accessorKey: "actual2" },
    { header: "Delay", accessorKey: "delay2" },
    { header: "Created By", accessorKey: "createdBy" },
    { header: "Category", accessorKey: "category" },
    { header: "Item", accessorKey: "itemName" },
    { header: "Qty", accessorKey: "quantity" },
    { header: "Warehouse", accessorKey: "warehouseLocation" },
    { header: "Item Code", accessorKey: "itemCode" },
    { header: "Lead Time", accessorKey: "leadTime" },

    { header: "Status", accessorKey: "status" },
    { header: "Approved Qty", accessorKey: "approvedQty" },
    { header: "Vendor Type", accessorKey: "vendorType" },
    { header: "Remarks", accessorKey: "remarks" },
    { header: "Attachment", accessorKey: "img", cell: (info: any) => info.getValue() ? <a href={info.getValue()} target="_blank" className="text-blue-500 underline">View</a> : "-" },
  ];

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    baseColumns.map((c) => c.accessorKey)
  );

  const getVendorSearchState = useCallback((num: number) => {
    if (num === 1) return { search: vendorSearch1, setSearch: setVendorSearch1, show: showVendorDropdown1, setShow: setShowVendorDropdown1 };
    if (num === 2) return { search: vendorSearch2, setSearch: setVendorSearch2, show: showVendorDropdown2, setShow: setShowVendorDropdown2 };
    return { search: vendorSearch3, setSearch: setVendorSearch3, show: showVendorDropdown3, setShow: setShowVendorDropdown3 };
  }, [vendorSearch1, vendorSearch2, vendorSearch3, showVendorDropdown1, showVendorDropdown2, showVendorDropdown3]);

  // Vendor selection is restricted to existing Vendor Master entries (see the vendor-name
  // suggestion dropdown above) — there is no longer an inline "create new vendor" path here.
  // New vendors must be added by an admin on the Master page, where addVendor/updateVendor
  // run the duplicate-name/code check.
  // (Removed: checkAndSaveNewVendors / the "saveNewVendors" call it made.)

  const resetForm = useCallback(() => {
    setOpen(false);
    setSelectedRecord(null);
    setCurrentRecord(null);
    setSubmitError(null);
    setFormData({
      vendor1Name: "", vendor1Rate: "", vendor1Terms: "", vendor1DeliveryDate: "", vendor1Attachment: null,
      vendor2Name: "", vendor2Rate: "", vendor2Terms: "", vendor2DeliveryDate: "", vendor2Attachment: null,
      vendor3Name: "", vendor3Rate: "", vendor3Terms: "", vendor3DeliveryDate: "", vendor3Attachment: null,
    });
    setBulkVendorData({ 1: {}, 2: {}, 3: {} });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!selectedRecord && selectedIds.size === 0) || !currentRecord) return;

    const submissionData = { ...formData };

    resetForm();

    const submitPromise = (async () => {
      const vendorImageUrls: string[] = ["", "", ""];

      for (let i = 1; i <= numVendors; i++) {
        const attachment = submissionData[`vendor${i}Attachment` as keyof typeof submissionData];

        if (attachment instanceof File) {
          try {
            const fileData = new FormData();
            fileData.append("file", attachment);
            fileData.append("folder", "vendors");

            const uploadRes = await fetch("/api/upload-supabase", {
              method: "POST",
              body: fileData
            });

            if (!uploadRes.ok) throw new Error(`Upload failed with status ${uploadRes.status}`);
            const uploadJson = await uploadRes.json();

            if (uploadJson.success && uploadJson.url) {
              vendorImageUrls[i - 1] = uploadJson.url;
            } else {
              throw new Error(uploadJson.error || "Upload failed");
            }
          } catch (err: any) {
            console.error(`Vendor ${i} upload error:`, err);
            throw new Error(`Vendor ${i} attachment error: ${err.message}`);
          }
        } else if (typeof attachment === 'string') {
          vendorImageUrls[i - 1] = attachment;
        }
      }

      const idsToProcess = selectedIds.size > 0 ? Array.from(selectedIds) : (selectedRecord ? [selectedRecord] : []);

      if (idsToProcess.length === 0) throw new Error("No records selected for update");

      const res = await fetch("/api/update-3-vendors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "insertVendors",
          idsToProcess,
          submissionData,
          bulkVendorData,
          vendorImageUrls
        })
      });

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to update vendors");
      }

      idsToProcess.forEach(id => {
        updateRecord(id, { ...submissionData });
        moveToNextStage(id);
        if (!isThirdParty) moveToNextStage(id);
      });

      await fetchData();
      setSelectedIds(new Set());

      return { success: true };
    })();

    toast.promise(submitPromise, {
      loading: `Saving Vendor details for ${selectedIds.size || 1} record(s)...`,
      success: "Vendor details saved successfully!",
      error: (err) => `Failed to save: ${err.message}`,
    });
  }, [selectedIds, selectedRecord, currentRecord, formData, bulkVendorData, moveToNextStage, updateRecord, isThirdParty]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = pending.length > 0 && pending.every((r) => prev.has(r.id));
      if (allSelected) return new Set();
      const next = new Set(prev);
      pending.forEach((r) => next.add(r.id));
      return next;
    });
  }, [pending]);

  // Quantities managed via database APIs

  const handleBulkUpdate = useCallback(() => {
    if (selectedIds.size === 0) return;
    setOpen(true);
    const firstId = Array.from(selectedIds)[0];
    const rec = sheetRecords.find((r) => r.id === firstId);
    if (rec) setCurrentRecord(rec);
  }, [selectedIds, sheetRecords]);

  const vendorCount = useMemo(() => {
    let filled = 0;
    for (let i = 1; i <= numVendors; i++) {
      if (formData[`vendor${i}Name` as keyof typeof formData]) filled++;
    }
    return filled;
  }, [formData, numVendors]);

  const handleFileRemove = useCallback((n: number) => {
    setFormData((prev) => ({ ...prev, [`vendor${n}Attachment`]: null }));
  }, []);

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
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Checkbox
              checked={selectedColumns.length === baseColumns.length}
              onCheckedChange={(c) => {
                if (c) setSelectedColumns(baseColumns.map((col) => col.accessorKey));
                else setSelectedColumns([]);
              }}
            />
            <Label className="text-sm font-medium">All Columns</Label>
          </div>
          {baseColumns.map((col) => (
            <div key={col.accessorKey} className="flex items-center space-x-2 py-1">
              <Checkbox
                checked={selectedColumns.includes(col.accessorKey)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedColumns((prev) => [...prev, col.accessorKey]);
                  } else {
                    setSelectedColumns((prev) => prev.filter((c) => c !== col.accessorKey));
                  }
                }}
              />
              <Label className="text-sm">{col.header}</Label>
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
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-indigo-950 tracking-tight">Stage 3: Vendor Quotation</h2>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-indigo-500" />
              <Input
                placeholder="Search by Indent No, Item Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border-indigo-100 focus-visible:ring-indigo-500"
              />
            </div>
            <div className="h-8 w-px bg-indigo-100/60 hidden md:block" />
            <div className="flex items-center gap-2">
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
                  {completed.length}
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

          {selectedIds.size > 0 && activeTab === "pending" && (
            <div className="flex items-center gap-3">
              <Button
                onClick={handleBulkUpdate}
                disabled={isSavingQuantities}
                className="animate-in fade-in zoom-in duration-200 shadow-md shadow-green-100 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white px-6 py-3 h-auto text-sm font-bold rounded-lg"
              >
                Update Vendor ({selectedIds.size})
              </Button>
            </div>
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
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No records found</p>
            </div>
          ) : (
            <Update3VendorsPending
              pending={pending}
              selectedIds={selectedIds}
              toggleSelection={toggleSelection}
              toggleSelectAll={toggleSelectAll}
              selectedColumns={selectedColumns}
              baseColumns={baseColumns}
              editedQuantities={editedQuantities}
              setEditedQuantities={setEditedQuantities}
            />
          )}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="mt-0 flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading History...</p>
              <p className="text-sm text-gray-500 mt-1">Fetching completed records</p>
            </div>
          ) : completed.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-white border rounded-lg">
              <p className="text-lg">No completed records</p>
            </div>
          ) : (
            <Update3VendorsHistory
              completed={completed}
              selectedColumns={selectedColumns}
              baseColumns={baseColumns}
              isAdmin={isAdmin}
              onEdit={handleOpenEditHistory}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-xl border border-indigo-150">
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-6 py-4 flex flex-col gap-1 flex-shrink-0">
            <DialogTitle className="text-white text-lg font-bold">Update {numVendors} Vendor{numVendors > 1 ? "s" : ""}</DialogTitle>
            <p className="text-slate-400 text-xs">
              {isThirdParty
                ? "Enter details for 3 different vendors"
                : "Enter details for the selected vendor"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6 p-6">
            {selectedIds.size > 1 && (
              <div className="text-xs font-semibold text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                ⚠️ Updating {selectedIds.size} records. The same vendor details will be applied to all selected items.
              </div>
            )}

            {/* Item Summary */}
            <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/15 max-h-60 overflow-y-auto shadow-2xs">
              <h3 className="font-bold text-indigo-950 mb-3 uppercase tracking-wider text-xs">Item Details</h3>
              <div className="space-y-4">
                {(selectedIds.size > 0
                  ? Array.from(selectedIds)
                    .map((id) => sheetRecords.find((r) => r.id === id))
                    .filter(Boolean)
                  : currentRecord
                    ? [currentRecord]
                    : []
                ).map((record: any, idx) => (
                  <div key={record.id || idx} className="grid grid-cols-4 gap-4 text-sm pb-4 border-b border-indigo-50/80 last:border-0 last:pb-0">
                    <div>
                      <span className="font-semibold text-indigo-950/70 text-xs">Indent #:</span>
                      <p className="font-bold text-indigo-950 text-sm">{record?.data?.indentNumber || "—"}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-indigo-950/70 text-xs">Item:</span>
                      <p className="font-bold text-indigo-950 text-sm">{record?.data?.itemName || "—"}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-indigo-950/70 text-xs">Quantity:</span>
                      <p className="font-bold text-indigo-950 text-sm">{record?.data?.quantity || "—"}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-indigo-950/70 text-xs">Warehouse:</span>
                      <p className="font-bold text-indigo-950 text-sm">{record?.data?.warehouseLocation || "—"}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-indigo-950/70 text-xs">Created By:</span>
                      <p className="font-bold text-indigo-950 text-sm">{record?.data?.createdBy || "—"}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-indigo-950/70 text-xs">Category:</span>
                      <p className="font-bold text-indigo-950 text-sm">{record?.data?.category || "—"}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-indigo-950/70 text-xs">Lead Time:</span>
                      <p className="font-bold text-indigo-950 text-sm">{record?.data?.leadTime ? `${record.data.leadTime} days` : "—"}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-indigo-950/70 text-xs">Item Code:</span>
                      <p className="font-bold text-indigo-950 text-sm">{record?.data?.itemCode || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vendor Forms */}
            {Array.from({ length: numVendors }, (_, i) => i + 1).map((num) => {
              return (
                <div key={num} className="border border-indigo-100 rounded-xl p-4 bg-white shadow-2xs">
                  <h3 className="font-bold text-indigo-950 mb-4 flex items-center gap-2 uppercase tracking-wider text-xs">
                    <Building2 className="w-5 h-5 text-indigo-650" />
                    Vendor {num}
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`vendor${num}Name`}>
                        Vendor Name {num === 1 && <span className="text-red-500">*</span>}
                      </Label>
                      <div className="relative">
                        <Input
                          id={`vendor${num}Name`}
                          placeholder="Type to search vendor..."
                          value={getVendorSearchState(num).search || (formData[`vendor${num}Name` as keyof typeof formData] as string) || ""}
                          onChange={(e) => {
                            const { setSearch, setShow } = getVendorSearchState(num);
                            setSearch(e.target.value);
                            setShow(true);
                            setFormData({ ...formData, [`vendor${num}Name`]: e.target.value });
                          }}
                          onFocus={() => {
                            const { setShow } = getVendorSearchState(num);
                            setShow(true);
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              const { setShow } = getVendorSearchState(num);
                              setShow(false);
                            }, 200);
                          }}
                          autoComplete="off"
                          required={num === 1}
                        />
                        {getVendorSearchState(num).show && (
                          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {fuzzyFilter(vendorList, getVendorSearchState(num).search).length > 0 ? (
                              fuzzyFilter(vendorList, getVendorSearchState(num).search).map((v) => (
                                <div
                                  key={v}
                                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setFormData({ ...formData, [`vendor${num}Name`]: v });
                                    const { setSearch, setShow } = getVendorSearchState(num);
                                    setSearch(v);
                                    setShow(false);
                                  }}
                                >
                                  {v}
                                </div>
                              ))
                            ) : (
                              // Selection is restricted to existing Vendor Master entries — no
                              // inline "create new" here. A missing vendor has to be added by an
                              // admin on the Master page first (where it goes through the
                              // duplicate-name/code check), so negotiations never carry a
                              // typo'd or unregistered vendor name.
                              <div className="px-3 py-2 text-xs text-slate-500">
                                No matching vendor. Ask an admin to add it under Master &rarr; Vendors first.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedIds.size <= 1 && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor={`vendor${num}Rate`}>
                            Rate per Qty
                          </Label>
                          <Input
                            id={`vendor${num}Rate`}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={(formData[`vendor${num}Rate` as keyof typeof formData] as string) || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, [`vendor${num}Rate`]: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`vendor${num}Terms`}>
                            Payment Terms
                          </Label>
                          <Select
                            value={(formData[`vendor${num}Terms` as keyof typeof formData] as string) || ""}
                            onValueChange={(v) =>
                              setFormData({ ...formData, [`vendor${num}Terms`]: v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select terms" />
                            </SelectTrigger>
                            <SelectContent>
                              {paymentTermsList.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`vendor${num}DeliveryDate`}>
                            Expected Delivery
                          </Label>
                          <Input
                            id={`vendor${num}DeliveryDate`}
                            type="date"
                            value={(formData[`vendor${num}DeliveryDate` as keyof typeof formData] as string) || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, [`vendor${num}DeliveryDate`]: e.target.value })
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {selectedIds.size > 1 && (
                    <div className="mt-4 border rounded-lg overflow-x-auto">
                      <Table className="text-sm">
                        <TableHeader className="bg-slate-50 border-b">
                          <TableRow>
                            <TableHead className="min-w-[100px] h-10 py-2">Indent</TableHead>
                            <TableHead className="min-w-[150px] h-10 py-2">Item</TableHead>
                            <TableHead className="min-w-[120px] h-10 py-2">Rate per Qty</TableHead>
                            <TableHead className="min-w-[150px] h-10 py-2">Payment Terms</TableHead>
                            <TableHead className="min-w-[140px] h-10 py-2">Exp. Delivery</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Array.from(selectedIds).map(id => {
                            const rec = sheetRecords.find(r => r.id === id);
                            const bData = bulkVendorData[num]?.[id] || { rate: "", terms: "", deliveryDate: "" };

                            return (
                              <TableRow key={id}>
                                <TableCell className="font-medium whitespace-nowrap py-2">{rec?.data?.indentNumber || "—"}</TableCell>
                                <TableCell className="max-w-[150px] truncate py-2" title={rec?.data?.itemName}>{rec?.data?.itemName || "—"}</TableCell>
                                <TableCell className="py-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={bData.rate}
                                    onChange={(e) => handleBulkVendorChange(num, id, "rate", e.target.value)}
                                    className="h-8 shadow-none"
                                  />
                                </TableCell>
                                <TableCell className="py-2">
                                  <Select
                                    value={bData.terms}
                                    onValueChange={(v) => handleBulkVendorChange(num, id, "terms", v)}
                                  >
                                    <SelectTrigger className="h-8 text-xs shadow-none">
                                      <SelectValue placeholder="Select terms" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {paymentTermsList.map((t) => (
                                        <SelectItem key={t} value={t} className="text-xs">
                                          {t}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="py-2">
                                  <Input
                                    type="date"
                                    value={bData.deliveryDate}
                                    onChange={(e) => handleBulkVendorChange(num, id, "deliveryDate", e.target.value)}
                                    className="h-8 text-xs px-2 shadow-none"
                                  />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <div className="mt-4 space-y-2">
                    <Label>Attachment</Label>
                    <div>
                      <input
                        id={`file-${num}`}
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [`vendor${num}Attachment`]: e.target.files?.[0] || null,
                          })
                        }
                        className="hidden"
                      />
                      <label
                        htmlFor={`file-${num}`}
                        className="flex items-center justify-center w-full p-4 border-2 border-dashed border-indigo-200 bg-indigo-50/10 hover:bg-indigo-50/20 hover:border-indigo-400 transition-all rounded-xl cursor-pointer"
                      >
                        <Upload className="w-5 h-5 mr-2 text-indigo-600" />
                        <span className="text-sm font-semibold text-indigo-900">Click to upload</span>
                      </label>

                      {formData[`vendor${num}Attachment` as keyof typeof formData] && (
                        <div className="mt-2 p-2 bg-indigo-50/30 border border-indigo-100 rounded-xl flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-indigo-950">
                            <FileText className="w-4 h-4 text-indigo-600" />
                            <span className="font-medium">
                              {(formData[`vendor${num}Attachment` as keyof typeof formData] as File).name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleFileRemove(num)}
                            className="text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-center gap-3 py-4">
              <span className="font-medium text-slate-700">Vendors Filled:</span>
              <div className="flex gap-1">
                {Array.from({ length: 3 }, (_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full transition-colors ${i < vendorCount ? "bg-green-600" : "bg-gray-300"
                      }`}
                  />
                ))}
              </div>
              <span className="font-bold text-slate-900">{vendorCount} / {numVendors}</span>
            </div>

            {submitError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm font-medium">
                ⚠️ {submitError}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-indigo-100">
              <Button type="submit" className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold px-6 py-2.5 h-auto rounded-lg shadow-md shadow-indigo-200">
                Submit {numVendors} Vendor{numVendors > 1 ? "s" : ""}
              </Button>
            </div>
          </form>

          <DialogFooter className="flex-shrink-0 border-t border-indigo-100 p-4">
            <Button type="button" variant="outline" onClick={resetForm} className="border-indigo-100 hover:bg-indigo-50/50 hover:text-indigo-600">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin: Edit History record modal */}
      <Dialog open={openEditModal} onOpenChange={setOpenEditModal}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-indigo-950">
              Edit Vendor Details — {editingRecord?.data?.indentNumber}
            </DialogTitle>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
              ⚠️ Agar rate change kiya jo Negotiation me select hua vendor hai, to PO Entry ka Basic/Total Value bhi automatically recalculate ho jayega.
            </p>
          </DialogHeader>
          <div className="space-y-5 max-h-[60vh] overflow-y-auto py-2">
            {[1, 2, 3].map((num) => (
              <div key={num} className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/10">
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-3">Vendor {num}</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Vendor Name</Label>
                    <Input
                      value={(editFormData as any)[`vendor${num}Name`]}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, [`vendor${num}Name`]: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Rate</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={(editFormData as any)[`vendor${num}Rate`]}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, [`vendor${num}Rate`]: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Payment Term</Label>
                    <Select
                      value={(editFormData as any)[`vendor${num}Terms`]}
                      onValueChange={(v) => setEditFormData((prev) => ({ ...prev, [`vendor${num}Terms`]: v }))}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {paymentTermsList.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEditModal(false)} disabled={isSavingEdit}>Cancel</Button>
            <Button onClick={handleSaveEditHistory} disabled={isSavingEdit} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BackgroundSyncBanner visible={isSavingEdit} />
    </div>
  );
}
