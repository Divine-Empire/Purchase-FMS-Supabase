"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, FileText, Search, RefreshCw, ClipboardCheck } from "lucide-react";
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
import { parseSheetDate, getFmsTimestamp } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import SubmitInvoiceHOPending from "./submit-invoice-ho-pending";
import SubmitInvoiceHOHistory from "./submit-invoice-ho-history";

const pendingColumns = [
    { key: "indentNumber", label: "Indent No." },
    { key: "category", label: "Category" },
    { key: "itemName", label: "Item" },
    { key: "quantity", label: "Qty" },
    { key: "warehouse", label: "Warehouse" },
    { key: "vendorName", label: "Vendor" },
    { key: "poNumber", label: "PO No." },
    { key: "invoiceNumber", label: "Invoice No." },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "basicValue", label: "Basic Value" },
    { key: "totalWithTax", label: "Total Value" },
    { key: "billAttachment", label: "Bill Attach" },
    { key: "planDate", label: "Planned" },
] as const;

const historyColumns = [
    ...pendingColumns,
    { key: "actualDate", label: "Actual" },
    { key: "hardcopySubmitted", label: "Hardcopy Submitted" },
    { key: "submissionDate", label: "Submission Date" },
] as const;

export default function SubmitInvoiceHO() {
    const [sheetRecords, setSheetRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
    const [searchTerm, setSearchTerm] = useState("");
    const [warehouseFilter, setWarehouseFilter] = useState("All");
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [bulkError, setBulkError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        hardcopySubmitted: "",
        submissionDate: new Date(),
    });

    const [selectedPendingColumns, setSelectedPendingColumns] = useState<string[]>(
        pendingColumns.map((c) => c.key)
    );

    const [selectedHistoryColumns, setSelectedHistoryColumns] = useState<string[]>(
        historyColumns.map((c) => c.key)
    );

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/submit-invoice-ho");
            const json = await res.json();
            if (json.success) {
                setSheetRecords([...(json.pending || []), ...(json.history || [])]);
            } else {
                toast.error(json.error || "Failed to load submissions");
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

    const pending = useMemo(() => sheetRecords
        .filter((r) => r.status === "pending")
        .filter((r) => {
            if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
            if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

            const searchLower = searchTerm.toLowerCase();
            return (
                r.data.indentNumber?.toLowerCase().includes(searchLower) ||
                r.data.itemName?.toLowerCase().includes(searchLower) ||
                r.data.vendorName?.toLowerCase().includes(searchLower) ||
                String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
                String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
            );
        }), [sheetRecords, searchTerm, warehouseFilter]);

    const completed = useMemo(() => sheetRecords
        .filter((r) => r.status === "completed")
        .filter((r) => {
            if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
            if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

            const searchLower = searchTerm.toLowerCase();
            if (!searchLower) return true;
            return (
                r.data.indentNumber?.toLowerCase().includes(searchLower) ||
                r.data.itemName?.toLowerCase().includes(searchLower) ||
                r.data.vendorName?.toLowerCase().includes(searchLower) ||
                String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
                String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
            );
        }), [sheetRecords, searchTerm, warehouseFilter]);

    const toggleRow = useCallback((id: string) => {
        setSelectedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleAll = useCallback(() => {
        setSelectedRows(prev => {
            const allPendingSelected = pending.length > 0 && pending.every(r => prev.has(r.id));
            const next = new Set(prev);
            if (allPendingSelected) {
                pending.forEach(r => next.delete(r.id));
            } else {
                pending.forEach(r => next.add(r.id));
            }
            return next;
        });
    }, [pending]);

    const handleOpenForm = useCallback((recordId?: string) => {
        setBulkError(null);
        let activeRows = selectedRows;
        if (recordId) {
            activeRows = new Set([recordId]);
            setSelectedRows(activeRows);
        } else if (selectedRows.size === 0) {
            return;
        }

        const selectedRecords = sheetRecords.filter(r => activeRows.has(r.id));
        if (selectedRecords.length === 0) return;

        if (activeRows.size > 1) {
            const firstInvoice = selectedRecords[0].data.invoiceNumber;
            if (!selectedRecords.every(r => r.data.invoiceNumber === firstInvoice)) {
                setBulkError("Selected items have different Invoice Numbers. Cannot submit together.");
            }
        }

        setFormData({
            hardcopySubmitted: "",
            submissionDate: new Date(),
        });
        setOpen(true);
    }, [selectedRows, sheetRecords]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedRows.size === 0 || bulkError) return;

        setIsSubmitting(true);
        try {
            const selectedRecords = sheetRecords.filter(r => selectedRows.has(r.id));
            if (selectedRecords.length === 0) return;

            const records = selectedRecords.map(rec => ({
                liftNo: rec.id,
                hardcopySubmitted: formData.hardcopySubmitted,
                submissionDate: formData.submissionDate || new Date()
            }));

            const res = await fetch("/api/submit-invoice-ho", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ records })
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error || `Request failed with status ${res.status}`);
            }

            toast.success(`${selectedRecords.length} invoice(s) submitted to HO!`);
            setOpen(false);
            setSelectedRows(new Set());
            fetchData();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to submit");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDateDash = (dateStr: any) => {
        if (!dateStr || dateStr === "-" || dateStr === "—") return "-";
        const d = parseSheetDate(dateStr);
        if (!d || isNaN(d.getTime())) return dateStr;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${day}-${month}-${year}`;
    };

    const safeValue = useCallback((record: any, key: string) => {
        try {
            const data = record?.data;
            if (!data) return "-";

            if (key === "vendorName") return data.vendorName || "-";

            if (key === "billAttachment") {
                const url = data.billAttachment;
                if (!url || url === "-" || url === "") return "-";

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

            const val = data[key];
            if (val === undefined || val === null || String(val).trim() === "") return "-";

            const lowKey = key.toLowerCase();
            if ((lowKey.includes("date") || lowKey.includes("plan") || lowKey.includes("actual"))) {
                return formatDateDash(val);
            }

            return String(val);
        } catch {
            return "-";
        }
    }, []);

    const isFormValid = formData.hardcopySubmitted;

    return (
        <div className="p-4 md:p-6 min-h-screen bg-[#f8fafc]">
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle>Submit Invoice to HO ({selectedRows.size} Selected)</DialogTitle>
                    </DialogHeader>

                    {bulkError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 border border-red-200">
                            {bulkError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="py-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100 mb-6">
                                <div>
                                    <Label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Invoice No.</Label>
                                    <p className="font-mono font-medium text-lg text-slate-900">
                                        {sheetRecords.find(r => selectedRows.has(r.id))?.data.invoiceNumber || "-"}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Vendor</Label>
                                    <p className="font-medium text-lg text-gray-900">
                                        {sheetRecords.find(r => selectedRows.has(r.id))?.data.vendorName || "-"}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <div className="space-y-2">
                                    <Label className="font-medium text-gray-700">Hardcopy Submitted to HO ? *</Label>
                                    <Select value={formData.hardcopySubmitted} onValueChange={(v) => setFormData({ ...formData, hardcopySubmitted: v })}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Yes">Yes</SelectItem>
                                            <SelectItem value="No">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-gray-500">Confirm physical docs handover to HO</p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="font-medium text-gray-700">Submission Date *</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full text-left font-normal border-gray-300">
                                                {formData.submissionDate ? format(formData.submissionDate, "PPP") : "Pick date"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={formData.submissionDate}
                                                onSelect={(d) => d && setFormData({ ...formData, submissionDate: d })}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>Cancel</Button>
                            <Button onClick={handleSubmit} disabled={!isFormValid || isSubmitting}>
                                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : "Submit"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                <div className="md:sticky md:top-0 z-30 bg-[#f8fafc] -mx-4 md:-mx-6 px-4 md:px-6 pt-2 pb-4 mb-4 border-b shadow-sm">
                    <div className="mb-4 md:mb-6 p-4 md:p-6 bg-white border rounded-lg shadow-sm">
                        <div className="flex items-start justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                                    <ClipboardCheck className="w-7 h-7" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Stage: Submit Invoice (HO)</h2>
                                    <p className="text-sm text-slate-500">Manage and track HO invoice submissions</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 flex-1 justify-end flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm font-medium text-slate-600 hidden md:inline-block">
                                        Columns:
                                    </Label>
                                    <Select value="" onValueChange={() => { }}>
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
                                                                ? selectedPendingColumns.length === pendingColumns.length
                                                                : selectedHistoryColumns.length === historyColumns.length
                                                        }
                                                        onCheckedChange={(checked) => {
                                                            if (activeTab === "pending") {
                                                                setSelectedPendingColumns(
                                                                    checked ? pendingColumns.map((c) => c.key) : []
                                                                );
                                                            } else {
                                                                setSelectedHistoryColumns(
                                                                    checked ? historyColumns.map((c) => c.key) : []
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

                                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
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
                                    <Input
                                        placeholder="Search records..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 bg-white border-slate-200 h-9"
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
                                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4 text-slate-600" />
                                    )}
                                </Button>

                                {selectedRows.size > 0 && activeTab === "pending" && (
                                    <Button
                                        onClick={() => handleOpenForm()}
                                        className="bg-blue-600 hover:bg-blue-700 text-white h-9 shadow-sm whitespace-nowrap"
                                    >
                                        Submit to HO ({selectedRows.size})
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-100/50 p-1 rounded-lg">
                        <TabsTrigger
                            value="pending"
                            className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                        >
                            Pending ({isLoading && pending.length === 0 ? "..." : pending.length})
                        </TabsTrigger>
                        <TabsTrigger
                            value="history"
                            className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                        >
                            History ({isLoading && completed.length === 0 ? "..." : completed.length})
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="pending" className="mt-0 outline-none">
                    <SubmitInvoiceHOPending
                        pending={pending}
                        selectedRows={selectedRows}
                        toggleRow={toggleRow}
                        toggleAll={toggleAll}
                        handleOpenForm={handleOpenForm}
                        selectedPendingColumns={selectedPendingColumns}
                        pendingColumns={pendingColumns}
                        safeValue={safeValue}
                        isLoading={isLoading}
                    />
                </TabsContent>

                <TabsContent value="history" className="mt-0 outline-none">
                    <SubmitInvoiceHOHistory
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
