"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Search, ShieldAlert, ClipboardList, History, AlertCircle } from "lucide-react";
import { formatDate, parseSheetDate, getFmsTimestamp, formatDateTimeDash, sortByIndentNumber, canViewPurchaserRecord } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import WarrantyClaimPending from "./warranty-claim-pending";
import WarrantyClaimHistory from "./warranty-claim-history";

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
});

const PENDING_COLUMNS = [
    { key: "indentNo", label: "Indent No." },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "vendorName", label: "Vendor Name" },
    { key: "itemName", label: "Item Name" },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "serialNo", label: "Serial No." },
    { key: "warrantyEnd", label: "Warranty End" },
] as const;

const CLOSURE_PENDING_COLUMNS = [
    { key: "indentNo", label: "Indent No." },
    { key: "planned", label: "Planned" },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "serialNo", label: "Serial No." },
    { key: "invoiceNo", label: "Invoice No." },
    { key: "issueDescription", label: "Issue Description" },
    { key: "claimType", label: "Claim Type" },
    { key: "status", label: "Status" },
] as const;

const HISTORY_COLUMNS = [
    { key: "indentNo", label: "Indent No." },
    { key: "planned", label: "Planned" },
    { key: "actual", label: "Actual" },
    { key: "delay", label: "Delay" },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "vendorName", label: "Vendor Name" },
    { key: "itemName", label: "Item Name" },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "serialNo", label: "Serial No." },
    { key: "warrantyEnd", label: "Warranty End" },
] as const;

// Pending is this stage's big list (thousands of serials awaiting a claim) — unlike
// Tally Entry where Pending was small, here it's Pending that's paginated server-side.
// Default page size stays small (100) until a search/expiring filter narrows things down
// (200), matching the same "capped until filtered" behavior used on Tally Entry's History.
const PENDING_DEFAULT_LIMIT = 100;
const PENDING_FILTERED_LIMIT = 200;

