"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Search, Truck, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { getFmsTimestamp } from "@/lib/utils";
import TransporterFollowUpPending from "./transporter-follow-up-pending";
import TransporterFollowUpHistory from "./transporter-follow-up-history";

const formatDateDash = (date: any) => {
  if (!date || date === "-" || date === "—") return "-";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return typeof date === 'string' ? date : "-";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
  } catch (e) {
    return typeof date === 'string' ? date : "-";
  }
};

export default function TransporterFollowUp() {
    const [records, setRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
    const [searchTerm, setSearchTerm] = useState("");

    // Modal State
    const [open, setOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        status: "",
        remarks: "",
        expectedDate: "",
        expectedDelivery: "",
    });

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

    // Selection State
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

    // Bulk State
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [bulkError, setBulkError] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/transporter-follow-up");
            const json = await res.json();

            if (json.success && Array.isArray(json.data)) {
                setRecords(json.data);
            } else {
                toast.error(json.error || "Failed to load data");
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

    const handleSort = (key: string) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    const sortedPending = useMemo(() => {
        const searchLower = searchTerm.toLowerCase();
        const pendingItems = records
            .filter(r => r.status === "pending")
            .filter((r) => {
                return (
                    r.data.indentNumber?.toLowerCase().includes(searchLower) ||
                    r.data.itemName?.toLowerCase().includes(searchLower) ||
                    r.data.vendorName?.toLowerCase().includes(searchLower) ||
                    r.data.transporterName?.toLowerCase().includes(searchLower) ||
                    String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
                    String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower) ||
                    String(r.data.lrCopy || "").toLowerCase().includes(searchLower) ||
                    String(r.data.lrNo || "").toLowerCase().includes(searchLower)
                );
            });

        if (!sortConfig) return pendingItems;

        return [...pendingItems].sort((a, b) => {
            const aValue = a.data[sortConfig.key] || "";
            const bValue = b.data[sortConfig.key] || "";

            if (sortConfig.key === "expectedDate") {
                const dateA = new Date(aValue).getTime() || 0;
                const dateB = new Date(bValue).getTime() || 0;
                if (dateA < dateB) return sortConfig.direction === "asc" ? -1 : 1;
                if (dateA > dateB) return sortConfig.direction === "asc" ? 1 : -1;
                return 0;
            }

            if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
    }, [records, sortConfig, searchTerm]);

    const completed = useMemo(() => {
        const searchLower = searchTerm.toLowerCase();
        return records.filter(r => {
            if (r.status !== "history") return false;
            return (
                r.data.indentNumber?.toLowerCase().includes(searchLower) ||
                r.data.itemName?.toLowerCase().includes(searchLower) ||
                r.data.vendorName?.toLowerCase().includes(searchLower) ||
                r.data.transporterName?.toLowerCase().includes(searchLower) ||
                String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
                String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower) ||
                String(r.data.lrCopy || "").toLowerCase().includes(searchLower) ||
                String(r.data.lrNo || "").toLowerCase().includes(searchLower)
            );
        });
    }, [records, searchTerm]);
    const pending = sortedPending;

    const pendingColumns = [
        { key: "indentNumber", label: "Indent No" },
        { key: "itemName", label: "Item Name" },
        { key: "plannedDate", label: "Expected Date" },
        { key: "totalFollowUps", label: "Total Follow-Ups" },
        { key: "expectedDate", label: "Last Follow-Up Date" },
        { key: "remarks", label: "Remarks" },
        { key: "liftNo", label: "Unit Tracking No." },
        { key: "vendorName", label: "Vendor Name" },
        { key: "poNumber", label: "PO Number" },
        { key: "liftingQty", label: "Dispatch Qty" },
        { key: "transporterName", label: "Transporter Name" },
        { key: "freightAmt", label: "Freight Amt" },
        { key: "vehicleNo", label: "Vehicle No" },
        { key: "contactNo", label: "Contact Number" },
        { key: "lrNo", label: "LR No." },
        { key: "lrCopy", label: "LR Copy" },
    ];

    const historyColumns = [
        { key: "indentNumber", label: "Indent No" },
        { key: "itemName", label: "Item Name" },
        { key: "plannedDate", label: "Expected Date" },
        { key: "actualDate", label: "Actual" },
        { key: "totalFollowUps", label: "Total Follow-Ups" },
        { key: "expectedDate", label: "Last Follow-Up Date" },
        { key: "remarks", label: "Remarks" },
        { key: "liftNo", label: "Unit Tracking No." },
        { key: "vendorName", label: "Vendor Name" },
        { key: "poNumber", label: "PO Number" },
        { key: "liftingQty", label: "Dispatch Qty" },
        { key: "transporterName", label: "Transporter Name" },
        { key: "freightAmt", label: "Freight Amt" },
        { key: "vehicleNo", label: "Vehicle No" },
        { key: "contactNo", label: "Contact Number" },
        { key: "lrNo", label: "LR No." },
        { key: "lrCopy", label: "LR Copy" },
    ];

    const handleOpenForm = (record: any) => {
        setSelectedRecord(record);
        setFormData({
            status: "",
            remarks: "",
            expectedDate: "",
            expectedDelivery: "",
        });
        setIsBulkMode(false);
        setBulkError(null);
        setOpen(true);
    };

    const validateBulkSelection = () => {
        if (selectedRows.size <= 1) return true;
        const selectedItems = records.filter(r => selectedRows.has(r.id));
        if (selectedItems.length === 0) return false;

        const first = selectedItems[0];
        const vendor = first.data.vendorName;
        const po = first.data.poNumber;

        for (let i = 1; i < selectedItems.length; i++) {
            if (selectedItems[i].data.vendorName !== vendor || selectedItems[i].data.poNumber !== po) {
                return false;
            }
        }
        return true;
    };

    const handleBulkOpen = () => {
        if (selectedRows.size === 0) return;

        const isValid = validateBulkSelection();
        if (!isValid) {
            toast.error("Vendor and PO No. didn't match");
            setBulkError("Vendor and PO Number mismatch. Cannot submit.");
        } else {
            setBulkError(null);
        }

        const firstId = Array.from(selectedRows)[0];
        const rec = records.find(r => r.id === firstId);
        if (rec) {
            setSelectedRecord(rec);
            setFormData({
                status: "",
                remarks: "",
                expectedDate: "",
                expectedDelivery: "",
            });
            setIsBulkMode(true);
            setOpen(true);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecord && !isBulkMode) return;
        if (isBulkMode && bulkError) {
            toast.error(bulkError);
            return;
        }

        if (!formData.status) {
            toast.error("Status is required");
            return;
        }

        if (formData.status === "Intransit") {
            if (!formData.expectedDate) {
                toast.error("Next Follow-Up is required when status is Intransit");
                return;
            }
            if (!formData.expectedDelivery) {
                toast.error("Expected Delivery is required when status is Intransit");
                return;
            }
        }

        setIsSubmitting(true);
        const toastId = toast.loading(isBulkMode ? "Recording Bulk Follow-Up..." : "Recording Follow-Up...");

        try {
            const recordsToProcess = isBulkMode
                ? records.filter(r => selectedRows.has(r.id))
                : [selectedRecord];

            const res = await fetch("/api/transporter-follow-up", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    status: formData.status,
                    remarks: formData.remarks,
                    expectedDate: formData.expectedDate,
                    expectedDelivery: formData.expectedDelivery,
                    records: recordsToProcess
                })
            });

            if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
            const result = await res.json();
            if (!result.success) throw new Error(result.error || "Update failed");

            toast.success("Follow-Up Recorded!", { id: toastId });
            setOpen(false);
            if (isBulkMode) {
                setSelectedRows(new Set());
                setIsBulkMode(false);
            }
            fetchData();

        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleRow = (id: string) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedRows(newSelected);
    };

    const toggleAll = () => {
        const currentList = activeTab === "pending" ? pending : completed;
        if (selectedRows.size === currentList.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(currentList.map(r => r.id)));
        }
    };

    const safeValue = (val: any) => {
        if (!val || val === "-" || val === "") return "-";
        return String(val);
    };

    const handleExportPendingCSV = () => {
        setIsExporting(true);
        setTimeout(() => {
            try {
                const headers = pendingColumns.map((c) => c.label);

                const rowData = pending.map((record) => {
                    return pendingColumns.map((col) => {
                        const val = record.data[col.key];
                        if (col.key === "plannedDate" || col.key === "expectedDate") {
                            return formatDateDash(val);
                        }
                        return val === undefined || val === null || String(val).trim() === "" ? "-" : String(val);
                    });
                });

                const escapeCSV = (val: string) => {
                    const clean = val === undefined || val === null ? "" : String(val);
                    if (clean.includes(",") || clean.includes('"') || clean.includes("\n") || clean.includes("\r")) {
                        return `"${clean.replace(/"/g, '""')}"`;
                    }
                    return clean;
                };

                const csvContent = [
                    headers.map(escapeCSV).join(","),
                    ...rowData.map((row) => row.map(escapeCSV).join(","))
                ].join("\r\n");

                const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `Pending_Transporter_FollowUp_${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success("CSV file exported successfully!");
            } catch (error) {
                console.error("Export CSV error:", error);
                toast.error("Failed to export CSV file");
            } finally {
                setIsExporting(false);
            }
        }, 1000);
    };

    return (
        <div className="p-6 h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
            <div className="mb-6 p-6 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm shrink-0">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-900 rounded-lg shadow-slate-100 shadow-xl text-white">
                            <Truck className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage 7: Transporter Follow-Up</h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Search by Indent, Item, Vendor, Transporter, LR No..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-white"
                            />
                        </div>

                        <div className="h-8 w-px bg-slate-200 hidden md:block" />

                        <div className="flex gap-4 items-center">
                            {activeTab === "pending" && selectedRows.size > 1 && (
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={handleBulkOpen}
                                >
                                    Bulk Follow-Up ({selectedRows.size})
                                </Button>
                            )}

                            {activeTab === "pending" && (
                                <Select
                                    value={sortConfig?.key || ""}
                                    onValueChange={(value) => handleSort(value)}
                                >
                                    <SelectTrigger className="w-[150px]">
                                        <SelectValue placeholder="Sort by..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="indentNumber">Indent No</SelectItem>
                                        <SelectItem value="expectedDate">Last Follow-Up Date</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}

                            <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-500">Loading transport records...</span>
                </div>
            ) : (
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 mb-4 gap-3">
                        <TabsList className="bg-slate-100/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1 border border-slate-200/50 w-full sm:w-auto">
                            <TabsTrigger
                                value="pending"
                                className="py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm"
                            >
                                Pending ({pending.length})
                            </TabsTrigger>
                            <TabsTrigger
                                value="history"
                                className="py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm"
                            >
                                History ({completed.length})
                            </TabsTrigger>
                        </TabsList>

                        {activeTab === "pending" && (
                            <Button
                                onClick={handleExportPendingCSV}
                                disabled={isExporting}
                                size="sm"
                                className="bg-green-700 hover:bg-green-800 text-white flex items-center gap-2 ml-auto sm:ml-0"
                            >
                                {isExporting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4" />
                                )}
                                Export CSV
                            </Button>
                        )}
                    </div>

                    <TabsContent value="pending" className="mt-0 flex-1 flex flex-col overflow-hidden">
                        {pending.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">No pending transporter follow-ups</div>
                        ) : (
                            <TransporterFollowUpPending
                              pending={pending}
                              selectedRows={selectedRows}
                              toggleAll={toggleAll}
                              toggleRow={toggleRow}
                              handleOpenForm={handleOpenForm}
                              pendingColumns={pendingColumns}
                              safeValue={safeValue}
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="history" className="mt-0 flex-1 flex flex-col overflow-hidden">
                        {completed.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">No follow-up history</div>
                        ) : (
                            <TransporterFollowUpHistory
                              completed={completed}
                              historyColumns={historyColumns}
                              safeValue={safeValue}
                            />
                        )}
                    </TabsContent>
                </Tabs>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isBulkMode ? `Bulk Follow-Up (${selectedRows.size} items)` : "Transport Follow-Up"}</DialogTitle>
                    </DialogHeader>

                    {bulkError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 border border-red-200">
                            {bulkError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        {isBulkMode ? (
                            <div className="space-y-4">
                                <div className="border rounded-md overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-2 border-b text-sm font-medium flex justify-between">
                                        <span>Selected Items ({selectedRows.size})</span>
                                        <span className="text-gray-500 font-normal">
                                            Vendor: {selectedRecord?.data.vendorName} | PO: {selectedRecord?.data.poNumber}
                                        </span>
                                    </div>
                                    <div className="max-h-40 overflow-y-auto p-2 bg-slate-50">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-gray-500 border-b">
                                                    <th className="pb-1 font-medium">Indent No</th>
                                                    <th className="pb-1 font-medium">Unit Tracking No.</th>
                                                    <th className="pb-1 font-medium">Transporter</th>
                                                    <th className="pb-1 font-medium">Vehicle</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {records
                                                    .filter(r => selectedRows.has(r.id))
                                                    .map(r => (
                                                        <tr key={r.id} className="border-b last:border-0 border-gray-100">
                                                            <td className="py-1">{r.data.indentNumber}</td>
                                                            <td className="py-1">{r.data.liftNo}</td>
                                                            <td className="py-1 truncate max-w-[100px]" title={r.data.transporterName}>{r.data.transporterName}</td>
                                                            <td className="py-1">{r.data.vehicleNo}</td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs text-gray-500">Transporter Name</Label>
                                        <div className="p-2 bg-gray-50 rounded text-sm font-medium truncate">
                                            {selectedRecord?.data.transporterName || "-"}
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Vehicle Number</Label>
                                        <div className="p-2 bg-gray-50 rounded text-sm font-medium">
                                            {selectedRecord?.data.vehicleNo || "-"}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs text-gray-500">Contact Number</Label>
                                        <div className="p-2 bg-gray-50 rounded text-sm font-medium">
                                            {selectedRecord?.data.contactNo || "-"}
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Unit Tracking No.</Label>
                                        <div className="p-2 bg-gray-50 rounded text-sm font-medium">
                                            {selectedRecord?.data.liftNo || "-"}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-xs text-gray-500">Indent Number</Label>
                                    <div className="p-2 bg-gray-50 rounded text-sm font-medium">
                                        {selectedRecord?.data.indentNumber || "-"}
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="p-4 bg-white border rounded-md shadow-sm space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">Update Status</h3>
                            <div className={`grid gap-3 ${formData.status === "Intransit" ? "grid-cols-3" : "grid-cols-2"}`}>
                                <div>
                                    <Label className="text-xs mb-1 block">Status <span className="text-red-500">*</span></Label>
                                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Intransit">Intransit</SelectItem>
                                            <SelectItem value="Received">Received</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {formData.status === "Intransit" && (
                                    <>
                                        <div>
                                            <Label className="text-xs mb-1 block">Next Follow-Up <span className="text-red-500">*</span></Label>
                                            <Input
                                                type="date"
                                                value={formData.expectedDate}
                                                onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                                                required
                                                className="h-9"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs mb-1 block">Expected Delivery <span className="text-red-500">*</span></Label>
                                            <Input
                                                type="date"
                                                value={formData.expectedDelivery}
                                                onChange={(e) => setFormData({ ...formData, expectedDelivery: e.target.value })}
                                                required
                                                className="h-9"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            <div>
                                <Label className="text-xs mb-1 block">Remarks</Label>
                                <Textarea
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    placeholder="Enter any remarks..."
                                    rows={2}
                                    className="resize-none"
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting || !!bulkError} className="bg-blue-600 hover:bg-blue-700">
                                {isSubmitting ? "Submitting..." : "Submit"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
