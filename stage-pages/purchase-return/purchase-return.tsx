"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, FileText, RefreshCw, Search, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import PurchaseReturnPending from "./purchase-return-pending";
import PurchaseReturnHistory from "./purchase-return-history";

const PENDING_COLUMNS = [
  { key: "indentNumber", label: "Indent No" },
  { key: "unitTrackingNo", label: "Unit Tracking No" },
  { key: "itemName", label: "Item" },
  { key: "rejectedQty", label: "Rejected Qty" },
  { key: "vendor", label: "Vendor" },
  { key: "invoiceNumber", label: "Invoice No" },
  { key: "remark", label: "Remark" },
  { key: "partName", label: "Part Name" },
  { key: "serialNoWithPhoto", label: "S-No. with Photo" },
  { key: "plan6", label: "Planned" },
] as const;

const HISTORY_COLUMNS = [
  { key: "indentNumber", label: "Indent No" },
  { key: "unitTrackingNo", label: "Unit Tracking No" },
  { key: "itemName", label: "Item" },
  { key: "vendor", label: "Vendor" },
  { key: "invoiceNumber", label: "Invoice No" },
  { key: "remark", label: "Remark" },
  { key: "partName", label: "Part Name" },
  { key: "serialNoWithPhoto", label: "S-No. with Photo" },
  { key: "plan6", label: "Planned" },
  { key: "actual6", label: "Actual" },
  { key: "returnedQty", label: "Return Qty" },
  { key: "returnAmount", label: "Return Amount" },
  { key: "returnReason", label: "Reason" },
  { key: "returnStatus", label: "Status" },
  { key: "returnItemImage", label: "Item Img" },
  { key: "creditNoteImage", label: "Credit Note" },
] as const;

const formatDateDash = (date: any) => {
  if (!date || date === "-" || date === "—") return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return typeof date === "string" ? date : "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
};

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = error => reject(error);
});

