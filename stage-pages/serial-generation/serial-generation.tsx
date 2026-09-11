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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ShieldAlert, Eye, Printer, PlusCircle, Check, ChevronsUpDown, Download, X, ClipboardList, History } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate, parseSheetDate, getFmsTimestamp, formatDateTimeDash, sortByIndentNumber, canViewPurchaserRecord } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Label } from "@/components/ui/label";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import QRCode from "qrcode";
import SerialGenerationPending from "./serial-generation-pending";
import SerialGenerationHistory from "./serial-generation-history";

const getDirectDriveLink = (url: string) => {
    if (!url) return "";
    const match = url.match(/\/d\/(.+?)\/(view|edit)/) || url.match(/id=(.+?)(&|$)/);
    if (match && match[1]) {
        return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    return url;
};

const getGoogleDriveViewLink = (url: string) => {
    if (!url) return "";
    const match = url.match(/\/d\/(.+?)\/(view|edit)/) || url.match(/id=(.+?)(&|$)/);
    if (match && match[1]) {
        return `https://drive.google.com/file/d/${match[1]}/view`;
    }
    return url;
};

const LocalQRPreview = ({ itemName, itemCode, serialNo, expiryDate }: { itemName: string, itemCode: string, serialNo: string, expiryDate?: string }) => {
    const [qrUrl, setQrUrl] = useState<string>("");

    useEffect(() => {
        let active = true;
        const generate = async () => {
            try {
                const dataUrl = await generateLabelPngDataUrl(itemName, itemCode, serialNo, expiryDate || "");
                if (active) {
                    setQrUrl(dataUrl);
                }
            } catch (err) {
                console.error("Failed to generate local QR code", err);
            }
        };
        generate();
        return () => {
            active = false;
        };
    }, [itemName, itemCode, serialNo, expiryDate]);

    if (!qrUrl) {
        return (
            <div className="h-[140px] w-[350px] flex items-center justify-center bg-slate-50 border rounded-lg animate-pulse">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <img
            src={qrUrl}
            alt="Sample QR Label"
            className="max-w-full h-auto w-[350px] border shadow-sm rounded-lg"
        />
    );
};

const formatDateDash = (date: any) => formatDateTimeDash(date);

const PENDING_COLUMNS = [
    { key: "indentNo", label: "Indent No." },
    { key: "planned", label: "Planned" },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "vendorName", label: "Vendor Name" },
    { key: "itemName", label: "Item Name" },
    { key: "invoiceNo", label: "Invoice No." },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "invoiceCopy", label: "Invoice Copy" },
    { key: "poNumber", label: "PO Number" },
    { key: "poCopy", label: "PO Copy" },
    { key: "readyQty", label: "Ready Qty" },
    { key: "warrantyExpiry", label: "Warranty Expiry" },
    { key: "productExpiry", label: "Product Expiry" },
] as const;

const HISTORY_COLUMNS = [
    { key: "indentNo", label: "Indent No." },
    { key: "planned", label: "Planned" },
    { key: "actual", label: "Actual" },
    { key: "delay", label: "Delay" },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "vendorName", label: "Vendor Name" },
    { key: "itemName", label: "Item Name" },
    { key: "invoiceNo", label: "Invoice No." },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "invoiceCopy", label: "Invoice Copy" },
    { key: "poNumber", label: "PO Number" },
    { key: "poCopy", label: "PO Copy" },
    { key: "receivedQty", label: "Received Qty" },
    { key: "warrantyExpiry", label: "Warranty Expiry" },
    { key: "productExpiry", label: "Product Expiry" },
    { key: "actions", label: "Action" },
] as const;

interface WarrantyEntry {
    serialNo: string;
}

const toBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });

const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};

const uploadFileToDrive = async (
    blob: Blob,
    fileName: string
): Promise<string> => {
    const file = new File([blob], fileName, { type: "image/png" });
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    const res = await fetch("/api/upload-supabase", { method: "POST", body: formDataUpload });
    const json = await res.json();
    return json.success ? (json.fileUrl || json.url || "") : "";
};

const codeMap: Record<string, string> = {
    "0": "0", "1": "A", "2": "B", "3": "C", "4": "D",
    "5": "E", "6": "F", "7": "G", "8": "H", "9": "I"
};

const encodeExpiryDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
        const parts = dateStr.split("-"); // YYYY-MM-DD
        if (parts.length < 2) return "";
        const year = parts[0].slice(2); // YY
        const month = parts[1]; // MM
        const encode = (s: string) => s.split("").map(c => codeMap[c] || c).join("");
        return `${encode(month)}-${encode(year)}`;
    } catch (e) {
        return "";
    }
};

const getTextWrapLines = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine ? currentLine + " " + word : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && i > 0) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines;
};

const generateLabelPngDataUrl = async (
    itemName: string,
    itemCode: string,
    serialNo: string,
    expiryDateStr: string
): Promise<string> => {
    const encodedDate = expiryDateStr ? encodeExpiryDate(expiryDateStr) : "";
    const qrData = encodedDate
        ? `${itemName}/${itemCode}/${serialNo}/${encodedDate}`
        : `${itemName}/${itemCode}/${serialNo}`;

    const qrDataUrl = await QRCode.toDataURL(qrData, {
        margin: 1,
        errorCorrectionLevel: 'L',
        width: 250
    });

    const canvas = document.createElement("canvas");
    canvas.width = 650;
    canvas.height = 250;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D context");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 20, 20, 210, 210);
            resolve();
        };
        img.onerror = reject;
        img.src = qrDataUrl;
    });

    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";

    ctx.font = "bold 22px Arial, sans-serif";
    const displayName = `${itemName.toUpperCase()} (${itemCode})`;
    const titleLines = getTextWrapLines(ctx, displayName, 380);

    const line1Height = titleLines.length * 28;
    const line2Height = 26;
    const line3Height = encodedDate ? 24 : 0;
    const totalTextHeight = line1Height + 20 + line2Height + (encodedDate ? 12 + line3Height : 0);

    let currentY = Math.max(15, (250 - totalTextHeight) / 2);

    ctx.font = "bold 22px Arial, sans-serif";
    for (const line of titleLines) {
        ctx.fillText(line, 250, currentY);
        currentY += 28;
    }

    currentY += 20;

    ctx.font = "24px Arial, sans-serif";
    ctx.fillText(serialNo, 250, currentY);
    currentY += 26;

    if (encodedDate) {
        currentY += 12;
        ctx.font = "22px Arial, sans-serif";
        ctx.fillText(encodedDate, 250, currentY);
    }

    return canvas.toDataURL("image/png");
};

