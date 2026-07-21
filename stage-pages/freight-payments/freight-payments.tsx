"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, FileText, RefreshCw, Upload, CalendarIcon, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatDate as sharedFormatDate, getFmsTimestamp } from "@/lib/utils";
import FreightPaymentsPending from "./freight-payments-pending";
import FreightPaymentsHistory from "./freight-payments-history";

const COLUMNS = [
  { key: "lrNo", label: "LR No." },
  { key: "biltyImage", label: "Bilty" },
  { key: "freightAmount", label: "Freight Amt" },
  { key: "transporter", label: "Transporter" },
  { key: "vehicleNo", label: "Vehicle No." },
  { key: "contact", label: "Contact" },
  { key: "advanceAmount", label: "Advance" },
  { key: "totalPaid", label: "Paid" },
  { key: "pendingAmount", label: "Pending" },
  { key: "plan1", label: "Planned" },
  { key: "actual1", label: "Actual" },
  { key: "planned", label: "Planned" },
  { key: "actual", label: "Actual" },
  { key: "amountPaid", label: "Amount Paid" },
  { key: "date", label: "Payment Date" },
  { key: "mode", label: "Mode" },
  { key: "status", label: "Status" },
  { key: "proof", label: "Proof" },
  { key: "invoiceNo", label: "Invoice No." },
  { key: "invoiceCopy", label: "Invoice" },
] as const;

const ALL_COLUMN_KEYS = COLUMNS.map(c => c.key);

const formatDate = (d: any): string => sharedFormatDate(d);

const parseNum = (val: any): number =>
  parseFloat(String(val || 0).replace(/,/g, "")) || 0;

const gsNow = (): string => getFmsTimestamp();

const defaultForm = () => ({
  amount: "",
  paymentDetails: "",
  paymentDate: new Date(),
  paymentStatus: "pending",
  totalPaid: "",
  pendingAmount: "",
  paymentProof: null as File | null,
});