export default function PurchaseReturn() {
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [partialReturnRecords, setPartialReturnRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [serialDialogOpen, setSerialDialogOpen] = useState(false);
  const [selectedSerialRecord, setSelectedSerialRecord] = useState<any>(null);

  const [selectedPendingColumns, setSelectedPendingColumns] = useState<string[]>(
    PENDING_COLUMNS.map((c) => c.key)
  );

  const [selectedHistoryColumns, setSelectedHistoryColumns] = useState<string[]>(
    HISTORY_COLUMNS.map((c) => c.key)
  );

  const safeValue = useCallback((record: any, key: string) => {
    try {
      const data = record?.data;
      if (!data) return "-";

      const val = data[key];

      if (key === "serialNoWithPhoto") {
        const hasSerials = data.serialNo && data.serialNo !== "-" && String(data.serialNo).trim() !== "";
        if (!hasSerials) return "-";
        return (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors justify-center"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSerialRecord(record);
              setSerialDialogOpen(true);
            }}
          >
            <Eye className="w-4 h-4" />
          </Button>
        );
      }

      if (!val || val === "-" || val === "") return "-";

      if (key.includes("Image") || key.includes("Attachment") || key.includes("Copy") || key === "returnItemImage" || key === "creditNoteImage") {
        return (
          <a href={String(val)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-xs font-medium justify-center">
            <FileText className="w-3.5 h-3.5" /> 
            View
          </a>
        );
      }
      
      const lowKey = key.toLowerCase();
      if (lowKey.includes("plan") || lowKey.includes("actual") || lowKey.includes("date")) {
        return formatDateDash(val);
      }
      return String(val);
    } catch {
      return "-";
    }
  }, []);

  const [formData, setFormData] = useState({
    returnedQty: "",
    returnRate: "",
    returnAmount: "",
    returnReason: "",
    returnStatus: "",
    returnItemImage: null as File | null,
    creditNoteImage: null as File | null,
    actual6Date: new Date(),
  });

  const [originalQty, setOriginalQty] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/purchase-return");
      const json = await res.json();

      if (json.success) {
        setSheetRecords(json.pending || []);
        setPartialReturnRecords(json.history || []);
      } else {
        toast.error(json.error || "Failed to load purchase return records");
      }
    } catch (e) {
      console.error("Fetch error:", e);
      toast.error("Failed to load data");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pending = useMemo(() => {
    return sheetRecords.filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      if (!searchLower) return true;
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendor?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    });
  }, [sheetRecords, searchTerm]);

  const completed = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    if (!searchLower) return partialReturnRecords;
    return partialReturnRecords.filter((r) => {
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendor?.toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    });
  }, [partialReturnRecords, searchTerm]);

  const handleOpenForm = useCallback((recordId: string) => {
    const rec = sheetRecords.find((r) => r.id === recordId);
    if (!rec) return;

    const rejectQty = parseFloat(rec.data.rejectedQty !== undefined ? rec.data.rejectedQty : rec.data.rejectQty || "0") || 0;
    setOriginalQty(rejectQty);

    setSelectedRecordId(recordId);
    setFormData({
      returnedQty: rejectQty > 0 ? rejectQty.toString() : "",
      returnRate: "",
      returnAmount: "",
      returnReason: "",
      returnStatus: "",
      returnItemImage: null,
      creditNoteImage: null,
      actual6Date: new Date(),
    });
    setOpen(true);
  }, [sheetRecords]);

  useEffect(() => {
    const qty = parseFloat(formData.returnedQty) || 0;
    const rate = parseFloat(formData.returnRate) || 0;
    setFormData(prev => {
      const newAmount = (qty * rate).toFixed(2);
      if (prev.returnAmount === newAmount) return prev;
      return { ...prev, returnAmount: newAmount };
    });
  }, [formData.returnedQty, formData.returnRate]);

  const uploadFile = useCallback(async (file: File) => {
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    const upRes = await fetch("/api/upload-supabase", {
      method: "POST",
      body: formDataUpload,
    });
    const upJson = await upRes.json();
    if (upJson.success) return upJson.url;
    throw new Error(upJson.error || "Upload failed");
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId) return;

    const rec = sheetRecords.find((r) => r.id === selectedRecordId);
    if (!rec) return;

    setIsSubmitting(true);
    const toastId = toast.loading("Processing Return...");

    try {
      let itemImgUrl = "";
      let creditImgUrl = "";

      const uploadPromises = [];
      if (formData.returnItemImage) uploadPromises.push(uploadFile(formData.returnItemImage).then(url => { itemImgUrl = url; }));
      if (formData.creditNoteImage) uploadPromises.push(uploadFile(formData.creditNoteImage).then(url => { creditImgUrl = url; }));

      if (uploadPromises.length > 0) await Promise.all(uploadPromises);

      const payload = {
        liftNo: rec.id, // rec.id is the liftNo in mapped records
        returnedQty: formData.returnedQty,
        returnRate: formData.returnRate,
        returnAmount: formData.returnAmount,
        returnReason: formData.returnReason,
        returnStatus: formData.returnStatus,
        returnItemImage: itemImgUrl,
        creditNoteImage: creditImgUrl,
        actualDate: formData.actual6Date || new Date()
      };

      const res = await fetch("/api/purchase-return", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
      }

      toast.success("Return processed successfully!", { id: toastId });
      setOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedRecordId, sheetRecords, formData, uploadFile, fetchData]);

  const isFormValid = useMemo(() =>
    !!formData.returnedQty &&
    !!formData.returnRate &&
    !!formData.returnReason &&
    !!formData.returnStatus &&
    parseFloat(formData.returnedQty) <= originalQty
    , [formData, originalQty]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/30">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full flex flex-col h-full">
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b shadow-sm">
          <div className="max-w-[1600px] mx-auto">
            <div className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-blue-200 shadow-lg">
                    <RefreshCw className="w-6 h-6 text-white" />
                  </span>
                  Stage 12: Purchase Return
                </h1>
                <p className="text-slate-500 text-sm mt-1 ml-12">Process and track returns for rejected QC items</p>
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-80 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <Input
                    placeholder="Search by indent, item, vendor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all h-10 rounded-xl"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold text-slate-500 hidden md:inline">Columns:</Label>
                  <Select value="" onValueChange={() => {}}>
                    <SelectTrigger className="w-36 bg-white border-slate-200 h-9">
                      <SelectValue placeholder={activeTab === "pending" ? `${selectedPendingColumns.length} cols` : `${selectedHistoryColumns.length} cols`} />
                    </SelectTrigger>
                    <SelectContent className="w-56 max-h-96 overflow-y-auto">
                      <div className="p-2">
                        <div className="flex items-center space-x-2 mb-2 pb-2 border-b">
                          <Checkbox
                            id="select-all-cols"
                            checked={activeTab === "pending" ? selectedPendingColumns.length === PENDING_COLUMNS.length : selectedHistoryColumns.length === HISTORY_COLUMNS.length}
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
                              checked={activeTab === "pending" ? selectedPendingColumns.includes(c.key) : selectedHistoryColumns.includes(c.key)}
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
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={fetchData} 
                  disabled={isLoading}
                  className="h-10 w-10 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            <div className="px-6 pb-2">
              <TabsList className="bg-slate-200/50 p-1 rounded-xl h-11 inline-flex w-auto mb-2">
                <TabsTrigger 
                  value="pending" 
                  className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all font-medium"
                >
                  Pending Returns ({pending.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="history"
                  className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all font-medium"
                >
                  Return History ({completed.length})
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full flex-1">
          {isLoading && sheetRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 bg-white border rounded-2xl shadow-sm">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <RefreshCw className="w-5 h-5 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="mt-4 text-slate-500 font-medium animate-pulse">Synchronizing return data...</p>
            </div>
          ) : (
            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
              <TabsContent value="pending" className="flex-1 mt-0 focus-visible:outline-none">
                <PurchaseReturnPending
                  pending={pending}
                  handleOpenForm={handleOpenForm}
                  selectedPendingColumns={selectedPendingColumns}
                  PENDING_COLUMNS={PENDING_COLUMNS}
                  safeValue={safeValue}
                />
              </TabsContent>

              <TabsContent value="history" className="flex-1 mt-0 focus-visible:outline-none">
                <PurchaseReturnHistory
                  completed={completed}
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
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-50/80 backdrop-blur-sm border-b shrink-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-3 text-slate-900">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-blue-600" />
              </div>
              Process Purchase Return
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Return Qty * (Max: {originalQty})</Label>
                <Input
                  type="number"
                  min="0"
                  max={originalQty}
                  value={formData.returnedQty}
                  onChange={e => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, returnedQty: val }));
                  }}
                  placeholder={`Max: ${originalQty}`}
                  className={parseFloat(formData.returnedQty) > originalQty ? "border-red-500" : ""}
                />
                {parseFloat(formData.returnedQty) > originalQty && (
                  <p className="text-red-500 text-xs mt-1">Cannot exceed reject qty ({originalQty})</p>
                )}
              </div>
              <div>
                <Label>Return Rate *</Label>
                <Input
                  type="number"
                  value={formData.returnRate}
                  onChange={e => setFormData(prev => ({ ...prev, returnRate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Return Amount</Label>
                <Input value={formData.returnAmount} readOnly className="bg-gray-50" />
              </div>

              <div>
                <Label>Return Date *</Label>
                <Input
                  type="date"
                  value={formData.actual6Date instanceof Date && !isNaN(formData.actual6Date.getTime()) ? formData.actual6Date.toISOString().split("T")[0] : ""}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    if (!isNaN(d.getTime())) {
                      setFormData(prev => ({ ...prev, actual6Date: d }));
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Return Reason *</Label>
                <Input
                  value={formData.returnReason}
                  onChange={e => setFormData(prev => ({ ...prev, returnReason: e.target.value }))}
                />
              </div>
              <div>
                <Label>Status *</Label>
                <Select value={formData.returnStatus} onValueChange={v => setFormData(prev => ({ ...prev, returnStatus: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Debit Note">Debit Note</SelectItem>
                    <SelectItem value="Replaced (DN)">Replaced (DN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Return Item Image</Label>
                <Input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setFormData(prev => ({ ...prev, returnItemImage: file }));
                }} />
              </div>
              <div>
                <Label>Credit Note Image</Label>
                <Input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setFormData(prev => ({ ...prev, creditNoteImage: file }));
                }} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !isFormValid}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={serialDialogOpen} onOpenChange={setSerialDialogOpen}>
        <DialogContent className="w-[450px] h-[450px] max-w-[450px] max-h-[450px] flex flex-col p-0 overflow-hidden rounded-xl bg-white">
          <DialogHeader className="p-4 bg-slate-50 border-b shrink-0">
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
              <Eye className="w-4 h-4 text-blue-600" />
              S-No. & Photo Details
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Item Details</span>
              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs space-y-1">
                <div><span className="font-semibold text-slate-500">Indent:</span> {selectedSerialRecord?.data?.indentNumber || "-"}</div>
                <div><span className="font-semibold text-slate-500">Item:</span> {selectedSerialRecord?.data?.itemName || "-"}</div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Serials & Photos</span>
              <div className="space-y-2 pr-1">
                {selectedSerialRecord?.data?.serialNo && selectedSerialRecord.data.serialNo !== "-" ? (
                  (() => {
                    const serials = String(selectedSerialRecord.data.serialNo).split(",").map(s => s.trim()).filter(Boolean);
                    const images = selectedSerialRecord?.data?.serialPhoto && selectedSerialRecord.data.serialPhoto !== "-"
                      ? String(selectedSerialRecord.data.serialPhoto).split(",").map(i => i.trim()).filter(Boolean)
                      : [];
                    return serials.map((serial, idx) => {
                      const imageUrl = images[idx] || "";
                      return (
                        <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                          <span className="font-semibold text-slate-400">#{idx + 1}</span>
                          <span className="font-medium text-slate-700 truncate max-w-[150px]" title={serial}>{serial}</span>
                          {imageUrl ? (
                            <a
                              href={imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm hover:bg-slate-50"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-500" />
                              View Image
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No image</span>
                          )}
                        </div>
                      );
                    });
                  })()
                ) : (
                  <span className="text-xs text-slate-400 italic">No serial numbers recorded</span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="p-3 bg-slate-50 border-t flex justify-end shrink-0">
            <Button variant="outline" size="sm" onClick={() => setSerialDialogOpen(false)} className="text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
