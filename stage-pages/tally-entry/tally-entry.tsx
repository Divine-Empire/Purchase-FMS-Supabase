"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, FileText, Search, RefreshCw, ClipboardList, History } from "lucide-react";
import { parseSheetDate, getFmsTimestamp, cn, formatDateTimeDash, canViewPurchaserRecord } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";

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
import TallyEntryPending from "./tally-entry-pending";
import TallyEntryHistory from "./tally-entry-history";

const pendingColumns = [
  { key: "indentNumber", label: "Indent No." },
  { key: "plan8", label: "Planned" },
  { key: "createdBy", label: "Created By" },
  { key: "category", label: "Category" },
  { key: "itemName", label: "Item" },
  { key: "indentQty", label: "Qty" },
  { key: "warehouse", label: "Warehouse" },
  { key: "vendorName", label: "Vendor" },
  { key: "poNumber", label: "PO Number" },
  { key: "basicValue", label: "Basic Value" },
  { key: "totalWithTax", label: "Total w/Tax" },
  { key: "poCopy", label: "PO Copy" },
  { key: "receiptLiftNumber", label: "Unit Tracking No." },
  { key: "readyQty", label: "Ready Qty" },
  { key: "invoiceNumber", label: "Invoice No." },
  { key: "invoiceDate", label: "Invoice Date" },
  { key: "qcRequirement", label: "QC Required" },
  { key: "receivedItemImage", label: "Rec. Item Img" },
  { key: "billAttachment", label: "Bill Attach" },
] as const;

const historyColumns = [
  { key: "indentNumber", label: "Indent No." },
  { key: "plan8", label: "Planned" },
  { key: "actual8", label: "Actual" },
  { key: "delay8", label: "Delay" },
  { key: "createdBy", label: "Created By" },
  { key: "category", label: "Category" },
  { key: "itemName", label: "Item" },
  { key: "indentQty", label: "Qty" },
  { key: "warehouse", label: "Warehouse" },
  { key: "vendorName", label: "Vendor" },
  { key: "poNumber", label: "PO Number" },
  { key: "basicValue", label: "Basic Value" },
  { key: "totalWithTax", label: "Total w/Tax" },
  { key: "poCopy", label: "PO Copy" },
  { key: "receiptLiftNumber", label: "Unit Tracking No." },
  { key: "receivedQty", label: "Rec. Qty" },
  { key: "invoiceNumber", label: "Invoice No." },
  { key: "invoiceDate", label: "Invoice Date" },
  { key: "qcRequirement", label: "QC Required" },
  { key: "receivedItemImage", label: "Rec. Item Img" },
  { key: "billAttachment", label: "Bill Attach" },
  { key: "doneBy", label: "Tally Done By" },
  { key: "doneDate", label: "Tally Date" },
  { key: "tallyStatus", label: "Tally Status" },
  { key: "remarks", label: "Tally Remarks" },
  { key: "checkedStatus", label: "Checked" },
  { key: "checkedByAcc", label: "Checked By" },
] as const;

