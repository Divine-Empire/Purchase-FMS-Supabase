"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useWorkflow } from "@/lib/workflow-context";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  X,
  Loader2,
  Truck,
  ClipboardList,
  History,
  Search,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn, parseSheetDate, formatDate, getFmsTimestamp } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import FollowUpVendorPending from "./follow-up-vendor-pending";
import FollowUpVendorHistory from "./follow-up-vendor-history";

interface LiftingEntry {
  liftNumber: string;
  liftingQty: string;
  transporterName: string;
  vehicleNumber: string;
  contactNumber: string;
  lrNumber: string;
  biltyCopy: File | null;
  dispatchDate: string;
  freightAmount: string;
  advanceAmount: string;
  paymentDate: string;
  paymentStatus?: string;
  expectedDeliveryDate?: string;
}

interface RecordLifting {
  recordId: string;
  status: string;
  followUpDate?: string;
  remarks?: string;
  quantity?: number | string;
  liftingData: LiftingEntry;
  indentNumber: string;
}

const formatDateDash = (date: any) => {
  if (!date || date === "-" || date === "—") return "-";
  const d = date instanceof Date ? date : parseSheetDate(date);
  if (!d || isNaN(d.getTime())) return typeof date === 'string' ? date : "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
};

const TransporterCombobox = ({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-white border-green-200"
        >
          {value ? value : "Select transporter..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search transporter..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              <div className="p-2">
                <p className="text-sm text-muted-foreground pb-2">No transporter found.</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full h-8"
                  onClick={() => {
                    onChange(query);
                    setOpen(false);
                  }}
                >
                  Create "{query}"
                </Button>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={(currentValue) => {
                    onChange(currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default function Stage6() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [bulkFormData, setBulkFormData] = useState<RecordLifting[]>([]);
  const [liftCounter, setLiftCounter] = useState(1);
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [receivingAccountsData, setReceivingAccountsData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Unified form mode state
  const [isUnifiedMode, setIsUnifiedMode] = useState(false);
  const [commonVendorPO, setCommonVendorPO] = useState<{ vendor: string; poNumber: string } | null>(null);
  const [vendorPOMismatchError, setVendorPOMismatchError] = useState<string | null>(null);
  const [unifiedFormData, setUnifiedFormData] = useState<{
    status: string;
    followUpDate: string;
    remarks: string;
    liftingData: LiftingEntry;
  } | null>(null);
  const [unifiedLiftingQtys, setUnifiedLiftingQtys] = useState<Record<string, string>>({});
  const [processMode, setProcessMode] = useState<"follow-up" | "lift-material">("lift-material");

  const baseColumns = [
    { key: "indentNumber", label: "Indent No.", icon: null },
    { key: "itemName", label: "Item", icon: null },
    { key: "quantity", label: "Qty", icon: null },
    { key: "planned5", label: "Planned", icon: null },
    { key: "totalLifted", label: "Total Dispatch Qty", icon: null },
    { key: "pendingLifted", label: "Pending Dispatch Qty", icon: null },
    { key: "estimatedDate", label: "Estimated Date", icon: null },
    { key: "remarksFollowUp", label: "Remark", icon: null },
  ];

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    baseColumns.map((c) => c.key)
  );

  const [transporterList, setTransporterList] = useState<string[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resFMS, dropRes] = await Promise.all([
        fetch("/api/follow-up-vendor"),
        fetch("/api/dropdowns"),
      ]);

      const [jsonFMS, dropJson] = await Promise.all([
        resFMS.json(),
        dropRes.json(),
      ]);

      if (dropJson.success && dropJson.data && Array.isArray(dropJson.data.transporterOptions)) {
        setTransporterList(dropJson.data.transporterOptions);
      }

      if (jsonFMS.success && jsonFMS.data) {
        setSheetRecords(jsonFMS.data.sheetRecords || []);
        setReceivingAccountsData(jsonFMS.data.receivingAccountsData || []);
      } else {
        toast.error(jsonFMS.error || "Failed to fetch FMS data");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data from database");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [indentFilter, setIndentFilter] = useState<"no_filter" | "increasing" | "decreasing">("no_filter");

  const pending = useMemo(() => {
    let records = sheetRecords
      .filter((r) => r.status === "pending")
      .filter((r) => {
        const searchLower = searchTerm.toLowerCase();
        const vName = r.data.finalVendorName;

        return (
          r.data.indentNumber?.toLowerCase().includes(searchLower) ||
          r.data.itemName?.toLowerCase().includes(searchLower) ||
          (vName && vName.toLowerCase().includes(searchLower)) ||
          String(r.data.poNumber || "").toLowerCase().includes(searchLower)
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
  }, [sheetRecords, searchTerm, indentFilter]);

  const completed = useMemo(() => {
    let records = sheetRecords
      .filter((r) => r.status === "completed")
      .filter((r) => {
        const searchLower = searchTerm.toLowerCase();
        if (!searchLower) return true;
        const vName = r.data.finalVendorName;
        return (
          r.data.indentNumber?.toLowerCase().includes(searchLower) ||
          r.data.itemName?.toLowerCase().includes(searchLower) ||
          (vName && vName.toLowerCase().includes(searchLower)) ||
          String(r.data.poNumber || "").toLowerCase().includes(searchLower)
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
  }, [sheetRecords, searchTerm, indentFilter]);

  const filteredHistoryData = useMemo(() => {
    return receivingAccountsData.filter((row) => {
      const searchLower = searchTerm.toLowerCase();
      if (!searchLower) return true;
      return (
        row.indentNumber?.toLowerCase().includes(searchLower) ||
        row.itemName?.toLowerCase().includes(searchLower) ||
        row.vendorName?.toLowerCase().includes(searchLower) ||
        String(row.poNumber || "").toLowerCase().includes(searchLower) ||
        row.liftNo?.toLowerCase().includes(searchLower)
      );
    });
  }, [receivingAccountsData, searchTerm]);

  const getVendorData = (record: any) => {
    const selectedId = String(record.data.selectedVendor || "vendor1");
    const idx = parseInt(selectedId.replace("vendor", ""), 10) || 1;
    return {
      name: record.data.finalVendorName || "-",
      rate: record.data[`vendor${idx}Rate`],
      terms: record.data[`vendor${idx}Terms`],
      delivery: record.data[`vendor${idx}DeliveryDate`],
      warrantyType: record.data[`vendor${idx}WarrantyType`],
      attachment: record.data[`vendor${idx}Attachment`],
      approvedBy: record.data.approvedBy || "Auto-Approved",
      poNumber: record.data.poNumber || "-",
      basicValue: record.data.basicValue || "-",
      totalWithTax: record.data.totalWithTax || "-",
      poCopy: record.data.poCopy,
    };
  };

  const checkVendorPOMatch = (recordIds: string[]): { isMatched: boolean; vendor: string; poNumber: string } => {
    if (recordIds.length === 0) return { isMatched: false, vendor: "", poNumber: "" };

    const firstRecord = sheetRecords.find((r) => r.id === recordIds[0])!;
    const firstVendorData = getVendorData(firstRecord);
    const firstVendor = firstVendorData.name || "";
    const firstPO = firstVendorData.poNumber || "";

    for (let i = 1; i < recordIds.length; i++) {
      const record = sheetRecords.find((r) => r.id === recordIds[i])!;
      const vendorData = getVendorData(record);
      const currentVendor = vendorData.name || "";
      const currentPO = vendorData.poNumber || "";

      if (currentVendor !== firstVendor || currentPO !== firstPO) {
        return { isMatched: false, vendor: "", poNumber: "" };
      }
    }

    return { isMatched: true, vendor: firstVendor, poNumber: firstPO };
  };

  const handleProcessOption = (recordId: string, mode: "follow-up" | "lift-material") => {
    setSelectedRecordIds([recordId]);
    setProcessMode(mode);

    const record = sheetRecords.find((r) => r.id === recordId)!;
    const existLift = record.data.liftingData || {};

    setIsUnifiedMode(false);
    setVendorPOMismatchError(null);
    setCommonVendorPO(null);

    if (mode === "follow-up") {
      setUnifiedFormData(null);
    } else {
      setUnifiedFormData({
        status: "lift-material",
        followUpDate: "",
        remarks: "",
        liftingData: {
          liftNumber: "",
          liftingQty: "",
          transporterName: "",
          vehicleNumber: "",
          contactNumber: "",
          lrNumber: "",
          biltyCopy: null,
          dispatchDate: new Date().toISOString().split("T")[0],
          expectedDeliveryDate: "",
          freightAmount: "",
          advanceAmount: "",
          paymentDate: "",
          paymentStatus: ""
        }
      });
    }

    const initialData = [
      {
        recordId: recordId,
        status: mode,
        followUpDate: "",
        remarks: "",
        liftingData: {
          liftNumber: existLift.liftNumber || "",
          liftingQty: existLift.liftingQty || String(record.data.quantity || 0),
          transporterName: existLift.transporterName || "",
          vehicleNumber: existLift.vehicleNumber || "",
          contactNumber: existLift.contactNumber || "",
          lrNumber: existLift.lrNumber || "",
          biltyCopy: null,
          dispatchDate: existLift.dispatchDate || "",
          expectedDeliveryDate: existLift.expectedDeliveryDate || "",
          freightAmount: existLift.freightAmount || "",
          advanceAmount: existLift.advanceAmount || "",
          paymentDate: existLift.paymentDate || "",
          paymentStatus: ""
        },
        indentNumber: record.data.indentNumber,
        quantity: record.data.quantity,
      }
    ];
    setBulkFormData(initialData);
    setOpen(true);
  };

  const handleBulkProcessOption = (mode: "follow-up" | "lift-material") => {
    if (selectedRecordIds.length === 0) return;
    setProcessMode(mode);

    if (mode === "lift-material") {
      const matchResult = checkVendorPOMatch(selectedRecordIds);
      if (selectedRecordIds.length > 1 && !matchResult.isMatched) {
        setIsUnifiedMode(false);
        setVendorPOMismatchError("Vendor Name or PO number not matched for the selected items.");
        setCommonVendorPO(null);
        setUnifiedFormData(null);
        setBulkFormData([]);
        setOpen(true);
        return;
      }

      setIsUnifiedMode(selectedRecordIds.length > 1);
      setVendorPOMismatchError(null);
      setCommonVendorPO({ vendor: matchResult.vendor, poNumber: matchResult.poNumber });

      setUnifiedFormData({
        status: "lift-material",
        followUpDate: "",
        remarks: "",
        liftingData: {
          liftNumber: "",
          liftingQty: "",
          transporterName: "",
          vehicleNumber: "",
          contactNumber: "",
          lrNumber: "",
          biltyCopy: null,
          dispatchDate: new Date().toISOString().split("T")[0],
          expectedDeliveryDate: "",
          freightAmount: "",
          advanceAmount: "",
          paymentDate: "",
          paymentStatus: ""
        }
      });

      const qtys: Record<string, string> = {};
      selectedRecordIds.forEach(id => {
        const record = sheetRecords.find(r => r.id === id);
        const existLift = record?.data.liftingData || {};
        qtys[id] = existLift.liftingQty || String(record?.data.quantity || 0);
      });
      setUnifiedLiftingQtys(qtys);
    } else {
      setIsUnifiedMode(selectedRecordIds.length > 1);
      setVendorPOMismatchError(null);
      setCommonVendorPO(null);

      setUnifiedFormData({
        status: "follow-up",
        followUpDate: "",
        remarks: "",
        liftingData: {
          liftNumber: "",
          liftingQty: "",
          transporterName: "",
          vehicleNumber: "",
          contactNumber: "",
          lrNumber: "",
          biltyCopy: null,
          dispatchDate: "",
          expectedDeliveryDate: "",
          freightAmount: "",
          advanceAmount: "",
          paymentDate: "",
          paymentStatus: ""
        }
      });
    }

    const initialData = selectedRecordIds.map((id) => {
      const record = sheetRecords.find((r) => r.id === id)!;
      const existLift = record.data.liftingData || {};

      return {
        recordId: id,
        status: mode,
        followUpDate: "",
        remarks: "",
        liftingData: {
          liftNumber: existLift.liftNumber || "",
          liftingQty: existLift.liftingQty || String(record.data.quantity || 0),
          transporterName: existLift.transporterName || "",
          vehicleNumber: existLift.vehicleNumber || "",
          contactNumber: existLift.contactNumber || "",
          lrNumber: existLift.lrNumber || "",
          biltyCopy: null,
          dispatchDate: existLift.dispatchDate || "",
          expectedDeliveryDate: existLift.expectedDeliveryDate || "",
          freightAmount: existLift.freightAmount || "",
          advanceAmount: existLift.advanceAmount || "",
          paymentDate: existLift.paymentDate || "",
          paymentStatus: ""
        },
        indentNumber: record.data.indentNumber,
        quantity: record.data.quantity,
      };
    });
    setBulkFormData(initialData);
    setOpen(true);
  };

  const handleUnifiedQtyChange = (id: string, value: string) => {
    setUnifiedLiftingQtys(prev => ({ ...prev, [id]: value }));
  };

  const updateLiftingEntry = (
    recordIndex: number,
    field: keyof LiftingEntry | 'paymentStatus',
    value: any
  ) => {
    setBulkFormData((prev) => {
      const updated = [...prev];
      updated[recordIndex].liftingData = {
        ...updated[recordIndex].liftingData,
        [field]: value,
      };
      return updated;
    });
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);

      let commonFileUrl = "";
      let fileToUpload: File | null = null;

      if (isUnifiedMode && unifiedFormData?.status === "lift-material" && unifiedFormData.liftingData.biltyCopy instanceof File) {
        fileToUpload = unifiedFormData.liftingData.biltyCopy;
      } else if (!isUnifiedMode && bulkFormData.length === 1 && bulkFormData[0].status === "lift-material" && bulkFormData[0].liftingData.biltyCopy instanceof File) {
        fileToUpload = bulkFormData[0].liftingData.biltyCopy;
      }

      if (fileToUpload) {
        try {
          const fileData = new FormData();
          fileData.append("file", fileToUpload);
          fileData.append("folder", "bilty-copies");

          const uploadRes = await fetch("/api/upload-supabase", {
            method: "POST",
            body: fileData
          });

          if (!uploadRes.ok) throw new Error(`Upload failed with status ${uploadRes.status}`);
          const uploadJson = await uploadRes.json();

          if (uploadJson.success && uploadJson.url) {
            commonFileUrl = uploadJson.url;
          } else {
            throw new Error(uploadJson.error || "Upload failed");
          }
        } catch (err: any) {
          console.error("Bilty Copy upload error:", err);
          toast.warning(`File upload failed: ${err.message}. Proceeding without it.`);
        }
      }

      const recordsToProcess = bulkFormData.map((record) => {
        let currentRecord = { ...record };

        if (isUnifiedMode && unifiedFormData) {
          currentRecord = {
            ...record,
            status: unifiedFormData.status,
            followUpDate: unifiedFormData.followUpDate,
            remarks: unifiedFormData.remarks,
            liftingData: {
              ...record.liftingData,
              ...unifiedFormData.liftingData,
              liftingQty: unifiedLiftingQtys[record.recordId] || "",
              liftNumber: record.liftingData.liftNumber || "",
              biltyCopy: unifiedFormData.liftingData.biltyCopy
            }
          };
        }

        const lift = currentRecord.liftingData;
        let biltyLink = typeof lift.biltyCopy === 'string' ? lift.biltyCopy : "";
        if (currentRecord.status === "lift-material" && lift.biltyCopy instanceof File) {
          biltyLink = commonFileUrl;
        }

        return {
          recordId: currentRecord.recordId,
          indentNumber: currentRecord.indentNumber,
          status: currentRecord.status,
          followUpDate: currentRecord.followUpDate,
          remarks: currentRecord.remarks,
          liftingData: {
            ...lift,
            biltyCopy: biltyLink
          }
        };
      });

      const action = processMode === "follow-up" ? "logFollowUp" : "insertLift";

      const res = await fetch("/api/follow-up-vendor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action,
          records: recordsToProcess
        })
      });

      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Submission failed");

      setOpen(false);
      resetBulk();
      await fetchData();
      toast.success("Successfully submitted updates");
    } catch (error: any) {
      console.error("Bulk submit error:", error);
      toast.error(error.message || "Failed to submit updates");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetBulk = () => {
    setOpen(false);
    setSelectedRecordIds([]);
    setBulkFormData([]);
    setIsUnifiedMode(false);
    setCommonVendorPO(null);
    setVendorPOMismatchError(null);
    setUnifiedFormData(null);
    setUnifiedLiftingQtys({});
  };

  const toggleSelect = (id: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedRecordIds.length === pending.length) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(pending.map((r) => r.id));
    }
  };

  const isBulkValid = (() => {
    if (vendorPOMismatchError) return false;

    if (processMode === "follow-up") {
      if (isUnifiedMode) {
        return !!(unifiedFormData && unifiedFormData.followUpDate);
      }
      return bulkFormData.length > 0 && !!bulkFormData[0].followUpDate;
    }

    if (isUnifiedMode && unifiedFormData) {
      if (!unifiedFormData.status) return false;
      if (unifiedFormData.status === "lift-material") {
        const e = unifiedFormData.liftingData;
        const allQtysFilled = selectedRecordIds.every(id => {
          const val = unifiedLiftingQtys[id];
          return val !== undefined && val !== null && String(val).trim() !== "";
        });

        return !!(
          e.transporterName &&
          e.vehicleNumber &&
          e.contactNumber &&
          e.lrNumber &&
          e.biltyCopy &&
          e.dispatchDate &&
          e.freightAmount &&
          allQtysFilled
        );
      }
      return false;
    }

    return bulkFormData.length > 0 &&
      bulkFormData.every((item) => {
        if (!item.status) return false;
        if (item.status === "lift-material") {
          const e = item.liftingData;
          return !!(
            e.transporterName &&
            e.vehicleNumber &&
            e.contactNumber &&
            e.lrNumber &&
            e.biltyCopy &&
            e.dispatchDate &&
            e.freightAmount &&
            e.liftingQty
          );
        }
        return false;
      });
  })();

  const handleExportPendingCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        const headers = [
          ...baseColumns.filter((c) => selectedColumns.includes(c.key)).map((c) => c.label),
          "Vendor",
          "Rate",
          "Terms",
          "Delivery Date",
          "Warranty",
          "Warranty Attach",
          "Approved By",
          "PO Number",
          "Basic Value",
          "Total w/Tax",
          "PO Copy"
        ];

        const rowData = pending.map((record) => {
          const v = getVendorData(record);
          const baseData = baseColumns
            .filter((c) => selectedColumns.includes(c.key))
            .map((col) => {
              const val = record.data[col.key];
              if (col.key === "planned5" || col.key === "estimatedDate") {
                return formatDateDash(val);
              }
              return val || "-";
            });

          const warrantyStr = v.warrantyType
            ? v.warrantyType.charAt(0).toUpperCase() + v.warrantyType.slice(1)
            : "-";

          const attachmentStr = v.attachment
            ? (typeof v.attachment === 'string' ? v.attachment : (v.attachment as any).name)
            : "-";

          const poCopyStr = v.poCopy
            ? (typeof v.poCopy === 'string' ? v.poCopy : (v.poCopy as any).name)
            : "-";

          return [
            ...baseData,
            v.name || "-",
            v.rate || "-",
            v.terms || "-",
            v.delivery ? new Date(v.delivery).toLocaleDateString("en-IN") : "-",
            warrantyStr,
            attachmentStr,
            v.approvedBy || "-",
            v.poNumber || "-",
            v.basicValue || "-",
            v.totalWithTax || "-",
            poCopyStr
          ];
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
        link.setAttribute("download", `Pending_Vendor_FollowUp_${new Date().toISOString().split('T')[0]}.csv`);
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
    <div className="p-4 md:p-6 md:h-[calc(100vh-2rem)] flex flex-col md:overflow-hidden min-h-screen md:min-h-0 bg-slate-50/30">
      {/* Header */}
      <div className="mb-4 md:mb-6 p-4 md:p-6 bg-gradient-to-r from-indigo-50/50 via-blue-50/20 to-white border border-indigo-100/60 rounded-xl shadow-xs shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg shadow-indigo-100 shadow-xl text-white">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-indigo-950 tracking-tight">Stage 6: Vendor Follow-Up</h2>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-indigo-500" />
              <Input
                placeholder="Search by Indent, Item, Vendor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border-indigo-100 focus-visible:ring-indigo-500"
              />
            </div>
            <div className="h-8 w-px bg-indigo-100/60 mx-2" />
            <div className="flex items-center gap-4">
              <Label className="text-sm font-semibold text-indigo-900 whitespace-nowrap hidden md:inline-block">Show Columns:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-40 justify-start border-indigo-150 text-indigo-700 bg-white hover:bg-indigo-50/50 hover:text-indigo-800 shadow-xs">
                    {selectedColumns.length} selected
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-2">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 pb-2 border-b">
                      <Checkbox
                        checked={selectedColumns.length === baseColumns.length}
                        onCheckedChange={(c) => {
                          if (c)
                            setSelectedColumns(baseColumns.map((col) => col.key));
                          else setSelectedColumns([]);
                        }}
                      />
                      <Label className="text-sm font-medium">All Columns</Label>
                    </div>
                    {baseColumns.map((col) => (
                      <div
                        key={col.key}
                        className="flex items-center space-x-2 py-1"
                      >
                        <Checkbox
                          checked={selectedColumns.includes(col.key)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedColumns((prev) => [...prev, col.key]);
                            } else {
                              setSelectedColumns((prev) =>
                                prev.filter((c) => c !== col.key)
                              );
                            }
                          }}
                        />
                        <Label className="text-sm">{col.label}</Label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full flex-1 flex flex-col md:overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 mb-4 gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <TabsList className="bg-indigo-50/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1.5 border border-indigo-100/50 w-[420px] shadow-2xs">
              <TabsTrigger
                value="pending"
                className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-3 transition-all cursor-pointer text-slate-700"
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
                className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-3 transition-all cursor-pointer text-slate-700"
              >
                <History className="w-5 h-5 opacity-80" />
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
                  {filteredHistoryData.length}
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

          <div className="flex items-center gap-3 ml-auto sm:ml-0">
            {selectedRecordIds.length > 0 && activeTab === "pending" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={selectedRecordIds.length === 0}
                    size="sm"
                    className="bg-slate-900 hover:bg-slate-800 text-white"
                  >
                    Process Selected ({selectedRecordIds.length})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border shadow-md">
                  <DropdownMenuItem
                    onClick={() => handleBulkProcessOption("follow-up")}
                    className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-sm text-slate-800"
                  >
                    Follow-Up
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleBulkProcessOption("lift-material")}
                    className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-sm text-slate-800"
                  >
                    Material Lifting
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {activeTab === "pending" && (
              <Button
                onClick={handleExportPendingCSV}
                disabled={isExporting}
                size="sm"
                className="bg-green-700 hover:bg-green-800 text-white flex items-center gap-2"
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
        </div>

        {/* PENDING */}
        <TabsContent value="pending" className="mt-0 flex-1 flex flex-col md:overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading...</p>
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border rounded-lg bg-gray-50">
              <p className="text-lg">No pending follow-ups</p>
            </div>
          ) : (
            <FollowUpVendorPending
              pending={pending}
              selectedRecordIds={selectedRecordIds}
              toggleSelect={toggleSelect}
              selectAll={selectAll}
              selectedColumns={selectedColumns}
              baseColumns={baseColumns}
              handleProcessOption={handleProcessOption}
              getVendorData={getVendorData}
            />
          )}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="mt-0 flex-1 flex flex-col md:overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading History...</p>
              <p className="text-sm text-gray-500 mt-1">Fetching records from RECEIVING-ACCOUNTS</p>
            </div>
          ) : receivingAccountsData.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border rounded-lg bg-gray-50">
              <p className="text-lg">No records found</p>
            </div>
          ) : (
            <FollowUpVendorHistory
              filteredHistoryData={filteredHistoryData}
              sheetRecords={sheetRecords}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* BULK MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] sm:max-h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {processMode === "follow-up" ? "Follow-Up Details" : "Bulk Follow-Up & Dispatch"}
            </DialogTitle>
            <p className="text-sm text-gray-600">
              {vendorPOMismatchError
                ? "Cannot proceed with submission."
                : isUnifiedMode
                  ? `Updating ${bulkFormData.length} indents with common details.`
                  : "Update multiple indents at once."}
            </p>
          </DialogHeader>

          {vendorPOMismatchError ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
                <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-red-700 mb-2">Cannot Proceed</h4>
                <p className="text-red-600">{vendorPOMismatchError}</p>
                <p className="text-sm text-gray-500 mt-4">
                  Please select items with the same Vendor and PO Number to use bulk follow-up.
                </p>
              </div>
            </div>
          ) : processMode === "follow-up" ? (
            <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto space-y-6 pr-2">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-800 mb-2">Selected Indents ({bulkFormData.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {bulkFormData.map((item) => {
                    const record = sheetRecords.find((r) => r.id === item.recordId);
                    return (
                      <Badge key={item.recordId} variant="secondary" className="bg-white">
                        {record?.data.indentNumber} - {record?.data.itemName}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="border rounded-lg p-6 bg-white shadow-sm space-y-4">
                <h4 className="font-semibold text-lg mb-2">Follow-Up Form</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                      Estimated Date *
                    </Label>
                    <Input
                      type="date"
                      required
                      value={
                        isUnifiedMode
                          ? unifiedFormData?.followUpDate || ""
                          : bulkFormData[0]?.followUpDate || ""
                      }
                      onChange={(e) => {
                        if (isUnifiedMode) {
                          setUnifiedFormData((prev) =>
                            prev ? { ...prev, followUpDate: e.target.value } : null
                          );
                        } else {
                          setBulkFormData((prev) => {
                            const updated = [...prev];
                            if (updated[0]) updated[0].followUpDate = e.target.value;
                            return updated;
                          });
                        }
                      }}
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                      Remarks
                    </Label>
                    <Input
                      placeholder="Enter remarks..."
                      value={
                        isUnifiedMode
                          ? unifiedFormData?.remarks || ""
                          : bulkFormData[0]?.remarks || ""
                      }
                      onChange={(e) => {
                        if (isUnifiedMode) {
                          setUnifiedFormData((prev) =>
                            prev ? { ...prev, remarks: e.target.value } : null
                          );
                        } else {
                          setBulkFormData((prev) => {
                            const updated = [...prev];
                            if (updated[0]) updated[0].remarks = e.target.value;
                            return updated;
                          });
                        }
                      }}
                      className="bg-white"
                    />
                  </div>
                </div>
              </div>
            </form>
          ) : isUnifiedMode && unifiedFormData ? (
            <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto space-y-6 pr-2">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-800 mb-2">Selected Indents ({bulkFormData.length})</h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  {bulkFormData.map((item) => {
                    const record = sheetRecords.find((r) => r.id === item.recordId);
                    return (
                      <Badge key={item.recordId} variant="secondary" className="bg-white">
                        {record?.data.indentNumber} - {record?.data.itemName}
                      </Badge>
                    );
                  })}
                </div>
                <div className="flex gap-4 text-sm text-slate-600">
                  <span><strong>Vendor:</strong> {commonVendorPO?.vendor}</span>
                  <span><strong>PO Number:</strong> {commonVendorPO?.poNumber}</span>
                </div>
              </div>

              <div className="border rounded-lg p-6 bg-white shadow-sm">
                <h4 className="font-semibold text-lg mb-4">Common Details for All Selected Items</h4>

                <div className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h5 className="font-semibold text-green-900">Lifting Details</h5>
                      <div className="font-mono text-sm text-gray-500">
                        {unifiedFormData.liftingData.liftNumber}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-green-50/50 rounded-lg border border-green-100">
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Transporter *</Label>
                        <TransporterCombobox
                          value={unifiedFormData.liftingData.transporterName}
                          onChange={(val) =>
                            setUnifiedFormData((prev) => prev ? {
                              ...prev,
                              liftingData: { ...prev.liftingData, transporterName: val }
                            } : null)
                          }
                          options={transporterList}
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Vehicle No *</Label>
                        <Input
                          className="bg-white border-green-200 uppercase"
                          value={unifiedFormData.liftingData.vehicleNumber}
                          onChange={(e) =>
                            setUnifiedFormData((prev) => prev ? {
                              ...prev,
                              liftingData: { ...prev.liftingData, vehicleNumber: e.target.value.toUpperCase() }
                            } : null)
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Contact No *</Label>
                        <Input
                          className="bg-white border-green-200"
                          value={unifiedFormData.liftingData.contactNumber}
                          onChange={(e) =>
                            setUnifiedFormData((prev) => prev ? {
                              ...prev,
                              liftingData: { ...prev.liftingData, contactNumber: e.target.value }
                            } : null)
                          }
                          required
                          placeholder="Driver contact info"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">LR No *</Label>
                        <Input
                          className="bg-white border-green-200"
                          value={unifiedFormData.liftingData.lrNumber}
                          onChange={(e) =>
                            setUnifiedFormData((prev) => prev ? {
                              ...prev,
                              liftingData: { ...prev.liftingData, lrNumber: e.target.value }
                            } : null)
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Dispatch Date *</Label>
                        <Input
                          type="date"
                          className="bg-white border-green-200"
                          value={unifiedFormData.liftingData.dispatchDate}
                          onChange={(e) =>
                            setUnifiedFormData((prev) => prev ? {
                              ...prev,
                              liftingData: { ...prev.liftingData, dispatchDate: e.target.value }
                            } : null)
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Expected Delivery Date</Label>
                        <Input
                          type="date"
                          className="bg-white border-green-200"
                          value={unifiedFormData.liftingData.expectedDeliveryDate}
                          onChange={(e) =>
                            setUnifiedFormData((prev) => prev ? {
                              ...prev,
                              liftingData: { ...prev.liftingData, expectedDeliveryDate: e.target.value }
                            } : null)
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Freight Amt *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="bg-white border-green-200"
                          value={unifiedFormData.liftingData.freightAmount}
                          onChange={(e) =>
                            setUnifiedFormData((prev) => prev ? {
                              ...prev,
                              liftingData: { ...prev.liftingData, freightAmount: e.target.value }
                            } : null)
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Advance Amt</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="bg-white border-green-200"
                          value={unifiedFormData.liftingData.advanceAmount}
                          onChange={(e) =>
                            setUnifiedFormData((prev) => prev ? {
                              ...prev,
                              liftingData: { ...prev.liftingData, advanceAmount: e.target.value }
                            } : null)
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Payment Date</Label>
                        <Input
                          type="date"
                          className="bg-white border-green-200"
                          value={unifiedFormData.liftingData.paymentDate}
                          onChange={(e) =>
                            setUnifiedFormData((prev) => prev ? {
                              ...prev,
                              liftingData: { ...prev.liftingData, paymentDate: e.target.value }
                            } : null)
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Payment Status</Label>
                        <Select
                          value={unifiedFormData.liftingData.paymentStatus || ""}
                          onValueChange={(val) =>
                            setUnifiedFormData((prev) => prev ? {
                              ...prev,
                              liftingData: { ...prev.liftingData, paymentStatus: val }
                            } : null)
                          }
                        >
                          <SelectTrigger className="bg-white border-green-200">
                            <SelectValue placeholder="Select status..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="to_pay">To Pay</SelectItem>
                            <SelectItem value="for_pay">For Pay</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-full">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Bilty Copy *</Label>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.png"
                          onChange={(e) =>
                            setUnifiedFormData((prev) => prev ? {
                              ...prev,
                              liftingData: { ...prev.liftingData, biltyCopy: e.target.files?.[0] || null }
                            } : null)
                          }
                          className="hidden"
                          id="unified-file"
                        />
                        <label
                          htmlFor="unified-file"
                          className="flex items-center justify-center w-full p-4 border-2 border-dashed border-green-300 rounded-lg cursor-pointer bg-white hover:bg-green-50 transition-colors"
                        >
                          <Upload className="w-5 h-5 mr-3 text-green-600" />
                          <span className="text-green-700 font-medium">Upload Bilty Copy</span>
                        </label>
                        {unifiedFormData.liftingData.biltyCopy && (
                          <div className="mt-2 p-2 bg-white rounded border border-green-100 text-xs text-green-700 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            <span className="font-medium truncate">{unifiedFormData.liftingData.biltyCopy.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 mt-4 border-t border-gray-200">
                    <h5 className="font-semibold text-green-900">Per-Indent Quantities</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {bulkFormData.map((item) => {
                        const record = sheetRecords.find(r => r.id === item.recordId);
                        return (
                          <div key={item.recordId} className="flex flex-col gap-2 p-3 bg-white border border-gray-200 rounded-md">
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium">{record?.data.indentNumber}</span>
                              <span className="text-gray-500 truncate max-w-[120px]" title={record?.data.itemName}>
                                {record?.data.itemName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-gray-500 whitespace-nowrap">Lifting Qty *</Label>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="h-8 text-sm"
                                value={unifiedLiftingQtys[item.recordId] || ""}
                                onChange={(e) => handleUnifiedQtyChange(item.recordId, e.target.value)}
                                required
                                placeholder={`Max: ${record?.data.quantity}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded border border-blue-100 mt-4 pt-4 border-t">
                    <Label>Remarks (Optional)</Label>
                    <Textarea
                      className="bg-white"
                      value={unifiedFormData.remarks}
                      onChange={(e) =>
                        setUnifiedFormData((prev) => prev ? {
                          ...prev,
                          remarks: e.target.value
                        } : null)
                      }
                    />
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto space-y-8 pr-2">
              {bulkFormData.map((item, recordIdx) => {
                const record = sheetRecords.find((r) => r.id === item.recordId)!;
                const v = getVendorData(record);
                return (
                  <div key={item.recordId} className="border rounded-lg p-6 bg-white shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-lg">
                          Lift the Material - Indent No.{record.data.indentNumber}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {record.data.itemName} | Qty: {record.data.quantity} | Vendor: {v.name}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h5 className="font-semibold text-green-900">Lifting Details</h5>
                          <div className="font-mono text-sm text-gray-500">
                            {item.liftingData.liftNumber}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-green-50/50 rounded-lg border border-green-100">
                          <div>
                            <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Lifting Qty *</Label>
                            <Input
                              type="number"
                              className="bg-white border-green-200 focus:ring-green-500"
                              value={item.liftingData.liftingQty}
                              onChange={(e) =>
                                updateLiftingEntry(
                                  recordIdx,
                                  "liftingQty",
                                  e.target.value
                                )
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Transporter *</Label>
                            <TransporterCombobox
                              value={item.liftingData.transporterName}
                              onChange={(val) =>
                                updateLiftingEntry(
                                  recordIdx,
                                  "transporterName",
                                  val
                                )
                              }
                              options={transporterList}
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Vehicle No *</Label>
                            <Input
                              className="bg-white border-green-200 uppercase"
                              value={item.liftingData.vehicleNumber}
                              onChange={(e) =>
                                updateLiftingEntry(
                                  recordIdx,
                                  "vehicleNumber",
                                  e.target.value.toUpperCase()
                                )
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Contact No *</Label>
                            <Input
                              className="bg-white border-green-200"
                              value={item.liftingData.contactNumber}
                              onChange={(e) =>
                                updateLiftingEntry(
                                  recordIdx,
                                  "contactNumber",
                                  e.target.value
                                )
                              }
                              required
                              placeholder="Driver contact info"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">LR No *</Label>
                            <Input
                              className="bg-white border-green-200"
                              value={item.liftingData.lrNumber}
                              onChange={(e) =>
                                updateLiftingEntry(
                                  recordIdx,
                                  "lrNumber",
                                  e.target.value
                                )
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Dispatch Date *</Label>
                            <Input
                              type="date"
                              className="bg-white border-green-200"
                              value={item.liftingData.dispatchDate}
                              onChange={(e) =>
                                updateLiftingEntry(
                                  recordIdx,
                                  "dispatchDate",
                                  e.target.value
                                )
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Expected Delivery Date</Label>
                            <Input
                              type="date"
                              className="bg-white border-green-200"
                              value={item.liftingData.expectedDeliveryDate}
                              onChange={(e) =>
                                updateLiftingEntry(
                                  recordIdx,
                                  "expectedDeliveryDate",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Freight Amt *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              className="bg-white border-green-200"
                              value={item.liftingData.freightAmount}
                              onChange={(e) =>
                                updateLiftingEntry(
                                  recordIdx,
                                  "freightAmount",
                                  e.target.value
                                )
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Advance Amt</Label>
                            <Input
                              type="number"
                              step="0.01"
                              className="bg-white border-green-200"
                              value={item.liftingData.advanceAmount}
                              onChange={(e) =>
                                updateLiftingEntry(
                                  recordIdx,
                                  "advanceAmount",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Payment Date</Label>
                            <Input
                              type="date"
                              className="bg-white border-green-200"
                              value={item.liftingData.paymentDate}
                              onChange={(e) =>
                                updateLiftingEntry(
                                  recordIdx,
                                  "paymentDate",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Payment Status</Label>
                            <Select
                              value={item.liftingData.paymentStatus || ""}
                              onValueChange={(val) =>
                                updateLiftingEntry(
                                  recordIdx,
                                  "paymentStatus",
                                  val
                                )
                              }
                            >
                              <SelectTrigger className="bg-white border-green-200">
                                <SelectValue placeholder="Select status..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="to_pay">To Pay</SelectItem>
                                <SelectItem value="for_pay">For Pay</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-full">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Bilty Copy *</Label>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.png"
                              onChange={(e) =>
                                updateLiftingEntry(
                                  recordIdx,
                                  "biltyCopy",
                                  e.target.files?.[0] || null
                                )
                              }
                              className="hidden"
                              id={`file-${recordIdx}`}
                            />
                            <label
                              htmlFor={`file-${recordIdx}`}
                              className="flex items-center justify-center w-full p-4 border-2 border-dashed border-green-300 rounded-lg cursor-pointer bg-white hover:bg-green-50 transition-colors"
                            >
                              <Upload className="w-5 h-5 mr-3 text-green-600" />
                              <span className="text-green-700 font-medium">Upload Bilty Copy</span>
                            </label>
                            {item.liftingData.biltyCopy && (
                              <div className="mt-2 p-2 bg-white rounded border border-green-100 text-xs text-green-700 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                <span className="font-medium truncate">{item.liftingData.biltyCopy.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 rounded border border-blue-100 mt-4 pt-4 border-t">
                      <Label>Remarks (Optional)</Label>
                      <Textarea
                        className="bg-white"
                        value={item.remarks}
                        onChange={(e) =>
                          setBulkFormData((prev) => {
                            const updated = [...prev];
                            updated[recordIdx].remarks = e.target.value;
                            return updated;
                          })
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </form>
          )}

          <DialogFooter className="flex-shrink-0 border-t pt-4 flex sm:justify-end items-center bg-gray-50 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={resetBulk}>
                Cancel
              </Button>
              <Button onClick={handleBulkSubmit} disabled={!isBulkValid || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Submit All"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
