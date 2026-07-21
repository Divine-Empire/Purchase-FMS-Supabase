"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Search, ShieldAlert } from "lucide-react";
import { formatDate, parseSheetDate, getFmsTimestamp, isWarrantyExpiringSoon } from "@/lib/utils";
import { toast } from "sonner";
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
    { key: "planned", label: "Planned" },
] as const;

const CLOSURE_PENDING_COLUMNS = [
    { key: "indentNo", label: "Indent No." },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "serialNo", label: "Serial No." },
    { key: "invoiceNo", label: "Invoice No." },
    { key: "issueDescription", label: "Issue Description" },
    { key: "claimType", label: "Claim Type" },
    { key: "status", label: "Status" },
] as const;

const HISTORY_COLUMNS = [
    { key: "indentNo", label: "Indent No." },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "vendorName", label: "Vendor Name" },
    { key: "itemName", label: "Item Name" },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "serialNo", label: "Serial No." },
    { key: "warrantyEnd", label: "Warranty End" },
    { key: "planned", label: "Planned" },
    { key: "actual", label: "Actual" },
] as const;

export default function WarrantyClaim() {
    const [pendingRecords, setPendingRecords] = useState<any[]>([]);
    const [closurePendingRecords, setClosurePendingRecords] = useState<any[]>([]);
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
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

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/warranty-claim");
            const json = await res.json();
            if (json.success) {
                setPendingRecords(json.pending || []);
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

    const pending = useMemo(() => {
        let filtered = applySearch(pendingRecords);
        if (showExpiringOnly) {
            filtered = filtered.filter(r => isWarrantyExpiringSoon(r.data.warrantyEnd));
        }
        return filtered;
    }, [pendingRecords, applySearch, showExpiringOnly]);

    const closurePending = useMemo(() => applySearch(closurePendingRecords), [closurePendingRecords, applySearch]);
    const history = useMemo(() => applySearch(historyRecords), [historyRecords, applySearch]);

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
        } catch (e: any) {
            console.error("Submit error:", e);
            toast.error(e.message || "Failed to submit claim", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedRecord, formData, fetchData, uploadFile]);

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

    const formatDateDash = (dateStr: any) => {
        if (!dateStr || dateStr === "-" || dateStr === "—") return "-";
        const d = parseSheetDate(dateStr);
        if (!d || isNaN(d.getTime())) return dateStr;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${day}-${month}-${year}`;
    };

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
                <div className="sticky top-0 z-30 bg-[#f8fafc] -mx-6 px-6 pt-2 pb-4 mb-4 border-b shadow-sm">
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

                    <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-100/50 p-1 rounded-lg">
                        <TabsTrigger
                            value="pending"
                            className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                        >
                            Pending ({pending.length})
                        </TabsTrigger>
                        <TabsTrigger
                            value="closurePending"
                            className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                        >
                            Closure Pending ({closurePending.length})
                        </TabsTrigger>
                        <TabsTrigger
                            value="history"
                            className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                        >
                            History ({history.length})
                        </TabsTrigger>
                    </TabsList>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-500">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-600" />
                        <p className="text-lg animate-pulse text-indigo-900 font-medium">Loading records...</p>
                    </div>
                ) : (
                    <>
                        <TabsContent value="pending" className="mt-0 outline-none">
                            {pending.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-lg text-black">No pending Warranty Claims</p>
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
