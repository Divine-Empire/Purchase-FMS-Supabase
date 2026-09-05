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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, X, Loader2, Search, Package } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, History as HistoryIcon } from "lucide-react";
import { parseSheetDate, getFmsTimestamp, cn } from "@/lib/utils";
import MaterialReceivedPending from "./material-received-pending";
import MaterialReceivedHistory from "./material-received-history";

const formatDateDash = (date: any) => {
    if (!date || date === "-" || date === "—") return "-";
    const d = date instanceof Date ? date : parseSheetDate(date);
    if (!d || isNaN(d.getTime())) return typeof date === "string" ? date : "-";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
};

const GST_RATES: Record<string, number> = {
    "0%": 0.0,
    "5%": 0.05,
    "12%": 0.12,
    "18%": 0.18,
    "28%": 0.28,
};

const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });

const convertToDownloadUrl = (url: string) => {
    if (!url || !url.includes("drive.google.com")) return url;
    const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
        return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
    return url;
};

const uploadFileToDrive = async (file: File): Promise<string> => {
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    const res = await fetch("/api/upload-supabase", { method: "POST", body: formDataUpload });
    const json = await res.json();
    return json.success ? (json.fileUrl || json.url || "") : "";
};

const PENDING_COLUMNS = [
    { key: "indentNumber", label: "Indent No." },
    { key: "planned6", label: "Planned" },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "warehouse", label: "Warehouse" },
    { key: "vendorName", label: "Vendor Name" },
    { key: "itemName", label: "Item Name" },
    { key: "poNumber", label: "PO Number" },
    { key: "nextFollowUpDate", label: "Next Follow-Up" },
    { key: "remarks", label: "Remarks" },
    { key: "liftingQty", label: "Dispatch Qty" },
    { key: "transporterName", label: "Transporter" },
    { key: "vehicleNo", label: "Vehicle No" },
    { key: "contactNo", label: "Contact No" },
    { key: "lrNo", label: "LR No" },
    { key: "dispatchDate", label: "Dispatch Date" },
    { key: "freightAmount", label: "Freight Amt" },
    { key: "advanceAmount", label: "Advance Amt" },
    { key: "paymentDate", label: "Payment Date" },
    { key: "paymentStatus", label: "Payment Status" },
    { key: "biltyCopy", label: "Bilty Copy" },
    { key: "poCopy", label: "PO Copy" },
] as const;

const HISTORY_COLUMNS = [
    { key: "indentNumber", label: "Indent No." },
    { key: "planned6", label: "Planned" },
    { key: "actual6", label: "Actual" },
    { key: "delay6", label: "Delay" },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "warehouse", label: "Warehouse" },
    { key: "vendorName", label: "Vendor Name" },
    { key: "itemName", label: "Item Name" },
    { key: "poNumber", label: "PO Number" },
    { key: "nextFollowUpDate", label: "Next Follow-Up" },
    { key: "remarks", label: "Remarks" },
    { key: "liftingQty", label: "Dispatch Qty" },
    { key: "transporterName", label: "Transporter" },
    { key: "vehicleNo", label: "Vehicle No" },
    { key: "contactNo", label: "Contact No" },
    { key: "lrNo", label: "LR No" },
    { key: "dispatchDate", label: "Dispatch Date" },
    { key: "freightAmount", label: "Freight Amt" },
    { key: "advanceAmount", label: "Advance Amt" },
    { key: "paymentDate", label: "Payment Date" },
    { key: "paymentStatus", label: "Payment Status" },
    { key: "biltyCopy", label: "Bilty Copy" },
    { key: "poCopy", label: "PO Copy" },
    { key: "invoiceType", label: "Invoice Type" },
    { key: "receiptLiftNumber", label: "Receipt Unit Tracking No." },
    { key: "receivedQty", label: "Received Qty" },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "invoiceNumber", label: "Invoice No." },
    { key: "extraFreight", label: "Extra Freight" },
    { key: "qcRequirement", label: "QC Required" },
    { key: "receivedItemImage", label: "Rec. Item Img" },
    { key: "billAttachment", label: "Bill Attach" },
    { key: "paymentAmountHydra", label: "Hydra Amt" },
    { key: "paymentAmountLabour", label: "Labour Amt" },
    { key: "paymentAmountHamali", label: "Hamali Amt" },
    { key: "damagedQty", label: "Damaged Qty" },
    { key: "damageReason", label: "Damage Reason" },
    { key: "damageImage", label: "Damage Image" },
] as const;

