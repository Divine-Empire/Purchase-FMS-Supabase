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
import { FileText, Loader2, Search, ClipboardCheck, RefreshCw, Eye, ClipboardList, History } from "lucide-react";
import { toast } from "sonner";
import { getFmsTimestamp, cn, formatDateTimeDash, parseSheetDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import MaterialTestingPending from "./material-testing-pending";
import MaterialTestingHistory from "./material-testing-history";

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = error => reject(error);
});

interface SearchableSrnDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder: string;
}

function SearchableSrnDropdown({ value, onChange, options, placeholder }: SearchableSrnDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
        placeholder={placeholder}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        required
      />
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {filteredOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 transition-colors focus:bg-slate-100 focus:outline-none"
              onClick={() => {
                onChange(opt);
                setSearch(opt);
                setIsOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PENDING_COLUMNS = [
  { key: "indentNumber", label: "Indent No." },
  { key: "plan7", label: "Planned" },
  { key: "liftNo", label: "Unit Tracking No." },
  { key: "itemName", label: "Item" },
  { key: "receivedQty", label: "Received Qty" },
  { key: "totalApproved", label: "Approved" },
  { key: "totalRejected", label: "Rejected" },
  { key: "pendingQty", label: "Pending Qty" },
  { key: "damageQty", label: "Damage Qty" },
  { key: "damageReason", label: "Reason" },
  { key: "damageImage", label: "Image" },
] as const;

const HISTORY_COLUMNS = [
  { key: "indentNumber", label: "Indent No." },
  { key: "plan7", label: "Planned" },
  { key: "qcDate", label: "Actual" },
  { key: "delay7", label: "Delay" },
  { key: "liftNo", label: "Lift No." },
  { key: "workingCondition", label: "Working Condition" },
  { key: "qcBy", label: "Checked By" },
  { key: "approvedQty", label: "Approved Qty" },
  { key: "checklist", label: "Checklist" },
  { key: "serialNo", label: "Serial-No" },
  { key: "image", label: "Image" },
  { key: "rejectType", label: "Reject Type" },
  { key: "partName", label: "Part-Name" },
  { key: "rejectedQty", label: "Reject Qty" },
  { key: "remarks", label: "Remarks" },
] as const;

const FILE_FIELDS = new Set(["poCopy", "receivedItemImage", "billAttachment", "rejectPhoto", "damageImage"]);
const AMOUNT_FIELDS = new Set(["freightAmount", "advanceAmount", "basicValue", "totalWithTax", "ratePerQty", "paymentAmountHydra", "paymentAmountLabour", "paymentAmountHamali"]);

export default function MaterialTesting() {
  const [open, setOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qcEngineerList, setQcEngineerList] = useState<string[]>([]);
  const [checklistList, setChecklistList] = useState<string[]>([]);
  const [rejectTypeList, setRejectTypeList] = useState<string[]>([]);
  const [partialQCRecords, setPartialQCRecords] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<any>(null);

  const [formData, setFormData] = useState({
    qcBy: "",
    qcDate: "",
    workingCondition: "",
    approvedQty: "",
    checklistSelected: [] as string[],
    rejectType: "",
    partName: "",
    rejectQty: "",
    rejectPhoto: null as File | null,
    remarks: "",
    srnEntries: [] as { serialNo: number; srn: string; image: File | null }[],
    rejectSrnEntries: [] as { serialNo: number; srn: string; image: File | null }[],
  });

  const [serialNoList, setSerialNoList] = useState<string[]>([]);
  const [isSerialsLoading, setIsSerialsLoading] = useState(false);

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
        fetch("/api/material-testing"),
      ]);

      const dropJson = await dropRes.json();
      const dataJson = await dataRes.json();

      if (dropJson.success && dropJson.data) {
        setQcEngineerList(dropJson.data.checkedByOptions || []);
        setChecklistList(dropJson.data.qcChecklistOptions || []);
        setRejectTypeList(dropJson.data.rejectTypeQcOptions || []);
      }

      if (dataJson.success) {
        setSheetRecords([...(dataJson.pending || []), ...(dataJson.history || [])]);
      } else {
        toast.error(dataJson.error || "Failed to load testing records");
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

  const pending = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return sheetRecords.filter((r) => {
      if (r.status !== "pending") return false;
      if (!searchLower) return true;
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendorName?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    });
  }, [sheetRecords, searchTerm]);

  const history = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return sheetRecords.filter((r) => {
      if (r.status !== "completed") return false;
      if (!searchLower) return true;
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendorName?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    });
  }, [sheetRecords, searchTerm]);

  const fetchSerialsForRecord = useCallback(async (indentNumber: string, liftNo: string) => {
    setIsSerialsLoading(true);
    try {
      const res = await fetch(`/api/serial-generation?liftNo=${liftNo}`);
      const json = await res.json();
      if (json.success) {
        setSerialNoList(json.serials || []);
      }
    } catch (e) {
      console.error("Failed to fetch serial numbers", e);
    } finally {
      setIsSerialsLoading(false);
    }
  }, []);

  const handleOpenForm = useCallback((recordId: string) => {
    const record = sheetRecords.find((r) => r.id === recordId);
    if (!record) return;

    setSelectedRecordId(recordId);
    setFormData({
      qcBy: "",
      qcDate: getFmsTimestamp().split(" ")[0],
      workingCondition: "",
      approvedQty: "",
      checklistSelected: [],
      rejectType: "",
      partName: "",
      rejectQty: "",
      rejectPhoto: null,
      remarks: "",
      srnEntries: [],
      rejectSrnEntries: [],
    });
    setSerialNoList([]);
    setOpen(true);

    fetchSerialsForRecord(record.data.indentNumber, record.data.liftNo);
  }, [sheetRecords, fetchSerialsForRecord]);

  const isFormValid = useMemo(() => {
    if (!formData.qcDate || !formData.workingCondition) return false;
    const isPassed = formData.workingCondition === "Passed" || formData.workingCondition === "Passed but Concern" || formData.workingCondition === "Passed but quality concern";
    if (isPassed) {
      return !!(
        formData.qcBy &&
        formData.approvedQty &&
        parseInt(formData.approvedQty) > 0 &&
        formData.checklistSelected.length > 0 &&
        formData.srnEntries.length > 0 &&
        formData.srnEntries.every((e) => e.srn.trim() !== "")
      );
    } else if (formData.workingCondition === "Rejected") {
      return !!(
        formData.rejectType &&
        formData.partName &&
        formData.rejectQty &&
        parseInt(formData.rejectQty) > 0 &&
        formData.rejectSrnEntries.length > 0 &&
        formData.rejectSrnEntries.every((e) => e.srn.trim() !== "")
      );
    }
    return false;
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    setIsSubmitting(true);
    try {
      const isPassed = formData.workingCondition === "Passed" || formData.workingCondition === "Passed but Concern" || formData.workingCondition === "Passed but quality concern";

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

      let serialNosStrList: string[] = [];
      let imageUrlsStrList: string[] = [];

      if (isPassed && formData.srnEntries.length > 0) {
        const srnData = await Promise.all(
          formData.srnEntries.map(async (entry) => {
            let imageUrl = "";
            if (entry.image instanceof File) {
              imageUrl = await uploadFile(entry.image);
            }
            return { srn: entry.srn, image: imageUrl };
          })
        );
        serialNosStrList = srnData.map((d) => d.srn).filter(Boolean);
        imageUrlsStrList = srnData.map((d) => d.image).filter(Boolean);
      } else if (formData.workingCondition === "Rejected" && formData.rejectSrnEntries.length > 0) {
        const srnData = await Promise.all(
          formData.rejectSrnEntries.map(async (entry) => {
            let imageUrl = "";
            if (entry.image instanceof File) {
              imageUrl = await uploadFile(entry.image);
            }
            return { srn: entry.srn, image: imageUrl };
          })
        );
        serialNosStrList = srnData.map((d) => d.srn).filter(Boolean);
        imageUrlsStrList = srnData.map((d) => d.image).filter(Boolean);
      }

      const payload = {
        liftNo: selectedRecord.data.liftNo,
        qcBy: formData.qcBy,
        qcDate: formData.qcDate,
        workingCondition: formData.workingCondition,
        remarks: formData.remarks,
        approvedQty: isPassed ? parseFloat(formData.approvedQty) || 0 : 0,
        rejectedQty: formData.workingCondition === "Rejected" ? parseFloat(formData.rejectQty) || 0 : 0,
        checklistSelected: isPassed ? formData.checklistSelected : [],
        serialNumbers: serialNosStrList,
        images: imageUrlsStrList,
        rejectType: formData.workingCondition === "Rejected" ? formData.rejectType : "",
        partName: formData.workingCondition === "Rejected" ? formData.partName : "",
      };

      const res = await fetch("/api/material-testing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
      }

      toast.success("Quality Check recorded successfully.");
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

      if (FILE_FIELDS.has(key)) {
        const url = data[key];
        if (!url || String(url).trim() === "" || url === "-") return "-";
        return (
          <a href={String(url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline justify-center">
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate max-w-20">View</span>
          </a>
        );
      }

      if (key === "qcStatus") {
        const status = data.qcStatus;
        if (!status || status === "-" || status === "") return "-";
        return status.charAt(0).toUpperCase() + status.slice(1);
      }

      if (key === "workingCondition") {
        const cond = data.workingCondition;
        if (!cond || cond === "-" || cond === "") return "-";
        if (cond === "yes" || cond === "Passed") return "Passed";
        if (cond === "no" || cond === "Rejected") return "Rejected";
        if (cond === "passed_concern" || cond === "Passed but Concern" || cond === "Passed but quality concern") return "Passed but quality concern";
        return cond.charAt(0).toUpperCase() + cond.slice(1);
      }

      if (key === "checklist" || key === "serialNo" || key === "image") {
        const val = data[key];
        if (!val || String(val).trim() === "" || val === "-") return "-";
        return (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors justify-center"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedHistoryRecord(record);
              setHistoryDialogOpen(true);
            }}
          >
            <Eye className="w-4 h-4" />
          </Button>
        );
      }

      if (AMOUNT_FIELDS.has(key)) {
        const amount = data[key];
        return amount && amount !== "-" && amount !== "" ? `₹${amount}` : "-";
      }

      if (key === "delay7" || key === "delay") {
        const pStr = data.plan7 || data.plannedMaterialTesting || data.plannedDate || data.planned7 || data.planned;
        const aStr = data.qcDate || data.actual7 || data.timestamp || data.actualDate || data.actual;
        const pDate = parseSheetDate(pStr);
        const aDate = parseSheetDate(aStr);
        if (!pDate || !aDate) return "-";
        const diffMs = aDate.getTime() - pDate.getTime();
        if (diffMs <= 0) return <span className="text-emerald-700 font-semibold">0</span>;
        const diffHours = diffMs / (1000 * 60 * 60);
        const days = Math.floor(diffHours / 24);
        const hours = Math.floor(diffHours % 24);
        let str = "";
        if (days > 0) str = hours > 0 ? `${days}d ${hours}h` : `${days} day${days > 1 ? "s" : ""}`;
        else if (hours > 0) str = `${hours} hr${hours > 1 ? "s" : ""}`;
        else str = `${Math.floor(diffMs / (1000 * 60))} mins`;
        return <span className="text-amber-700 font-bold">{str}</span>;
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
        <Button variant="outline" className="w-40 justify-start border-indigo-100/80 text-indigo-700 bg-white hover:bg-indigo-50/50 hover:text-indigo-800 shadow-2xs rounded-lg font-semibold text-xs transition-colors h-9">
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
      <div className="mb-6 p-6 bg-gradient-to-r from-indigo-50/50 via-blue-50/20 to-white border border-indigo-100/60 rounded-xl shadow-xs shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg shadow-indigo-100 shadow-xl text-white">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-indigo-950 tracking-tight">Stage 8: Material Testing</h2>
              <p className="text-xs text-slate-500 mt-1">Manage inspections and SRN entries</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-indigo-500" />
              <Input
                placeholder="Search records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
              onClick={fetchData}
              disabled={isLoading}
              className="bg-white hover:bg-slate-50 shrink-0 border-indigo-100/80 text-indigo-700"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full flex-1 flex flex-col overflow-hidden">
        <div className="mb-4">
          <TabsList className="bg-indigo-50/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1.5 border border-indigo-100/50 w-[420px] shadow-2xs">
            <TabsTrigger
              value="pending"
              className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-3 transition-all cursor-pointer text-slate-700"
            >
              <ClipboardList className="w-5 h-5 opacity-80" />
              <div className="flex flex-col items-start leading-none gap-1 text-left">
                <span className="font-bold">Pending</span>
                <span className="text-[10px] opacity-70 font-medium">Awaiting QC testing</span>
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
                <span className="text-[10px] opacity-70 font-medium">Completed inspections</span>
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
              <div className="w-12 h-12 border-4 border-blue-100 rounded-full animate-pulse"></div>
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 absolute inset-0" />
            </div>
            <p className="mt-4 font-medium text-slate-900">Fetching records...</p>
          </div>
        ) : (
          <div className="h-full overflow-auto p-4 lg:p-6">
            <TabsContent value="pending" className="mt-0 focus-visible:outline-none">
              <MaterialTestingPending
                pending={pending}
                handleOpenForm={handleOpenForm}
                selectedPendingColumns={selectedPendingColumns}
                PENDING_COLUMNS={PENDING_COLUMNS}
                safeValue={safeValue}
              />
            </TabsContent>

            <TabsContent value="history" className="mt-0 focus-visible:outline-none">
              <MaterialTestingHistory
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
          <DialogHeader className="p-6 bg-slate-50 border-b">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              Quality Control Inspection
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Indent No.</dt>
                <dd className="text-sm font-semibold text-slate-900">{selectedRecord?.data?.indentNumber || "-"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Vendor</dt>
                <dd className="text-sm font-semibold text-slate-900 truncate">{selectedRecord?.data?.vendorName || "-"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Item</dt>
                <dd className="text-sm font-semibold text-slate-900 truncate">{selectedRecord?.data?.itemName || "-"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Received Qty</dt>
                <dd className="text-sm font-semibold text-slate-900">{selectedRecord?.data?.receivedQty || "0"} units</dd>
              </div>
            </div>

            <form onSubmit={handleSubmit} id="qc-form" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">Machine Working Condition *</Label>
                  <Select
                    value={formData.workingCondition}
                    onValueChange={(v) => setFormData({
                      ...formData,
                      workingCondition: v,
                      approvedQty: v === "Rejected" ? "" : formData.approvedQty,
                      checklistSelected: v === "Rejected" ? [] : formData.checklistSelected,
                      srnEntries: v === "Rejected" ? [] : formData.srnEntries,
                      rejectType: (v === "Passed" || v === "Passed but Concern" || v === "Passed but quality concern") ? "" : formData.rejectType,
                      partName: (v === "Passed" || v === "Passed but Concern" || v === "Passed but quality concern") ? "" : formData.partName,
                      rejectQty: (v === "Passed" || v === "Passed but Concern" || v === "Passed but quality concern") ? "" : formData.rejectQty,
                      rejectSrnEntries: (v === "Passed" || v === "Passed but Concern" || v === "Passed but quality concern") ? [] : formData.rejectSrnEntries,
                    })}
                  >
                    <SelectTrigger className="bg-white border-slate-200 rounded-lg shadow-sm h-10">
                      <SelectValue placeholder="Select Option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Passed">Passed</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                      <SelectItem value="Passed but quality concern">Passed but quality concern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">QC Date *</Label>
                  <Input
                    type="date"
                    className="bg-white border-slate-200 rounded-lg shadow-sm h-10"
                    value={formData.qcDate}
                    onChange={(e) => setFormData({ ...formData, qcDate: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">Checked By</Label>
                  <Select value={formData.qcBy} onValueChange={(v) => setFormData({ ...formData, qcBy: v })}>
                    <SelectTrigger className="bg-white border-slate-200 rounded-lg shadow-sm h-10">
                      <SelectValue placeholder="Select engineer" />
                    </SelectTrigger>
                    <SelectContent>
                      {qcEngineerList.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {(formData.workingCondition === "Passed" || formData.workingCondition === "Passed but Concern" || formData.workingCondition === "Passed but quality concern") && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700 font-medium">Approved Qty *</Label>
                      <Input
                        type="number"
                        min="1"
                        max={selectedRecord?.data?.pendingQty || 999}
                        className="bg-white border-slate-200 rounded-lg shadow-sm h-10"
                        placeholder={`Pending: ${selectedRecord?.data?.pendingQty || "0"}`}
                        value={formData.approvedQty}
                        onChange={(e) => {
                          const qty = parseInt(e.target.value) || 0;
                          const maxQty = parseInt(selectedRecord?.data?.pendingQty) || 999;
                          const validQty = Math.min(Math.max(0, qty), maxQty);
                          const newEntries = Array.from({ length: validQty }, (_, i) => ({
                            serialNo: i + 1,
                            srn: formData.srnEntries[i]?.srn || "",
                            image: formData.srnEntries[i]?.image || null,
                          }));
                          setFormData({ ...formData, approvedQty: String(validQty), srnEntries: newEntries });
                        }}
                        required
                      />
                    </div>

                    <div className="space-y-2 col-span-full">
                      <Label className="text-xs font-bold text-slate-700">Checklist *</Label>
                      <div className="grid grid-cols-1 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-[160px] overflow-y-auto">
                        {checklistList.map((item) => {
                          const isChecked = formData.checklistSelected.includes(item);
                          return (
                            <div key={item} className="flex items-start space-x-3 py-1">
                              <input
                                type="checkbox"
                                id={`checklist-${item}`}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                checked={isChecked}
                                onChange={() => {
                                  setFormData((prev) => {
                                    const list = prev.checklistSelected.includes(item)
                                      ? prev.checklistSelected.filter((i) => i !== item)
                                      : [...prev.checklistSelected, item];
                                    return { ...prev, checklistSelected: list };
                                  });
                                }}
                              />
                              <Label
                                htmlFor={`checklist-${item}`}
                                className="text-xs font-medium text-slate-700 cursor-pointer leading-normal"
                              >
                                {item}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {formData.workingCondition === "Rejected" && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700">Reject Type *</Label>
                      <Select value={formData.rejectType} onValueChange={(v) => setFormData({ ...formData, rejectType: v })}>
                        <SelectTrigger className="bg-white border-slate-200 rounded-lg shadow-sm h-10">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {rejectTypeList.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700">Part-Name *</Label>
                      <Input
                        type="text"
                        placeholder="Enter part name"
                        className="bg-white border-slate-200 rounded-lg shadow-sm h-10"
                        value={formData.partName}
                        onChange={(e) => setFormData({ ...formData, partName: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700">Reject Qty *</Label>
                      <Input
                        type="number"
                        min="1"
                        max={selectedRecord?.data?.pendingQty || 999}
                        className="bg-white border-slate-200 rounded-lg shadow-sm h-10"
                        placeholder={`Pending: ${selectedRecord?.data?.pendingQty || "0"}`}
                        value={formData.rejectQty}
                        onChange={(e) => {
                          const qty = parseInt(e.target.value) || 0;
                          const maxQty = parseInt(selectedRecord?.data?.pendingQty) || 999;
                          const validQty = Math.min(Math.max(0, qty), maxQty);
                          const newEntries = Array.from({ length: validQty }, (_, i) => ({
                            serialNo: i + 1,
                            srn: formData.rejectSrnEntries[i]?.srn || "",
                            image: formData.rejectSrnEntries[i]?.image || null,
                          }));
                          setFormData({ ...formData, rejectQty: String(validQty), rejectSrnEntries: newEntries });
                        }}
                        required
                      />
                    </div>
                  </>
                )}
              </div>

              {(formData.workingCondition === "Passed" || formData.workingCondition === "Passed but Concern" || formData.workingCondition === "Passed but quality concern") && formData.srnEntries.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">Approved-Qty with S No. and Img</h3>
                    <span className="text-xs bg-white text-slate-600 px-2 py-0.5 rounded-full border border-slate-200 font-medium">
                      {formData.srnEntries.length} Items Pending
                    </span>
                  </div>
                  <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
                    {formData.srnEntries.map((entry, idx) => (
                      <div key={entry.serialNo} className="grid grid-cols-12 gap-3 items-center bg-white p-3 rounded-lg border border-slate-100 group">
                        <div className="col-span-1 text-xs font-bold text-slate-400">#{entry.serialNo}</div>
                        <div className="col-span-5 relative">
                          <SearchableSrnDropdown
                            value={entry.srn}
                            onChange={(val) => {
                              const updated = [...formData.srnEntries];
                              updated[idx] = { ...updated[idx], srn: val };
                              setFormData({ ...formData, srnEntries: updated });
                            }}
                            options={serialNoList}
                            placeholder="Select/Search SRN"
                          />
                        </div>
                        <div className="col-span-6 flex items-center gap-2">
                          <div className="flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              id={`srn-image-${idx}`}
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                const updated = [...formData.srnEntries];
                                updated[idx] = { ...updated[idx], image: file };
                                setFormData({ ...formData, srnEntries: updated });
                              }}
                            />
                            <label
                              htmlFor={`srn-image-${idx}`}
                              className={`flex items-center justify-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer transition-all h-9 text-xs font-medium ${entry.image
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                            >
                              {entry.image ? (
                                <>
                                  <FileText className="w-3.5 h-3.5" />
                                  <span className="truncate max-w-[120px]">{entry.image.name}</span>
                                </>
                              ) : (
                                "Attach Photo"
                              )}
                            </label>
                          </div>
                          {entry.image && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              onClick={() => {
                                const updated = [...formData.srnEntries];
                                updated[idx] = { ...updated[idx], image: null };
                                setFormData({ ...formData, srnEntries: updated });
                              }}
                            >
                              ✕
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formData.workingCondition === "Rejected" && formData.rejectSrnEntries.length > 0 && (
                <div className="bg-red-50/30 border border-red-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-red-50/80 border-b border-red-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-red-800">Rejected-Qty with S No. and Img</h3>
                    <span className="text-xs bg-white text-red-600 px-2 py-0.5 rounded-full border border-red-200 font-medium">
                      {formData.rejectSrnEntries.length} Items Pending
                    </span>
                  </div>
                  <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
                    {formData.rejectSrnEntries.map((entry, idx) => (
                      <div key={entry.serialNo} className="grid grid-cols-12 gap-3 items-center bg-white p-3 rounded-lg border border-slate-100 group">
                        <div className="col-span-1 text-xs font-bold text-slate-400">#{entry.serialNo}</div>
                        <div className="col-span-5 relative">
                          <SearchableSrnDropdown
                            value={entry.srn}
                            onChange={(val) => {
                              const updated = [...formData.rejectSrnEntries];
                              updated[idx] = { ...updated[idx], srn: val };
                              setFormData({ ...formData, rejectSrnEntries: updated });
                            }}
                            options={serialNoList}
                            placeholder="Select/Search SRN"
                          />
                        </div>
                        <div className="col-span-6 flex items-center gap-2">
                          <div className="flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              id={`reject-srn-image-${idx}`}
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                const updated = [...formData.rejectSrnEntries];
                                updated[idx] = { ...updated[idx], image: file };
                                setFormData({ ...formData, rejectSrnEntries: updated });
                              }}
                            />
                            <label
                              htmlFor={`reject-srn-image-${idx}`}
                              className={`flex items-center justify-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer transition-all h-9 text-xs font-medium ${entry.image
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                            >
                              {entry.image ? (
                                <>
                                  <FileText className="w-3.5 h-3.5" />
                                  <span className="truncate max-w-[120px]">{entry.image.name}</span>
                                </>
                              ) : (
                                "Attach Photo"
                              )}
                            </label>
                          </div>
                          {entry.image && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              onClick={() => {
                                const updated = [...formData.rejectSrnEntries];
                                updated[idx] = { ...updated[idx], image: null };
                                setFormData({ ...formData, rejectSrnEntries: updated });
                              }}
                            >
                              ✕
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 font-medium">
                  {formData.workingCondition === "Passed but Concern" || formData.workingCondition === "Passed but quality concern" ? "Concern Issue" : "Remarks"}
                </Label>
                <textarea
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl resize-none text-sm focus:ring-blue-500 h-24"
                  rows={3}
                  placeholder={formData.workingCondition === "Passed but Concern" || formData.workingCondition === "Passed but quality concern" ? "Concern Issue..." : "Remarks..."}
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
              form="qc-form"
              className="px-10 bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading Assets...
                </>
              ) : (
                "Finalize Quality Report"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              Inspection Details
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Indent No</span>
                <span className="text-xs font-bold text-slate-800">{selectedHistoryRecord?.data?.indentNumber || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lift No</span>
                <span className="text-xs font-bold text-slate-800">{selectedHistoryRecord?.data?.liftNo || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">QC Date</span>
                <span className="text-xs font-medium text-slate-800">{selectedHistoryRecord?.data?.qcDate || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Checked By</span>
                <span className="text-xs font-medium text-slate-800">{selectedHistoryRecord?.data?.qcBy || "-"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">QC Checklist</h4>
              {selectedHistoryRecord?.data?.checklist && selectedHistoryRecord.data.checklist !== "-" ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedHistoryRecord.data.checklist.split(",").map((item: string, i: number) => (
                    <span key={i} className="text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full">
                      ✓ {item.trim()}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">No checklist recorded</span>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Serial Numbers & Photos</h4>
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {selectedHistoryRecord?.data?.serialNo && selectedHistoryRecord.data.serialNo !== "-" ? (
                  (() => {
                    const serials = String(selectedHistoryRecord.data.serialNo).split(",").map(s => s.trim()).filter(Boolean);
                    const images = selectedHistoryRecord?.data?.image && selectedHistoryRecord.data.image !== "-"
                      ? String(selectedHistoryRecord.data.image).split(",").map(i => i.trim()).filter(Boolean)
                      : [];
                    return serials.map((serial, idx) => {
                      const imageUrl = images[idx] || "";
                      return (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                          <span className="text-xs font-semibold text-slate-400">#{idx + 1}</span>
                          {imageUrl ? (
                            <a
                              href={imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-sm transition-all hover:bg-slate-50"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-500" />
                              {serial}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-600 font-medium bg-white px-2.5 py-1 rounded border border-slate-200">
                              {serial}
                            </span>
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

          <DialogFooter className="p-4 bg-slate-50 border-t flex justify-end">
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)} className="px-5 text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
