"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, FileText, RefreshCw, Upload, CalendarIcon, Search, ClipboardList, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { cn, formatDate as sharedFormatDate, getFmsTimestamp, canViewPurchaserRecord } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
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
  { key: "delay", label: "Delay" },
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

// History (the payment-log tab) is fetched lazily — only once the user opens that
// tab — and paginated server-side, since it grows unboundedly over time unlike
// Pending (bounded by open freight invoices). Default page size stays small (100)
// until search narrows it (200).
const HISTORY_DEFAULT_LIMIT = 100;
const HISTORY_FILTERED_LIMIT = 200;

export default function FreightPayments() {
  const { role, records: recordsAccess } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
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
      const params = new URLSearchParams({ view: "pending" });
      if (role) params.set("role", role);
      if (recordsAccess) params.set("records", recordsAccess);

      const res = await fetch(`/api/freight-payment?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setRecords(json.pending || []);
        setHistoryCount(json.historyCount || 0);
      } else {
        throw new Error(json.error || "Failed to fetch data");
      }
    } catch (e: any) {
      console.error("Fetch error:", e);
      toast.error(e.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [role, recordsAccess]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const historyLoadedRef = React.useRef(false);
  const historyHasSearch = activeTab === "history" && !!searchTerm;
  const historyLimit = historyHasSearch ? HISTORY_FILTERED_LIMIT : HISTORY_DEFAULT_LIMIT;

  const fetchHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        view: "history",
        page: String(historyPage),
      });
      if (searchTerm) params.set("search", searchTerm);
      if (role) params.set("role", role);
      if (recordsAccess) params.set("records", recordsAccess);

      const res = await fetch(`/api/freight-payment?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setHistoryRecords(json.history || []);
        setHistoryTotalCount(json.totalCount || 0);
      } else {
        toast.error(json.error || "Failed to load payment history");
      }
    } catch (e) {
      console.error("History fetch error:", e);
      toast.error("Failed to load payment history");
    }
    setIsHistoryLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyPage, searchTerm, role, recordsAccess]);

  // History only loads once the user opens that tab, and again on page/search change
  // while it's active. Search is debounced; the first load on tab-open is immediate.
  useEffect(() => {
    if (activeTab !== "history") return;
    const debounceMs = historyLoadedRef.current ? 300 : 0;
    const timer = setTimeout(() => {
      historyLoadedRef.current = true;
      fetchHistory();
    }, debounceMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, historyPage, searchTerm]);

  // Changing search resets History back to page 0.
  useEffect(() => {
    setHistoryPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const searchLower = useMemo(() => searchTerm.toLowerCase(), [searchTerm]);

  // Purchaser-based record access: only show records this user is allowed to see.
  const visibleRecords = useMemo(
    () => records.filter((r) => canViewPurchaserRecord(r.data?.purchaser, recordsAccess, role)),
    [records, recordsAccess, role]
  );

  const filteredPending = useMemo(() =>
    visibleRecords.filter(r => {
      if (!searchLower) return true;
      return (
        String(r.data.lrNo || "").toLowerCase().includes(searchLower) ||
        String(r.data.transporter || "").toLowerCase().includes(searchLower) ||
        String(r.data.vehicleNo || "").toLowerCase().includes(searchLower) ||
        String(r.data.contact || "").toLowerCase().includes(searchLower)
      );
    }),
    [visibleRecords, searchLower]);

  // historyRecords is already filtered/searched/paginated server-side (see
  // fetchHistory above) — used as-is, no client-side re-filtering.
  const filteredHistory = historyRecords;

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
    const historyKeys = ["lrNo", "transporter", "planned", "actual", "delay", "amountPaid", "date", "mode", "status", "proof"];
    return COLUMNS.filter(c => historyKeys.includes(c.key as string));
  }, []);

  const visiblePendingColumns = useMemo(() => {
    const pendingKeys = ["lrNo", "biltyImage", "freightAmount", "transporter", "vehicleNo", "contact", "advanceAmount", "totalPaid", "pendingAmount", "plan1", "actual1", "invoiceNo", "invoiceCopy"];
    return COLUMNS.filter(c => pendingKeys.includes(c.key as string) && selectedColumns.includes(c.key)).map(c => 
      c.key === "plan1" ? { ...c, label: "Planned" } : 
      c.key === "actual1" ? { ...c, label: "Actual" } : c
    );
  }, [selectedColumns]);

  const ColumnSelector = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-40 justify-start border-indigo-100/80 text-indigo-700 bg-white hover:bg-indigo-50/50 hover:text-indigo-800 shadow-2xs rounded-lg font-semibold text-xs transition-colors h-9">
          {selectedColumns.length === COLUMNS.length
            ? "All columns"
            : `${selectedColumns.length} columns selected`
          }
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 max-h-80 overflow-y-auto">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100" onClick={() => {
            if (selectedColumns.length === COLUMNS.length) {
              setSelectedColumns([]);
            } else {
              setSelectedColumns(COLUMNS.map(c => c.key));
            }
          }}>
            <Checkbox
              id="select-all-cols"
              checked={selectedColumns.length === COLUMNS.length}
              onCheckedChange={(checked) => {
                setSelectedColumns(checked ? COLUMNS.map(c => c.key) : []);
              }}
            />
            <Label htmlFor="select-all-cols" className="text-sm font-semibold cursor-pointer">Select All</Label>
          </div>
          {COLUMNS.map((c) => (
            <div key={c.key} className="flex items-center space-x-2 py-1.5 hover:bg-slate-50 px-1 rounded cursor-pointer" onClick={() => handleColumnToggle(c.key, !selectedColumns.includes(c.key))}>
              <Checkbox
                id={`col-${c.key}`}
                checked={selectedColumns.includes(c.key)}
                onCheckedChange={(checked) => handleColumnToggle(c.key, !!checked)}
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
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex-1 flex flex-col overflow-hidden">
        {/* Header Card */}
        <div className="mb-6 p-6 bg-gradient-to-r from-indigo-50/50 via-blue-50/20 to-white border border-indigo-100/60 rounded-xl shadow-xs shrink-0">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg shadow-indigo-100 shadow-xl text-white">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-indigo-950 tracking-tight">Stage 14: Freight Payments</h2>
                <p className="text-xs text-slate-500 mt-1">Track and process transporter freight payments</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-indigo-500" />
                <Input
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="pl-9 bg-white border-indigo-100 focus-visible:ring-indigo-500"
                />
              </div>
              <div className="h-8 w-px bg-indigo-100/60 hidden md:block" />
              <div className="flex items-center gap-2">
                <div className="flex flex-col text-right leading-none hidden md:block">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Show</span>
                  <span className="text-[11px] font-extrabold text-indigo-950">Columns:</span>
                </div>
                <ColumnSelector />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  fetchData();
                  if (activeTab === "history") fetchHistory();
                }}
                disabled={isLoading || isHistoryLoading}
                className="bg-white hover:bg-slate-50 shrink-0 border-indigo-100/80 text-indigo-700"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading || isHistoryLoading ? "animate-spin" : ""}`} />
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
                <span className="text-[10px] opacity-70 font-medium">Awaiting payment</span>
              </div>
              <Badge variant="secondary" className={cn(
                "px-2.5 py-0.5 font-extrabold rounded-full text-xs min-w-[24px] text-center border-none transition-all",
                activeTab === "pending"
                  ? "bg-white text-red-600 shadow-xs"
                  : "bg-red-100 text-red-700"
              )}>
                {filteredPending.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-3 transition-all cursor-pointer text-slate-700"
            >
              <History className="w-5 h-5 opacity-80" />
              <div className="flex flex-col items-start leading-none gap-1 text-left">
                <span className="font-bold">History</span>
                <span className="text-[10px] opacity-70 font-medium">Payment history</span>
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
        </div>

        <div className="flex-1 overflow-hidden">
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
            <div className="h-full overflow-auto">
              <TabsContent value="pending" className="mt-0 focus-visible:outline-none">
                <FreightPaymentsPending
                  filteredPending={filteredPending}
                  visiblePendingColumns={visiblePendingColumns}
                  handleOpenForm={handleOpenForm}
                  parseNum={parseNum}
                  safeValue={safeValue}
                />
              </TabsContent>

              <TabsContent value="history" className="mt-0 focus-visible:outline-none">
                {isHistoryLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
                    <p className="font-medium">Loading payment history...</p>
                  </div>
                ) : (
                  <>
                    <FreightPaymentsHistory
                      filteredHistory={filteredHistory}
                      visibleHistoryColumns={visibleHistoryColumns}
                      parseNum={parseNum}
                      safeValue={safeValue}
                    />
                    {historyTotalCount > historyLimit && (
                      <div className="flex items-center justify-between mt-3 px-4 pb-4 text-sm text-slate-600">
                        {historyHasSearch ? (
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
            </div>
          )}
        </div>
      </Tabs>

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