export default function WarrantyClaim() {
    const { role, records: recordsAccess } = useAuth();
    const [pendingRecords, setPendingRecords] = useState<any[]>([]);
    const [pendingTotalCount, setPendingTotalCount] = useState(0);
    const [pendingPage, setPendingPage] = useState(0);
    const [isPendingLoading, setIsPendingLoading] = useState(false);
    const [closurePendingRecords, setClosurePendingRecords] = useState<any[]>([]);
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [indentFilter, setIndentFilter] = useState<"no_filter" | "increasing" | "decreasing">("no_filter");
    const [activeTab, setActiveTab] = useState<"pending" | "closurePending" | "history">("pending");
    const [showExpiringOnly, setShowExpiringOnly] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        by: "",
        invoiceNo: "",
        invoiceCopy: null as File | null,
        issueDescription: "",
        photosVideos: null as File | null,
        claimType: "",
    });

    const [closureFormData, setClosureFormData] = useState({
        status: "Pending",
        closureDate: "",
        remarks: ""
    });

    const sortDir = indentFilter === "decreasing" ? "desc" : "asc";
    const hasPendingFilter = !!searchTerm || showExpiringOnly;
    const pendingLimit = hasPendingFilter ? PENDING_FILTERED_LIMIT : PENDING_DEFAULT_LIMIT;

    const fetchPending = useCallback(async () => {
        setIsPendingLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(pendingPage),
                sort: sortDir,
            });
            if (searchTerm) params.set("search", searchTerm);
            if (showExpiringOnly) params.set("expiringOnly", "true");
            if (role) params.set("role", role);
            if (recordsAccess) params.set("records", recordsAccess);

            const res = await fetch(`/api/warranty-claim?${params.toString()}`);
            const json = await res.json();
            if (json.success) {
                setPendingRecords(json.pending || []);
                setPendingTotalCount(json.pendingTotalCount || 0);
            } else {
                toast.error(json.error || "Failed to load pending claims");
            }
        } catch (e) {
            console.error("Pending fetch error:", e);
            toast.error("Failed to load pending claims");
        }
        setIsPendingLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingPage, sortDir, searchTerm, showExpiringOnly, role, recordsAccess]);

    // closurePending/history come along on this same call (their source table is small,
    // no need to defer or paginate them) — only Pending is fetched separately/paginated.
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/warranty-claim");
            const json = await res.json();
            if (json.success) {
                setClosurePendingRecords(json.closurePending || []);
                setHistoryRecords(json.history || []);
            } else {
                toast.error(json.error || "Failed to load data");
            }
        } catch (e) {
            console.error("Fetch error:", e);
            toast.error("Failed to load data");
        }
        setIsLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Debounce search/expiring/sort changes so typing doesn't fire a request per
    // keystroke; the very first load (mount) fetches immediately.
    const pendingLoadedRef = React.useRef(false);
    useEffect(() => {
        const debounceMs = pendingLoadedRef.current ? 300 : 0;
        const timer = setTimeout(() => {
            pendingLoadedRef.current = true;
            fetchPending();
        }, debounceMs);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingPage, sortDir, searchTerm, showExpiringOnly, role, recordsAccess]);

    // Changing search/expiring resets back to page 0.
    useEffect(() => {
        setPendingPage(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, showExpiringOnly, sortDir]);

    const applySearch = useCallback((records: any[]) => {
        if (!searchTerm) return records;
        const lower = searchTerm.toLowerCase();
        return records.filter((r) =>
            String(r.data.indentNo || "").toLowerCase().includes(lower) ||
            String(r.data.itemName || "").toLowerCase().includes(lower) ||
            String(r.data.vendorName || "").toLowerCase().includes(lower) ||
            String(r.data.serialNo || "").toLowerCase().includes(lower) ||
            String(r.data.invoiceNo || "").toLowerCase().includes(lower)
        );
    }, [searchTerm]);

    // Purchaser-based record access: only show records this user is allowed to see.
    // Pending is already filtered/searched/sorted/paginated server-side (see
    // fetchPending above) — used as-is here, no client-side re-filtering.
    const pending = pendingRecords;

    const visibleClosurePendingRecords = useMemo(
        () => closurePendingRecords.filter((r) => canViewPurchaserRecord(r.data?.purchaser, recordsAccess, role)),
        [closurePendingRecords, recordsAccess, role]
    );
    const visibleHistoryRecords = useMemo(
        () => historyRecords.filter((r) => canViewPurchaserRecord(r.data?.purchaser, recordsAccess, role)),
        [historyRecords, recordsAccess, role]
    );

    const closurePending = useMemo(() => {
        const items = applySearch(visibleClosurePendingRecords);
        return sortByIndentNumber(items, indentFilter === "decreasing" ? "desc" : "asc");
    }, [visibleClosurePendingRecords, applySearch, indentFilter]);

    const history = useMemo(() => {
        const items = applySearch(visibleHistoryRecords);
        return sortByIndentNumber(items, indentFilter === "decreasing" ? "desc" : "asc");
    }, [visibleHistoryRecords, applySearch, indentFilter]);

    const uploadFile = useCallback(async (file: File) => {
        const formDataUpload = new FormData();
        formDataUpload.append("file", file);
        const upRes = await fetch("/api/upload-supabase", { method: "POST", body: formDataUpload });
        const upJson = await upRes.json();
        if (upJson.success) return upJson.fileUrl || upJson.url;
        throw new Error("Upload failed: " + (upJson.error || "Unknown error"));
    }, []);

    const handleClaimSubmit = useCallback(async () => {
        if (!selectedRecord) return;

        setIsSubmitting(true);
        const toastId = toast.loading("Processing submission...");

        try {
            let invoiceCopyUrl = "";
            let photosVideosUrl = "";

            if (formData.by === "Client") {
                const uploadPromises: Promise<any>[] = [];
                if (formData.invoiceCopy) {
                    uploadPromises.push(uploadFile(formData.invoiceCopy).then(url => { invoiceCopyUrl = url; }));
                }
                if (formData.photosVideos) {
                    uploadPromises.push(uploadFile(formData.photosVideos).then(url => { photosVideosUrl = url; }));
                }
                if (uploadPromises.length > 0) {
                    toast.loading("Uploading files...", { id: toastId });
                    await Promise.all(uploadPromises);
                }
            }

            const res = await fetch("/api/warranty-claim", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    action: "fileClaim",
                    serialNo: selectedRecord.data.serialNo,
                    invoiceNo: formData.invoiceNo || null,
                    invoiceCopy: formData.by === "Client" ? invoiceCopyUrl : null,
                    issueDescription: formData.issueDescription,
                    photoVideo: formData.by === "Client" ? photosVideosUrl : null,
                    claimType: formData.claimType,
                    claimedBy: formData.by || null
                })
            });

            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.error || `Request failed with status ${res.status}`);
            }

            setIsModalOpen(false);
            toast.success("Claim submitted successfully!", { id: toastId, duration: 2000 });
            fetchData();
            fetchPending();
        } catch (e: any) {
            console.error("Submit error:", e);
            toast.error(e.message || "Failed to submit claim", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedRecord, formData, fetchData, fetchPending, uploadFile]);

    const handleClosureSubmit = useCallback(async () => {
        if (!selectedRecord) return;

        setIsSubmitting(true);
        const toastId = toast.loading("Processing closure...");
        try {
            const res = await fetch("/api/warranty-claim", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    action: "closeClaim",
                    claimId: selectedRecord.id,
                    closureDate: closureFormData.closureDate,
                    remarks: closureFormData.remarks || ""
                })
            });

            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.error || `Request failed with status ${res.status}`);
            }

            setIsClosureModalOpen(false);
            toast.success("Closure updated successfully!", { id: toastId, duration: 2000 });
            fetchData();
        } catch (e: any) {
            console.error("Closure update error:", e);
            toast.error(e.message || "Failed to update closure", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedRecord, closureFormData, fetchData]);

    const formatDateDash = (dateStr: any) => formatDateTimeDash(dateStr);

    const renderCell = useCallback((data: any, key: string) => {
        const val = data?.[key];

        if (key === "invoiceCopy" || key === "poCopy" || key === "photoVideo") {
            if (!val || String(val).trim() === "" || val === "-") return "-";
            return (
                <a
                    href={String(val)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline inline-flex items-center gap-1 font-medium"
                >
                    View
                </a>
            );
        }

        if (key === "delay") {
            const pDate = parseSheetDate(data?.planned || data?.plannedDate);
            const aDate = parseSheetDate(data?.actual || data?.actualDate);
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

        if (
            key === "invoiceDate" ||
            key === "planned" ||
            key === "actual" ||
            key === "warrantyEnd" ||
            key === "closureDate"
        ) {
            return formatDateDash(val);
        }

        if (!val || String(val).trim() === "" || val === "-") return "-";
        return String(val);
    }, []);

    const onAction = useCallback((r: any) => {
        setSelectedRecord(r);
        setFormData({
            by: "",
            invoiceNo: r.data.invoiceNo || "",
            invoiceCopy: null,
            issueDescription: "",
            photosVideos: null,
            claimType: "",
        });
        setIsModalOpen(true);
    }, []);

    const onClosureAction = useCallback((r: any) => {
        setSelectedRecord(r);
        setClosureFormData({
            status: r.data.status || "Pending",
            closureDate: r.data.closureDate || "",
            remarks: r.data.remarks || ""
        });
        setIsClosureModalOpen(true);
    }, []);

    return (
        <div className="p-6 min-h-screen bg-[#f8fafc]">
            <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as any)}
                className="w-full"
            >
                <div className="sticky top-0 z-50 bg-[#f8fafc] -mx-6 px-6 pt-2 pb-4 mb-4 border-b shadow-sm">
                    <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm">
                        <div className="flex items-start justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <ShieldAlert className="w-7 h-7 text-indigo-600" />
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Stage: Warranty Claim</h2>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 flex-1 max-w-2xl justify-end">
                                <Button
                                    variant={showExpiringOnly ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setShowExpiringOnly(!showExpiringOnly)}
                                    className={`h-10 px-4 flex items-center gap-2 transition-all ${showExpiringOnly
                                            ? "bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-md"
                                            : "border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                        }`}
                                >
                                    <ShieldAlert className={`w-4 h-4 ${showExpiringOnly ? "animate-pulse" : ""}`} />
                                    <span className="font-semibold">Recent Expiring</span>
                                </Button>
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                                    <Input
                                        placeholder="Search by Indent, Item, Vendor..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 bg-white border-slate-200 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <TabsList className="bg-indigo-50/50 p-1 rounded-xl h-auto grid grid-cols-3 gap-1.5 border border-indigo-100/50 w-[620px] shadow-2xs">
                            <TabsTrigger
                                value="pending"
                                className="text-base py-3 px-4 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center gap-3 transition-all cursor-pointer text-slate-700"
                            >
                                <ClipboardList className="w-5 h-5 opacity-80" />
                                <div className="flex flex-col items-start leading-none gap-1 text-left">
                                    <span className="font-bold">Pending</span>
                                    <span className="text-[10px] opacity-70">Awaiting claims</span>
                                </div>
                                <Badge variant="secondary" className={cn(
                                    "px-2.5 py-0.5 font-extrabold rounded-full text-xs min-w-[24px] text-center border-none transition-all",
                                    activeTab === "pending"
                                        ? "bg-white text-red-600 shadow-xs"
                                        : "bg-red-100 text-red-700"
                                )}>
                                    {pendingTotalCount}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger
                                value="closurePending"
                                className="text-base py-3 px-4 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center gap-3 transition-all cursor-pointer text-slate-700"
                            >
                                <AlertCircle className="w-5 h-5 opacity-80" />
                                <div className="flex flex-col items-start leading-none gap-1 text-left">
                                    <span className="font-bold">Closure Pending</span>
                                    <span className="text-[10px] opacity-70">Claims raised</span>
                                </div>
                                <Badge variant="secondary" className={cn(
                                    "px-2.5 py-0.5 font-extrabold rounded-full text-xs min-w-[24px] text-center border-none transition-all",
                                    activeTab === "closurePending"
                                        ? "bg-white text-amber-600 shadow-xs"
                                        : "bg-amber-100 text-amber-700"
                                )}>
                                    {closurePending.length}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger
                                value="history"
                                className="text-base py-3 px-4 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center gap-3 transition-all cursor-pointer text-slate-700"
                            >
                                <History className="w-5 h-5 opacity-80" />
                                <div className="flex flex-col items-start leading-none gap-1 text-left">
                                    <span className="font-bold">History</span>
                                    <span className="text-[10px] opacity-70 font-medium">Closed claims</span>
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
                </div>

                <>
                    <TabsContent value="pending" className="mt-0 outline-none">
                        {isPendingLoading ? (
                            <div className="flex flex-col items-center justify-center py-24 text-gray-500">
                                <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-600" />
                                <p className="text-lg animate-pulse text-indigo-900 font-medium">Loading records...</p>
                            </div>
                        ) : pending.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                <p className="text-lg text-black">No pending Warranty Claims</p>
                            </div>
                        ) : (
                            <>
                                <WarrantyClaimPending
                                    pending={pending}
                                    closurePending={closurePending}
                                    activeTab={activeTab}
                                    PENDING_COLUMNS={PENDING_COLUMNS}
                                    CLOSURE_PENDING_COLUMNS={CLOSURE_PENDING_COLUMNS}
                                    renderCell={renderCell}
                                    onAction={onAction}
                                    onClosureAction={onClosureAction}
                                />
                                {pendingTotalCount > pendingLimit && (
                                    <div className="flex items-center justify-between mt-3 text-sm text-slate-600">
                                        {hasPendingFilter ? (
                                            <>
                                                <span>
                                                    Showing {pendingPage * pendingLimit + 1}-
                                                    {Math.min((pendingPage + 1) * pendingLimit, pendingTotalCount)} of {pendingTotalCount}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={pendingPage === 0 || isPendingLoading}
                                                        onClick={() => setPendingPage((p) => Math.max(0, p - 1))}
                                                    >
                                                        Previous
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={(pendingPage + 1) * pendingLimit >= pendingTotalCount || isPendingLoading}
                                                        onClick={() => setPendingPage((p) => p + 1)}
                                                    >
                                                        Next
                                                    </Button>
                                                </div>
                                            </>
                                        ) : (
                                            <span>
                                                Showing first {pendingLimit} of {pendingTotalCount} — apply a search or the expiring filter to see more
                                            </span>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </TabsContent>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-24 text-gray-500">
                            <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-600" />
                            <p className="text-lg animate-pulse text-indigo-900 font-medium">Loading records...</p>
                        </div>
                    ) : (
                    <>
                        <TabsContent value="closurePending" className="mt-0 outline-none">
                            {closurePending.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-lg text-black">No pending closures</p>
                                </div>
                            ) : (
                                <WarrantyClaimPending
                                    pending={pending}
                                    closurePending={closurePending}
                                    activeTab={activeTab}
                                    PENDING_COLUMNS={PENDING_COLUMNS}
                                    CLOSURE_PENDING_COLUMNS={CLOSURE_PENDING_COLUMNS}
                                    renderCell={renderCell}
                                    onAction={onAction}
                                    onClosureAction={onClosureAction}
                                />
                            )}
                        </TabsContent>

                        <TabsContent value="history" className="mt-0 outline-none">
                            {history.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-lg text-black">No completed Warranty Claims</p>
                                </div>
                            ) : (
                                <WarrantyClaimHistory
                                    history={history}
                                    HISTORY_COLUMNS={HISTORY_COLUMNS}
                                    renderCell={renderCell}
                                />
                            )}
                        </TabsContent>
                    </>
                )}
                </>
            </Tabs>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-[360px] p-0 overflow-hidden border-none shadow-2xl rounded-xl">
                    <DialogHeader className="p-4 bg-slate-50 border-b">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                            <ShieldAlert className="w-5 h-5 text-indigo-600" />
                            Warranty Claim Form
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-5 overflow-y-auto max-h-[75vh] custom-scrollbar">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">By *</label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow transition-colors"
                                    value={formData.by}
                                    onChange={(e) => setFormData(prev => ({ ...prev, by: e.target.value }))}
                                >
                                    <option value="" disabled>Select...</option>
                                    <option value="Client">Client</option>
                                    <option value="Company">Company</option>
                                </select>
                            </div>

                            {formData.by !== "" && (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Claim Type *</label>
                                        <select
                                            className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow transition-colors"
                                            value={formData.claimType}
                                            onChange={(e) => setFormData(prev => ({ ...prev, claimType: e.target.value }))}
                                        >
                                            <option value="" disabled>Select...</option>
                                            <option value="Repair">Repair</option>
                                            <option value="Replacement">Replacement</option>
                                            <option value="Service issue">Service issue</option>
                                            <option value="Part failure">Part failure</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Invoice *</label>
                                        <Input
                                            value={formData.invoiceNo}
                                            onChange={(e) => setFormData(prev => ({ ...prev, invoiceNo: e.target.value }))}
                                            placeholder="Invoice No."
                                            className="h-9 bg-white focus-visible:ring-indigo-500 text-sm"
                                        />
                                    </div>

                                    <div className="col-span-2 space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Issue Description *</label>
                                        <Input
                                            value={formData.issueDescription}
                                            onChange={(e) => setFormData(prev => ({ ...prev, issueDescription: e.target.value }))}
                                            placeholder="What's the issue?"
                                            className="h-9 bg-white focus-visible:ring-indigo-500 text-sm"
                                        />
                                    </div>

                                    {formData.by === "Client" && (
                                        <>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Invoice Copy</label>
                                                {formData.invoiceCopy ? (
                                                    <div className="flex items-center justify-between px-3 border border-slate-200 rounded-md bg-white h-9">
                                                        <span className="text-[11px] truncate mr-1 font-medium" title={formData.invoiceCopy.name}>{formData.invoiceCopy.name}</span>
                                                        <Button variant="ghost" size="sm" onClick={() => setFormData(prev => ({ ...prev, invoiceCopy: null }))} className="h-4 w-4 p-0 text-red-500 hover:text-red-700 rounded-full flex-shrink-0">✕</Button>
                                                    </div>
                                                ) : (
                                                    <Input
                                                        type="file"
                                                        accept="image/*,.pdf"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0] || null;
                                                            setFormData(prev => ({ ...prev, invoiceCopy: file }))
                                                        }}
                                                        className="h-9 text-[11px] cursor-pointer bg-white file:mr-2 file:py-0 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 focus-visible:ring-indigo-500"
                                                    />
                                                )}
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Photo/Video (Optional)</label>
                                                {formData.photosVideos ? (
                                                    <div className="flex items-center justify-between px-3 border border-slate-200 rounded-md bg-white h-9">
                                                        <span className="text-[11px] truncate mr-1 font-medium" title={formData.photosVideos.name}>{formData.photosVideos.name}</span>
                                                        <Button variant="ghost" size="sm" onClick={() => setFormData(prev => ({ ...prev, photosVideos: null }))} className="h-4 w-4 p-0 text-red-500 hover:text-red-700 rounded-full flex-shrink-0">✕</Button>
                                                    </div>
                                                ) : (
                                                    <Input
                                                        type="file"
                                                        accept="image/*,video/*"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0] || null;
                                                            setFormData(prev => ({ ...prev, photosVideos: file }))
                                                        }}
                                                        className="h-9 text-[11px] cursor-pointer bg-white file:mr-2 file:py-0 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 focus-visible:ring-indigo-500"
                                                    />
                                                )}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="p-4 bg-slate-50 border-t flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setIsModalOpen(false)}
                            disabled={isSubmitting}
                            className="bg-white border-slate-300 hover:bg-slate-100 h-9 text-xs font-medium flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleClaimSubmit}
                            disabled={isSubmitting || !formData.by || !formData.claimType || !formData.invoiceNo || !formData.issueDescription}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-bold h-9 text-xs flex-1 transition-all active:scale-95"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> ...</>
                            ) : (
                                "Submit Claim"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isClosureModalOpen} onOpenChange={setIsClosureModalOpen}>
                <DialogContent className="max-w-[360px] p-0 overflow-hidden border-none shadow-2xl rounded-xl">
                    <DialogHeader className="p-4 bg-slate-50 border-b">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                            <ShieldAlert className="w-5 h-5 text-indigo-600" />
                            Process Closure
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-5 overflow-y-auto max-h-[75vh] custom-scrollbar">
                        <div className="space-y-4">
                            <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 flex flex-col gap-1.5">
                                <div className="flex justify-between items-center text-[10px] text-indigo-600 font-bold uppercase tracking-wider">
                                    <span>Indent No</span>
                                    <span>Serial No</span>
                                </div>
                                <div className="flex justify-between items-center text-sm font-semibold text-indigo-900">
                                    <span>{selectedRecord?.data.indentNo || "-"}</span>
                                    <span>{selectedRecord?.data.serialNo || "-"}</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Status *</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    value={closureFormData.status}
                                    onChange={(e) => setClosureFormData(prev => ({ ...prev, status: e.target.value }))}
                                >
                                    <option value="Pending">Pending</option>
                                    <option value="Closure">Closure</option>
                                </select>
                            </div>

                            {closureFormData.status === "Closure" && (
                                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Closure Date *</label>
                                    <Input
                                        type="date"
                                        value={closureFormData.closureDate}
                                        onChange={(e) => setClosureFormData(prev => ({ ...prev, closureDate: e.target.value }))}
                                        className="h-10 bg-white focus-visible:ring-indigo-500 text-sm"
                                    />
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Remarks</label>
                                <Input
                                    value={closureFormData.remarks}
                                    onChange={(e) => setClosureFormData(prev => ({ ...prev, remarks: e.target.value }))}
                                    placeholder="Enter closure remarks..."
                                    className="h-10 bg-white focus-visible:ring-indigo-500 text-sm"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-4 bg-slate-50 border-t flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setIsClosureModalOpen(false)}
                            disabled={isSubmitting}
                            className="bg-white border-slate-300 hover:bg-slate-100 h-10 text-xs font-medium flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleClosureSubmit}
                            disabled={isSubmitting || (closureFormData.status === "Closure" && !closureFormData.closureDate)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-bold h-10 text-xs flex-1 transition-all active:scale-95"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...</>
                            ) : (
                                "Update Status"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