export default function TallyEntry() {
  const { role, records: recordsAccess } = useAuth();
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("All");
  const [accountantList, setAccountantList] = useState<string[]>([]);
  const [checkerList, setCheckerList] = useState<string[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    doneBy: "",
    submissionDate: new Date().toISOString().split("T")[0],
    remarks: "",
    checkedStatus: "",
    checkedByAcc: "",
  });

  const [selectedPendingColumns, setSelectedPendingColumns] = useState<string[]>(
    pendingColumns.map((c) => c.key)
  );

  const [selectedHistoryColumns, setSelectedHistoryColumns] = useState<string[]>(
    historyColumns.map((c) => c.key)
  );

  const handleOpenModal = () => {
    if (selectedRows.size === 0) return;
    setBulkError(null);

    const selectedRecords = sheetRecords.filter((r) => selectedRows.has(r.id));
    if (selectedRecords.length === 0) return;

    const firstInvoice = selectedRecords[0].data.invoiceNumber;
    const isConsistent = selectedRecords.every(
      (r) => r.data.invoiceNumber === firstInvoice
    );

    if (!isConsistent) {
      setBulkError(
        "Selected items have different Invoice Numbers. Cannot submit together."
      );
    }

    const rec = selectedRecords[0];
    const hasCheckedBy = !!rec.data.checkedByAcc && rec.data.checkedByAcc !== "-";
    const doneByExists = !!rec.data.doneBy && rec.data.doneBy !== "-";

    let status = "";
    if (rec.data.checkedStatus && rec.data.checkedStatus !== "-") {
      status = rec.data.checkedStatus;
    } else if (doneByExists) {
      status = "No";
    }

    setFormData({
      doneBy: doneByExists ? rec.data.doneBy : "",
      submissionDate: new Date().toISOString().split("T")[0],
      remarks:
        rec.data.remarks && rec.data.remarks !== "-" ? rec.data.remarks : "",
      checkedStatus: status,
      checkedByAcc: hasCheckedBy ? rec.data.checkedByAcc : "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (
      selectedRows.size === 0 ||
      !formData.doneBy ||
      !formData.checkedStatus
    )
      return;
    if (formData.checkedStatus === "Yes" && !formData.checkedByAcc) return;
    if (bulkError) return;

    setIsSubmitting(true);
    try {
      const selectedRecords = sheetRecords.filter((r) => selectedRows.has(r.id));
      const records = selectedRecords.map((rec) => ({
        liftNo: rec.id,
        doneBy: formData.doneBy,
        doneDate: formData.submissionDate || null,
        remarks: formData.remarks,
        checkedStatus: formData.checkedStatus,
        checkedByAcc: formData.checkedStatus === "Yes" ? formData.checkedByAcc : null
      }));

      const res = await fetch("/api/tally-entry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          records
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
      }

      toast.success(
        formData.checkedStatus === "Yes"
          ? "Tally Entry Completed (Bulk)!"
          : "Tally Entry Saved (Bulk Pending)"
      );
      setIsModalOpen(false);
      setSelectedRows(new Set());
      fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [dataRes, dropRes] = await Promise.all([
        fetch("/api/tally-entry"),
        fetch("/api/dropdowns")
      ]);

      const dataJson = await dataRes.json();
      const dropJson = await dropRes.json();

      if (dataJson.success) {
        setSheetRecords([...(dataJson.pending || []), ...(dataJson.history || [])]);
      } else {
        toast.error(dataJson.error || "Failed to load tally entries");
      }

      if (dropJson.success && dropJson.data) {
        setAccountantList(dropJson.data.accountsOptions || []);
        setCheckerList(dropJson.data.accountsOptions || []);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      toast.error("Failed to load data");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Purchaser-based record access: only show records this user is allowed to see.
  const visibleRecords = useMemo(
    () => sheetRecords.filter((r) => canViewPurchaserRecord(r.data?.purchaser, recordsAccess, role)),
    [sheetRecords, recordsAccess, role]
  );

  const pending = useMemo(
    () =>
      visibleRecords
        .filter((r: any) => r.status === "pending")
        .filter((r) => {
          if (
            warehouseFilter === "NE Warehouse" &&
            r.data.warehouse !== "NE Warehouse"
          )
            return false;
          if (
            warehouseFilter === "Others" &&
            r.data.warehouse === "NE Warehouse"
          )
            return false;

          const searchLower = searchTerm.toLowerCase();
          return (
            r.data.indentNumber?.toLowerCase().includes(searchLower) ||
            r.data.itemName?.toLowerCase().includes(searchLower) ||
            r.data.vendorName?.toLowerCase().includes(searchLower) ||
            String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
            String(r.data.invoiceNumber || "")
              .toLowerCase()
              .includes(searchLower)
          );
        }),
    [visibleRecords, searchTerm, warehouseFilter]
  );

  const completed = useMemo(
    () =>
      visibleRecords
        .filter((r: any) => r.status === "completed")
        .filter((r: any) => {
          if (
            warehouseFilter === "NE Warehouse" &&
            r.data.warehouse !== "NE Warehouse"
          )
            return false;
          if (
            warehouseFilter === "Others" &&
            r.data.warehouse === "NE Warehouse"
          )
            return false;

          const searchLower = searchTerm.toLowerCase();
          if (!searchLower) return true;
          return (
            r.data.indentNumber?.toLowerCase().includes(searchLower) ||
            r.data.itemName?.toLowerCase().includes(searchLower) ||
            r.data.vendorName?.toLowerCase().includes(searchLower) ||
            String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
            String(r.data.invoiceNumber || "")
              .toLowerCase()
              .includes(searchLower)
          );
        }),
    [visibleRecords, searchTerm, warehouseFilter]
  );

  const toggleRow = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedRows((prev) => {
      if (prev.size === pending.length) {
        return new Set();
      } else {
        return new Set(pending.map((r: any) => r.id));
      }
    });
  }, [pending]);

  const getVendorData = (record: any) => {
    const data = record?.data;
    if (!data) return { name: "-", rate: "-", terms: "-" };
    return {
      name: data.vendorName || data.vendorNameFallback || "-",
      rate: data.rate || "-",
      terms: data.terms || "-",
    };
  };

  const formatDateDash = (dateStr: any) => formatDateTimeDash(dateStr);

  const safeValue = useCallback((record: any, key: string) => {
    try {
      const data = record?.data;
      if (!data) return "-";

      const vendor = getVendorData(record);

      const fileFields = [
        "poCopy",
        "receivedItemImage",
        "billAttachment",
        "rejectPhoto",
        "biltyCopy",
      ];
      if (fileFields.includes(key)) {
        let url = data[key];
        if (key === "biltyCopy") url = data.liftingData?.[0]?.biltyCopy;

        if (!url || String(url).trim() === "" || url === "-") return "-";

        let displayUrl = String(url);
        if (displayUrl.includes("drive.google.com/uc")) {
          const idMatch = displayUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (idMatch && idMatch[1]) {
            displayUrl = `https://drive.google.com/file/d/${idMatch[1]}/view`;
          }
        }

        return (
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline justify-center"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate max-w-20">View</span>
          </a>
        );
      }

      if (key === "vendorName") return vendor.name;
      if (key === "ratePerQty") return vendor.rate ? `₹${vendor.rate}` : "-";
      if (key === "paymentTerms") return vendor.terms;

      if (key === "receiptLiftNumber") return data.liftNumber || "-";

      if (
        key === "paymentAmountHydra" ||
        key === "paymentAmountLabour" ||
        key === "paymentAmountHamali"
      ) {
        return data[key] ? `₹${data[key]}` : "-";
      }

      if (key === "qcStatus") {
        const val = data[key];
        if (!val || val === "-") return "-";
        return String(val).charAt(0).toUpperCase() + String(val).slice(1);
      }

      if (key === "delay8" || key === "delay") {
        const pDate = parseSheetDate(data.plan8 || data.planned8 || data.plannedDate);
        const aDate = parseSheetDate(data.actual8 || data.actualDate);
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
      if (val === undefined || val === null || String(val).trim() === "")
        return "-";

      const lowKey = key.toLowerCase();
      if (
        lowKey.includes("date") ||
        lowKey.includes("plan") ||
        lowKey.includes("actual")
      ) {
        return formatDateDash(val);
      }

      return String(val);
    } catch (err) {
      return "-";
    }
  }, []);

  return (
    <div className="p-4 md:p-6 min-h-screen bg-[#f8fafc]">
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Tally Entry ({selectedRows.size} Selected)</DialogTitle>
          </DialogHeader>

          {bulkError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 border border-red-200">
              {bulkError}
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Done By *</Label>
              <Select
                value={formData.doneBy}
                onValueChange={(v) => setFormData({ ...formData, doneBy: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Accountant" />
                </SelectTrigger>
                <SelectContent>
                  {accountantList.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.submissionDate}
                onChange={(e) =>
                  setFormData({ ...formData, submissionDate: e.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Remarks</Label>
              <Input
                value={formData.remarks}
                onChange={(e) =>
                  setFormData({ ...formData, remarks: e.target.value })
                }
                placeholder="Optional..."
              />
            </div>

            <div className="grid gap-2">
              <Label>Checked *</Label>
              <Select
                value={formData.checkedStatus}
                onValueChange={(v) => setFormData({ ...formData, checkedStatus: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.checkedStatus === "Yes" && (
              <div className="grid gap-2">
                <Label>Checked By *</Label>
                <Select
                  value={formData.checkedByAcc}
                  onValueChange={(v) => setFormData({ ...formData, checkedByAcc: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Accountant" />
                  </SelectTrigger>
                  <SelectContent>
                    {checkerList.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formData.doneBy ||
                !formData.checkedStatus ||
                (formData.checkedStatus === "Yes" && !formData.checkedByAcc) ||
                isSubmitting ||
                !!bulkError
              }
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="w-full"
      >
        <div className="md:sticky md:top-0 z-50 bg-[#f8fafc] -mx-4 md:-mx-6 px-4 md:px-6 pt-2 pb-4 mb-4 border-b shadow-sm">
          <div className="mb-4 md:mb-6 p-4 md:p-6 bg-white border rounded-lg shadow-sm">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <FileText className="w-7 h-7 text-indigo-600" />
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Stage 9: Tally Entry
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-1 justify-end flex-wrap">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-slate-600">
                    Columns:
                  </Label>
                  <Select value="" onValueChange={() => {}}>
                    <SelectTrigger className="w-40 bg-white border-slate-200 h-9 text-slate-900">
                      <SelectValue
                        placeholder={
                          activeTab === "pending"
                            ? `${selectedPendingColumns.length} selected`
                            : `${selectedHistoryColumns.length} selected`
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="w-56 max-h-96 overflow-y-auto">
                      <div className="p-2">
                        <div className="flex items-center space-x-2 mb-2 pb-2 border-b">
                          <Checkbox
                            id="select-all-columns"
                            checked={
                              activeTab === "pending"
                                ? selectedPendingColumns.length ===
                                  pendingColumns.length
                                : selectedHistoryColumns.length ===
                                  historyColumns.length
                            }
                            onCheckedChange={(checked) => {
                              if (activeTab === "pending") {
                                setSelectedPendingColumns(
                                  checked
                                    ? pendingColumns.map((c) => c.key)
                                    : []
                                );
                              } else {
                                setSelectedHistoryColumns(
                                  checked
                                    ? historyColumns.map((c) => c.key)
                                    : []
                                );
                              }
                            }}
                          />
                          <Label
                            htmlFor="select-all-columns"
                            className="text-sm font-semibold text-slate-900 cursor-pointer"
                          >
                            Select All
                          </Label>
                        </div>
                        {(activeTab === "pending"
                          ? pendingColumns
                          : historyColumns
                        ).map((col) => (
                          <div
                            key={col.key}
                            className="flex items-center space-x-2 py-1.5 hover:bg-slate-50 px-1 rounded transition-colors"
                          >
                            <Checkbox
                              id={`col-${col.key}`}
                              checked={
                                activeTab === "pending"
                                  ? selectedPendingColumns.includes(col.key)
                                  : selectedHistoryColumns.includes(col.key)
                              }
                              onCheckedChange={(checked) => {
                                if (activeTab === "pending") {
                                  setSelectedPendingColumns(
                                    checked
                                      ? [...selectedPendingColumns, col.key]
                                      : selectedPendingColumns.filter(
                                          (c) => c !== col.key
                                        )
                                  );
                                } else {
                                  setSelectedHistoryColumns(
                                    checked
                                      ? [...selectedHistoryColumns, col.key]
                                      : selectedHistoryColumns.filter(
                                          (c) => c !== col.key
                                        )
                                  );
                                }
                              }}
                            />
                            <Label
                              htmlFor={`col-${col.key}`}
                              className="text-sm cursor-pointer flex-1 text-slate-700"
                            >
                              {col.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </SelectContent>
                  </Select>
                </div>

                <Select
                  value={warehouseFilter}
                  onValueChange={setWarehouseFilter}
                >
                  <SelectTrigger className="w-[160px] bg-white border-slate-200 h-9 text-slate-900">
                    <SelectValue placeholder="Warehouse" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="All">All Warehouses</SelectItem>
                    <SelectItem value="NE Warehouse">NE Warehouse</SelectItem>
                    <SelectItem value="Others">Others</SelectItem>
                  </SelectContent>
                </Select>

                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-9 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchData}
                  disabled={isLoading}
                  className="h-9 w-9 border-slate-200"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-slate-600" />
                  )}
                </Button>

                {selectedRows.size >= 1 && activeTab === "pending" && (
                  <Button
                    onClick={handleOpenModal}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 shadow-sm whitespace-nowrap"
                  >
                    Tally Entry ({selectedRows.size})
                  </Button>
                )}
              </div>
            </div>
          </div>

          <TabsList className="bg-indigo-50/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1.5 border border-indigo-100/50 w-[420px] shadow-2xs">
            <TabsTrigger
              value="pending"
              className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-3 transition-all cursor-pointer text-slate-700"
            >
              <ClipboardList className="w-5 h-5 opacity-80" />
              <div className="flex flex-col items-start leading-none gap-1 text-left">
                <span className="font-bold">Pending</span>
                <span className="text-[10px] opacity-70">Awaiting Tally entry</span>
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
                <span className="text-[10px] opacity-70 font-medium">Completed entries</span>
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

        <TabsContent value="pending" className="mt-0 outline-none">
          <TallyEntryPending
            pending={pending}
            selectedRows={selectedRows}
            toggleRow={toggleRow}
            toggleAll={toggleAll}
            selectedPendingColumns={selectedPendingColumns}
            pendingColumns={pendingColumns}
            safeValue={safeValue}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <TallyEntryHistory
            completed={completed}
            selectedHistoryColumns={selectedHistoryColumns}
            historyColumns={historyColumns}
            safeValue={safeValue}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
