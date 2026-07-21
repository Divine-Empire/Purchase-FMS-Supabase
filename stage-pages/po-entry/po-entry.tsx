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
import { formatDate, parseSheetDate, getFmsTimestamp } from "@/lib/utils";
import PoEntryPending from "./po-entry-pending";
import PoEntryHistory from "./po-entry-history";

export default function Stage5() {
  const [open, setOpen] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [bulkFormData, setBulkFormData] = useState<Record<string, any>>({});
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/po-entry?_t=${Date.now()}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSheetRecords(json.data);
      }
    } catch (e) {
      console.error("Fetch error Stage 5:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [searchTerm, setSearchTerm] = useState("");

  const pending = useMemo(() => sheetRecords
    .filter((r) => r.status === "pending")
    .filter((r) => {
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
    }), [sheetRecords, searchTerm]);

  const completed = useMemo(() => sheetRecords
    .filter((r) => r.status === "completed")
    .filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      if (!searchLower) return true;
      const selectedId = String(r.data.selectedVendor || "1");
      const idx = parseInt(selectedId.toLowerCase().replace("vendor", "").trim(), 10) || 1;
      const vName = r.data[`vendor${idx}Name`] || "";

      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        vName.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower)
      );
    }), [sheetRecords, searchTerm]);

  const poTotalMap = useMemo(() => {
    const totals = new Map<string, number>();
    completed.forEach(record => {
      const po = record.data.poNumber;
      if (po && po !== "-") {
        const amount = parseFloat(String(record.data.totalWithTax || "0").replace(/[^0-9.]/g, "")) || 0;
        totals.set(po, (totals.get(po) || 0) + amount);
      }
    });
    return totals;
  }, [completed]);

  const baseColumns = [
    { key: "indentNumber", label: "Indent-No", icon: null },
    { key: "itemName", label: "Item", icon: null },
    { key: "quantity", label: "Qty", icon: null },
    { key: "planned4", label: "Planned", icon: null },
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
      const record = sheetRecords.find((r) => r.id === id);
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
      const record = sheetRecords.find((r) => r.id === id);
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
      <div className="mb-6 p-6 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-lg shadow-slate-100 shadow-xl text-white">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage 5: PO Creation</h2>
              </div>
              {submitError && (
                <p className="text-red-600 text-sm mt-2 font-medium bg-red-50 p-2 rounded border border-red-100 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                  {submitError}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by Indent, Item, Vendor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            <div className="h-8 w-px bg-slate-200 mx-2" />
            <div className="flex items-center gap-4">
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

          {selectedRecordIds.length > 0 && activeTab === "pending" && (
            <Button
              onClick={handleOpenBulkForm}
              className="animate-in fade-in zoom-in duration-200 shadow-md shadow-slate-200 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 h-auto text-sm font-bold rounded-lg"
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
          {isLoading ? (
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
            <PoEntryHistory
              completed={completed}
              getVendorData={getVendorData}
              paymentTermsList={paymentTermsList}
              poTotalMap={poTotalMap}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* BULK PO MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Bulk PO Creation ({selectedRecordIds.length} items)</DialogTitle>
            <p className="text-sm text-gray-600">Fill PO details for all selected items</p>
            {selectedRecordIds.length > 1 && (
              <div className="mt-3 flex items-center gap-2 max-w-xs">
                <Label htmlFor="grand-total-display" className="text-xs font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap">
                  Grand Total (w/ Tax):
                </Label>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-medium">₹</span>
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
                    className="pl-7 bg-slate-100 cursor-not-allowed font-bold text-green-700 h-9"
                  />
                </div>
              </div>
            )}
          </DialogHeader>

          <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* SHARED PO NUMBER - AT TOP */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <div className="space-y-2">
                <Label htmlFor="common-poNumber" className="text-base font-semibold">
                  PO Number <span className="text-red-500">*</span>
                  <span className="text-xs font-normal text-gray-500 ml-2">(applies to all items)</span>
                </Label>
                <Input
                  id="common-poNumber"
                  value={commonPONumber}
                  onChange={(e) => setCommonPONumber(e.target.value)}
                  required
                  placeholder="PO-2025-001"
                  className="bg-white"
                />
              </div>
            </div>

            {/* SHARED PACKAGING/FORWARDING SECTION */}
            <div className="border rounded-lg p-4 bg-amber-50">
              <div className="space-y-3">
                <Label className="text-base font-semibold">
                  Packaging / Forwarding
                  <span className="text-xs font-normal text-gray-500 ml-2">(applies to all items, divided equally)</span>
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="common-pkgAmount">Amount</Label>
                    <Input
                      id="common-pkgAmount"
                      type="number"
                      step="0.01"
                      value={commonPkgAmount}
                      onChange={(e) => setCommonPkgAmount(e.target.value)}
                      placeholder="0.00"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="common-pkgGST">GST on Packaging</Label>
                    <Select value={commonPkgGST} onValueChange={setCommonPkgGST}>
                      <SelectTrigger id="common-pkgGST" className="bg-white">
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
                    <Label>Total Packaging / Forwarding</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={getPkgTotals(commonPkgAmount, commonPkgGST, selectedRecordIds.length).totalPkg.toFixed(2)}
                      readOnly
                      className="bg-gray-100 cursor-not-allowed font-semibold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* PER-ITEM SECTIONS */}
            {selectedRecordIds.map((recordId) => {
              const record = sheetRecords.find((r) => r.id === recordId);
              if (!record) return null;
              const v = getVendorData(record);
              const data = bulkFormData[recordId] || {};

              return (
                <div key={recordId} className="border rounded-lg p-4 bg-gray-50">
                  <div className="mb-4 pb-3 border-b">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><strong>Indent-No:</strong> {record.data.indentNumber}</div>
                      <div><strong>Item:</strong> {record.data.itemName}</div>
                      <div><strong>Qty:</strong> {record.data.quantity}</div>
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      Vendor: <span className="font-medium">{v.name}</span> | Rate: ₹{v.rate}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`${recordId}-basicValue`}>
                        Basic Value <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`${recordId}-basicValue`}
                        type="number"
                        step="0.01"
                        value={data.basicValue || ""}
                        readOnly
                        className="bg-gray-100 cursor-not-allowed"
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
                        <SelectTrigger id={`${recordId}-gst`}>
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
                      <Label>Pkg/Fwd Share</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={getPkgTotals(commonPkgAmount, commonPkgGST, selectedRecordIds.length).perItemPkgTotal.toFixed(2)}
                        readOnly
                        className="bg-gray-100 cursor-not-allowed text-amber-700"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${recordId}-totalWithTax`}>
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
                        className="bg-gray-100 cursor-not-allowed font-semibold"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${recordId}-hsn`}>
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
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* SHARED PO COPY - AT BOTTOM */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <div className="space-y-2">
                <Label className="text-base font-semibold text-slate-900">
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
                    className="flex items-center justify-center w-full p-3 border-2 border-dashed border-gray-300 bg-white rounded-lg cursor-pointer hover:border-gray-400 text-sm"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload PO copy
                  </label>
                  {commonPOCopy && (
                    <div className="mt-2 p-2 bg-white border rounded flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>{commonPOCopy?.name}</span>
                        <span className="text-gray-500">
                          ({commonPOCopy ? (commonPOCopy.size / 1024).toFixed(1) : 0} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCommonFileRemove}
                        className="text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkSubmit}
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
    </div>
  );
}
