"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  XCircle,
  Package,
  Calendar,
  Warehouse,
  User,
  FileText,
  Hash,
  Clock,
  UserCheck,
  Tag,
  Loader2,
  Send,
  ClipboardList,
  History,
  Search,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, parseSheetDate, getFmsTimestamp } from "@/lib/utils";
import IndentApprovalPending from "./indent-approval-pending";
import IndentApprovalHistory from "./indent-approval-history";

const columns = [
  { key: "indentNumber", label: "Indent", icon: Hash },
  { key: "plannedDate", label: "Planned", icon: Calendar },
  { key: "actualDate", label: "Actual", icon: Calendar },
  { key: "createdBy", label: "Created By", icon: User },
  { key: "category", label: "Category", icon: FileText },
  { key: "itemName", label: "Item", icon: Package },
  { key: "quantity", label: "Qty", icon: Package },
  { key: "approvedQty", label: "Approved Qty", icon: Package },
  { key: "warehouseLocation", label: "Warehouse", icon: Warehouse },
  { key: "itemCode", label: "Item Code", icon: Hash },
  { key: "leadTime", label: "Lead Time", icon: Clock },
  { key: "delay", label: "Delay", icon: Clock },
  { key: "status", label: "Status", icon: Tag },
  { key: "remarks", label: "Remarks", icon: FileText },
] as const;

