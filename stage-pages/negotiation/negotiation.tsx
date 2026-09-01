"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Shield, ShieldCheck, Loader2, Users, Search, ClipboardList, History as HistoryIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate, parseSheetDate, getFmsTimestamp, cn } from "@/lib/utils";
import NegotiationPending from "./negotiation-pending";
import NegotiationHistory from "./negotiation-history";

export default function Stage4() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [currentRecord, setCurrentRecord] = useState<any>(null);
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Bulk Negotiate State
  const [selectedIndents, setSelectedIndents] = useState<string[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkRecords, setBulkRecords] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    selectedVendor: "",
    approvedBy: "",
    remarks: "",
  });

  const [approverList, setApproverList] = useState<string[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/negotiation?_t=${Date.now()}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSheetRecords(json.data);
      }

      const dropRes = await fetch("/api/dropdowns");
      const dropJson = await dropRes.json();
      if (dropJson.success && dropJson.data) {
        setApproverList(dropJson.data.approvedByOptions || []);
      }
    } catch (e) {
      console.error("Fetch error Stage 4:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [indentFilter, setIndentFilter] = useState<"no_filter" | "increasing" | "decreasing">("no_filter");

  const pending = useMemo(() => {
    let records = sheetRecords
      .filter((r) => r.status === "pending")
      .filter((r) => {
        const searchLower = searchTerm.toLowerCase();
        return (
          r.data.indentNumber?.toLowerCase().includes(searchLower) ||
          r.data.itemName?.toLowerCase().includes(searchLower) ||
          r.data.selectedVendor?.toLowerCase().includes(searchLower) ||
          r.data.selectedVendorName?.toLowerCase().includes(searchLower) ||
          r.data.vendor1Name?.toLowerCase().includes(searchLower) ||
          r.data.vendor2Name?.toLowerCase().includes(searchLower) ||
          r.data.vendor3Name?.toLowerCase().includes(searchLower) ||
          String(r.data.poNumber || "").toLowerCase().includes(searchLower)
        );
      });

    if (indentFilter === "increasing") {
      records = [...records].sort((a, b) => {
        const valA = a.data?.indentNumber || "";
        const valB = b.data?.indentNumber || "";
        return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      });
    } else if (indentFilter === "decreasing") {
      records = [...records].sort((a, b) => {
        const valA = a.data?.indentNumber || "";
        const valB = b.data?.indentNumber || "";
        return valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
      });
    }
    return records;
  }, [sheetRecords, searchTerm, indentFilter]);

  const completed = useMemo(() => {
    let records = sheetRecords
      .filter((r) => r.status === "completed")
      .filter((r) => {
        const searchLower = searchTerm.toLowerCase();
        if (!searchLower) return true;
        return (
          r.data.indentNumber?.toLowerCase().includes(searchLower) ||
          r.data.itemName?.toLowerCase().includes(searchLower) ||
          r.data.vendor1Name?.toLowerCase().includes(searchLower) ||
          r.data.vendor2Name?.toLowerCase().includes(searchLower) ||
          r.data.vendor3Name?.toLowerCase().includes(searchLower) ||
          String(r.data.poNumber || "").toLowerCase().includes(searchLower)
        );
      });

    if (indentFilter === "increasing") {
      records = [...records].sort((a, b) => {
        const valA = a.data?.indentNumber || "";
        const valB = b.data?.indentNumber || "";
        return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      });
    } else if (indentFilter === "decreasing") {
      records = [...records].sort((a, b) => {
        const valA = a.data?.indentNumber || "";
        const valB = b.data?.indentNumber || "";
        return valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
      });
    }
    return records;
  }, [sheetRecords, searchTerm, indentFilter]);

  const baseColumns = [
    { key: "indentNumber", label: "Indent" },
    { key: "planned3", label: "Planned" },
    { key: "actual3", label: "Actual" },
    { key: "itemName", label: "Item" },
    { key: "quantity", label: "Qty" },
  ];

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    baseColumns.map((c) => c.key)
  );

  const paymentTerms = [
    { value: "15", label: "15 days" },
    { value: "30", label: "30 days" },
    { value: "60", label: "60 days" },
    { value: "90", label: "90 days" },
    { value: "advance", label: "Advance" },
    { value: "PI", label: "PI (Proforma Invoice)" },
  ];

  const handleOpenForm = (recordId: string) => {
    const record = sheetRecords.find((r) => r.id === recordId);
    if (!record) return;

    setCurrentRecord(record);
    setFormData({ selectedVendor: "", approvedBy: "", remarks: "" });
    setOpen(true);
  };

  const submitNegotiation = async (idsToProcess: string[], data: typeof formData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const firstRecord = sheetRecords.find(r => r.id === idsToProcess[0]);
      if (!firstRecord) throw new Error("No record found");
      const currentVendors = getVendors(firstRecord);
      const selectedVendorObj = currentVendors.find(v => v && v.id === data.selectedVendor);
      const selectedVendorName = selectedVendorObj ? selectedVendorObj.name : data.selectedVendor;

      const res = await fetch("/api/negotiation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "insertNegotiation",
          idsToProcess,
          submissionData: {
            selectedVendorName,
            finalApprovedBy: data.approvedBy,
            negotiationRemarks: data.remarks
          }
        }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Negotiation failed");

      await fetchData();
      return true;
    } catch (err: any) {
      console.error("Stage 4 Submit Error:", err);
      setSubmitError(err.message || "Something went wrong during submission");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRecord || !formData.selectedVendor || !formData.approvedBy) return;

    const success = await submitNegotiation([currentRecord.id], formData);
    if (success) {
      resetForm();
    }
  };

  const resetForm = () => {
    setOpen(false);
    setCurrentRecord(null);
    setFormData({ selectedVendor: "", approvedBy: "", remarks: "" });
  };

  const getVendors = (record: any) => {
    return Array.from({ length: 3 }, (_, i) => {
      const idx = i + 1;
      const name = record.data[`vendor${idx}Name`];
      if (!name) return null;
      return {
        id: `vendor${idx}`,
        name,
        rate: record.data[`vendor${idx}Rate`],
        terms: record.data[`vendor${idx}Terms`],
        delivery: record.data[`vendor${idx}DeliveryDate`],
        warrantyType: record.data[`vendor${idx}WarrantyType`],
        warrantyFrom: record.data[`vendor${idx}WarrantyFrom`],
        warrantyTo: record.data[`vendor${idx}WarrantyTo`],
        attachment: record.data[`vendor${idx}Attachment`],
      };
    }).filter(Boolean);
  };

  const toggleIndentSelection = (indentId: string) => {
    setSelectedIndents(prev =>
      prev.includes(indentId)
        ? prev.filter(id => id !== indentId)
        : [...prev, indentId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIndents.length === pending.length) {
      setSelectedIndents([]);
    } else {
      setSelectedIndents(pending.map(r => r.id));
    }
  };

  const getCommonVendors = (records: any[]) => {
    if (records.length === 0) return [];

    const vendorNameSets = records.map(record => {
      const vendors = getVendors(record);
      return vendors.map((v: any) => v?.name).filter(Boolean);
    });

    const commonNames = vendorNameSets.reduce((acc, names) =>
      acc.filter(name => names.includes(name))
    );

    const firstRecordVendors = getVendors(records[0]);
    return firstRecordVendors.filter((v: any) => v && commonNames.includes(v.name));
  };

  const getAllVendorsForComparison = (records: any[]) => {
    if (records.length === 0) return [];

    const vendorNameSets = records.map(record => {
      const vendors = getVendors(record);
      return vendors.map((v: any) => v?.name).filter(Boolean);
    });
    const commonNames = vendorNameSets.reduce((acc, names) =>
      acc.filter(name => names.includes(name))
    );

    const allVendors: any[] = [];
    records.forEach(record => {
      const vendors = getVendors(record);
      vendors.forEach((v: any) => {
        if (v && commonNames.includes(v.name)) {
          allVendors.push({
            ...v,
            indentNumber: record.data?.indentNumber || record.id,
          });
        }
      });
    });
    return allVendors;
  };

  const handleOpenBulkModal = () => {
    const records = selectedIndents.map(id => sheetRecords.find(r => r.id === id)).filter(Boolean);
    setBulkRecords(records);
    setFormData({ selectedVendor: "", approvedBy: "", remarks: "" });
    setBulkModalOpen(true);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkRecords.length === 0 || !formData.selectedVendor || !formData.approvedBy) return;

    const ids = bulkRecords.map(r => r.id);
    const success = await submitNegotiation(ids, formData);
    if (success) {
      setBulkModalOpen(false);
      setSelectedIndents([]);
      setBulkRecords([]);
      setFormData({ selectedVendor: "", approvedBy: "", remarks: "" });
    }
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

  const vendors = currentRecord ? getVendors(currentRecord) : [];

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col overflow-hidden p-6 bg-slate-50/30">
      {/* Header */}
      <div className="shrink-0 mb-6 p-6 bg-gradient-to-r from-indigo-50/50 via-blue-50/20 to-white border border-indigo-100/60 rounded-xl shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg shadow-indigo-100 shadow-xl text-white">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-indigo-950 tracking-tight">Stage 4: Vendor Negotiation</h2>
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
              {isLoading && <Loader2 className="w-5 h-5 animate-spin text-indigo-650" />}
              <Label className="text-sm font-semibold text-indigo-900 whitespace-nowrap hidden md:inline-block">Show Columns:</Label>
              <ColumnSelector />
            </div>
          </div>
        </div>
      </div>

      {submitError && (
        <div className="shrink-0 mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center gap-2">
          <span className="font-medium">Error:</span> {submitError}
        </div>
      )}

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
                <HistoryIcon className="w-5 h-5 opacity-80" />
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

          {selectedIndents.length >= 2 && activeTab === "pending" && (
            <Button
              onClick={handleOpenBulkModal}
              className="animate-in fade-in zoom-in duration-200 shadow-md shadow-green-100 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white px-6 py-3 h-auto text-sm font-bold rounded-lg"
            >
              Bulk Negotiate ({selectedIndents.length})
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
              <p className="text-lg">No pending negotiations</p>
              <p className="text-sm mt-1">All caught up!</p>
            </div>
          ) : (
            <NegotiationPending
              pending={pending}
              selectedIndents={selectedIndents}
              toggleIndentSelection={toggleIndentSelection}
              toggleSelectAll={toggleSelectAll}
              selectedColumns={selectedColumns}
              baseColumns={baseColumns}
              handleOpenForm={handleOpenForm}
              getVendors={getVendors}
              paymentTerms={paymentTerms}
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
            <div className="text-center py-12 text-gray-500 border rounded-lg bg-gray-50">
              <p className="text-lg">No completed negotiations</p>
            </div>
          ) : (
            <NegotiationHistory
              completed={completed}
              selectedColumns={selectedColumns}
              baseColumns={baseColumns}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-xl border border-indigo-150">
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-6 py-4 flex flex-col gap-1 flex-shrink-0">
            <DialogTitle className="text-white text-lg font-bold">Vendor Negotiation & Final Selection</DialogTitle>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6 p-6">
            {/* 1. SELECT VENDOR FIRST */}
            <div className="space-y-3 border-b border-indigo-100 pb-4">
              <Label className="text-sm font-bold text-indigo-900 uppercase tracking-wider">
                Select Vendor <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {vendors.map((v) => {
                  if (!v) return null;
                  return (
                    <label
                      key={v.id}
                      className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${formData.selectedVendor === v.id
                        ? "border-emerald-500 bg-emerald-50 text-emerald-950 shadow-xs font-bold"
                        : "border-indigo-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/10 text-slate-700"
                        }`}
                    >
                      <input
                        type="radio"
                        name="selectedVendor"
                        value={v.id}
                        checked={formData.selectedVendor === v.id}
                        onChange={(e) => setFormData({ ...formData, selectedVendor: e.target.value })}
                        className="mr-3 text-indigo-650 focus:ring-indigo-500"
                      />
                      <span className="text-sm">{v.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 2. APPROVED BY */}
            <div className="space-y-2">
              <Label htmlFor="approvedBy" className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider ml-1">
                Approved By <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.approvedBy}
                onValueChange={(v) => setFormData({ ...formData, approvedBy: v })}
                required
              >
                <SelectTrigger className="border-indigo-150 focus:ring-indigo-500">
                  <SelectValue placeholder="Select approver..." />
                </SelectTrigger>
                <SelectContent>
                  {approverList.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. ITEM DETAILS */}
            <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/15 max-h-60 overflow-y-auto shadow-2xs">
              <h3 className="font-bold text-indigo-950 mb-3 uppercase tracking-wider text-xs">Item Details</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-indigo-950/70 text-xs">Indent #:</span>
                  <p className="font-bold text-indigo-950 text-sm">{currentRecord?.data?.indentNumber || "—"}</p>
                </div>
                <div>
                  <span className="font-semibold text-indigo-950/70 text-xs">Item:</span>
                  <p className="font-bold text-indigo-950 text-sm">{currentRecord?.data?.itemName || "—"}</p>
                </div>
                <div>
                  <span className="font-semibold text-indigo-950/70 text-xs">Quantity:</span>
                  <p className="font-bold text-indigo-950 text-sm">{currentRecord?.data?.quantity || "—"}</p>
                </div>
              </div>
            </div>

            {/* 4. COMPARISON SHEET */}
            <div className="border border-indigo-100 rounded-xl overflow-hidden shadow-xs bg-white">
              <div className="p-4 border-b border-indigo-100 bg-indigo-50/50">
                <h3 className="font-bold text-indigo-950 text-sm uppercase tracking-wider">Vendor Comparison Sheet</h3>
              </div>
              <div className="p-4">
                <Table>
                  <TableHeader className="bg-indigo-50/20 sticky top-0 z-10 border-b border-indigo-100">
                    <TableRow className="hover:bg-transparent border-b border-indigo-100">
                      <TableHead className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Vendor Name</TableHead>
                      <TableHead className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Rate</TableHead>
                      <TableHead className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Payment Terms</TableHead>
                      <TableHead className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Exp. Delivery</TableHead>
                      <TableHead className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Warranty</TableHead>
                      <TableHead className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Attachment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendors.map((v) => {
                      if (!v) return null;
                      const isSelectedVendor = formData.selectedVendor === v.id;
                      return (
                        <TableRow
                          key={v.id}
                          className={cn(
                            "transition-all border-b border-indigo-50 last:border-0 odd:bg-white even:bg-indigo-50/10 hover:bg-indigo-50/20",
                            isSelectedVendor ? "bg-emerald-50/45 text-emerald-950 font-bold border-l-2 border-l-emerald-500" : ""
                          )}
                        >
                          <TableCell className="font-semibold text-indigo-950">{v.name}</TableCell>
                          <TableCell className="font-semibold text-slate-700">₹{v.rate || "-"}</TableCell>
                          <TableCell className="text-slate-600 font-medium">
                            {paymentTerms.find((t) => t.value === v.terms)?.label || v.terms || "-"}
                          </TableCell>
                          <TableCell className="text-slate-650 font-medium">
                            {v.delivery ? new Date(v.delivery).toLocaleDateString("en-IN") : "-"}
                          </TableCell>
                          <TableCell className="text-slate-650 font-medium">
                            {v.warrantyType ? (
                              <div className="flex items-center gap-1 text-xs">
                                {v.warrantyType === "warranty" ? (
                                  <Shield className="w-3.5 h-3.5 text-indigo-650" />
                                ) : (
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                )}
                                <span className="capitalize font-semibold text-indigo-950">{v.warrantyType}</span>
                                {v.warrantyFrom && v.warrantyTo && (
                                  <span className="text-slate-500 font-medium ml-1">
                                    ({new Date(v.warrantyFrom).toLocaleDateString("en-IN")} -{" "}
                                    {new Date(v.warrantyTo).toLocaleDateString("en-IN")})
                                  </span>
                                )}
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {v.attachment ? (
                              <a
                                href={typeof v.attachment === 'string' ? v.attachment : undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-indigo-600 hover:underline text-xs font-semibold"
                              >
                                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="truncate max-w-20">
                                  {typeof v.attachment === 'string' ? "View File" : (v.attachment as any).name}
                                </span>
                              </a>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 5. REMARKS */}
            <div className="space-y-2">
              <Label htmlFor="remarks" className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider ml-1">Negotiation Remarks</Label>
              <Textarea
                id="remarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Any special terms, discounts, or notes..."
                className="min-h-24 border-indigo-150 focus-visible:ring-indigo-500"
              />
            </div>

            <DialogFooter className="flex-shrink-0 border-t border-indigo-100 pt-4 gap-2">
              <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting} className="border-indigo-100 hover:bg-indigo-50/50 hover:text-indigo-600">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.selectedVendor || !formData.approvedBy}
                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold shadow-md shadow-indigo-200 px-6 py-2.5 h-auto rounded-lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Confirm & Proceed"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* BULK NEGOTIATE MODAL */}
      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-xl border border-indigo-150">
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-6 py-4 flex flex-col gap-1 flex-shrink-0">
            <DialogTitle className="text-white text-lg font-bold">Bulk Vendor Negotiation & Final Selection</DialogTitle>
            <p className="text-slate-400 text-xs">
              Applying negotiation to {bulkRecords.length} items
            </p>
          </div>

          <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto space-y-6 p-6">
            {/* 1. SELECT VENDOR (Common Vendors Only) */}
            <div className="space-y-3 border-b border-indigo-100 pb-4">
              <Label className="text-sm font-bold text-indigo-900 uppercase tracking-wider">
                Select Vendor <span className="text-red-500">*</span>
              </Label>
              {(() => {
                const commonVendors = getCommonVendors(bulkRecords);
                if (commonVendors.length === 0 && bulkRecords.length > 0) {
                  return (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm font-semibold">
                      ⚠️ No common vendors found across selected items. Please select items with at least one common vendor.
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {commonVendors.map((v: any) => {
                      if (!v) return null;
                      return (
                        <label
                          key={v.id}
                          className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${formData.selectedVendor === v.id
                            ? "border-emerald-500 bg-emerald-50 text-emerald-950 shadow-xs font-bold"
                            : "border-indigo-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/10 text-slate-700"
                            }`}
                        >
                          <input
                            type="radio"
                            name="bulkSelectedVendor"
                            value={v.id}
                            checked={formData.selectedVendor === v.id}
                            onChange={(e) => setFormData({ ...formData, selectedVendor: e.target.value })}
                            className="mr-3 text-indigo-650 focus:ring-indigo-500"
                          />
                          <span className="text-sm">{v.name}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* 2. APPROVED BY */}
            <div className="space-y-2">
              <Label htmlFor="bulkApprovedBy" className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider ml-1">
                Approved By <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.approvedBy}
                onValueChange={(v) => setFormData({ ...formData, approvedBy: v })}
                required
              >
                <SelectTrigger className="border-indigo-150 focus:ring-indigo-500">
                  <SelectValue placeholder="Select approver..." />
                </SelectTrigger>
                <SelectContent>
                  {approverList.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. ITEM DETAILS */}
            <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/15 max-h-60 overflow-y-auto shadow-2xs">
              <h3 className="font-bold text-indigo-950 mb-3 uppercase tracking-wider text-xs">Item Details ({bulkRecords.length} items selected)</h3>
              <Table>
                <TableHeader className="bg-indigo-50/20 sticky top-0 z-10 border-b border-indigo-100">
                  <TableRow className="hover:bg-transparent border-b border-indigo-100">
                    <TableHead className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Indent #</TableHead>
                    <TableHead className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Item</TableHead>
                    <TableHead className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulkRecords.map((record) => (
                    <TableRow key={record.id} className="transition-all border-b border-indigo-50 last:border-0 hover:bg-indigo-50/10">
                      <TableCell className="font-semibold text-indigo-950">{record.data?.indentNumber || "—"}</TableCell>
                      <TableCell className="text-slate-600 font-semibold">{record.data?.itemName || "—"}</TableCell>
                      <TableCell className="text-slate-650 font-medium">{record.data?.quantity || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 4. VENDOR COMPARISON */}
            <div className="border border-indigo-100 rounded-xl overflow-hidden bg-white shadow-xs">
              <div className="p-4 border-b border-indigo-100 bg-indigo-50/50">
                <h3 className="font-bold text-indigo-950 text-sm uppercase tracking-wider">Vendor Comparison Sheet (Common Vendors)</h3>
              </div>
              <div className="p-4">
                <Table>
                  <TableHeader className="bg-indigo-50/20 sticky top-0 z-10 border-b border-indigo-100">
                    <TableRow className="hover:bg-transparent border-b border-indigo-100">
                      <TableHead className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Indent #</TableHead>
                      <TableHead className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Vendor Name</TableHead>
                      <TableHead className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Rate</TableHead>
                      <TableHead className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Payment Terms</TableHead>
                      <TableHead className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Exp. Delivery</TableHead>
                      <TableHead className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Attachment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getAllVendorsForComparison(bulkRecords).map((v: any, index: number) => {
                      if (!v) return null;
                      const isSelectedVendor = formData.selectedVendor === v.id;
                      return (
                        <TableRow
                          key={`${v.indentNumber}-${v.id}-${index}`}
                          className={cn(
                            "transition-all border-b border-indigo-50 last:border-0 odd:bg-white even:bg-indigo-50/10 hover:bg-indigo-50/20",
                            isSelectedVendor ? "bg-emerald-50/45 text-emerald-950 font-bold border-l-2 border-l-emerald-500" : ""
                          )}
                        >
                          <TableCell className="font-semibold text-indigo-950">{v.indentNumber}</TableCell>
                          <TableCell className="font-semibold text-indigo-950">{v.name}</TableCell>
                          <TableCell className="font-semibold text-slate-700">₹{v.rate || "-"}</TableCell>
                          <TableCell className="text-slate-600 font-medium">
                            {paymentTerms.find((t) => t.value === v.terms)?.label || v.terms || "-"}
                          </TableCell>
                          <TableCell className="text-slate-650 font-medium">
                            {v.delivery ? new Date(v.delivery).toLocaleDateString("en-IN") : "-"}
                          </TableCell>
                          <TableCell>
                            {v.attachment ? (
                              <a
                                href={typeof v.attachment === 'string' ? v.attachment : undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-indigo-600 hover:underline text-xs font-semibold"
                              >
                                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                <span>View</span>
                              </a>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 5. REMARKS */}
            <div className="space-y-2">
              <Label htmlFor="bulkRemarks" className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider ml-1">Negotiation Remarks</Label>
              <Textarea
                id="bulkRemarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Any special terms, discounts, or notes..."
                className="min-h-24 border-indigo-150 focus-visible:ring-indigo-500"
              />
            </div>

            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-semibold">
                ⚠️ {submitError}
              </div>
            )}

            <DialogFooter className="flex-shrink-0 border-t border-indigo-100 pt-4 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBulkModalOpen(false);
                  setFormData({ selectedVendor: "", approvedBy: "", remarks: "" });
                }}
                disabled={isSubmitting}
                className="border-indigo-100 hover:bg-indigo-50/50 hover:text-indigo-600"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.selectedVendor || !formData.approvedBy || getCommonVendors(bulkRecords).length === 0}
                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold shadow-md shadow-indigo-200 px-6 py-2.5 h-auto rounded-lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving {bulkRecords.length} items...
                  </>
                ) : (
                  `Confirm & Proceed (${bulkRecords.length} items)`
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