const encodeDateYYMMDD = (dateStr: string) => {
    if (!dateStr || dateStr === "-") return "";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        const yy = String(d.getFullYear()).slice(-2);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const full = yy + mm + dd; // YYMMDD
        return full.split("").map(c => codeMap[c] || c).join("");
    } catch (e) {
        return "";
    }
};

const generateQRSvgString = async (
    itemName: string,
    itemCode: string,
    serialNo: string,
    encodedDate: string
): Promise<string> => {
    const qrData = encodedDate
        ? `${itemName}/${itemCode}/${serialNo}/${encodedDate}`
        : `${itemName}/${itemCode}/${serialNo}`;

    return await QRCode.toString(qrData, {
        type: 'svg',
        margin: 2,
        errorCorrectionLevel: 'L'
    });
};

const Combobox = ({
    options,
    value,
    onChange,
    placeholder,
    searchPlaceholder,
    disabled,
}: {
    options: string[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    searchPlaceholder: string;
    disabled?: boolean;
}) => {
    const [open, setOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const [debouncedSearchValue, setDebouncedSearchValue] = useState("");

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchValue(searchValue);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchValue]);

    const filteredOptions = useMemo(() => {
        if (!debouncedSearchValue) return options.slice(0, 50);
        const lower = debouncedSearchValue.toLowerCase();
        return options
            .filter((option) => option.toLowerCase().includes(lower))
            .slice(0, 50);
    }, [options, debouncedSearchValue]);

    return (
        <Popover open={open} onOpenChange={setOpen} modal={true}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between font-normal bg-white border-slate-200 text-left", !value && "text-muted-foreground")}
                    disabled={disabled}
                >
                    <span className="truncate">
                        {value
                            ? options.find((option) => option === value) || value
                            : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={searchPlaceholder}
                        value={searchValue}
                        onValueChange={setSearchValue}
                    />
                    <CommandList className="max-h-[250px] overflow-y-auto">
                        {filteredOptions.length === 0 && searchValue.trim() !== "" && (
                            <div
                                className="py-2 px-4 text-sm text-blue-600 cursor-pointer hover:bg-slate-100 flex items-center gap-2"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onChange(searchValue);
                                    setOpen(false);
                                }}
                            >
                                <PlusCircle className="w-3 h-3" />
                                Create "{searchValue}"
                            </div>
                        )}
                        <CommandGroup>
                            {filteredOptions.map((option) => (
                                <CommandItem
                                    key={option}
                                    value={option}
                                    onSelect={() => {
                                        onChange(option);
                                        setOpen(false);
                                    }}
                                    className="whitespace-normal break-words py-2 cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4 shrink-0",
                                            value === option ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <span className="flex-1 text-sm">{option}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default function SerialGeneration() {
    const { role, records: recordsAccess } = useAuth();
    const [pendingRecords, setPendingRecords] = useState<any[]>([]);
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
    const [indentFilter, setIndentFilter] = useState<"no_filter" | "increasing" | "decreasing">("no_filter");

    const [open, setOpen] = useState(false);
    const [selectedRecords, setSelectedRecords] = useState<any[]>([]);
    const [entriesMap, setEntriesMap] = useState<Record<string, WarrantyEntry[]>>({});
    const [isSerialEnabled, setIsSerialEnabled] = useState(true);
    const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set());
    const [selectedInvoiceGroup, setSelectedInvoiceGroup] = useState<string | null>(null);
    const [isAutoMode, setIsAutoMode] = useState(false);
    const [vendorCodes, setVendorCodes] = useState<Record<string, string>>({});
    const [itemCodeMap, setItemCodeMap] = useState<Record<string, string>>({});
    const [previewContent, setPreviewContent] = useState<Record<string, string>>({});
    const [startingSequence, setStartingSequence] = useState(1);
    const [isCheckingSequence, setIsCheckingSequence] = useState(false);

    const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
    const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<any>(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [pdfGeneratingId, setPdfGeneratingId] = useState<string | null>(null);


    // === Direct Entry Form State ===
    const [directFormOpen, setDirectFormOpen] = useState(false);
    const [directForm, setDirectForm] = useState<{
        itemName: string;
        vendorName: string;
        invoiceDate: string;
        duration: string;
        quantity: number | "";
    }>({
        itemName: "",
        vendorName: "",
        invoiceDate: "",
        duration: "12",
        quantity: "",
    });
    const [debouncedQuantity, setDebouncedQuantity] = useState(0);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuantity(directForm.quantity === "" ? 0 : directForm.quantity);
        }, 500);
        return () => clearTimeout(handler);
    }, [directForm.quantity]);

    const [directEntries, setDirectEntries] = useState<Array<{ serialNo: string }>>([]);
    const [directIsAutoMode, setDirectIsAutoMode] = useState(true);
    const [directStartingSequence, setDirectStartingSequence] = useState(1);
    const [directIsCheckingSequence, setDirectIsCheckingSequence] = useState(false);
    const [directPreviewContent, setDirectPreviewContent] = useState<Record<number, string>>({});

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/serial-generation");
            const json = await res.json();
            if (json.success) {
                setPendingRecords(json.pending || []);
                setHistoryRecords(json.history || []);
                if (json.itemCodeMap) setItemCodeMap(json.itemCodeMap);
                if (json.vendorCodeMap) setVendorCodes(json.vendorCodeMap);
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
            r.data.indentNo?.toLowerCase().includes(lower) ||
            r.data.itemName?.toLowerCase().includes(lower) ||
            r.data.vendorName?.toLowerCase().includes(lower) ||
            String(r.data.poNumber || "").toLowerCase().includes(lower) ||
            String(r.data.invoiceNo || "").toLowerCase().includes(lower)
        );
    }, [searchTerm]);

    // Purchaser-based record access: only show records this user is allowed to see.
    const visiblePendingRecords = useMemo(
        () => pendingRecords.filter((r) => canViewPurchaserRecord(r.data?.purchaser, recordsAccess, role)),
        [pendingRecords, recordsAccess, role]
    );
    const visibleHistoryRecords = useMemo(
        () => historyRecords.filter((r) => canViewPurchaserRecord(r.data?.purchaser, recordsAccess, role)),
        [historyRecords, recordsAccess, role]
    );

    const pending = useMemo(() => {
        const items = applySearch(visiblePendingRecords);
        return sortByIndentNumber(items, indentFilter === "decreasing" ? "desc" : "asc");
    }, [visiblePendingRecords, applySearch, indentFilter]);

    const history = useMemo(() => {
        const items = applySearch(visibleHistoryRecords);
        return sortByIndentNumber(items, indentFilter === "decreasing" ? "desc" : "asc");
    }, [visibleHistoryRecords, applySearch, indentFilter]);

    const pendingGroups = useMemo(() => {
        const groups: Record<string, {
            invoiceNo: string;
            invoiceDate: string;
            vendorName: string;
            records: any[];
        }> = {};

        pending.forEach((rec) => {
            const invNo = rec.data.invoiceNo || "No Invoice";
            if (!groups[invNo]) {
                groups[invNo] = {
                    invoiceNo: invNo,
                    invoiceDate: rec.data.invoiceDate,
                    vendorName: rec.data.vendorName,
                    records: [],
                };
            }
            groups[invNo].records.push(rec);
        });

        return Object.values(groups);
    }, [pending]);

    const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});

    const toggleInvoiceExpanded = useCallback((invoiceNo: string) => {
        setExpandedInvoices((prev) => ({
            ...prev,
            [invoiceNo]: !prev[invoiceNo],
        }));
    }, []);

    const handleCheckboxChange = useCallback((rec: any, checked: boolean) => {
        const invNo = rec.data.invoiceNo || "No Invoice";
        if (checked) {
            setSelectedPendingIds((prev) => {
                if (selectedInvoiceGroup && selectedInvoiceGroup !== invNo) {
                    toast.warning(`Selection cleared: You can only select lifts from the same invoice group ("${invNo}").`);
                    const newSet = new Set<string>();
                    newSet.add(rec.id);
                    setSelectedInvoiceGroup(invNo);
                    return newSet;
                } else {
                    const newSet = new Set(prev);
                    newSet.add(rec.id);
                    setSelectedInvoiceGroup(invNo);
                    return newSet;
                }
            });
        } else {
            setSelectedPendingIds((prev) => {
                const newSet = new Set(prev);
                newSet.delete(rec.id);
                if (newSet.size === 0) {
                    setSelectedInvoiceGroup(null);
                }
                return newSet;
            });
        }
    }, [selectedInvoiceGroup]);

    const fetchNextSequence = useCallback(async (vendorName: string, invoiceDate: string) => {
        setIsCheckingSequence(true);
        try {
            const vendorCode = vendorCodes[vendorName] || "UNKNOWN";
            const encodedDate = encodeDateYYMMDD(invoiceDate);
            const prefix = `SN-${vendorCode}/${encodedDate}/`;

            const res = await fetch(`/api/serial-generation?prefix=${encodeURIComponent(prefix)}`);
            const json = await res.json();
            if (json.success) {
                setStartingSequence(json.nextSequence || 1);
            }
        } catch (err) {
            console.error("Sequence fetch error:", err);
        } finally {
            setIsCheckingSequence(false);
        }
    }, [vendorCodes]);

    const fetchDirectNextSequence = useCallback(async (vendorName: string, invoiceDate: string) => {
        setDirectIsCheckingSequence(true);
        try {
            const vendorCode = vendorCodes[vendorName] || "UNKNOWN";
            const encodedDate = encodeDateYYMMDD(invoiceDate);
            const prefix = `SN-DIR-${vendorCode}/${encodedDate}/`;

            const res = await fetch(`/api/serial-generation?prefix=${encodeURIComponent(prefix)}&isDirect=true`);
            const json = await res.json();
            if (json.success) {
                setDirectStartingSequence(json.nextSequence || 1);
            }
        } catch (err) {
            console.error("Direct sequence fetch error:", err);
        } finally {
            setDirectIsCheckingSequence(false);
        }
    }, [vendorCodes]);

    useEffect(() => {
        if (directForm.vendorName && directForm.invoiceDate && directFormOpen) {
            fetchDirectNextSequence(directForm.vendorName, directForm.invoiceDate);
        }
    }, [directForm.vendorName, directForm.invoiceDate, directFormOpen, fetchDirectNextSequence]);

    useEffect(() => {
        if (!directFormOpen) return;
        const vendorCode = vendorCodes[directForm.vendorName] || "UNKNOWN";
        const encodedDate = encodeDateYYMMDD(directForm.invoiceDate);
        const prefix = `SN-DIR-${vendorCode}/${encodedDate}/`;

        if (directIsAutoMode) {
            if (directIsCheckingSequence) {
                setDirectEntries(Array.from({ length: debouncedQuantity }, () => ({
                    serialNo: `${prefix}Loading...`
                })));
            } else {
                setDirectEntries(Array.from({ length: debouncedQuantity }, (_, idx) => ({
                    serialNo: `${prefix}${String(directStartingSequence + idx).padStart(3, "0")}`
                })));
            }
        } else {
            setDirectEntries((prev) => {
                const arr = Array.from({ length: debouncedQuantity }, (_, idx) => {
                    if (prev[idx] && prev[idx].serialNo.startsWith(`SN-DIR-`)) {
                        return prev[idx];
                    }
                    return { serialNo: prefix };
                });
                return arr;
            });
        }
    }, [directIsAutoMode, directForm.vendorName, directForm.invoiceDate, debouncedQuantity, vendorCodes, directStartingSequence, directIsCheckingSequence, directFormOpen]);

    const openHistoryDetails = useCallback((record: any) => {
        setSelectedHistoryRecord(record);
        setHistoryDialogOpen(true);
    }, []);

    const handlePrintAllQRs = async () => {
        if (!selectedHistoryRecord) return;
        setIsPrinting(true);
        try {
            const itemName = selectedHistoryRecord.data.itemName;
            const itemCode = itemCodeMap[itemName] || "N/A";
            const productExpiry = selectedHistoryRecord.data.productExpiry;
            const encodedDate = encodeExpiryDate(productExpiry);
            const serials = selectedHistoryRecord.data.serials || [];

            if (serials.length === 0) {
                toast.error("No serial numbers found for this record");
                return;
            }

            const printWindow = window.open('', '', 'width=900,height=800');
            if (!printWindow) {
                toast.error("Pop-up blocked. Please allow pop-ups to print.");
                return;
            }

            const labelContents = await Promise.all(serials.map(async (s: any) => {
                const svgString = await generateQRSvgString(itemName, itemCode, s.serialNo, encodedDate);
                return `
                    <div class="page">
                        <div class="label-wrapper">
                            <div class="qr-container">
                                ${svgString}
                            </div>
                            <div class="text-container">
                                <div class="item-name">${itemName.toUpperCase()}</div>
                                <div class="item-code">(${itemCode})</div>
                                <div class="serial-no">${s.serialNo}</div>
                                ${encodedDate ? `<div class="expiry-date">${encodedDate}</div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }));

            const html = `
                <html>
                <head>
                    <title>Print Labels - ${selectedHistoryRecord.data.indentNo}</title>
                    <style>
                        @page { 
                            size: 50mm 38mm; 
                            margin: 0 !important; 
                        }
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body { 
                            margin: 0; 
                            padding: 0; 
                            background: white; 
                            font-family: Arial, sans-serif; 
                        }
                        .page { 
                            width: 50mm; 
                            height: 38mm; 
                            page-break-after: always;
                            overflow: hidden;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            padding-left: 2mm;
                        }
                        .label-wrapper {
                            width: 100%;
                            height: 100%;
                            display: flex;
                            align-items: center;
                            justify-content: flex-start;
                            padding: 2mm;
                        }
                        .qr-container {
                            width: 24mm;
                            height: 24mm;
                            flex-shrink: 0;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        .qr-container svg {
                            width: 100%;
                            height: 100%;
                            display: block;
                            shape-rendering: crispEdges;
                        }
                        .text-container {
                            flex: 1;
                            padding-left: 3mm;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            overflow: hidden;
                            min-width: 0;
                        }
                        .item-name {
                            font-size: 8pt;
                            font-weight: 900;
                            line-height: 1.1;
                            margin-bottom: 1px;
                            word-break: break-all;
                        }
                        .item-code {
                            font-size: 7pt;
                            font-weight: 900;
                            line-height: 1.1;
                            margin-bottom: 4px;
                        }
                        .serial-no {
                            font-size: 9pt;
                            font-weight: 900;
                            font-family: "Courier New", monospace;
                            line-height: 1.1;
                            word-break: break-all;
                        }
                        .expiry-date {
                            font-size: 7pt;
                            font-weight: 900;
                            margin-top: 2px;
                        }
                        @media print {
                            body { -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    ${labelContents.join('')}
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
                </html>
            `;

            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();

        } catch (err) {
            console.error(err);
            toast.error("Failed to prepare labels");
        } finally {
            setIsPrinting(false);
        }
    };

    const handleDownloadAllPDF = async (record: any) => {
        if (!record) return;
        const indentNo = record.data.indentNo;
        setPdfGeneratingId(record.id);
        const toastId = toast.loading(`Generating PDF for Indent ${indentNo}...`);
        try {
            const itemName = record.data.itemName;
            const itemCode = itemCodeMap[itemName] || "N/A";
            const productExpiry = record.data.productExpiry || record.data.warrantyExpiry || "";
            const encodedDate = encodeExpiryDate(productExpiry);
            const serials = record.data.serials || [];

            if (serials.length === 0) {
                toast.error("No serial numbers found for this record", { id: toastId });
                return;
            }

            const serialsWithQr = await Promise.all(serials.map(async (s: any) => {
                const qrData = encodedDate
                    ? `${itemName}/${itemCode}/${s.serialNo}/${encodedDate}`
                    : `${itemName}/${itemCode}/${s.serialNo}`;
                const qrDataUrl = await QRCode.toDataURL(qrData, {
                    margin: 1,
                    errorCorrectionLevel: 'L',
                    width: 250
                });
                return {
                    serialNo: s.serialNo,
                    qrDataUrl
                };
            }));

            const { pdf } = await import("@react-pdf/renderer");
            const { SerialPDFDocument } = await import("@/components/stages/serial-pdf");

            const doc = <SerialPDFDocument itemName={itemName} itemCode={itemCode} encodedDate={encodedDate} serials={serialsWithQr} />;
            const blob = await pdf(doc).toBlob();

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `QR_Labels_${indentNo.replace(/[/\\:]/g, '_')}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
            toast.success("PDF downloaded successfully!", { id: toastId });
        } catch (err) {
            console.error(err);
            toast.error("Failed to generate PDF", { id: toastId });
        } finally {
            setPdfGeneratingId(null);
        }
    };

    const openForm = useCallback((records: any[]) => {
        setSelectedRecords(records);
        setIsAutoMode(false);
        setIsSerialEnabled(true);
        setStartingSequence(1);

        const newEntriesMap: Record<string, WarrantyEntry[]> = {};
        records.forEach(rec => {
            const vendorCode = vendorCodes[rec.data.vendorName] || "UNKNOWN";
            const encodedDate = encodeDateYYMMDD(rec.data.invoiceDate);
            const prefix = `SN-${vendorCode}/${encodedDate}/`;
            // readyQty (passed + repaired, once QC/Repair fully resolve) is the correct count
            // to generate serials for — receivedQty may include qty that was rejected/returned
            // and never reaches this stage. Falls back to receivedQty for QC=No lifts.
            const qty = Math.max(1, parseInt(rec.data.readyQty ?? rec.data.receivedQty) || 1);
            newEntriesMap[rec.id] = Array.from({ length: qty }, () => ({
                serialNo: prefix,
            }));
        });
        setEntriesMap(newEntriesMap);

        if (records.length > 0) {
            fetchNextSequence(records[0].data.vendorName, records[0].data.invoiceDate);
        }

        setOpen(true);
    }, [vendorCodes, fetchNextSequence]);

    useEffect(() => {
        if (open && selectedRecords.length > 0) {
            fetchNextSequence(selectedRecords[0].data.vendorName, selectedRecords[0].data.invoiceDate);
        }
    }, [open, selectedRecords, vendorCodes, fetchNextSequence]);

    useEffect(() => {
        if (selectedRecords.length === 0) return;

        const newEntriesMap: Record<string, WarrantyEntry[]> = {};
        let currentSeq = startingSequence;

        selectedRecords.forEach(rec => {
            const vendorCode = vendorCodes[rec.data.vendorName] || "UNKNOWN";
            const encodedDate = encodeDateYYMMDD(rec.data.invoiceDate);
            const prefix = `SN-${vendorCode}/${encodedDate}/`;
            // readyQty (passed + repaired, once QC/Repair fully resolve) is the correct count
            // to generate serials for — receivedQty may include qty that was rejected/returned
            // and never reaches this stage. Falls back to receivedQty for QC=No lifts.
            const qty = Math.max(1, parseInt(rec.data.readyQty ?? rec.data.receivedQty) || 1);

            const length = !isSerialEnabled ? 1 : qty;

            newEntriesMap[rec.id] = Array.from({ length }, (_, idx) => {
                if (!isSerialEnabled) {
                    if (isCheckingSequence) {
                        return { serialNo: `${prefix}Loading...` };
                    } else {
                        const seqStr = String(currentSeq + idx).padStart(3, "0");
                        return { serialNo: `${prefix}${seqStr}` };
                    }
                } else if (isAutoMode) {
                    if (isCheckingSequence) {
                        return { serialNo: `${prefix}Loading...` };
                    } else {
                        const seqStr = String(currentSeq + idx).padStart(3, "0");
                        return { serialNo: `${prefix}${seqStr}` };
                    }
                } else {
                    return { serialNo: prefix };
                }
            });

            if (!isCheckingSequence && (!isSerialEnabled || isAutoMode)) {
                currentSeq += length;
            }
        });

        setEntriesMap(newEntriesMap);
    }, [isAutoMode, isSerialEnabled, selectedRecords, vendorCodes, startingSequence, isCheckingSequence]);

    const updateEntry = useCallback((recordId: string, idx: number, value: string) => {
        setEntriesMap((prev) => {
            const next = { ...prev };
            if (next[recordId]) {
                const nextList = [...next[recordId]];
                nextList[idx] = { ...nextList[idx], serialNo: value };
                next[recordId] = nextList;
            }
            return next;
        });
        setPreviewContent(prev => {
            const next = { ...prev };
            delete next[`${recordId}_${idx}`];
            return next;
        });
    }, []);

    const handlePreview = async (recordId: string, idx: number) => {
        const rec = selectedRecords.find(r => r.id === recordId);
        if (!rec) return;
        const recEntries = entriesMap[recordId] || [];
        const entry = recEntries[idx];
        if (!entry || !entry.serialNo.trim()) {
            toast.error("Please enter a serial number first");
            return;
        }

        try {
            const itemName = rec.data.itemName;
            const itemCode = itemCodeMap[itemName] || "N/A";
            const encodedDate = encodeExpiryDate(rec.data.productExpiry);
            const svgString = await generateQRSvgString(itemName, itemCode, entry.serialNo, encodedDate);

            const html = `
                <div style="width: 400px; height: 190px; border: 1px solid #eee; display: flex; align-items: center; padding: 10px; font-family: Arial, sans-serif;">
                    <div style="width: 130px; height: 130px; flex-shrink: 0;">
                        ${svgString.replace('<svg', '<svg style="width:100%;height:100%"')}
                    </div>
                    <div style="flex: 1; padding-left: 10px; overflow: hidden; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 7.5px; font-weight: 900; line-height: 1.1; margin-bottom: 1px; word-break: break-all;">${itemName.toUpperCase()}</div>
                        <div style="font-size: 6px; font-weight: 900; color: #000; margin-bottom: 4px;">(${itemCode})</div>
                        <div style="font-size: 8.5px; font-weight: 900; line-height: 1.1; word-break: break-all;">${entry.serialNo}</div>
                        ${encodedDate ? `<div style="font-size: 6px; font-weight: 900; margin-top: 2px;">${encodedDate}</div>` : ''}
                    </div>
                </div>
            `;

            setPreviewContent(prev => ({ ...prev, [`${recordId}_${idx}`]: html }));
        } catch (err) {
            console.error(err);
            toast.error("Failed to generate preview");
        }
    };

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedRecords.length === 0) return;

        setIsSubmitting(true);
        try {
            const recordsToProcess = [];

            for (const rec of selectedRecords) {
                const itemName = rec.data.itemName;
                const itemCode = itemCodeMap[itemName] || "N/A";
                const recEntries = entriesMap[rec.id] || [];

                let serialsForRecord = [];

                if (!isSerialEnabled) {
                    const entry = recEntries[0];
                    const serialNo = entry?.serialNo?.trim() || "";

                    serialsForRecord.push({
                        serialNo: serialNo,
                        qrLink: null,
                        warrantyExpiry: rec.data.warrantyExpiry || null,
                        productExpiry: rec.data.productExpiry || null
                    });
                } else {
                    const uploadResults = await Promise.all(recEntries.map(async (entry, idx) => {
                        try {
                            const pngDataUrl = await generateLabelPngDataUrl(
                                itemName,
                                itemCode,
                                entry.serialNo,
                                rec.data.productExpiry
                            );
                            const blob = dataURLtoBlob(pngDataUrl);
                            const fileName = `QR_${entry.serialNo.replace(/[/\\:]/g, '_')}.png`;
                            const driveUrl = await uploadFileToDrive(blob, fileName);
                            return driveUrl;
                        } catch (err) {
                            console.error("Upload error for record", rec.id, "index", idx, err);
                            return "";
                        }
                    }));

                    recEntries.forEach((entry, idx) => {
                        serialsForRecord.push({
                            serialNo: entry.serialNo,
                            qrLink: uploadResults[idx] || null,
                            warrantyExpiry: rec.data.warrantyExpiry || null,
                            productExpiry: rec.data.productExpiry || null
                        });
                    });
                }

                recordsToProcess.push({
                    liftNo: rec.data.liftNo,
                    serials: serialsForRecord
                });
            }

            const batchSerials = recordsToProcess.flatMap(r => r.serials.map(s => s.serialNo.trim()));
            const uniqueSerials = new Set(batchSerials);
            if (uniqueSerials.size !== batchSerials.length) {
                throw new Error("Duplicate serial numbers detected in this batch. Please verify all serial numbers are unique.");
            }

            const res = await fetch("/api/serial-generation", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    records: recordsToProcess
                })
            });

            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.error || `Request failed with status ${res.status}`);
            }

            toast.success("Serial Generation recorded successfully!");
            setOpen(false);
            setSelectedPendingIds(new Set());
            setSelectedInvoiceGroup(null);
            fetchData();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Submission failed");
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedRecords, entriesMap, isSerialEnabled, fetchData, itemCodeMap, vendorCodes]);

    const updateDirectEntry = useCallback((idx: number, value: string) => {
        setDirectEntries((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], serialNo: value };
            return next;
        });
        setDirectPreviewContent(prev => {
            const next = { ...prev };
            delete next[idx];
            return next;
        });
    }, []);

    const handleDirectPreview = async (idx: number) => {
        const entry = directEntries[idx];
        if (!entry || !entry.serialNo.trim()) {
            toast.error("Please enter a serial number first");
            return;
        }

        try {
            const itemName = directForm.itemName;
            const itemCode = itemCodeMap[itemName] || "N/A";
            const svgString = await generateQRSvgString(itemName, itemCode, entry.serialNo, "");

            const html = `
                <div style="width: 400px; height: 190px; border: 1px solid #eee; display: flex; align-items: center; padding: 10px; font-family: Arial, sans-serif;">
                    <div style="width: 130px; height: 130px; flex-shrink: 0;">
                        ${svgString.replace('<svg', '<svg style="width:100%;height:100%"')}
                    </div>
                    <div style="flex: 1; padding-left: 10px; overflow: hidden; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 7.5px; font-weight: 900; line-height: 1.1; margin-bottom: 1px; word-break: break-all;">${itemName.toUpperCase()}</div>
                        <div style="font-size: 6px; font-weight: 900; color: #000; margin-bottom: 4px;">(${itemCode})</div>
                        <div style="font-size: 8.5px; font-weight: 900; line-height: 1.1; word-break: break-all;">${entry.serialNo}</div>
                    </div>
                </div>
            `;

            setDirectPreviewContent(prev => ({ ...prev, [idx]: html }));
        } catch (err) {
            console.error(err);
            toast.error("Failed to generate preview");
        }
    };

    const handleDirectSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!directForm.itemName || !directForm.vendorName || !directForm.invoiceDate || !directForm.duration) {
            toast.error("Please fill in all details");
            return;
        }

        setIsSubmitting(true);
        try {
            const itemName = directForm.itemName;
            const itemCode = itemCodeMap[itemName] || "N/A";

            const uploadResults = await Promise.all(directEntries.map(async (entry, idx) => {
                try {
                    const pngDataUrl = await generateLabelPngDataUrl(
                        itemName,
                        itemCode,
                        entry.serialNo,
                        ""
                    );
                    const blob = dataURLtoBlob(pngDataUrl);
                    const fileName = `QR_${entry.serialNo.replace(/[/\\:]/g, '_')}.png`;
                    const driveUrl = await uploadFileToDrive(blob, fileName);
                    return driveUrl;
                } catch (err) {
                    console.error("Upload error for index", idx, err);
                    return "";
                }
            }));

            const serialsPayload = directEntries.map((entry, idx) => ({
                serialNo: entry.serialNo,
                qrLink: uploadResults[idx] || null
            }));

            const directSerials = directEntries.map(e => e.serialNo.trim());
            const uniqueDirectSerials = new Set(directSerials);
            if (uniqueDirectSerials.size !== directSerials.length) {
                throw new Error("Duplicate serial numbers detected in your inputs. Please verify all serial numbers are unique.");
            }

            const res = await fetch("/api/serial-generation", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    isDirect: true,
                    directForm: directForm,
                    serials: serialsPayload
                })
            });

            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.error || `Request failed with status ${res.status}`);
            }

            toast.success("Serial Generation recorded successfully!");
            setDirectFormOpen(false);
            setDirectForm({
                itemName: "",
                vendorName: "",
                invoiceDate: "",
                duration: "12",
                quantity: "",
            });
            setDirectEntries([]);
            setDirectPreviewContent({});
            fetchData();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Submission failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formValid = useMemo(() => {
        if (selectedRecords.length === 0) return false;
        return selectedRecords.every(rec => {
            const recEntries = entriesMap[rec.id] || [];
            return recEntries.length > 0 && recEntries.every(e => e.serialNo.trim() !== "" && !e.serialNo.includes("Loading..."));
        });
    }, [selectedRecords, entriesMap]);

    const renderCell = useCallback((data: any, key: string) => {
        const val = data?.[key];

        if (key === "invoiceCopy" || key === "poCopy" || key === "actions") {
            if (!val || String(val).trim() === "" || val === "-") return "-";
            return (
                <a
                    href={String(val)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
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

        if (key === "invoiceDate" || key === "planned" || key === "actual" || key === "warrantyEnd" || key === "warrantyExpiry" || key === "productExpiry") {
            return formatDateDash(val);
        }

        if (!val || String(val).trim() === "" || val === "-") return "-";
        return String(val);
    }, []);

    return (
        <div className="p-6 min-h-screen bg-[#f8fafc]">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                <div className="sticky top-0 z-50 bg-[#f8fafc] -mx-6 px-6 pt-2 pb-4 mb-4 border-b shadow-sm">
                    <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm">
                        <div className="flex items-start justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <ShieldAlert className="w-7 h-7 text-amber-600" />
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Stage: Serial Generation</h2>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 flex-1 max-w-2xl justify-end">
                                {selectedPendingIds.size > 0 && (
                                    <Button
                                        onClick={() => {
                                            const selectedRecs = pendingRecords.filter(r => selectedPendingIds.has(r.id));
                                            openForm(selectedRecs);
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all"
                                    >
                                        Generate Serials ({selectedPendingIds.size} selected)
                                    </Button>
                                )}
                                <Button
                                    onClick={() => setDirectFormOpen(true)}
                                    className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm transition-colors"
                                >
                                    <PlusCircle className="w-4 h-4 mr-2" />
                                    Form
                                </Button>
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                                    <Input
                                        placeholder="Search by Indent, Item, Vendor, PO, Invoice..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 bg-white border-slate-200 focus:ring-amber-500 focus:border-amber-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <TabsList className="bg-indigo-50/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1.5 border border-indigo-100/50 w-[420px] shadow-2xs">
                            <TabsTrigger
                                value="pending"
                                className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-3 transition-all cursor-pointer text-slate-700"
                            >
                                <ClipboardList className="w-5 h-5 opacity-80" />
                                <div className="flex flex-col items-start leading-none gap-1 text-left">
                                    <span className="font-bold">Pending</span>
                                    <span className="text-[10px] opacity-70">Awaiting serials</span>
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
                                    <span className="text-[10px] opacity-70 font-medium">Completed serials</span>
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
                                    <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-lg text-black">No pending Serial Generation entries</p>
                                </div>
                            ) : (
                                <SerialGenerationPending
                                    pendingGroups={pendingGroups}
                                    selectedPendingIds={selectedPendingIds}
                                    expandedInvoices={expandedInvoices}
                                    toggleInvoiceExpanded={toggleInvoiceExpanded}
                                    handleCheckboxChange={handleCheckboxChange}
                                    openForm={openForm}
                                    PENDING_COLUMNS={PENDING_COLUMNS}
                                    renderCell={renderCell}
                                    formatDateDash={formatDateDash}
                                />
                            )}
                        </TabsContent>

                        <TabsContent value="history" className="mt-0 outline-none">
                            {history.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-lg text-black">No completed Serial Generation entries</p>
                                </div>
                            ) : (
                                <SerialGenerationHistory
                                    history={history}
                                    HISTORY_COLUMNS={HISTORY_COLUMNS}
                                    openHistoryDetails={openHistoryDetails}
                                    handleDownloadAllPDF={handleDownloadAllPDF}
                                    pdfGeneratingId={pdfGeneratingId}
                                    renderCell={renderCell}
                                />
                            )}
                        </TabsContent>
                    </>
                )}
            </Tabs>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader className="shrink-0 border-b pb-4">
                        <DialogTitle>Serial Generation</DialogTitle>
                        {selectedRecords.length > 0 && (
                            <div className="flex flex-col gap-2 mt-2">
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                                    <span>Invoice: <span className="font-medium text-gray-700">{selectedRecords[0].data.invoiceNo || "-"}</span></span>
                                    <span>Vendor: <span className="font-medium text-gray-700">{selectedRecords[0].data.vendorName}</span></span>
                                    <span>Total Lifts: <span className="font-medium text-gray-700">{selectedRecords.length}</span></span>
                                </div>
                                <div className="flex items-center justify-between mt-2 flex-wrap gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-700">Yes / No Toggle:</span>
                                        <select
                                            value={isSerialEnabled ? "Yes" : "No"}
                                            onChange={(e) => setIsSerialEnabled(e.target.value === "Yes")}
                                            className="h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 shadow-sm focus:border-amber-500 focus:outline-none"
                                        >
                                            <option value="Yes">Yes</option>
                                            <option value="No">No</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-700">Serial Mode:</span>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={isAutoMode ? "default" : "outline"}
                                            className={
                                                !isSerialEnabled
                                                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed min-w-[80px]"
                                                    : isAutoMode ? "bg-blue-600 hover:bg-blue-700 text-white min-w-[80px]" : "border-amber-500 text-amber-600 hover:bg-amber-50 min-w-[80px]"
                                            }
                                            onClick={() => {
                                                if (isSerialEnabled) {
                                                    setIsAutoMode(!isAutoMode);
                                                }
                                            }}
                                            disabled={!isSerialEnabled || (isAutoMode && isCheckingSequence)}
                                        >
                                            {isAutoMode && isCheckingSequence ? (
                                                <><Loader2 className="w-3 h-3 animate-spin mr-1.5" />Auto</>
                                            ) : (
                                                isAutoMode ? "Auto" : "Manual"
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1">
                            {selectedRecords.map((rec) => {
                                const recEntries = entriesMap[rec.id] || [];
                                return (
                                    <div key={rec.id} className="border rounded-lg p-3 space-y-3 bg-white shadow-sm">
                                        <div className="bg-slate-50 px-3 py-2 -mx-3 -mt-3 rounded-t-lg border-b flex flex-wrap justify-between items-center text-xs font-semibold text-slate-700">
                                            <div className="flex gap-3">
                                                <span>Indent: <span className="font-bold text-slate-900">{rec.data.indentNo}</span></span>
                                                <span>Lift: <span className="font-bold text-slate-900">{rec.data.liftNo || "-"}</span></span>
                                            </div>
                                            <div className="flex gap-3">
                                                <span>Item: <span className="font-bold text-slate-900">{rec.data.itemName}</span></span>
                                                <span>Qty: <span className="font-bold text-slate-900">{rec.data.receivedQty}</span></span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 py-1 border-b">
                                            <div className="col-span-1 text-center">#</div>
                                            <div className="col-span-10">Serial No. *</div>
                                            <div className="col-span-1 text-center">QR</div>
                                        </div>

                                        <div className="space-y-2">
                                            {recEntries.map((entry, idx) => (
                                                <div key={idx} className="grid grid-cols-12 gap-2 items-center px-1">
                                                    <div className="col-span-1 text-center text-sm font-medium text-gray-500">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="col-span-10">
                                                        <Input
                                                            value={entry.serialNo}
                                                            onChange={(e) => updateEntry(rec.id, idx, e.target.value)}
                                                            placeholder={isAutoMode ? "Auto-generated" : "Enter Serial Number"}
                                                            className={`h-8 text-sm ${isAutoMode || !isSerialEnabled ? "bg-slate-50 font-mono" : ""}`}
                                                            required
                                                            readOnly={isAutoMode || !isSerialEnabled}
                                                        />
                                                    </div>
                                                    <div className="col-span-1 flex justify-center">
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0"
                                                                    onClick={() => handlePreview(rec.id, idx)}
                                                                    disabled={!entry.serialNo.trim() || !isSerialEnabled}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[420px] p-2 bg-white" side="left">
                                                                <div className="flex flex-col items-center gap-2">
                                                                    <span className="text-xs font-semibold text-gray-500">Label Preview</span>
                                                                    {previewContent[`${rec.id}_${idx}`] ? (
                                                                        <div
                                                                            dangerouslySetInnerHTML={{ __html: previewContent[`${rec.id}_${idx}`] }}
                                                                            className="border shadow-sm max-w-full"
                                                                        />
                                                                    ) : (
                                                                        <div className="flex items-center justify-center w-[400px] h-[190px] bg-slate-50 border border-dashed rounded text-slate-400">
                                                                            <Loader2 className="h-8 w-8 animate-spin" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <DialogFooter className="shrink-0 pt-3 border-t">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!formValid || isSubmitting}>
                                {isSubmitting
                                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                                    : `Submit (${selectedRecords.reduce((acc, rec) => acc + (entriesMap[rec.id]?.length || 0), 0)} items across ${selectedRecords.length} lift${selectedRecords.length > 1 ? "s" : ""})`
                                }
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={directFormOpen} onOpenChange={setDirectFormOpen}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-2 shrink-0 border-b">
                        <DialogTitle className="text-xl font-bold">Direct Serial Generation</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleDirectSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b pb-1">Product Details</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5 col-span-2">
                                        <Label className="text-sm font-semibold text-slate-700">Item Name *</Label>
                                        <Combobox
                                            options={Object.keys(itemCodeMap)}
                                            value={directForm.itemName}
                                            onChange={(val) => setDirectForm(prev => ({ ...prev, itemName: val }))}
                                            placeholder="Search and select item"
                                            searchPlaceholder="Type item name..."
                                        />
                                    </div>
                                    <div className="space-y-1.5 col-span-2">
                                        <Label className="text-sm font-semibold text-slate-700">Vendor Name *</Label>
                                        <Combobox
                                            options={Object.keys(vendorCodes)}
                                            value={directForm.vendorName}
                                            onChange={(val) => setDirectForm(prev => ({ ...prev, vendorName: val }))}
                                            placeholder="Search and select vendor"
                                            searchPlaceholder="Type vendor name..."
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-sm font-semibold text-slate-700">Invoice Date *</Label>
                                        <Input
                                            type="date"
                                            value={directForm.invoiceDate}
                                            onChange={(e) => setDirectForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
                                            className="h-9 bg-white border-slate-200 focus:ring-amber-500 focus:border-amber-500"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-sm font-semibold text-slate-700">Warranty (Months) *</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={directForm.duration}
                                            onChange={(e) => setDirectForm(prev => ({ ...prev, duration: e.target.value }))}
                                            placeholder="Warranty duration in months"
                                            className="h-9 bg-white border-slate-200 focus:ring-amber-500 focus:border-amber-500"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-sm font-semibold text-slate-700">Quantity *</Label>
                                        <Input
                                            type="number"
                                            value={directForm.quantity}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setDirectForm(prev => ({
                                                    ...prev,
                                                    quantity: val === "" ? "" : parseInt(val) || 0
                                                }));
                                            }}
                                            className="h-9 bg-white border-slate-200 focus:ring-amber-500 focus:border-amber-500"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5 flex flex-col justify-end">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-semibold text-slate-700">Serial Mode:</span>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={directIsAutoMode ? "default" : "outline"}
                                                className={directIsAutoMode ? "bg-blue-600 hover:bg-blue-700 text-white min-w-[80px] h-8" : "border-amber-500 text-amber-600 hover:bg-amber-50 min-w-[80px] h-8"}
                                                onClick={() => setDirectIsAutoMode(!directIsAutoMode)}
                                                disabled={directIsAutoMode && directIsCheckingSequence && directEntries[0]?.serialNo?.includes("Loading...")}
                                            >
                                                {directIsAutoMode && directIsCheckingSequence ? (
                                                    <><Loader2 className="w-3 h-3 animate-spin mr-1.5" />Auto</>
                                                ) : (
                                                    directIsAutoMode ? "Auto" : "Manual"
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b pb-1">Serial Numbers</h3>
                                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 py-1">
                                    <div className="col-span-1 text-center">#</div>
                                    <div className="col-span-10">Serial No. *</div>
                                    <div className="col-span-1 text-center">QR</div>
                                </div>

                                <div className="space-y-2">
                                    {directEntries.map((entry, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center px-1">
                                            <div className="col-span-1 text-center text-sm font-medium text-gray-500">
                                                {idx + 1}
                                            </div>
                                            <div className="col-span-10">
                                                <Input
                                                    value={entry.serialNo}
                                                    onChange={(e) => updateDirectEntry(idx, e.target.value)}
                                                    placeholder={directIsAutoMode ? "Auto-generated" : "Enter Serial Number"}
                                                    className={`h-8 text-sm ${directIsAutoMode ? "bg-gray-50 font-mono" : ""}`}
                                                    required
                                                    readOnly={directIsAutoMode}
                                                />
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => handleDirectPreview(idx)}
                                                            disabled={!entry.serialNo.trim() || !directForm.itemName}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[420px] p-2 bg-white" side="left">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <span className="text-xs font-semibold text-gray-500">Label Preview</span>
                                                            {directPreviewContent[idx] ? (
                                                                <div
                                                                    dangerouslySetInnerHTML={{ __html: directPreviewContent[idx] }}
                                                                    className="border shadow-sm max-w-full"
                                                                />
                                                            ) : (
                                                                <div className="flex items-center justify-center w-[400px] h-[190px] bg-slate-50 border border-dashed rounded text-slate-400">
                                                                    <Loader2 className="h-8 w-8 animate-spin" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="p-6 shrink-0 border-t">
                            <Button type="button" variant="outline" onClick={() => setDirectFormOpen(false)} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting || directEntries.length === 0 || directEntries.some(e => e.serialNo.trim() === "" || e.serialNo.includes("Loading..."))}>
                                {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : "Submit"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── HISTORY DETAILS DIALOG ── */}
            <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
                    <DialogHeader className="shrink-0 border-b pb-4">
                        <DialogTitle className="text-lg font-bold">Serial Details: {selectedHistoryRecord?.data?.indentNo}</DialogTitle>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-500">
                            <span>Item Name: <span className="font-semibold text-gray-900">{selectedHistoryRecord?.data?.itemName}</span></span>
                            <span>Item Code: <span className="font-semibold text-gray-900">{itemCodeMap[selectedHistoryRecord?.data?.itemName] || "N/A"}</span></span>
                            <span>Vendor Name: <span className="font-semibold text-gray-900">{selectedHistoryRecord?.data?.vendorName}</span></span>
                            <span>Lifts No: <span className="font-semibold text-gray-900">{selectedHistoryRecord?.data?.liftNo || "-"}</span></span>
                            <span>Invoice Date: <span className="font-semibold text-gray-900">{formatDateDash(selectedHistoryRecord?.data?.invoiceDate)}</span></span>
                            <span>Warranty Expiry: <span className="font-semibold text-gray-900">{formatDateDash(selectedHistoryRecord?.data?.warrantyExpiry)}</span></span>
                        </div>
                    </DialogHeader>

                    {/* QR and Serial list body */}
                    <div className="flex-1 overflow-y-auto py-4 space-y-4">
                        {selectedHistoryRecord?.data?.serials?.length === 0 ? (
                            <div className="text-center py-6 text-slate-400">
                                No serial numbers logged.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedHistoryRecord?.data?.serials?.map((s: any, idx: number) => {
                                    const itemName = selectedHistoryRecord?.data?.itemName || "";
                                    const itemCode = itemCodeMap[itemName] || "N/A";
                                    const productExpiry = selectedHistoryRecord?.data?.productExpiry || "";

                                    return (
                                        <div key={idx} className="flex flex-col items-center bg-white border p-3 rounded-lg shadow-sm">
                                            <div className="w-full flex items-center justify-between border-b pb-1.5 mb-2 text-xs font-semibold text-slate-500">
                                                <span>Label #{idx + 1}</span>
                                                <a
                                                    href={s.qrLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:underline flex items-center gap-0.5"
                                                >
                                                    Drive Image
                                                </a>
                                            </div>
                                            <LocalQRPreview
                                                itemName={itemName}
                                                itemCode={itemCode}
                                                serialNo={s.serialNo}
                                                expiryDate={productExpiry}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="shrink-0 pt-3 border-t flex items-center justify-between gap-4">
                        <Button
                            type="button"
                            variant="outline"
                            className="border-green-600 text-green-700 hover:bg-green-50 mr-auto"
                            onClick={handlePrintAllQRs}
                            disabled={isPrinting || selectedHistoryRecord?.data?.serials?.length === 0}
                        >
                            {isPrinting ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Preparing...</>
                            ) : (
                                <><Printer className="w-4 h-4 mr-2" />Print QR Labels</>
                            )}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setHistoryDialogOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