export default function Stage2() {
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [indentFilter, setIndentFilter] = useState<"no_filter" | "increasing" | "decreasing">("no_filter");
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "rejected">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [approvalForm, setApprovalForm] = useState({
    status: "",
    approvedQty: "",
    vendorType: "",
    remarks: "",
    attachment: null as File | null,
  });

  const [lineItemsData, setLineItemsData] = useState<Record<string, { approvedQty: string; status: string; vendorType: string }>>({});

  useEffect(() => {
    if (isModalOpen) {
      const initial: Record<string, { approvedQty: string; status: string; vendorType: string }> = {};
      selectedRecords.forEach(id => {
        const item = sheetRecords.find(r => r.id === id);
        initial[id] = {
          approvedQty: item?.data.quantity || "",
          status: "approved",
          vendorType: "regular"
        };
      });
      setLineItemsData(initial);
    }
  }, [isModalOpen]);

  const fetchData = async (status = statusFilter) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/indent-approval?status=${status}&_t=${Date.now()}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSheetRecords(json.data);
      }
    } catch (e) {
      console.error("Fetch error:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData(statusFilter);
  }, [statusFilter]);

  const [searchTerm, setSearchTerm] = useState("");

  const pending = useMemo(() => {
    let records = sheetRecords
      .filter((r) => r.status === "pending")
      .filter((r) => {
        const searchLower = searchTerm.toLowerCase();
        return (
          r.data.indentNumber?.toLowerCase().includes(searchLower) ||
          r.data.itemName?.toLowerCase().includes(searchLower) ||
          r.data.quantity?.toString().toLowerCase().includes(searchLower) ||
          r.data.vendorType?.toLowerCase().includes(searchLower)
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

  const history = useMemo(() => {
    let records = sheetRecords
      .filter((r) => r.status === "completed")
      .filter((r) => {
        const searchLower = searchTerm.toLowerCase();
        if (!searchLower) return true;
        return (
          r.data.indentNumber?.toLowerCase().includes(searchLower) ||
          r.data.itemName?.toLowerCase().includes(searchLower) ||
          r.data.quantity?.toString().toLowerCase().includes(searchLower) ||
          r.data.vendorType?.toLowerCase().includes(searchLower)
        );
      });

    if (statusFilter !== "all") {
      records = records.filter((r) => r.data.status?.toLowerCase() === statusFilter);
    }

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
  }, [sheetRecords, searchTerm, indentFilter, statusFilter]);

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    columns.map((c) => c.key)
  );

  const toggleRecord = (id: string) => {
    setSelectedRecords((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedRecords.length === pending.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(pending.map((r) => r.id));
    }
  };

  useEffect(() => {
    if (selectedRecords.length > 0) {
      const first = sheetRecords.find((r) => r.id === selectedRecords[0]);
      if (first) {
        setApprovalForm((prev) => ({
          ...prev,
          approvedQty: selectedRecords.length === 1 ? (first?.data.quantity ?? "") : "",
          status: "approved",
        }));
      }
    }
  }, [selectedRecords, sheetRecords]);

  const updateLineItem = (id: string, field: string, value: string) => {
    setLineItemsData(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const submitToSheet = async (recordsToSubmit: any[], approvalData: any) => {
    try {
      let attachmentUrl = "";
      if (approvalData.attachment) {
        try {
          const fileData = new FormData();
          fileData.append("file", approvalData.attachment);
          fileData.append("folder", "approvals");

          const uploadRes = await fetch("/api/upload-supabase", {
            method: "POST",
            body: fileData
          });
          if (!uploadRes.ok) throw new Error(`Upload failed with status ${uploadRes.status}`);
          const uploadJson = await uploadRes.json();
          if (uploadJson.success && uploadJson.url) {
            attachmentUrl = uploadJson.url;
          } else {
            throw new Error(uploadJson.error || "Upload failed");
          }
        } catch (error) {
          console.error("Image processing error:", error);
          alert("Attachment upload failed. Proceeding without attachment.");
        }
      }

      const res = await fetch("/api/indent-approval", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "insertApproval",
          recordsToSubmit,
          approvalData: {
            status: approvalData.status,
            remarks: approvalData.remarks,
            approvedBy: "System",
            attachment: attachmentUrl,
            lineData: approvalData.lineData
          }
        }),
      });

      const result = await res.json();
      if (result.success) {
        fetchData();
      } else {
        throw new Error(result.error || "Approval failed");
      }
    } catch (e: any) {
      console.error("Error submitting Stage 2 data:", e);
      alert("Submission failed: " + (e.message || "Check console."));
    }
  };

  const handleBulkApprove = async () => {
    const recordsToProcess = selectedRecords
      .map((id) => sheetRecords.find((r) => r.id === id))
      .filter((r) => r !== undefined);

    if (recordsToProcess.length === 0) return;

    setIsSubmitting(true);
    await submitToSheet(recordsToProcess, { ...approvalForm, lineData: lineItemsData });
    setIsSubmitting(false);

    setSelectedRecords([]);
    setApprovalForm({
      status: "",
      approvedQty: "",
      vendorType: "",
      remarks: "",
      attachment: null,
    });
    setIsModalOpen(false);
    setLineItemsData({});
  };

  const selectedItems = pending.filter((r) =>
    selectedRecords.includes(r.id)
  );

  const isFormValid = true;

  const ColumnSelector = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-40 justify-start border-indigo-150 text-indigo-700 bg-white hover:bg-indigo-50/50 hover:text-indigo-800 shadow-xs">
          {selectedColumns.length === columns.length
            ? "All columns"
            : `${selectedColumns.length} column${selectedColumns.length !== 1 ? "s" : ""
            } selected`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-2">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Checkbox
              checked={selectedColumns.length === columns.length}
              onCheckedChange={(c) => {
                if (c) setSelectedColumns(columns.map((col) => col.key));
                else setSelectedColumns([]);
              }}
            />
            <Label className="text-sm font-medium">All Columns</Label>
          </div>

          {columns.map((col) => (
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
  );

  return (
    <div className="p-6 h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
      {/* Header Card */}
      <div className="mb-6 p-6 bg-gradient-to-r from-indigo-50/50 via-blue-50/20 to-white border border-indigo-100/60 rounded-xl shadow-xs shrink-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg shadow-indigo-100 shadow-xl text-white">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-indigo-950 tracking-tight">Stage 2: Approval</h2>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-end gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-indigo-500" />
              <Input
                placeholder="Search by Indent No, Item Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border-indigo-100 focus-visible:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <Label className="text-sm font-semibold text-indigo-900 hidden md:inline-block">Show Columns:</Label>
              <ColumnSelector />
            </div>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="w-full flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full lg:w-auto">
            <TabsList className="bg-indigo-50/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1.5 border border-indigo-100/50 w-full sm:max-w-md shadow-2xs">
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
                  <span className="text-[10px] opacity-70">Completed</span>
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

          {selectedRecords.length > 0 && activeTab === "pending" && (
            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white flex items-center gap-3 px-6 h-[50px] rounded-xl shadow-md shadow-green-100 transition-all hover:scale-[1.01] active:scale-[0.99] font-bold w-full sm:w-auto"
            >
              <Send className="w-4 h-4" />
              <span className="text-base">Submit Approval ({selectedRecords.length})</span>
            </Button>
          )}
        </div>

        {/* ---------- PENDING ---------- */}
        <TabsContent value="pending" className="mt-0 flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading...</p>
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No records found</p>
            </div>
          ) : (
            <IndentApprovalPending
              pending={pending}
              selectedRecords={selectedRecords}
              toggleRecord={toggleRecord}
              toggleAll={toggleAll}
              selectedColumns={selectedColumns}
              columns={columns}
            />
          )}
        </TabsContent>

        {/* ---------- HISTORY ---------- */}
        <TabsContent value="history" className="mt-0 flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading History...</p>
              <p className="text-sm text-gray-500 mt-1">Fetching completed records</p>
            </div>
          ) : (
            <IndentApprovalHistory
              history={history}
              selectedColumns={selectedColumns}
              columns={columns}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* ------------------- APPROVAL MODAL ------------------- */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden border-none shadow-2xl rounded-xl border border-indigo-150">
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-6 py-4 flex items-center justify-between ">
            <div className="flex items-center gap-3 ">
              <div className="p-2 bg-white/10 rounded-lg">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg font-bold leading-none">
                  Bulk Approval
                </DialogTitle>
                <p className="text-slate-400 text-xs mt-1">
                  Processing {selectedRecords.length} selected indent{selectedRecords.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-white/10 text-white border-white/20 px-3 py-1">
              Final Review
            </Badge>
          </div>

          <div className="p-6 space-y-8 bg-slate-50/30">
            {/* Selected items summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">Active Items</span>
                </div>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  {selectedItems.length} records to update
                </span>
              </div>

              <div className="border border-indigo-100 rounded-xl overflow-hidden bg-white shadow-xs">
                <div className="max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-100">
                  <Table>
                    <TableHeader className="bg-indigo-50/50 sticky top-0 z-10 border-b border-indigo-100">
                      <TableRow className="hover:bg-transparent border-b border-indigo-100">
                        <TableHead className="w-[120px] h-10 px-4 text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Indent ID</TableHead>
                        <TableHead className="max-w-[280px] min-w-[200px] h-10 px-4 text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">Item Description</TableHead>
                        <TableHead className="w-[80px] h-10 px-4 text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest text-center">Req. Qty</TableHead>
                        <TableHead className="w-[120px] h-10 px-4 text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest text-center">Status</TableHead>
                        <TableHead className="w-[120px] h-10 px-4 text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest text-center">Vendor Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedItems.map((item) => (
                        <TableRow
                          key={item.id}
                          className="transition-all border-b border-indigo-50 last:border-0 odd:bg-white even:bg-indigo-50/10 hover:bg-indigo-50/20"
                        >
                          <TableCell className="py-3 px-4 font-mono text-xs font-bold text-indigo-950">{item.data.indentNumber}</TableCell>
                          <TableCell className="py-3 px-4 text-slate-600 text-xs font-semibold max-w-[280px] break-words whitespace-normal leading-relaxed">{item.data.itemName}</TableCell>
                          <TableCell className="py-2 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Input
                                type="number"
                                className="h-8 w-20 text-center text-xs font-bold border-indigo-200 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                                value={lineItemsData[item.id]?.approvedQty || ""}
                                onChange={(e) => setLineItemsData(prev => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], approvedQty: e.target.value }
                                }))}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="flex bg-indigo-50/40 rounded-lg p-0.5 border border-indigo-100">
                              <button
                                type="button"
                                onClick={() => updateLineItem(item.id, "status", "approved")}
                                className={cn(
                                  "flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
                                  lineItemsData[item.id]?.status === "approved"
                                    ? "bg-white text-emerald-700 shadow-xs border border-emerald-100"
                                    : "text-slate-500 hover:text-indigo-600"
                                )}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => updateLineItem(item.id, "status", "rejected")}
                                className={cn(
                                  "flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
                                  lineItemsData[item.id]?.status === "rejected"
                                    ? "bg-white text-rose-700 shadow-xs border border-rose-100"
                                    : "text-slate-500 hover:text-rose-600"
                                )}
                              >
                                Reject
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 px-4 text-center">
                            <Select
                              value={lineItemsData[item.id]?.vendorType || ""}
                              onValueChange={(v) => setLineItemsData(prev => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], vendorType: v }
                              }))}
                            >
                              <SelectTrigger className="h-8 w-28 text-[10px] font-bold border-indigo-150 shadow-xs capitalize bg-white text-slate-700 focus:ring-indigo-500">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="regular" className="text-[10px] font-bold">Regular Vendor</SelectItem>
                                <SelectItem value="new vendor" className="text-[10px] font-bold">New Vendor</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleBulkApprove();
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider ml-1">
                      Final Remarks {approvalForm.status === "rejected" && <span className="text-rose-500">*</span>}
                    </Label>
                    <Textarea
                      placeholder="Enter detailed approval/rejection notes..."
                      className="bg-white border-indigo-150 shadow-xs resize-none min-h-[90px] focus-visible:ring-indigo-500"
                      value={approvalForm.remarks}
                      onChange={(e) => setApprovalForm((p) => ({ ...p, remarks: e.target.value }))}
                      required={approvalForm.status === "rejected"}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-indigo-100">
                <Button
                  type="button"
                  variant="ghost"
                  className="px-6 h-11 font-bold text-slate-400 hover:text-indigo-700 border border-transparent hover:border-indigo-100 hover:bg-indigo-50/30 transition-all rounded-lg"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedRecords([]);
                  }}
                >
                  Discard Changes
                </Button>

                <Button
                  type="submit"
                  className={`px-10 h-11 rounded-lg font-bold shadow-md transition-all active:scale-[0.98] ${approvalForm.status === "rejected"
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200/50"
                    : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md shadow-indigo-200"
                    }`}
                  disabled={!isFormValid || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Request...
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      {approvalForm.status === "rejected" ? <XCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                      <span>{approvalForm.status === "rejected" ? "Reject Selection" : "Complete Approval"}</span>
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