export default function MaterialReceived() {
    const [open, setOpen] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
    const [selectedPendingColumns, setSelectedPendingColumns] = useState<string[]>(
        PENDING_COLUMNS.map((c) => c.key)
    );
    const [selectedHistoryColumns, setSelectedHistoryColumns] = useState<string[]>(
        HISTORY_COLUMNS.map((c) => c.key)
    );

    const [sheetRecords, setSheetRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [itemCodeMap, setItemCodeMap] = useState<Record<string, string>>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [indentFilter, setIndentFilter] = useState<"no_filter" | "increasing" | "decreasing">("no_filter");
    const [warehouseFilter, setWarehouseFilter] = useState("All");

    // Bulk State
    const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [bulkItems, setBulkItems] = useState<{
        recordId: string;
        indentNumber: string;
        liftNumber: string;
        itemName: string;
        receivedQty: string;
        qcRequirement: string;
        warrantyClaim: string;
        duration: string;
        warrantyExpiry: string;
        productExpiry: string;
        productClaim: string;
        receivedItemImage: File | null;
        damageReceived: string;
        damagedQty: string;
        damageReason: string;
        damageImage: File | null;
        index: number;
    }[]>([]);
    const [commonData, setCommonData] = useState({
        invoiceNumber: "",
        invoiceDate: "",
        billAttachment: null as File | null,
        paymentAmountHydra: "",
        paymentAmountLabour: "",
        paymentAmountHamali: "",
        extraFreight: "",
        remarks: "",
        pkgAmount: "",
        pkgGST: "",
        warrantyClaim: "",
    });

    const getPkgTotals = useCallback((
        pkgAmount: string, pkgGST: string, count: number
    ) => {
        const base = parseFloat(pkgAmount) || 0;
        const gstRate = GST_RATES[pkgGST] ?? 0;
        const totalPkg = base + base * gstRate;
        const perItemPkgTotal = count > 0 ? totalPkg / count : 0;
        const perItemPkgBase = count > 0 ? base / count : 0;
        return { totalPkg, perItemPkgTotal, perItemPkgBase };
    }, []);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/material-received");
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                setSheetRecords(json.data);
            } else {
                toast.error(json.error || "Failed to load records");
            }
        } catch (e) {
            console.error("Fetch error:", e);
            toast.error("Failed to fetch data from database");
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const [form, setForm] = useState({
        itemName: "",
        liftNumber: "",
        receivedQty: "",
        invoiceNumber: "",
        invoiceDate: "",
        billAttachment: null as File | null,
        receivedItemImage: null as File | null,
        paymentAmountHydra: "",
        paymentAmountLabour: "",
        paymentAmountHamali: "",
        extraFreight: "",
        qcRequirement: "no",
        warrantyClaim: "",
        productClaim: "",
        duration: "",
        warrantyExpiry: "",
        productExpiry: "",
        remarks: "",
        pkgAmount: "",
        pkgGST: "",
        damageReceived: "",
        damagedQty: "",
        damageReason: "",
        damageImage: null as File | null,
    });

    const recordMap = useMemo(
        () => new Map(sheetRecords.map((r) => [r.id, r])),
        [sheetRecords]
    );

    const checkVendorPOMatch = useCallback((ids: string[]) => {
        if (ids.length === 0) return { match: false, vendor: "", po: "" };
        const first = recordMap.get(ids[0]);
        if (!first) return { match: false, vendor: "", po: "" };
        const v = first.data.vendorName;
        const p = first.data.poNumber;
        for (let i = 1; i < ids.length; i++) {
            const rec = recordMap.get(ids[i]);
            if (!rec || rec.data.vendorName !== v || rec.data.poNumber !== p)
                return { match: false, vendor: "", po: "" };
        }
        return { match: true, vendor: v, po: p };
    }, [recordMap]);

    const handleBulkOpen = useCallback(() => {
        if (selectedRecordIds.length === 0) return;
        const { match } = checkVendorPOMatch(selectedRecordIds);
        if (selectedRecordIds.length > 1 && !match) {
            toast.error("All selected items must have the same Vendor and PO Number.", {
                style: { background: "red", color: "white", border: "none" }
            });
            return;
        }
        setIsBulkMode(true);
        setCommonData({
            invoiceNumber: "",
            invoiceDate: "",
            billAttachment: null,
            paymentAmountHydra: "",
            paymentAmountLabour: "",
            paymentAmountHamali: "",
            extraFreight: "",
            remarks: "",
            pkgAmount: "",
            pkgGST: "",
            warrantyClaim: "",
        });
        const items = selectedRecordIds.map(id => {
            const rec = recordMap.get(id);
            return {
                recordId: id,
                indentNumber: rec?.data?.indentNumber || "",
                liftNumber: rec?.data?.liftNo || "",
                itemName: rec?.data?.itemName || "",
                receivedQty: "",
                qcRequirement: "no",
                warrantyClaim: "no",
                duration: "",
                warrantyExpiry: "",
                productExpiry: "",
                productClaim: "no",
                receivedItemImage: null,
                damageReceived: "no",
                damagedQty: "",
                damageReason: "",
                damageImage: null,
                index: rec?.rowIndex || 0
            };
        });
        setBulkItems(items);
        setOpen(true);
    }, [selectedRecordIds, checkVendorPOMatch, recordMap]);

    const handleBulkSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const billUrlPromise = commonData.billAttachment
                ? uploadFileToDrive(commonData.billAttachment)
                : Promise.resolve("");

            const { perItemPkgBase } = getPkgTotals(
                commonData.pkgAmount,
                commonData.pkgGST,
                bulkItems.length
            );
            const pkgBaseStr = perItemPkgBase > 0 ? perItemPkgBase.toFixed(2) : "";

            const billUrl = await billUrlPromise;

            const recordsToProcess = [];

            for (const item of bulkItems) {
                const itemImgUrl = item.receivedItemImage
                    ? await uploadFileToDrive(item.receivedItemImage)
                    : "";

                let damageImageUrl = "";
                if (item.damageImage) {
                    damageImageUrl = await uploadFileToDrive(item.damageImage);
                }

                recordsToProcess.push({
                    liftNo: item.liftNumber,
                    form: {
                        invoiceType: "independent",
                        invoiceNumber: commonData.invoiceNumber,
                        invoiceDate: commonData.invoiceDate,
                        receivedQty: item.receivedQty,
                        receivedItemImage: itemImgUrl || null,
                        billAttachment: billUrl || null,
                        qcRequirement: item.qcRequirement,
                        extraFreight: commonData.extraFreight || null,
                        paymentAmountHydra: commonData.paymentAmountHydra || null,
                        paymentAmountLabour: commonData.paymentAmountLabour || null,
                        paymentAmountHamali: commonData.paymentAmountHamali || null,
                        remarks: commonData.remarks || "",
                        pkgAmount: pkgBaseStr || null,
                        pkgGST: commonData.pkgGST || null,
                        damagedQty: item.damagedQty || 0,
                        damageReason: item.damageReason || "",
                        damageImage: damageImageUrl || null,
                        warrantyClaim: item.warrantyClaim || null,
                        duration: item.duration || null,
                        warrantyExpiry: item.warrantyExpiry || null,
                        productExpiry: item.productExpiry || null,
                        productClaim: item.productClaim || null
                    }
                });
            }

            const res = await fetch("/api/material-received", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    action: "recordMaterialReceived",
                    records: recordsToProcess
                })
            });

            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.error || `Request failed with status ${res.status}`);
            }

            toast.success("Bulk Receipt recorded successfully!");
            setOpen(false);
            setSelectedRecordIds([]);
            setIsBulkMode(false);
            fetchData();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Error submitting bulk form");
        } finally {
            setIsSubmitting(false);
        }
    }, [commonData, bulkItems, getPkgTotals, fetchData]);

    const openModal = useCallback((recordId: string) => {
        const rec = recordMap.get(recordId);
        if (!rec) {
            toast.error("Record not found locally. Please refresh.");
            return;
        }
        setSelectedRecordIds([]);
        setIsBulkMode(false);
        setSelectedRecordId(recordId);
        setForm({
            itemName: rec.data.itemName || "",
            liftNumber: rec.data.liftNo || "",
            receivedQty: rec.data.liftingQty || "",
            invoiceNumber: rec.data.invoiceNumber || "",
            invoiceDate: "",
            billAttachment: null,
            receivedItemImage: null,
            paymentAmountHydra: "",
            paymentAmountLabour: "",
            paymentAmountHamali: "",
            extraFreight: "",
            qcRequirement: "no",
            warrantyClaim: "",
            productClaim: "",
            duration: "",
            warrantyExpiry: "",
            productExpiry: "",
            remarks: "",
            pkgAmount: "",
            pkgGST: "",
            damageReceived: "",
            damagedQty: "",
            damageReason: "",
            damageImage: null,
        });
        setOpen(true);
    }, [recordMap]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecordId) return;
        const rec = recordMap.get(selectedRecordId);
        if (!rec) return;
        setIsSubmitting(true);
        try {
            const billPromise = form.billAttachment instanceof File
                ? uploadFileToDrive(form.billAttachment)
                : Promise.resolve(typeof form.billAttachment === "string" ? form.billAttachment : "");

            const imagePromise = form.receivedItemImage instanceof File
                ? uploadFileToDrive(form.receivedItemImage)
                : Promise.resolve(typeof form.receivedItemImage === "string" ? form.receivedItemImage : "");

            const [billUrl, imageUrl] = await Promise.all([billPromise, imagePromise]);

            let damageImageUrl = "";
            if (form.damageImage instanceof File) {
                damageImageUrl = await uploadFileToDrive(form.damageImage);
            } else if (typeof form.damageImage === "string") {
                damageImageUrl = form.damageImage;
            }

            const recordsToProcess = [{
                liftNo: rec.data.liftNo,
                form: {
                    invoiceType: "independent",
                    invoiceNumber: form.invoiceNumber,
                    invoiceDate: form.invoiceDate,
                    receivedQty: form.receivedQty,
                    receivedItemImage: imageUrl || null,
                    billAttachment: billUrl || null,
                    qcRequirement: form.qcRequirement,
                    extraFreight: form.extraFreight || null,
                    paymentAmountHydra: form.paymentAmountHydra || null,
                    paymentAmountLabour: form.paymentAmountLabour || null,
                    paymentAmountHamali: form.paymentAmountHamali || null,
                    remarks: form.remarks || "",
                    pkgAmount: form.pkgAmount || null,
                    pkgGST: form.pkgGST || null,
                    damagedQty: form.damagedQty || 0,
                    damageReason: form.damageReason || "",
                    damageImage: damageImageUrl || null,
                    warrantyClaim: form.warrantyClaim || null,
                    duration: form.duration || null,
                    warrantyExpiry: form.warrantyExpiry || null,
                    productExpiry: form.productExpiry || null,
                    productClaim: form.productClaim || null
                }
            }];

            const res = await fetch("/api/material-received", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    action: "recordMaterialReceived",
                    records: recordsToProcess
                })
            });

            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.error || `Request failed with status ${res.status}`);
            }

            toast.success("Receipt recorded successfully!");
            setOpen(false);
            fetchData();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Error submitting form");
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedRecordId, recordMap, form, fetchData]);

    const removeFile = useCallback((key: "billAttachment" | "receivedItemImage") => {
        setForm((f) => ({ ...f, [key]: null }));
    }, []);

    const formValid = useMemo(() =>
        !!(form.receivedQty &&
        form.invoiceNumber &&
        form.invoiceDate &&
        form.qcRequirement &&
        form.billAttachment &&
        form.warrantyClaim &&
        form.productClaim &&
        (form.productClaim !== "yes" || form.productExpiry) &&
        form.damageReceived &&
        (form.damageReceived !== "yes" || (form.damagedQty && form.damageReason))),
        [
            form.receivedQty,
            form.invoiceNumber,
            form.invoiceDate,
            form.qcRequirement,
            form.billAttachment,
            form.warrantyClaim,
            form.productClaim,
            form.productExpiry,
            form.damageReceived,
            form.damagedQty,
            form.damageReason
        ]);

    const pending = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        let records = sheetRecords.filter((r) => {
            if (!r?.data || r.status !== "pending") return false;

            if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
            if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

            if (!lower) return true;
            return (
                String(r.data.indentNumber || "").toLowerCase().includes(lower) ||
                String(r.data.itemName || "").toLowerCase().includes(lower) ||
                String(r.data.vendorName || "").toLowerCase().includes(lower) ||
                String(r.data.poNumber || "").toLowerCase().includes(lower) ||
                String(r.data.invoiceNumber || "").toLowerCase().includes(lower)
            );
        });

        if (indentFilter === "increasing") {
            records = [...records].sort((a, b) => {
                const valA = a.data?.indentNumber || "";
                const valB = b.data?.indentNumber || "";
                return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
            });
        } else if (indentFilter === "decreasing") {
            records = [...records].sort((a, b) => {
                const valA = a.data?.indentNumber || "";
                const valB = b.data?.indentNumber || "";
                return valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
            });
        }
        return records;
    }, [sheetRecords, searchTerm, warehouseFilter, indentFilter]);

    const completed = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        let records = sheetRecords.filter((r) => {
            if (!r?.data || r.status !== "completed") return false;

            if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
            if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

            if (!lower) return true;
            return (
                String(r.data.indentNumber || "").toLowerCase().includes(lower) ||
                String(r.data.itemName || "").toLowerCase().includes(lower) ||
                String(r.data.vendorName || "").toLowerCase().includes(lower) ||
                String(r.data.poNumber || "").toLowerCase().includes(lower) ||
                String(r.data.invoiceNumber || "").toLowerCase().includes(lower)
            );
        });

        if (indentFilter === "increasing") {
            records = [...records].sort((a, b) => {
                const valA = a.data?.indentNumber || "";
                const valB = b.data?.indentNumber || "";
                return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
            });
        } else if (indentFilter === "decreasing") {
            records = [...records].sort((a, b) => {
                const valA = a.data?.indentNumber || "";
                const valB = b.data?.indentNumber || "";
                return valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
            });
        }
        return records;
    }, [sheetRecords, searchTerm, warehouseFilter, indentFilter]);

    const qcField = (
        <div className="space-y-1.5">
            <Label>
                QC Required <span className="text-red-500">*</span>
            </Label>
            <Select
                value={form.qcRequirement}
                onValueChange={(v) => setForm({ ...form, qcRequirement: v })}
            >
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );

    const productClaimField = (
        <div className="space-y-1.5">
            <Label>Product Expiry <span className="text-red-500">*</span></Label>
            <Select
                value={form.productClaim}
                onValueChange={(v) => {
                    const newForm = { ...form, productClaim: v };
                    if (v === "no") {
                        newForm.productExpiry = "";
                    }
                    setForm(newForm);
                }}
            >
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );

    const productExpiryField = (
        <div className="space-y-1.5">
            <Label>Expiry Date <span className="text-red-500">*</span></Label>
            <div className="flex items-center gap-2">
                <Input
                    type="date"
                    value={form.productExpiry}
                    onChange={(e) => setForm({ ...form, productExpiry: e.target.value })}
                    className="flex-1"
                />
            </div>
        </div>
    );

    const warrantyClaimField = (
        <div className="space-y-1.5">
            <Label>Warranty Claim <span className="text-red-500">*</span></Label>
            <Select
                value={form.warrantyClaim}
                onValueChange={(v) => {
                    const newForm = { ...form, warrantyClaim: v };
                    if (v === "no") {
                        newForm.duration = "";
                        newForm.warrantyExpiry = "";
                    }
                    setForm(newForm);
                }}
            >
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );

    const warrantyExpiryAndDurationFields = (
        <>
            <div className="space-y-1.5">
                <Label>Duration (Months)</Label>
                <Input
                    type="number"
                    value={form.duration}
                    onChange={(e) => {
                        const duration = e.target.value;
                        const newForm = { ...form, duration };
                        if (form.invoiceDate && duration) {
                            const d = new Date(form.invoiceDate);
                            const months = parseInt(duration, 10);
                            if (!isNaN(d.getTime()) && !isNaN(months)) {
                                d.setMonth(d.getMonth() + months);
                                newForm.warrantyExpiry = d.toISOString().split("T")[0];
                            }
                        } else {
                            newForm.warrantyExpiry = "";
                        }
                        setForm(newForm);
                    }}
                    placeholder="Months"
                />
            </div>
            <div className="space-y-1.5">
                <Label>Warranty Expiry</Label>
                <Input
                    value={form.warrantyExpiry}
                    readOnly
                    className="bg-gray-100"
                    placeholder="Auto-calc"
                />
            </div>
        </>
    );

    return (
        <div className="p-4 md:p-6 min-h-screen bg-slate-50/30">
            <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as any)}
                className="w-full"
            >
                <div className="md:sticky md:top-0 z-50 bg-slate-50 -mx-4 md:-mx-6 px-4 md:px-6 pt-2 pb-4 mb-4 border-b shadow-sm">
                    <div className="p-4 md:p-6 bg-gradient-to-r from-indigo-50/50 via-blue-50/20 to-white border border-indigo-100/60 rounded-xl shadow-xs mb-4 md:mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg shadow-indigo-100 shadow-xl text-white">
                                    <Package className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-extrabold text-indigo-950 tracking-tight">Stage 7: Material Receipt</h2>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {activeTab === "pending" && selectedRecordIds.length > 1 && (
                                    <Button 
                                        onClick={handleBulkOpen}
                                        className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-md text-white font-bold"
                                    >
                                        Bulk Record ({selectedRecordIds.length})
                                    </Button>
                                )}

                                <Label className="text-sm font-semibold text-indigo-900 whitespace-nowrap hidden md:inline-block">Show Columns:</Label>
                                <Select value="" onValueChange={() => { }}>
                                    <SelectTrigger className="w-40 border-indigo-150 text-indigo-700 bg-white hover:bg-indigo-50/50 hover:text-indigo-800 shadow-xs">
                                        <SelectValue
                                            placeholder={
                                                activeTab === "pending"
                                                    ? `${selectedPendingColumns.length} selected`
                                                    : `${selectedHistoryColumns.length} selected`
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent className="w-40 bg-white">
                                        <div className="p-2">
                                            <div className="flex items-center space-x-2 mb-2 pb-2 border-b">
                                                <Checkbox
                                                    checked={
                                                        activeTab === "pending"
                                                            ? selectedPendingColumns.length === PENDING_COLUMNS.length
                                                            : selectedHistoryColumns.length === HISTORY_COLUMNS.length
                                                    }
                                                    onCheckedChange={(c) => {
                                                        if (activeTab === "pending") {
                                                            setSelectedPendingColumns(
                                                                c ? PENDING_COLUMNS.map((col) => col.key) : []
                                                            );
                                                        } else {
                                                            setSelectedHistoryColumns(
                                                                c ? HISTORY_COLUMNS.map((col) => col.key) : []
                                                            );
                                                        }
                                                    }}
                                                />
                                                <Label className="text-sm font-medium">All Columns</Label>
                                            </div>
                                            {(activeTab === "pending"
                                                ? PENDING_COLUMNS
                                                : HISTORY_COLUMNS
                                            ).map((col) => (
                                                <div
                                                    key={col.key}
                                                    className="flex items-center space-x-2 py-1"
                                                >
                                                    <Checkbox
                                                        checked={
                                                            activeTab === "pending"
                                                                ? selectedPendingColumns.includes(col.key)
                                                                : selectedHistoryColumns.includes(col.key)
                                                        }
                                                        onCheckedChange={(checked) => {
                                                            if (activeTab === "pending") {
                                                                setSelectedPendingColumns((prev) =>
                                                                    checked
                                                                        ? [...prev, col.key]
                                                                        : prev.filter((c) => c !== col.key)
                                                                );
                                                            } else {
                                                                setSelectedHistoryColumns((prev) =>
                                                                    checked
                                                                        ? [...prev, col.key]
                                                                        : prev.filter((c) => c !== col.key)
                                                                );
                                                            }
                                                        }}
                                                    />
                                                    <Label className="text-sm">{col.label}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-4">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-indigo-500" />
                                <Input
                                    placeholder="Search by Indent, Item, Vendor, PO, Invoice..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 bg-white border-indigo-100 focus-visible:ring-indigo-500"
                                />
                            </div>

                            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                                <SelectTrigger className="w-[150px] bg-white border-indigo-100 focus:ring-indigo-500">
                                    <SelectValue placeholder="Select warehouse" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    <SelectItem value="All">All Warehouses</SelectItem>
                                    <SelectItem value="NE Warehouse">NE Warehouse</SelectItem>
                                    <SelectItem value="Others">Others</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <TabsList className="bg-indigo-50/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1.5 border border-indigo-100/50 w-[420px] shadow-2xs">
                            <TabsTrigger 
                                value="pending"
                                className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-3 transition-all cursor-pointer text-slate-700 font-medium"
                            >
                                <ClipboardList className="w-5 h-5 opacity-80" />
                                <div className="flex flex-col items-start leading-none gap-1 text-left">
                                    <span className="font-bold">Pending</span>
                                    <span className="text-[10px] opacity-70">Awaiting processing</span>
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
                                className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-3 transition-all cursor-pointer text-slate-700 font-medium"
                            >
                                <HistoryIcon className="w-5 h-5 opacity-80" />
                                <div className="flex flex-col items-start leading-none gap-1 text-left">
                                    <span className="font-bold">History</span>
                                    <span className="text-[10px] opacity-70 font-medium">Completed records</span>
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

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-500">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-black" />
                        <p className="text-lg animate-pulse text-black font-medium">Loading records...</p>
                    </div>
                ) : (
                    <>
                        <TabsContent value="pending" className="mt-0 outline-none">
                            {pending.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <p className="text-lg">No pending receipts</p>
                                </div>
                            ) : (
                                <MaterialReceivedPending
                                    pending={pending}
                                    selectedRecordIds={selectedRecordIds}
                                    setSelectedRecordIds={setSelectedRecordIds}
                                    openModal={openModal}
                                    selectedPendingColumns={selectedPendingColumns}
                                    PENDING_COLUMNS={PENDING_COLUMNS}
                                />
                            )}
                        </TabsContent>

                        <TabsContent value="history" className="mt-6">
                            {completed.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <p className="text-lg">No completed receipts</p>
                                </div>
                            ) : (
                                <MaterialReceivedHistory
                                    completed={completed}
                                    selectedHistoryColumns={selectedHistoryColumns}
                                    HISTORY_COLUMNS={HISTORY_COLUMNS}
                                />
                            )}
                        </TabsContent>
                    </>
                )}
            </Tabs>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col p-6">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle>
                            {isBulkMode
                                ? "Bulk Material Receipt"
                                : "Record Material Receipt"}
                        </DialogTitle>
                    </DialogHeader>

                    {isBulkMode ? (
                        <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto space-y-4 p-4 pb-8 pr-2">
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Items ({bulkItems.length})</h3>
                                <div className="border rounded-lg overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-gray-50">
                                            <TableRow>
                                                <TableHead className="w-[200px]">Item Details</TableHead>
                                                <TableHead className="w-[120px]">Received Qty <span className="text-red-500">*</span></TableHead>
                                                <TableHead className="w-[120px]">QC Required <span className="text-red-500">*</span></TableHead>
                                                <TableHead className="w-[150px]">Item Image</TableHead>
                                                <TableHead className="w-[120px]">Warranty</TableHead>
                                                <TableHead className="w-[120px]">Damage Received</TableHead>
                                                {bulkItems.some(i => i.damageReceived === "yes") && (
                                                    <>
                                                        <TableHead className="w-[100px]">Damaged Qty</TableHead>
                                                        <TableHead className="w-[150px]">Reason</TableHead>
                                                        <TableHead className="w-[150px]">Damage Image</TableHead>
                                                    </>
                                                )}
                                                {bulkItems.some(i => i.warrantyClaim === "yes") && (
                                                    <>
                                                        <TableHead className="w-[100px]">Duration (M)</TableHead>
                                                        <TableHead className="w-[120px]">Warranty Expiry</TableHead>
                                                        <TableHead className="w-[180px]">Product Expiry</TableHead>
                                                    </>
                                                )}
                                                {!bulkItems.some(i => i.warrantyClaim === "yes") && (
                                                    <TableHead className="w-[180px]">Product Expiry</TableHead>
                                                )}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {bulkItems.map((item, idx) => (
                                                <TableRow key={item.recordId}>
                                                    <TableCell className="text-xs">
                                                        <div className="font-bold">Ind: {item.indentNumber}</div>
                                                        <div>Lift: {item.liftNumber}</div>
                                                        <div className="text-gray-500 truncate max-w-[150px]" title={item.itemName}>{item.itemName}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            value={item.receivedQty}
                                                            onChange={(e) => {
                                                                const newItems = [...bulkItems];
                                                                newItems[idx].receivedQty = e.target.value;
                                                                setBulkItems(newItems);
                                                            }}
                                                            className="h-8"
                                                            required
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select
                                                            value={item.qcRequirement}
                                                            onValueChange={(v) => {
                                                                const newItems = [...bulkItems];
                                                                newItems[idx].qcRequirement = v;
                                                                setBulkItems(newItems);
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="yes">Yes</SelectItem>
                                                                <SelectItem value="no">No</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-1">
                                                            <input
                                                                id={`bulkItemImage-${idx}`}
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={(e) => {
                                                                    const newItems = [...bulkItems];
                                                                    newItems[idx].receivedItemImage = e.target.files?.[0] || null;
                                                                    setBulkItems(newItems);
                                                                }}
                                                                className="hidden"
                                                            />
                                                            {!item.receivedItemImage ? (
                                                                <label
                                                                    htmlFor={`bulkItemImage-${idx}`}
                                                                    className="flex items-center justify-center h-8 border border-dashed rounded cursor-pointer hover:bg-gray-50 px-2"
                                                                >
                                                                    <Upload className="w-3 h-3 mr-1" />
                                                                    <span className="text-[10px]">Upload</span>
                                                                </label>
                                                            ) : (
                                                                <div className="flex items-center justify-between gap-1 p-1 bg-gray-50 border rounded">
                                                                    <span className="text-[10px] truncate max-w-[60px]">{item.receivedItemImage.name}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newItems = [...bulkItems];
                                                                            newItems[idx].receivedItemImage = null;
                                                                            setBulkItems(newItems);
                                                                        }}
                                                                        className="text-red-600"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select
                                                            value={item.warrantyClaim}
                                                            onValueChange={(v) => {
                                                                const newItems = [...bulkItems];
                                                                newItems[idx].warrantyClaim = v;
                                                                if (v === "no") {
                                                                    newItems[idx].duration = "";
                                                                    newItems[idx].warrantyExpiry = "";
                                                                }
                                                                setBulkItems(newItems);
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="yes">Yes</SelectItem>
                                                                <SelectItem value="no">No</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select
                                                            value={item.damageReceived}
                                                            onValueChange={(v) => {
                                                                const newItems = [...bulkItems];
                                                                newItems[idx].damageReceived = v;
                                                                if (v === "no") {
                                                                    newItems[idx].damagedQty = "";
                                                                    newItems[idx].damageReason = "";
                                                                    newItems[idx].damageImage = null;
                                                                }
                                                                setBulkItems(newItems);
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="yes">Yes</SelectItem>
                                                                <SelectItem value="no">No</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    {bulkItems.some(i => i.damageReceived === "yes") && (
                                                        <>
                                                            <TableCell>
                                                                {item.damageReceived === "yes" ? (
                                                                    <Input
                                                                        type="number"
                                                                        value={item.damagedQty}
                                                                        onChange={(e) => {
                                                                            const newItems = [...bulkItems];
                                                                            newItems[idx].damagedQty = e.target.value;
                                                                            setBulkItems(newItems);
                                                                        }}
                                                                        className="h-8"
                                                                        placeholder="Qty"
                                                                    />
                                                                ) : "-"}
                                                            </TableCell>
                                                            <TableCell>
                                                                {item.damageReceived === "yes" ? (
                                                                    <Input
                                                                        value={item.damageReason}
                                                                        onChange={(e) => {
                                                                            const newItems = [...bulkItems];
                                                                            newItems[idx].damageReason = e.target.value;
                                                                            setBulkItems(newItems);
                                                                        }}
                                                                        className="h-8"
                                                                        placeholder="Reason"
                                                                    />
                                                                ) : "-"}
                                                            </TableCell>
                                                            <TableCell>
                                                                {item.damageReceived === "yes" ? (
                                                                    <div className="space-y-1">
                                                                        <input
                                                                            id={`bulkDamageImage-${idx}`}
                                                                            type="file"
                                                                            accept="image/*"
                                                                            onChange={(e) => {
                                                                                const newItems = [...bulkItems];
                                                                                newItems[idx].damageImage = e.target.files?.[0] || null;
                                                                                setBulkItems(newItems);
                                                                            }}
                                                                            className="hidden"
                                                                        />
                                                                        {!item.damageImage ? (
                                                                            <label
                                                                                htmlFor={`bulkDamageImage-${idx}`}
                                                                                className="flex items-center justify-center h-8 border border-dashed rounded cursor-pointer hover:bg-gray-50 px-2"
                                                                            >
                                                                                <Upload className="w-3 h-3 mr-1" />
                                                                                <span className="text-[10px]">Upload</span>
                                                                            </label>
                                                                        ) : (
                                                                            <div className="flex items-center justify-between gap-1 p-1 bg-gray-50 border rounded">
                                                                                <span className="text-[10px] truncate max-w-[60px]">{item.damageImage.name}</span>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const newItems = [...bulkItems];
                                                                                        newItems[idx].damageImage = null;
                                                                                        setBulkItems(newItems);
                                                                                    }}
                                                                                    className="text-red-600"
                                                                                >
                                                                                    <X className="w-3 h-3" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : "-"}
                                                            </TableCell>
                                                        </>
                                                    )}
                                                    {bulkItems.some(i => i.warrantyClaim === "yes") && (
                                                        <>
                                                            <TableCell>
                                                                {item.warrantyClaim === "yes" ? (
                                                                    <Input
                                                                        type="number"
                                                                        value={item.duration}
                                                                        onChange={(e) => {
                                                                            const newItems = [...bulkItems];
                                                                            newItems[idx].duration = e.target.value;
                                                                            if (commonData.invoiceDate && e.target.value) {
                                                                                const date = new Date(commonData.invoiceDate);
                                                                                const months = parseInt(e.target.value, 10);
                                                                                if (!isNaN(date.getTime()) && !isNaN(months)) {
                                                                                    date.setMonth(date.getMonth() + months);
                                                                                    newItems[idx].warrantyExpiry = date.toISOString().split("T")[0];
                                                                                }
                                                                            } else {
                                                                                newItems[idx].warrantyExpiry = "";
                                                                            }
                                                                            setBulkItems(newItems);
                                                                        }}
                                                                        className="h-8"
                                                                        placeholder="Months"
                                                                    />
                                                                ) : "-"}
                                                            </TableCell>
                                                            <TableCell>
                                                                {item.warrantyClaim === "yes" ? (
                                                                    <Input
                                                                        value={item.warrantyExpiry}
                                                                        readOnly
                                                                        className="h-8 bg-gray-50 text-[10px]"
                                                                        placeholder="Auto-calc"
                                                                    />
                                                                ) : "-"}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Input
                                                                    type="date"
                                                                    value={item.productExpiry}
                                                                    onChange={(e) => {
                                                                        const newItems = [...bulkItems];
                                                                        newItems[idx].productExpiry = e.target.value;
                                                                        setBulkItems(newItems);
                                                                    }}
                                                                    className="h-8 text-[10px]"
                                                                />
                                                            </TableCell>
                                                        </>
                                                    )}
                                                    {!bulkItems.some(i => i.warrantyClaim === "yes") && (
                                                        <TableCell>
                                                            <Input
                                                                type="date"
                                                                value={item.productExpiry}
                                                                onChange={(e) => {
                                                                    const newItems = [...bulkItems];
                                                                    newItems[idx].productExpiry = e.target.value;
                                                                    setBulkItems(newItems);
                                                                }}
                                                                className="h-8 text-[10px]"
                                                            />
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Common Details</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Invoice Date <span className="text-red-500">*</span></Label>
                                        <Input
                                            type="date"
                                            value={commonData.invoiceDate}
                                            onChange={(e) => {
                                                const newDate = e.target.value;
                                                setCommonData({ ...commonData, invoiceDate: newDate });
                                                if (newDate) {
                                                    const updatedItems = bulkItems.map(item => {
                                                        if (item.warrantyClaim === "yes" && item.duration) {
                                                            const d = new Date(newDate);
                                                            const months = parseInt(item.duration, 10);
                                                            if (!isNaN(d.getTime()) && !isNaN(months)) {
                                                                d.setMonth(d.getMonth() + months);
                                                                return { ...item, warrantyExpiry: d.toISOString().split("T")[0] };
                                                            }
                                                        }
                                                        return item;
                                                    });
                                                    setBulkItems(updatedItems);
                                                }
                                            }}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Invoice No. <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={commonData.invoiceNumber}
                                            onChange={(e) => setCommonData({ ...commonData, invoiceNumber: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5 col-span-2">
                                        <Label>Bill Attachment <span className="text-red-500">*</span></Label>
                                        <input
                                            id="bulkBillAttachment"
                                            type="file"
                                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                            onChange={(e) => setCommonData({ ...commonData, billAttachment: e.target.files?.[0] || null })}
                                            className="hidden"
                                        />
                                        <label
                                            htmlFor="bulkBillAttachment"
                                            className="flex items-center justify-center w-full p-2 border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-slate-50 rounded-lg cursor-pointer transition-all h-[80px]"
                                        >
                                            <Upload className="w-4 h-4 text-gray-400 mr-2" />
                                            <span className="text-xs text-gray-500 font-medium">Upload Bill</span>
                                        </label>
                                        {commonData.billAttachment && (
                                            <div className="mt-2 p-2 bg-gray-50 border rounded flex items-center justify-between">
                                                <div className="flex items-center">
                                                    <FileText className="w-4 h-4 text-gray-500 mr-2" />
                                                    <span className="text-sm text-gray-700">
                                                        {commonData.billAttachment.name}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setCommonData(prev => ({ ...prev, billAttachment: null }))}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="border rounded-lg p-4 bg-amber-50 space-y-3">
                                    <h4 className="font-semibold text-sm">Packaging / Forwarding
                                        <span className="text-xs font-normal text-gray-500 ml-2">(shared, divided equally among selected indents)</span>
                                    </h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="space-y-1.5">
                                            <Label>Amount</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={commonData.pkgAmount}
                                                onChange={(e) => setCommonData({ ...commonData, pkgAmount: e.target.value })}
                                                placeholder="0.00"
                                                className="bg-white"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>GST on Packaging</Label>
                                            <Select value={commonData.pkgGST} onValueChange={(v) => setCommonData({ ...commonData, pkgGST: v })}>
                                                <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Select GST" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0%">0%</SelectItem>
                                                    <SelectItem value="5%">5%</SelectItem>
                                                    <SelectItem value="12%">12%</SelectItem>
                                                    <SelectItem value="18%">18%</SelectItem>
                                                    <SelectItem value="28%">28%</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Total Packaging</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={getPkgTotals(commonData.pkgAmount, commonData.pkgGST, bulkItems.length).totalPkg.toFixed(2)}
                                                readOnly
                                                className="bg-gray-100 cursor-not-allowed font-semibold"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-amber-700">Per item share: ₹{getPkgTotals(commonData.pkgAmount, commonData.pkgGST, bulkItems.length).perItemPkgTotal.toFixed(2)}</p>
                                </div>

                                <div className="grid grid-cols-4 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Hydra Amt</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={commonData.paymentAmountHydra}
                                            onChange={(e) => setCommonData({ ...commonData, paymentAmountHydra: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Labour Amt</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={commonData.paymentAmountLabour}
                                            onChange={(e) => setCommonData({ ...commonData, paymentAmountLabour: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Hamali Amt</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={commonData.paymentAmountHamali}
                                            onChange={(e) => setCommonData({ ...commonData, paymentAmountHamali: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Extra Freight</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={commonData.extraFreight}
                                            onChange={(e) => setCommonData({ ...commonData, extraFreight: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Remarks</Label>
                                    <textarea
                                        value={commonData.remarks}
                                        onChange={(e) => setCommonData({ ...commonData, remarks: e.target.value })}
                                        className="w-full min-h-24 px-3 py-2 border border-gray-300 rounded resize-none"
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </form>
                    ) : (
                        <form
                            onSubmit={handleSubmit}
                            className="flex-1 overflow-y-auto space-y-4 p-4 pb-8 pr-2"
                        >
                            <div className="grid grid-cols-4 gap-3">
                                <div className="space-y-1.5 col-span-2">
                                    <Label>Item Name</Label>
                                    <Input
                                        value={form.itemName}
                                        readOnly
                                        className="bg-gray-50 border-blue-200"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Unit Tracking No.</Label>
                                    <Input
                                        value={form.liftNumber}
                                        readOnly
                                        className="bg-gray-50"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>
                                        Received Qty <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="number"
                                        value={form.receivedQty}
                                        onChange={(e) =>
                                            setForm({ ...form, receivedQty: e.target.value })
                                        }
                                        required
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>
                                        Invoice Date <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="date"
                                        value={form.invoiceDate}
                                        onChange={(e) =>
                                            setForm({ ...form, invoiceDate: e.target.value })
                                        }
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label>
                                        Invoice No. <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        value={form.invoiceNumber}
                                        onChange={(e) =>
                                            setForm({ ...form, invoiceNumber: e.target.value })
                                        }
                                        required
                                        placeholder="Invoice #"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {qcField}
                                {productClaimField}
                                {form.productClaim === "yes" && productExpiryField}
                                {warrantyClaimField}
                                {form.warrantyClaim === "yes" && warrantyExpiryAndDurationFields}
                            </div>

                            <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Damage Received <span className="text-red-500">*</span></Label>
                                        <Select
                                            value={form.damageReceived}
                                            onValueChange={(v) => {
                                                const newForm = { ...form, damageReceived: v };
                                                if (v === "no") {
                                                    newForm.damagedQty = "";
                                                    newForm.damageReason = "";
                                                    newForm.damageImage = null;
                                                }
                                                setForm(newForm);
                                            }}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="yes">Yes</SelectItem>
                                                <SelectItem value="no">No</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {form.damageReceived === "yes" && (
                                <div className="grid grid-cols-3 gap-3 bg-red-50/50 p-3 rounded-lg border border-red-100">
                                    <div className="space-y-1.5">
                                        <Label className="text-red-900 font-medium">Damaged Qty <span className="text-red-500">*</span></Label>
                                        <Input
                                            type="number"
                                            value={form.damagedQty}
                                            onChange={(e) => setForm({ ...form, damagedQty: e.target.value })}
                                            placeholder="0"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-red-900 font-medium">Reason <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={form.damageReason}
                                            onChange={(e) => setForm({ ...form, damageReason: e.target.value })}
                                            placeholder="Why is it damaged?"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-red-900 font-medium">Damage Image</Label>
                                        <input
                                            id="damageImage"
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setForm({ ...form, damageImage: e.target.files?.[0] || null })}
                                            className="hidden"
                                        />
                                        <label
                                            htmlFor="damageImage"
                                            className="flex items-center justify-center w-full h-10 border border-dashed border-red-300 rounded cursor-pointer hover:bg-red-100"
                                        >
                                            <Upload className="w-4 h-4 mr-2 text-red-500" />
                                            <span className="text-sm">Upload</span>
                                        </label>
                                        {form.damageImage && (
                                            <div className="mt-1 flex items-center justify-between text-xs text-red-700">
                                                <span className="truncate">{form.damageImage.name}</span>
                                                <button type="button" onClick={() => setForm({ ...form, damageImage: null })}>
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Received Item Image</Label>
                                    <input
                                        id="receivedItemImage"
                                        type="file"
                                        accept=".jpg,.jpeg,.png"
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                receivedItemImage: e.target.files?.[0] ?? null,
                                            })
                                        }
                                        className="hidden"
                                    />
                                    <label
                                        htmlFor="receivedItemImage"
                                        className="flex items-center justify-center w-full p-2 border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-slate-50 rounded-lg cursor-pointer transition-all h-[80px]"
                                    >
                                        <Upload className="w-4 h-4 text-gray-400 mr-2" />
                                        <span className="text-xs text-gray-500 font-medium">Upload Image</span>
                                    </label>
                                    {form.receivedItemImage && (
                                        <div className="mt-2 p-2 bg-gray-50 border rounded flex items-center justify-between">
                                            <div className="flex items-center">
                                                <FileText className="w-4 h-4 text-gray-500 mr-2" />
                                                <span className="text-sm text-gray-700">
                                                    {form.receivedItemImage.name}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeFile("receivedItemImage")}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Bill Attachment <span className="text-red-500">*</span></Label>
                                    <input
                                        id="billAttachment"
                                        type="file"
                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                billAttachment: e.target.files?.[0] ?? null,
                                            })
                                        }
                                        className="hidden"
                                    />
                                    <label
                                        htmlFor="billAttachment"
                                        className="flex items-center justify-center w-full p-2 border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-slate-50 rounded-lg cursor-pointer transition-all h-[80px]"
                                    >
                                        <Upload className="w-4 h-4 text-gray-400 mr-2" />
                                        <span className="text-xs text-gray-500 font-medium">Upload Bill</span>
                                    </label>
                                    {form.billAttachment && (
                                        <div className="mt-2 p-2 bg-gray-50 border rounded flex items-center justify-between">
                                            <div className="flex items-center">
                                                <FileText className="w-4 h-4 text-gray-500 mr-2" />
                                                <span className="text-sm text-gray-700">
                                                    {form.billAttachment.name}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeFile("billAttachment")}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b pb-1 mb-2">Others Payment Head</h3>
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Hydra Amount</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={form.paymentAmountHydra}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    paymentAmountHydra: e.target.value,
                                                })
                                            }
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Labour Amount</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={form.paymentAmountLabour}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    paymentAmountLabour: e.target.value,
                                                })
                                            }
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Hamali Amount</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={form.paymentAmountHamali}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    paymentAmountHamali: e.target.value,
                                                })
                                            }
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Extra Freight</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={form.extraFreight}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    extraFreight: e.target.value,
                                                })
                                            }
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 bg-amber-50 p-3 rounded-lg border border-amber-100">
                                <div className="space-y-1.5">
                                    <Label>Packaging Amount</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={form.pkgAmount}
                                        onChange={(e) => setForm({ ...form, pkgAmount: e.target.value })}
                                        placeholder="0.00"
                                        className="bg-white border-amber-200"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>GST on Packaging</Label>
                                    <Select
                                        value={form.pkgGST}
                                        onValueChange={(v) => setForm({ ...form, pkgGST: v })}
                                    >
                                        <SelectTrigger className="w-full bg-white border-amber-200">
                                            <SelectValue placeholder="Select GST..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0%">0%</SelectItem>
                                            <SelectItem value="5%">5%</SelectItem>
                                            <SelectItem value="12%">12%</SelectItem>
                                            <SelectItem value="18%">18%</SelectItem>
                                            <SelectItem value="28%">28%</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Total Packaging Amt</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={getPkgTotals(form.pkgAmount, form.pkgGST, 1).totalPkg.toFixed(2)}
                                        readOnly
                                        className="bg-gray-100 cursor-not-allowed font-semibold"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Remarks (Optional)</Label>
                                <textarea
                                    value={form.remarks}
                                    onChange={(e) =>
                                        setForm({ ...form, remarks: e.target.value })
                                    }
                                    className="w-full min-h-24 px-3 py-2 border border-gray-300 rounded resize-none"
                                    rows={3}
                                />
                            </div>
                        </form>
                    )}

                    <DialogFooter className="flex-shrink-0 pt-2 border-t">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        {isBulkMode ? (
                            <Button 
                                onClick={handleBulkSubmit}
                                disabled={isSubmitting || bulkItems.some(i => !i.receivedQty || !i.qcRequirement || (i.damageReceived === "yes" && (!i.damagedQty || !i.damageReason)))} 
                                className="bg-amber-600 hover:bg-amber-700 text-white"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Submit Bulk
                            </Button>
                        ) : (
                            <Button
                                onClick={handleSubmit}
                                disabled={!formValid || isSubmitting}
                                className="bg-amber-600 hover:bg-amber-700 text-white"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Submit Receipt
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