export default function FreightPayments() {
  const [records, setRecords] = useState<any[]>([]);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [formData, setFormData] = useState(defaultForm);
  const [calcData, setCalcData] = useState({ freightAmount: 0, advanceAmount: 0 });
  const [selectedColumns, setSelectedColumns] = useState<string[]>(ALL_COLUMN_KEYS);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/freight-payment");
      const json = await res.json();
      if (json.success) {
        setRecords(json.pending || []);
        setHistoryRecords(json.history || []);
      } else {
        throw new Error(json.error || "Failed to fetch data");
      }
    } catch (e: any) {
      console.error("Fetch error:", e);
      toast.error(e.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const searchLower = useMemo(() => searchTerm.toLowerCase(), [searchTerm]);

  const filteredPending = useMemo(() =>
    records.filter(r => {
      if (!searchLower) return true;
      return (
        String(r.data.lrNo || "").toLowerCase().includes(searchLower) ||
        String(r.data.transporter || "").toLowerCase().includes(searchLower) ||
        String(r.data.vehicleNo || "").toLowerCase().includes(searchLower) ||
        String(r.data.contact || "").toLowerCase().includes(searchLower)
      );
    }),
    [records, searchLower]);

  const filteredHistory = useMemo(() =>
    historyRecords.filter(r => {
      if (!searchLower) return true;
      return (
        String(r.lrNo || "").toLowerCase().includes(searchLower) ||
        String(r.transporter || "").toLowerCase().includes(searchLower)
      );
    }),
    [historyRecords, searchLower]);

  const visibleColumns = useMemo(() =>
    COLUMNS.filter(c => selectedColumns.includes(c.key)),
    [selectedColumns]);

  const handleColumnToggle = useCallback((key: string, checked: boolean) => {
    setSelectedColumns(prev =>
      checked ? [...prev, key] : prev.filter(k => k !== key)
    );
  }, []);

  const handleOpenForm = useCallback((recordId: string) => {
    const rec = records.find(r => r.id === recordId);
    if (!rec) return;

    const freight = rec.data.freightVal;
    const advance = rec.data.advanceVal;
    const pendingAmt = rec.data.pendingAmount > 0
      ? rec.data.pendingAmount
      : (freight - advance);

    setSelectedRecordId(recordId);
    setFormData({
      amount: (pendingAmt > 0 ? pendingAmt : 0).toFixed(2),
      paymentDetails: "",
      paymentDate: new Date(),
      paymentStatus: pendingAmt <= 1 ? "paid" : "pending",
      totalPaid: rec.data.totalPaid.toString(),
      pendingAmount: (pendingAmt > 0 ? pendingAmt : 0).toFixed(2),
      paymentProof: null,
    });
    setCalcData({ freightAmount: freight, advanceAmount: advance });
    setOpen(true);
  }, [records]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId) return;

    const rec = records.find(r => r.id === selectedRecordId);
    if (!rec) return;

    setIsSubmitting(true);
    const toastId = toast.loading("Processing Freight Payment...");

    try {
      let proofUrl = "";
      if (formData.paymentProof) {
        const fData = new FormData();
        fData.append("file", formData.paymentProof);
        const upRes = await fetch("/api/upload-supabase", {
          method: "POST",
          body: fData,
        });
        const upJson = await upRes.json();
        if (!upRes.ok || !upJson.success) {
          throw new Error(upJson.error || "File upload failed");
        }
        proofUrl = upJson.fileUrl;
      }

      const payAmount = parseNum(formData.amount);

      const res = await fetch("/api/freight-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          liftNo: rec.id, // rec.id is the liftNo
          payAmount,
          paymentMode: formData.paymentDetails,
          paymentDate: formData.paymentDate,
          proofUrl,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Payment submission failed");
      }

      toast.success("Freight Payment Recorded!", { id: toastId });
      setOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedRecordId, records, formData, fetchData]);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(prev => ({ ...prev, amount: e.target.value })), []);
  const handleDetailsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(prev => ({ ...prev, paymentDetails: e.target.value })), []);
  const handleDateChange = useCallback((date: Date | undefined) =>
    date && setFormData(prev => ({ ...prev, paymentDate: date })), []);
  const handleStatusChange = useCallback((v: string) =>
    setFormData(prev => ({ ...prev, paymentStatus: v })), []);
  const handleProofChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(prev => ({ ...prev, paymentProof: e.target.files?.[0] || null })), []);
  const handleTabChange = useCallback((v: string) =>
    setActiveTab(v as "pending" | "history"), []);
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
    setSearchTerm(e.target.value), []);
  const handleCloseDialog = useCallback(() => setOpen(false), []);

  const safeValue = useCallback((val: any) => {
    if (!val || val === "-" || val === "") return "-";
    if (typeof val === "string" && (val.startsWith("http") || val.includes("drive.google"))) {
      let displayUrl = val;
      if (displayUrl.includes("drive.google.com/uc")) {
        const idMatch = displayUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
          displayUrl = `https://drive.google.com/file/d/${idMatch[1]}/view`;
        }
      }
      return (
        <a href={displayUrl} target="_blank" rel="noopener noreferrer"
          className="text-blue-600 hover:underline flex items-center gap-1 justify-center">
          <FileText className="w-3 h-3" /> View
        </a>
      );
    }
    return String(val);
  }, []);

  const selectedLrNo = useMemo(() =>
    records.find(r => r.id === selectedRecordId)?.data.lrNo ?? "",
    [records, selectedRecordId]);

  const visibleHistoryColumns = useMemo(() => {
    const historyKeys = ["lrNo", "transporter", "amountPaid", "date", "planned", "actual", "mode", "status", "proof"];
    return COLUMNS.filter(c => historyKeys.includes(c.key as string));
  }, []);

  const visiblePendingColumns = useMemo(() => {
    const pendingKeys = ["lrNo", "biltyImage", "freightAmount", "transporter", "vehicleNo", "contact", "advanceAmount", "totalPaid", "pendingAmount", "plan1", "actual1", "invoiceNo", "invoiceCopy"];
    return COLUMNS.filter(c => pendingKeys.includes(c.key as string) && selectedColumns.includes(c.key)).map(c => 
      c.key === "plan1" ? { ...c, label: "Planned" } : 
      c.key === "actual1" ? { ...c, label: "Actual" } : c
    );
  }, [selectedColumns]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/30">
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b shadow-sm">
        <div className="max-w-[1600px] mx-auto">
          <div className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                <span className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-blue-200 shadow-lg">
                  <RefreshCw className="w-6 h-6 text-white" />
                </span>
                Stage 14: Freight Payments
              </h1>
              <p className="text-slate-500 text-sm mt-1 ml-13">Track and process transporter freight payments</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-80 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <Input
                  placeholder="Search by LR, Transporter, Vehicle..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="pl-10 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all h-10 rounded-xl shadow-none w-full"
                />
              </div>

              <Select value="" onValueChange={() => { }}>
                <SelectTrigger className="h-10 w-32 rounded-xl border-slate-200 bg-white hover:bg-slate-50">
                  <SelectValue placeholder="Columns" />
                </SelectTrigger>
                <SelectContent className="max-h-80 min-w-[200px] p-2 bg-white">
                  <div className="mb-2 px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visible Columns</div>
                  {COLUMNS.map(c => (
                    <div key={c.key} className="flex items-center p-2 gap-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => handleColumnToggle(c.key, !selectedColumns.includes(c.key))}>
                      <Checkbox
                        checked={selectedColumns.includes(c.key)}
                        onCheckedChange={(chk) => handleColumnToggle(c.key, !!chk)}
                        className="data-[state=checked]:bg-blue-600 border-slate-300"
                      />
                      <span className="text-sm text-slate-600 font-medium leading-none">{c.label}</span>
                    </div>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                size="icon"
                onClick={fetchData} 
                disabled={isLoading}
                className="h-10 w-10 rounded-xl bg-white hover:bg-slate-50 border-slate-200 flex-shrink-0"
              >
                <RefreshCw className={`w-4 h-4 text-slate-600 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <div className="px-6 pb-2">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="bg-slate-200/50 p-1 rounded-xl h-11 inline-flex w-auto mb-2">
                <TabsTrigger 
                  value="pending" 
                  className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all font-medium"
                >
                  Pending ({filteredPending.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="history"
                  className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all font-medium"
                >
                  History ({filteredHistory.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full flex-1">
        {isLoading && records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 bg-white border border-slate-200 rounded-3xl shadow-sm">
            <div className="relative mb-6">
              <div className="w-16 h-16 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
              <RefreshCw className="w-7 h-7 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Syncing Freight Records</h3>
            <p className="text-slate-500 mt-1 max-w-sm text-center">Fetching pending and history data from server...</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden flex flex-col h-full ring-1 ring-slate-400/5">
            <Tabs value={activeTab} className="w-full flex flex-col h-full">
              <TabsContent value="pending" className="flex-1 mt-0 focus-visible:outline-none">
                <FreightPaymentsPending
                  filteredPending={filteredPending}
                  visiblePendingColumns={visiblePendingColumns}
                  handleOpenForm={handleOpenForm}
                  parseNum={parseNum}
                  safeValue={safeValue}
                />
              </TabsContent>

              <TabsContent value="history" className="flex-1 mt-0 focus-visible:outline-none">
                <FreightPaymentsHistory
                  filteredHistory={filteredHistory}
                  visibleHistoryColumns={visibleHistoryColumns}
                  parseNum={parseNum}
                  safeValue={safeValue}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-lg border">
          <DialogHeader>
            <DialogTitle>Freight Payment</DialogTitle>
            <DialogDescription>
              Enter payment details for LR #{selectedLrNo}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-md border text-slate-900">
              <div>
                <Label className="text-xs text-gray-500">Freight Amount</Label>
                <div className="font-semibold">₹{calcData.freightAmount}</div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Advance Given</Label>
                <div className="font-semibold">₹{calcData.advanceAmount}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment Amount *</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={handleAmountChange}
                className="bg-white border"
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Details *</Label>
              <Input
                placeholder="e.g. Bank Transfer, Cash, Cheque"
                value={formData.paymentDetails}
                onChange={handleDetailsChange}
                className="bg-white border"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Payment Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-white border",
                      !formData.paymentDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.paymentDate ? format(formData.paymentDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.paymentDate}
                    onSelect={handleDateChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Payment Status *</Label>
              <Select value={formData.paymentStatus} onValueChange={handleStatusChange}>
                <SelectTrigger className="bg-white border"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Proof</Label>
              <div className="mt-1 border-2 border-dashed bg-white rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 hover:border-gray-400 transition-colors relative">
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleProofChange}
                  accept="image/*,application/pdf"
                />
                <Upload className="w-6 h-6 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-700">
                  {formData.paymentProof ? formData.paymentProof.name : "Upload file"}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-gray-600 hover:bg-gray-700 text-white">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : "Process Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
