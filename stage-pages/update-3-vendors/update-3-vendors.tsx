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
  getFmsTimestamp
} from "@/lib/utils";
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

  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  const pending = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return sheetRecords.filter((r) => {
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
  }, [sheetRecords, searchTerm]);

  const completed = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return sheetRecords.filter((r) => {
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
  }, [sheetRecords, searchTerm]);

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

  const isThirdParty = true;
  const numVendors = 3;

  const baseColumns = [
    { header: "Indent", accessorKey: "indentNumber" },
    { header: "Created By", accessorKey: "createdBy" },
    { header: "Category", accessorKey: "category" },
    { header: "Item", accessorKey: "itemName" },
    { header: "Qty", accessorKey: "quantity" },
    { header: "Warehouse", accessorKey: "warehouseLocation" },
    { header: "Item Code", accessorKey: "itemCode" },
    { header: "Lead Time", accessorKey: "leadTime" },
    { header: "Planned", accessorKey: "planned2" },
    { header: "Actual", accessorKey: "actual2" },

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

  const checkAndSaveNewVendors = useCallback(async (names: string[]) => {
    if (names.length === 0) return;

    const newVendors: string[] = [];
    names.forEach(name => {
      if (!name) return;
      const exists = vendorList.some(v => v.toLowerCase() === name.toLowerCase());
      const alreadyQueued = newVendors.some(v => v.toLowerCase() === name.toLowerCase());
      if (!exists && !alreadyQueued) {
        newVendors.push(name);
      }
    });

    if (newVendors.length > 0) {
      setVendorList(prev => [...prev, ...newVendors]);

      try {
        await fetch("/api/update-3-vendors", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "saveNewVendors",
            names: newVendors
          }),
        });
      } catch (e) {
        console.error("Failed to save new vendors:", e);
      }
    }
  }, [vendorList]);

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
      const vendorsToCheck = [
        submissionData.vendor1Name,
        submissionData.vendor2Name,
        submissionData.vendor3Name
      ].filter(Boolean);
      checkAndSaveNewVendors(vendorsToCheck);

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
  }, [selectedIds, selectedRecord, currentRecord, formData, bulkVendorData, moveToNextStage, updateRecord, checkAndSaveNewVendors, isThirdParty]);

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
        <Button variant="outline" className="w-40 justify-start">
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
      <div className="mb-6 p-6 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-lg shadow-slate-100 shadow-xl text-white">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage 3: Vendor Quotation</h2>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by Indent No, Item Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            <div className="h-8 w-px bg-slate-200 hidden md:block" />
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium hidden md:inline-block">Show Columns:</Label>
              <ColumnSelector />
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 mb-6 flex items-center justify-between">
          <TabsList className="bg-slate-100/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1 border border-slate-200/50 w-[400px]">
            <TabsTrigger
              value="pending"
              className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm flex items-center gap-3 transition-all"
            >
              <ClipboardList className="w-5 h-5" />
              <div className="flex flex-col items-start leading-none gap-1">
                <span className="font-bold">Pending</span>
                <span className="text-[10px] opacity-70">Awaiting processing</span>
              </div>
              <Badge variant="secondary" className="bg-slate-100 text-black border-slate-200 px-2">
                {pending.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm flex items-center gap-3 transition-all"
            >
              <History className="w-5 h-5" />
              <div className="flex flex-col items-start leading-none gap-1">
                <span className="font-bold">History</span>
                <span className="text-[10px] opacity-70">Completed</span>
              </div>
              <Badge variant="secondary" className="bg-slate-100 text-black border-slate-200 px-2">
                {completed.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {selectedIds.size > 0 && activeTab === "pending" && (
            <div className="flex items-center gap-3">
              <Button
                onClick={handleBulkUpdate}
                disabled={isSavingQuantities}
                className="animate-in fade-in zoom-in duration-200 shadow-md shadow-slate-200 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 h-auto text-sm font-bold rounded-lg"
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
            />
          )}
        </TabsContent>
      </Tabs>

      {/* MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Update {numVendors} Vendor{numVendors > 1 ? "s" : ""}</DialogTitle>
            <p className="text-sm text-gray-600">
              {isThirdParty
                ? "Enter details for 3 different vendors"
                : "Enter details for the selected vendor"}
            </p>
            {selectedIds.size > 1 && (
              <div className="mt-2 text-sm font-medium text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                Updating {selectedIds.size} records. The same vendor details will be applied to all selected items.
              </div>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* Item Summary */}
            <div className="border rounded-lg p-4 bg-gray-50 max-h-60 overflow-y-auto">
              <h3 className="font-medium mb-3">Item Details</h3>
              <div className="space-y-4">
                {(selectedIds.size > 0
                  ? Array.from(selectedIds)
                    .map((id) => sheetRecords.find((r) => r.id === id))
                    .filter(Boolean)
                  : currentRecord
                    ? [currentRecord]
                    : []
                ).map((record: any, idx) => (
                  <div key={record.id || idx} className="grid grid-cols-4 gap-4 text-sm pb-4 border-b border-gray-200 last:border-0 last:pb-0">
                    <div>
                      <span className="font-medium text-gray-500">Indent #:</span>
                      <p className="font-medium">{record?.data?.indentNumber || "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Item:</span>
                      <p className="font-medium">{record?.data?.itemName || "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Quantity:</span>
                      <p className="font-medium">{record?.data?.quantity || "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Warehouse:</span>
                      <p className="font-medium">{record?.data?.warehouseLocation || "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Created By:</span>
                      <p className="font-medium">{record?.data?.createdBy || "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Category:</span>
                      <p className="font-medium">{record?.data?.category || "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Lead Time:</span>
                      <p className="font-medium">{record?.data?.leadTime ? `${record.data.leadTime} days` : "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Item Code:</span>
                      <p className="font-medium">{record?.data?.itemCode || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vendor Forms */}
            {Array.from({ length: numVendors }, (_, i) => i + 1).map((num) => {
              return (
                <div key={num} className="border rounded-lg p-4">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
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
                              <div
                                className="px-3 py-2 text-sm text-blue-600 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  const newVal = getVendorSearchState(num).search;
                                  setFormData({ ...formData, [`vendor${num}Name`]: newVal });
                                  const { setSearch, setShow } = getVendorSearchState(num);
                                  setSearch(newVal);
                                  setShow(false);
                                }}
                              >
                                <span className="font-semibold">+ Create "{getVendorSearchState(num).search}"</span>
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
                        className="flex items-center justify-center w-full p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-gray-400"
                      >
                        <Upload className="w-5 h-5 mr-2 text-gray-500" />
                        <span className="text-sm">Click to upload</span>
                      </label>

                      {formData[`vendor${num}Attachment` as keyof typeof formData] && (
                        <div className="mt-2 p-2 bg-gray-50 border rounded flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            <span>
                              {(formData[`vendor${num}Attachment` as keyof typeof formData] as File).name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleFileRemove(num)}
                            className="text-red-600 hover:text-red-800"
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
              <span className="font-medium">Vendors Filled:</span>
              <div className="flex gap-1">
                {Array.from({ length: 3 }, (_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full transition-colors ${i < vendorCount ? "bg-green-600" : "bg-gray-300"
                      }`}
                  />
                ))}
              </div>
              <span className="font-medium">{vendorCount} / {numVendors}</span>
            </div>

            {submitError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm font-medium">
                ⚠️ {submitError}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <Button type="submit">
                Submit {numVendors} Vendor{numVendors > 1 ? "s" : ""}
              </Button>
            </div>
          </form>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
