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
  { key: "createdBy", label: "Created By", icon: User },
  { key: "category", label: "Category", icon: FileText },
  { key: "itemName", label: "Item", icon: Package },
  { key: "quantity", label: "Qty", icon: Package },
  { key: "approvedQty", label: "Approved Qty", icon: Package },
  { key: "warehouseLocation", label: "Warehouse", icon: Warehouse },
  { key: "itemCode", label: "Item Code", icon: Hash },
  { key: "leadTime", label: "Lead Time", icon: Clock },
  { key: "plannedDate", label: "Planned", icon: Calendar },
  { key: "actualDate", label: "Actual", icon: Calendar },
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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/indent-approval?_t=${Date.now()}`);
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
    fetchData();
  }, []);

  const [searchTerm, setSearchTerm] = useState("");

  const pending = useMemo(() => sheetRecords
    .filter((r) => r.status === "pending")
    .filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.quantity?.toString().toLowerCase().includes(searchLower) ||
        r.data.vendorType?.toLowerCase().includes(searchLower)
      );
    }), [sheetRecords, searchTerm]);

  const history = useMemo(() => sheetRecords
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
    }), [sheetRecords, searchTerm]);

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
        <Button variant="outline" className="w-40 justify-start">
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
      <div className="mb-6 p-6 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-lg shadow-slate-100 shadow-xl text-white">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage 2: Approval</h2>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-end gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by Indent No, Item Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>

            <div className="flex items-center gap-3">
              <Label className="text-sm font-semibold text-slate-600 hidden md:inline-block">Show Columns:</Label>
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
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4 shrink-0">
          <TabsList className="bg-slate-100/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1 border border-slate-200/50 w-full md:max-w-md">
            <TabsTrigger
              value="pending"
              className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm flex items-center gap-3 transition-all"
            >
              <ClipboardList className="w-5 h-5" />
              <div className="flex flex-col items-start leading-none gap-1">
                <span className="font-bold">Pending</span>
                <span className="text-[10px] opacity-70">Awaiting processing</span>
              </div>
              <Badge variant="secondary" className="bg-slate-100 text-black border-slate-200 px-2">
                {pending.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm flex items-center gap-3 transition-all"
            >
              <History className="w-5 h-5" />
              <div className="flex flex-col items-start leading-none gap-1">
                <span className="font-bold">History</span>
                <span className="text-[10px] opacity-70">Completed</span>
              </div>
              <Badge variant="secondary" className="bg-slate-100 text-black border-slate-200 px-2">
                {history.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {selectedRecords.length > 0 && activeTab === "pending" && (
            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-3 px-6 h-[60px] rounded-xl shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <Send className="w-4 h-4" />
              <span className="text-base font-semibold">Submit Approval ({selectedRecords.length})</span>
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
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No completed records found</p>
            </div>
          ) : (
            <IndentApprovalHistory
              history={history}
              selectedColumns={selectedColumns}
              columns={columns}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* ------------------- APPROVAL MODAL ------------------- */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[90vw] w-full p-0 overflow-hidden border-none shadow-2xl border-2 border-green-500">
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between ">
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
                <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  {selectedItems.length} records to update
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-slate-900/5">
                <div className="max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="hover:bg-transparent border-b border-slate-200">
                        <TableHead className="w-[120px] h-10 px-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Indent ID</TableHead>
                        <TableHead className="min-w-[200px] h-10 px-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Item Description</TableHead>
                        <TableHead className="w-[80px] h-10 px-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Req. Qty</TableHead>
                        <TableHead className="w-[120px] h-10 px-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Status</TableHead>
                        <TableHead className="w-[120px] h-10 px-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Vendor Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedItems.map((item) => (
                        <TableRow
                          key={item.id}
                          className="transition-all border-b border-slate-100 last:border-0 odd:bg-white even:bg-slate-50/80 hover:bg-slate-100/30"
                        >
                          <TableCell className="py-3 px-4 font-mono text-xs font-bold text-slate-900">{item.data.indentNumber}</TableCell>
                          <TableCell className="py-3 px-4 text-slate-600 text-xs font-medium">{item.data.itemName}</TableCell>
                          <TableCell className="py-2 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Input
                                type="number"
                                className="h-8 w-20 text-center text-xs font-bold border-slate-200 focus:ring-slate-900"
                                value={lineItemsData[item.id]?.approvedQty || ""}
                                onChange={(e) => setLineItemsData(prev => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], approvedQty: e.target.value }
                                }))}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="flex bg-slate-50 rounded-lg p-0.5 border border-slate-200">
                              <button
                                type="button"
                                onClick={() => updateLineItem(item.id, "status", "approved")}
                                className={cn(
                                  "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                  lineItemsData[item.id]?.status === "approved"
                                    ? "bg-white text-emerald-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                )}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => updateLineItem(item.id, "status", "rejected")}
                                className={cn(
                                  "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                  lineItemsData[item.id]?.status === "rejected"
                                    ? "bg-white text-rose-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
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
                              <SelectTrigger className="h-8 w-28 text-[10px] font-bold border-slate-200 shadow-sm capitalize bg-white text-slate-700">
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
                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                      Final Remarks {approvalForm.status === "rejected" && <span className="text-rose-500">*</span>}
                    </Label>
                    <Textarea
                      placeholder="Enter detailed approval/rejection notes..."
                      className="bg-white border-slate-200 shadow-sm resize-none min-h-[90px] focus:ring-slate-900"
                      value={approvalForm.remarks}
                      onChange={(e) => setApprovalForm((p) => ({ ...p, remarks: e.target.value }))}
                      required={approvalForm.status === "rejected"}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="ghost"
                  className="px-6 h-11 font-bold text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-100 hover:bg-white transition-all rounded-lg"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedRecords([]);
                  }}
                >
                  Discard Changes
                </Button>

                <Button
                  type="submit"
                  className={`px-10 h-11 rounded-lg font-bold shadow-xl transition-all active:scale-[0.98] ${approvalForm.status === "rejected"
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200/50"
                    : "bg-slate-900 hover:bg-slate-800 shadow-slate-200/50"
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
