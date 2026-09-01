"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RefreshCw, Upload, FileText, X, Search, ClipboardList, History } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getFmsTimestamp, cn, formatDateTimeDash } from "@/lib/utils";
import ReturnApprovalPending from "./return-approval-pending";
import ReturnApprovalHistory from "./return-approval-history";

const formatDate = (dateStr: string) => formatDateTimeDash(dateStr);

const safeValue = (val: any) => {
  return val && String(val).trim() !== "" ? val : "-";
};

const uploadFileToDrive = async (file: File) => {
  const formDataUpload = new FormData();
  formDataUpload.append("file", file);
  const upRes = await fetch("/api/upload-supabase", {
    method: "POST",
    body: formDataUpload,
  });
  const upJson = await upRes.json();
  if (upJson.success) return upJson.url;
  else throw new Error("Upload failed: " + (upJson.error || "Unknown error"));
};

export default function ReturnApproval() {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [open, setOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    liftNumber: "",
    itemName: "",
    invoiceNumber: "",
    returnQty: "",
    actualDate: "",
    dnNumber: "",
    returnImage: null as File | null,
    remarks: "",
  });

  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFormData, setBulkFormData] = useState({
    actualDate: new Date().toISOString().split("T")[0],
    dnNumber: "",
    returnImage: null as File | null,
    remarks: "",
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/return-approval");
      const json = await res.json();
      if (json.success) {
        setSheetRecords([...(json.pending || []), ...(json.history || [])]);
      } else {
        toast.error(json.error || "Failed to load return approvals");
      }
    } catch (e) {
      console.error("Fetch error:", e);
      toast.error("Failed to fetch data");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pending = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return sheetRecords
      .filter((r) => r.status === "pending")
      .filter((r) => {
        if (!lowerSearch) return true;
        return (
          r.data.indentNumber?.toLowerCase().includes(lowerSearch) ||
          r.data.itemName?.toLowerCase().includes(lowerSearch) ||
          r.data.vendorName?.toLowerCase().includes(lowerSearch) ||
          String(r.data.poNumber || "").toLowerCase().includes(lowerSearch) ||
          String(r.data.invoiceNumber || "").toLowerCase().includes(lowerSearch)
        );
      });
  }, [sheetRecords, searchTerm]);

  const completed = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return sheetRecords
      .filter((r) => r.status === "completed")
      .filter((r) => {
        if (!lowerSearch) return true;
        return (
          r.data.indentNumber?.toLowerCase().includes(lowerSearch) ||
          r.data.itemName?.toLowerCase().includes(lowerSearch) ||
          r.data.vendorName?.toLowerCase().includes(lowerSearch) ||
          String(r.data.invoiceNumber || "").toLowerCase().includes(lowerSearch)
        );
      });
  }, [sheetRecords, searchTerm]);

  const selectedRecords = useMemo(() =>
    pending.filter((r) => selectedRows.has(r.id)),
    [pending, selectedRows]);

  const toggleRow = useCallback((id: string) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedRows.size === pending.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(pending.map((r) => r.id)));
    }
  }, [selectedRows.size, pending]);

  const handleOpenForm = useCallback((recordId: string) => {
    const rec = sheetRecords.find((r) => r.id === recordId);
    if (!rec) return;

    setSelectedRecordId(recordId);
    setFormData({
      liftNumber: rec.data.liftNumber || rec.data.indentNumber,
      itemName: rec.data.itemName,
      invoiceNumber: rec.data.invoiceNumber,
      returnQty: rec.data.returnQty,
      actualDate: getFmsTimestamp(),
      dnNumber: "",
      returnImage: null,
      remarks: "",
    });
    setOpen(true);
  }, [sheetRecords]);

  const handleOpenBulkForm = useCallback(() => {
    if (selectedRows.size === 0) return;

    const invoices = new Set(selectedRecords.map((r) => r.data.invoiceNumber));
    if (invoices.size > 1) {
      toast.error("Cannot proceed: All selected items must have the same Invoice", {
        style: { background: '#fee2e2', border: '1px solid #ef4444', color: '#b91c1c' }
      });
      return;
    }

    setBulkFormData({
      actualDate: getFmsTimestamp(),
      dnNumber: "",
      returnImage: null,
      remarks: "",
    });
    setBulkOpen(true);
  }, [selectedRows.size, selectedRecords]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, returnImage: e.target.files![0] }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId) return;

    if (!formData.dnNumber?.trim()) {
      toast.error("Debit Note / DN No. is mandatory.");
      return;
    }
    if (!formData.returnImage) {
      toast.error("Image upload is mandatory.");
      return;
    }

    const rec = sheetRecords.find((r) => r.id === selectedRecordId);
    if (!rec) return;

    setIsSubmitting(true);
    const toastId = toast.loading("Submitting approval...");

    try {
      let imageUrl = "";
      if (formData.returnImage) {
        imageUrl = await uploadFileToDrive(formData.returnImage);
      }

      const res = await fetch("/api/return-approval", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          liftNo: rec.id,
          dnNumber: formData.dnNumber,
          remarks: formData.remarks,
          returnImage: imageUrl,
          approvalDate: formData.actualDate,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Approval failed");
      }

      toast.success("Approved successfully!", { id: toastId });
      setOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkSubmit = async () => {
    if (selectedRows.size === 0) return;

    if (!bulkFormData.dnNumber?.trim()) {
      toast.error("Debit Note / DN No. is mandatory.");
      return;
    }
    if (!bulkFormData.returnImage) {
      toast.error("Image upload is mandatory.");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(`Processing ${selectedRows.size} approvals...`);

    try {
      const imageUrl = await uploadFileToDrive(bulkFormData.returnImage);

      const res = await fetch("/api/return-approval", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          liftNos: Array.from(selectedRows),
          dnNumber: bulkFormData.dnNumber,
          remarks: bulkFormData.remarks,
          returnImage: imageUrl,
          approvalDate: bulkFormData.actualDate,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Bulk approval failed");
      }

      toast.success(`Successfully approved ${selectedRows.size} record(s)!`, { id: toastId });
      setSelectedRows(new Set());
      setBulkOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/30 p-6 overflow-hidden">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full flex-1 flex flex-col overflow-hidden">
        {/* Header Card */}
        <div className="mb-6 p-6 bg-gradient-to-r from-indigo-50/50 via-blue-50/20 to-white border border-indigo-100/60 rounded-xl shadow-xs shrink-0">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg shadow-indigo-100 shadow-xl text-white">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-indigo-950 tracking-tight">Stage 13: Return Approval</h2>
                <p className="text-xs text-slate-500 mt-1">Review and finalize rejected item returns</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {selectedRows.size > 1 && (
                <div className="flex items-center gap-3 px-4 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl animate-in fade-in slide-in-from-right-4 duration-300 shadow-sm">
                  <div className="flex flex-col items-start leading-tight">
                    <span className="text-sm font-semibold text-indigo-700">{selectedRows.size} selected</span>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={handleOpenBulkForm}
                    className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm px-4 rounded-lg text-xs font-semibold"
                  >
                    Bulk Approval
                  </Button>
                </div>
              )}
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-indigo-500" />
                <Input
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-white border-indigo-100 focus-visible:ring-indigo-500"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={fetchData}
                disabled={isLoading}
                className="bg-white hover:bg-slate-50 shrink-0 border-indigo-100/80 text-indigo-700"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <TabsList className="bg-indigo-50/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1.5 border border-indigo-100/50 w-[420px] shadow-2xs">
            <TabsTrigger
              value="pending"
              className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-3 transition-all cursor-pointer text-slate-700"
            >
              <ClipboardList className="w-5 h-5 opacity-80" />
              <div className="flex flex-col items-start leading-none gap-1 text-left">
                <span className="font-bold">Pending</span>
                <span className="text-[10px] opacity-70 font-medium">Awaiting return approval</span>
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
                <span className="text-[10px] opacity-70 font-medium">Approval history</span>
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
        </div>

        <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full flex-1">
          {isLoading && sheetRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 bg-white border rounded-2xl shadow-sm">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <RefreshCw className="w-5 h-5 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="mt-4 text-slate-500 font-medium animate-pulse">Synchronizing records...</p>
            </div>
          ) : (
            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
              <TabsContent value="pending" className="flex-1 mt-0 focus-visible:outline-none">
                <ReturnApprovalPending
                  pending={pending}
                  selectedRows={selectedRows}
                  toggleRow={toggleRow}
                  toggleAll={toggleAll}
                  handleOpenForm={handleOpenForm}
                  safeValue={safeValue}
                  formatDate={formatDate}
                />
              </TabsContent>

              <TabsContent value="history" className="flex-1 mt-0 focus-visible:outline-none">
                <ReturnApprovalHistory
                  completed={completed}
                  safeValue={safeValue}
                  formatDate={formatDate}
                />
              </TabsContent>
            </div>
          )}
        </div>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-white rounded-xl shadow-lg border">
          <DialogHeader>
            <DialogTitle>Return Approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lift Number</Label>
                <Input value={formData.liftNumber} disabled className="bg-gray-100 h-8 text-xs" />
              </div>
              <div className="space-y-2">
                <Label>Invoice No</Label>
                <Input value={formData.invoiceNumber} disabled className="bg-gray-100 h-8 text-xs" />
              </div>

              <div className="space-y-2">
                <Label>Item Name</Label>
                <Input value={formData.itemName} disabled className="bg-gray-100 h-8 text-xs" />
              </div>
              <div className="space-y-2">
                <Label>Return Qty</Label>
                <Input value={formData.returnQty} disabled className="bg-gray-100 h-8 text-xs" />
              </div>

              <div className="space-y-2">
                <Label>Approval Date *</Label>
                <Input
                  type="date"
                  value={formData.actualDate}
                  onChange={(e) => setFormData({ ...formData, actualDate: e.target.value })}
                  className="h-8 text-xs bg-white border"
                />
              </div>
              <div className="space-y-2">
                <Label>Debit Note / DN No. *</Label>
                <Input
                  placeholder="Enter DN Number"
                  value={formData.dnNumber}
                  onChange={(e) => setFormData({ ...formData, dnNumber: e.target.value })}
                  className="h-8 text-xs bg-white border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Image *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 flex items-center justify-center gap-2 h-8 border-dashed text-xs px-2 bg-white"
                    onClick={() => document.getElementById("image-upload")?.click()}
                  >
                    {formData.returnImage ? (
                      <div className="flex items-center gap-2 text-green-600 truncate">
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{formData.returnImage.name}</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-500 truncate">Upload</span>
                      </>
                    )}
                  </Button>
                  {formData.returnImage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 hover:bg-slate-50"
                      onClick={() => setFormData(prev => ({ ...prev, returnImage: null }))}
                    >
                      <X className="w-3 h-3 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Input
                  placeholder="Enter remarks..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="h-8 text-xs bg-white border"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.dnNumber || !formData.dnNumber.trim() || !formData.returnImage}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-lg border">
          <DialogHeader>
            <DialogTitle>Bulk Return Approval ({selectedRows.size} items)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Selected Items</Label>
              <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indent</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Return Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedRecords.map((rec) => (
                      <TableRow key={rec.id}>
                        <TableCell className="py-2">{rec.data.indentNumber}</TableCell>
                        <TableCell className="py-2">{rec.data.itemName}</TableCell>
                        <TableCell className="py-2">{safeValue(rec.data.returnQty)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Approval Date *</Label>
                <Input
                  type="date"
                  value={bulkFormData.actualDate}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, actualDate: e.target.value })}
                  className="h-8 text-xs bg-white border"
                />
              </div>
              <div className="space-y-2">
                <Label>Debit Note / DN No. *</Label>
                <Input
                  placeholder="Enter DN Number"
                  value={bulkFormData.dnNumber}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, dnNumber: e.target.value })}
                  className="h-8 text-xs bg-white border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Image *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="bulk-image-upload"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setBulkFormData({ ...bulkFormData, returnImage: e.target.files[0] });
                      }
                    }}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 flex items-center justify-center gap-2 h-8 border-dashed text-xs px-2 bg-white"
                    onClick={() => document.getElementById("bulk-image-upload")?.click()}
                  >
                    {bulkFormData.returnImage ? (
                      <div className="flex items-center gap-2 text-green-600 truncate">
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{bulkFormData.returnImage.name}</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-500 truncate">Upload</span>
                      </>
                    )}
                  </Button>
                  {bulkFormData.returnImage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 hover:bg-slate-50"
                      onClick={() => setBulkFormData({ ...bulkFormData, returnImage: null })}
                    >
                      <X className="w-3 h-3 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Input
                  placeholder="Enter remarks..."
                  value={bulkFormData.remarks}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, remarks: e.target.value })}
                  className="h-8 text-xs bg-white border"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button
              onClick={handleBulkSubmit}
              disabled={isSubmitting || !bulkFormData.dnNumber || !bulkFormData.dnNumber.trim() || !bulkFormData.returnImage}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
