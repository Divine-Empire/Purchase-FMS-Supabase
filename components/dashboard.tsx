"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Truck,
  CheckCircle,
  Clock,
  Filter,
  Calendar,
  FileText,
  TrendingUp,
  Plus,
  Loader2,
  Download,
  Eye,
  Package,
  Users,
  ShieldAlert,
  Settings2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { parseSheetDate, formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Define all purchase order stages with pending counts (Excluding Create Indent)
const purchaseStages = [
  { id: 2, name: "Indent Approval", color: "bg-purple-500" },
  { id: 3, name: "Update 3 Vendors", color: "bg-indigo-500" },
  { id: 4, name: "Negotiation", color: "bg-cyan-500" },
  { id: 5, name: "PO Entry", color: "bg-teal-500" },
  { id: 6, name: "Follow-Up Vendor", color: "bg-emerald-500" },
  { id: 7, name: "Transporter Follow-Up", color: "bg-green-500" },
  { id: 8, name: "Material Received", color: "bg-lime-500" },
  { id: 9, name: "Serial Generation", color: "bg-yellow-500" },
  { id: 11, name: "Receipt in Tally", color: "bg-orange-500" },
  { id: 12, name: "Submit Invoice (HO)", color: "bg-red-500" },
  { id: 13, name: "Submit Invoice", color: "bg-rose-500" },
  { id: 14, name: "Verification by Accounts", color: "bg-pink-500" },
  { id: 15, name: "QC Requirement", color: "bg-fuchsia-500" },
  { id: 16, name: "Purchase Return", color: "bg-violet-500" },
  { id: 17, name: "Return Approval", color: "bg-indigo-600" },
  { id: 18, name: "Vendor Payment", color: "bg-slate-500" },
  { id: 19, name: "Freight Payments", color: "bg-zinc-500" },
];

const formatExpDeliveryDate = (dateStr: any) => {
  if (!dateStr || dateStr === "-" || dateStr === "—") return "-";
  if (typeof dateStr === "string") {
    const cleanStr = dateStr.split("T")[0].split(" ")[0];
    if (cleanStr && /^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
      return cleanStr;
    }
  }
  const d = dateStr instanceof Date ? dateStr : parseSheetDate(dateStr);
  if (!d || isNaN(d.getTime())) return typeof dateStr === "string" ? dateStr : "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function PurchaseDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  // Filter states
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedParty, setSelectedParty] = useState("all");
  const [selectedMaterial, setSelectedMaterial] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Search states
  const [inTransitSearch, setInTransitSearch] = useState("");
  const [receivedSearch, setReceivedSearch] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [warrantySearch, setWarrantySearch] = useState("");

  // Forms modal states
  const [formsMenuOpen, setFormsMenuOpen] = useState(false);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [transporterFormOpen, setTransporterFormOpen] = useState(false);

  // Form data states
  const [itemForm, setItemForm] = useState({
    category: "",
    itemName: "",
    uom: "",
  });

  const [vendorForm, setVendorForm] = useState({
    vendorName: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
  });

  const [transporterForm, setTransporterForm] = useState({
    transporterName: "",
    contactPerson: "",
    phone: "",
    vehicleType: "",
  });

  // Sort states
  const [inTransitSort, setInTransitSort] = useState({
    key: "date",
    direction: "desc",
  });
  const [receivedSort, setReceivedSort] = useState({
    key: "date",
    direction: "desc",
  });
  const [pendingSort, setPendingSort] = useState({
    key: "erp",
    direction: "asc",
  });
  const [warrantySort, setWarrantySort] = useState({
    key: "indentNo",
    direction: "desc",
  });

  const [warrantyVisibleColumns, setWarrantyVisibleColumns] = useState<string[]>([
    "indentNo",
    "liftNo",
    "serialNo",
    "vendorName",
    "itemName",
    "invoiceDate",
    "warrantyEnd"
  ]);

  const [warrantyMonthsFilter, setWarrantyMonthsFilter] = useState<string>("");

  const [expandedPOs, setExpandedPOs] = useState<Record<string, boolean>>({});

  const [totalPurchaseOrders, setTotalPurchaseOrders] = useState<number | null>(null);
  const [pendingPOs, setPendingPOs] = useState<number | null>(null);
  const [completedPOs, setCompletedPOs] = useState<number | null>(null);
  const [completionRate, setCompletionRate] = useState<number | null>(null);

  const [receivedItems, setReceivedItems] = useState<any[]>([]);
  const [inTransitItems, setInTransitItems] = useState<any[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
  const [warrantyItems, setWarrantyItems] = useState<any[]>([]);
  const [overviewItems, setOverviewItems] = useState<any[]>([]);
  const [stageCounts, setStageCounts] = useState<any>({});
  const [stageOverdueCounts, setStageOverdueCounts] = useState<any>({});
  const [topReceivedOrders, setTopReceivedOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/dashboard");
        const result = await response.json();
        if (result.success && result.data) {
          const {
            totalPurchaseOrders,
            pendingPOs,
            completedPOs,
            completionRate,
            overviewItems,
            purchaseItems,
            inTransitItems,
            receivedItems,
            warrantyItems,
            stageCounts,
            stageOverdueCounts,
            topReceivedOrders,
          } = result.data;

          setTotalPurchaseOrders(totalPurchaseOrders);
          setPendingPOs(pendingPOs);
          setCompletedPOs(completedPOs);
          setCompletionRate(completionRate);
          setOverviewItems(overviewItems);
          setPurchaseItems(purchaseItems);
          setInTransitItems(inTransitItems);
          setReceivedItems(receivedItems);
          setWarrantyItems(warrantyItems);
          setStageCounts(stageCounts);
          setStageOverdueCounts(stageOverdueCounts);
          setTopReceivedOrders(topReceivedOrders);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Compute unique values for filters
  const allData = useMemo(() => [...inTransitItems, ...receivedItems, ...purchaseItems, ...warrantyItems], [inTransitItems, receivedItems, purchaseItems, warrantyItems]);

  const uniqueParties = useMemo(() =>
    [...new Set(allData.map((item) => item.party))].filter(Boolean).sort()
    , [allData]);

  const uniqueMaterials = useMemo(() =>
    [...new Set(allData.map((item) => item.material))].filter(Boolean).sort()
    , [allData]);

  // Filtering function
  const applyFilters = (data: any[], dataType: string) => {
    return data.filter((item: any) => {
      // Date filter
      if (dateFrom || dateTo) {
        const itemDate = parseSheetDate(item.date);
        if (!itemDate) return false;
        if (dateFrom) {
          const fromDate = parseSheetDate(dateFrom);
          if (fromDate && itemDate < fromDate) return false;
        }
        if (dateTo) {
          const toDate = parseSheetDate(dateTo);
          if (toDate && itemDate > toDate) return false;
        }
      }

      // Party filter
      if (
        selectedParty &&
        selectedParty !== "all" &&
        item.party !== selectedParty
      )
        return false;

      // Material filter
      if (
        selectedMaterial &&
        selectedMaterial !== "all" &&
        item.material !== selectedMaterial
      )
        return false;

      // Status filter
      if (
        selectedStatus &&
        selectedStatus !== "all" &&
        selectedStatus !== dataType
      )
        return false;

      // Warranty Months Left filter
      if (dataType === "warranty" && warrantyMonthsFilter) {
        const months = parseInt(warrantyMonthsFilter);
        if (!isNaN(months)) {
          const itemDate = new Date(item.warrantyEnd);
          if (isNaN(itemDate.getTime())) return false;

          const maxDate = new Date();
          maxDate.setMonth(maxDate.getMonth() + months);

          if (itemDate > maxDate) return false;
          // Also filter out past dates if strictly "months left" means future? 
          // Usually "months left" implies filter <= X months from now.
          if (itemDate < new Date()) return false;
        }
      }

      return true;
    });
  };

  // Apply filters to data
  const filteredInTransitData = useMemo(() => applyFilters(inTransitItems, "intransit"), [inTransitItems, dateFrom, dateTo, selectedParty, selectedMaterial, selectedStatus]);
  const filteredReceivedData = useMemo(() => applyFilters(receivedItems, "received"), [receivedItems, dateFrom, dateTo, selectedParty, selectedMaterial, selectedStatus]);
  const filteredPendingData = useMemo(() => applyFilters(purchaseItems, "pending"), [purchaseItems, dateFrom, dateTo, selectedParty, selectedMaterial, selectedStatus]);
  const filteredWarrantyData = useMemo(() => applyFilters(warrantyItems, "warranty"), [warrantyItems, dateFrom, dateTo, selectedParty, selectedMaterial, selectedStatus, warrantyMonthsFilter]);

  // Sorting function
  const sortData = (data: any[], sortConfig: any) => {
    return [...data].sort((a: any, b: any) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === "date") {
        aVal = parseSheetDate(aVal);
        bVal = parseSheetDate(bVal);
      } else if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      const aTime = aVal instanceof Date ? aVal.getTime() : aVal;
      const bTime = bVal instanceof Date ? bVal.getTime() : bVal;

      if (aTime < bTime) return sortConfig.direction === "asc" ? -1 : 1;
      if (aTime > bTime) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  // Apply sorting
  const sortedInTransitData = useMemo(() => sortData(filteredInTransitData, inTransitSort), [filteredInTransitData, inTransitSort]);
  const sortedReceivedData = useMemo(() => sortData(filteredReceivedData, receivedSort), [filteredReceivedData, receivedSort]);
  const sortedPendingData = useMemo(() => sortData(filteredPendingData, pendingSort), [filteredPendingData, pendingSort]);
  const sortedWarrantyData = useMemo(() => sortData(filteredWarrantyData, warrantySort), [filteredWarrantyData, warrantySort]);

  // Apply search
  const searchData = (data: any[], searchTerm: string) => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(
      (item: any) =>
        (item.erp && item.erp.toString().toLowerCase().includes(term)) ||
        (item.material && item.material.toLowerCase().includes(term)) ||
        (item.party && item.party.toLowerCase().includes(term)) ||
        // Warranty specific fields
        (item.indentNo && item.indentNo.toString().toLowerCase().includes(term)) ||
        (item.liftNo && item.liftNo.toString().toLowerCase().includes(term)) ||
        (item.serialNo && item.serialNo.toString().toLowerCase().includes(term))
    );
  };

  const finalInTransitData = useMemo(() => searchData(sortedInTransitData, inTransitSearch), [sortedInTransitData, inTransitSearch]);
  const finalReceivedData = useMemo(() => searchData(sortedReceivedData, receivedSearch), [sortedReceivedData, receivedSearch]);
  const finalPendingData = useMemo(() => searchData(sortedPendingData, pendingSearch), [sortedPendingData, pendingSearch]);
  const finalWarrantyData = useMemo(() => searchData(sortedWarrantyData, warrantySearch), [sortedWarrantyData, warrantySearch]);

  const togglePOExpand = (erp: string) => {
    setExpandedPOs((prev) => ({
      ...prev,
      [erp]: !prev[erp],
    }));
  };

  const groupedPendingData = useMemo(() => {
    const groupsMap: {
      [key: string]: {
        erp: string;
        party: string;
        totalQty: number;
        poCopy: string;
        items: any[];
      };
    } = {};

    finalPendingData.forEach((item: any) => {
      const key = item.erp || "N/A";
      if (!groupsMap[key]) {
        groupsMap[key] = {
          erp: key,
          party: item.party || "-",
          totalQty: 0,
          poCopy: item.poCopy || "",
          items: [],
        };
      }
      groupsMap[key].items.push(item);
      const numericQty = typeof item.qty === "number" ? item.qty : parseFloat(item.qty) || 0;
      groupsMap[key].totalQty += numericQty;
      if (!groupsMap[key].poCopy && item.poCopy) {
        groupsMap[key].poCopy = item.poCopy;
      }
    });

    return Object.values(groupsMap);
  }, [finalPendingData]);

  // Export to CSV function
  const exportToCSV = (data: any[], filename: string, visibleColumns?: string[]) => {
    if (data.length === 0) return;

    const allHeaders = Object.keys(data[0]);
    // If visibleColumns is provided, only use those. Otherwise use all headers.
    const headers = visibleColumns ? allHeaders.filter(h => visibleColumns.includes(h)) : allHeaders;

    const csvContent = [
      headers.map(h => h.toUpperCase()).join(","),
      ...data.map((row: any) =>
        headers.map((header) => {
          let val = row[header];
          // Format date fields in CSV if they look like dates
          if (header.toLowerCase().includes("date") || header.toLowerCase().includes("end")) {
            val = formatDate(val);
          }
          return `"${val}"`;
        }).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { ReportDocument } = await import("./report-pdf");

      const response = await fetch("/api/dashboard/report");
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch report data");
      }

      const { summaryData, detailedData } = result;

      const blob = await pdf(<ReportDocument summaryData={summaryData} detailedData={detailedData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Purchase_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to generate report");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header with Forms Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and manage your purchase orders
          </p>
        </div>
        <Button
          onClick={() => {
            setFormsMenuOpen(true);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Forms
        </Button>
      </div>

      {/* Smart Filters */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-sm font-medium">Smart Filters</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Refine your data view with advanced filtering options
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2">

                <Input
                  type="date"
                  placeholder="dd-mm-yyyy"
                  className="h-9 text-xs cursor-pointer"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker();
                    } catch (err) { }
                  }}
                />
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  to
                </span>
                <Input
                  type="date"
                  placeholder="dd-mm-yyyy"
                  className="h-9 text-xs cursor-pointer"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker();
                    } catch (err) { }
                  }}
                />
              </div>
            </div>
            <Select value={selectedParty} onValueChange={setSelectedParty}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Party Names" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Party Names</SelectItem>
                {uniqueParties.map((party) => (
                  <SelectItem key={party} value={party}>
                    {party}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedMaterial}
              onValueChange={setSelectedMaterial}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Materials" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Materials</SelectItem>
                {uniqueMaterials.map((material) => (
                  <SelectItem key={material} value={material}>
                    {material}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setSelectedParty("all");
                setSelectedMaterial("all");
                setSelectedStatus("all");
              }}
            >
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-11">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="purchase" className="text-xs sm:text-sm">
            Purchase Orders
          </TabsTrigger>
          <TabsTrigger value="intransit" className="text-xs sm:text-sm">
            In-Transit
          </TabsTrigger>
          <TabsTrigger value="received" className="text-xs sm:text-sm">
            Received
          </TabsTrigger>
          <TabsTrigger value="warranty" className="text-xs sm:text-sm">
            Warranty
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Purchase Orders
                </CardTitle>
                <FileText className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : totalPurchaseOrders !== null ? totalPurchaseOrders : 0}
                </div>
                <p className="text-xs text-muted-foreground">Active Orders</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pending PO's
                </CardTitle>
                <Clock className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : pendingPOs !== null ? pendingPOs : 0}
                </div>
                <p className="text-xs text-muted-foreground">Awaiting Action</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Completed PO's
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : completedPOs !== null ? completedPOs : 0}
                </div>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Completion Rate
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : completionRate !== null ? `${completionRate}%` : "0%"}
                </div>
                <Progress value={completionRate || 0} className="mt-2 h-2" />
              </CardContent>
            </Card>
          </div>

          {/* Pending Items by Stage */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-sm font-medium">
                  Pending Items by Stage
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Track all pending items across different purchase stages
                </p>
              </div>
              <Button
                variant="default"
                className="bg-blue-600 hover:bg-blue-700 h-8 text-xs flex items-center"
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
              >
                {isGeneratingReport ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1.5" />}
                {isGeneratingReport ? "Generating..." : "Generate Report"}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[200px]">Stage</TableHead>
                    <TableHead className="text-xs text-right w-[80px]">
                      Pending
                    </TableHead>
                    <TableHead className="text-xs text-center w-[120px] pl-6">
                      Pending Overdue
                    </TableHead>
                    <TableHead className="text-xs w-[200px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseStages.map((stage) => {
                    let dynamicCount = stageCounts[stage.name] || 0;

                    let overdueCount = stageOverdueCounts[stage.name] || 0;

                    return (
                      <TableRow key={stage.id} className="hover:bg-gray-50">
                        <TableCell className="text-xs font-medium">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${stage.color}`}
                            ></div>
                            {stage.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">
                          {dynamicCount}
                        </TableCell>
                        <TableCell className="text-xs text-center text-red-500 font-medium pl-6">
                          {overdueCount > 0 ? overdueCount : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${stage.color}`}
                                style={{
                                  width: `${Math.min(
                                    (dynamicCount / 20) * 100,
                                    100
                                  )}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/*  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-purple-600" />
                  PO Quantity by Status
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Distribution of quantities across order statuses
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>Complete: 88%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span>Pending: 12%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          */}
          {/* BEST PRICE PER MATERIAL – NEW MODERN SECTION */}
          {/* TOP RECEIVED ORDERS - REPLACED BEST PRICE SECTION */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    Top Received Orders
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Vendors with highest order volume (Prioritized by Count)
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-emerald-50 text-emerald-700"
                >
                  Live Data
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Count</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Vendor Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topReceivedOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No received orders data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      topReceivedOrders.map((item: any, idx: number) => (
                        <TableRow key={idx} className="hover:bg-muted/50">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-muted-foreground" />
                              {item.product}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {item.count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">
                            ₹{item.value.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm">
                            {item.vendor}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          {/* <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Top Materials
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Most ordered materials by quantity
                </p>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {topMaterials.slice(0, 5).map((m) => (
                  <div
                    key={m.rank}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="w-6 h-6 p-0 flex items-center justify-center text-[10px] font-bold"
                      >
                        {m.rank}
                      </Badge>
                      <span className="truncate max-w-32 sm:max-w-none">
                        {m.material}
                      </span>
                    </div>
                    <span className="font-medium">{m.qty.toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="lg:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Top Vendors</CardTitle>
              <p className="text-xs text-muted-foreground">
                Leading suppliers by order count
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={vendorBarData.slice(0, 5)} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={80}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip />
                  <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="hidden lg:block">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Top Vendors</CardTitle>
              <p className="text-xs text-muted-foreground">
                Leading suppliers by order count
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={vendorBarData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={80}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip />
                  <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Top Vendors by Quantity
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Leading suppliers by total quantity
              </p>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {topVendors.slice(0, 5).map((v) => (
                <div key={v.rank} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="w-6 h-6 p-0 flex items-center justify-center text-[10px] font-bold"
                    >
                      {v.rank}
                    </Badge>
                    <span className="truncate max-w-32">
                      {v.vendor.split(" ").slice(0, 2).join(" ")}
                    </span>
                  </div>
                  <span className="font-medium">{v.qty.toFixed(2)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* New Overview Table */}
          {/* <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Purchase Order Overview
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Detailed view of all purchase orders
              </p>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Indent #</TableHead>
                    <TableHead className="text-xs">Created By</TableHead>
                    <TableHead className="text-xs">
                      Warehouse Location
                    </TableHead>
                    <TableHead className="text-xs">Lead Time</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs">Item</TableHead>
                    <TableHead className="text-xs text-right">Qty</TableHead>
                    <TableHead className="text-xs">Exp. Delivery</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overviewItems.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs">IND-{item.indent}</TableCell>
                      <TableCell className="text-xs">
                        {item.createdBy || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.warehouse || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.leadTime || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.category}
                      </TableCell>
                      <TableCell className="text-xs">{item.item}</TableCell>
                      <TableCell className="text-xs text-right">
                        {typeof item.qty === 'number' ? item.qty.toFixed(2) : item.qty}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatExpDeliveryDate(item.expDelivery)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          variant="outline"
                          className={`
                            ${item.status?.includes("Approved")
                              ? "bg-green-50 text-green-700 border-green-200"
                              : item.status?.includes("Pending")
                                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                : "bg-gray-50 text-gray-700 border-gray-200"
                            }
                          `}
                        >
                          {item.status || "Pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card> */}
        </TabsContent>

        {/* IN-TRANSIT TAB */}
        <TabsContent value="intransit" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Materials In-Transit</h3>
            </div>
            <Badge variant="secondary" className="bg-blue-50 text-blue-700">
              {finalInTransitData.length} Items
            </Badge>
          </div>

          {/* Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              placeholder="Search by ERP, material, or party..."
              value={inTransitSearch}
              onChange={(e) => setInTransitSearch(e.target.value)}
              className="flex-1 sm:max-w-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCSV(finalInTransitData, "in-transit-data.csv")
              }
              className="flex items-center justify-center gap-1"
            >
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setInTransitSort({
                          key: "erp",
                          direction:
                            inTransitSort.key === "erp" &&
                              inTransitSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      ERP PO Number{" "}
                      {inTransitSort.key === "erp" &&
                        (inTransitSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setInTransitSort({
                          key: "material",
                          direction:
                            inTransitSort.key === "material" &&
                              inTransitSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Material Name{" "}
                      {inTransitSort.key === "material" &&
                        (inTransitSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setInTransitSort({
                          key: "party",
                          direction:
                            inTransitSort.key === "party" &&
                              inTransitSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Party Name{" "}
                      {inTransitSort.key === "party" &&
                        (inTransitSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-xs">Truck No.</TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setInTransitSort({
                          key: "date",
                          direction:
                            inTransitSort.key === "date" &&
                              inTransitSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Date{" "}
                      {inTransitSort.key === "date" &&
                        (inTransitSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-xs text-right">
                      Quantity
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalInTransitData.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-xs">
                        {item.erp}
                      </TableCell>
                      <TableCell className="text-xs">{item.material}</TableCell>
                      <TableCell className="text-xs max-w-48 truncate">
                        {item.party}
                      </TableCell>
                      <TableCell className="text-xs">{item.truck}</TableCell>
                      <TableCell className="text-xs">{item.date}</TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {item.qty}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RECEIVED TAB */}
        <TabsContent value="received" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold">Received Materials</h3>
            </div>
            <Badge variant="secondary" className="bg-green-50 text-green-700">
              {finalReceivedData.length} Items
            </Badge>
          </div>

          {/* Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              placeholder="Search by ERP, material, or party..."
              value={receivedSearch}
              onChange={(e) => setReceivedSearch(e.target.value)}
              className="flex-1 sm:max-w-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCSV(finalReceivedData, "received-data.csv")
              }
              className="flex items-center justify-center gap-1"
            >
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setReceivedSort({
                          key: "erp",
                          direction:
                            receivedSort.key === "erp" &&
                              receivedSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      ERP PO Number{" "}
                      {receivedSort.key === "erp" &&
                        (receivedSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setReceivedSort({
                          key: "material",
                          direction:
                            receivedSort.key === "material" &&
                              receivedSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Material Name{" "}
                      {receivedSort.key === "material" &&
                        (receivedSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setReceivedSort({
                          key: "party",
                          direction:
                            receivedSort.key === "party" &&
                              receivedSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Party Name{" "}
                      {receivedSort.key === "party" &&
                        (receivedSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-xs">Invoice Number</TableHead>
                    <TableHead className="text-xs">Bill Image</TableHead>
                    <TableHead className="text-xs">Truck No.</TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setReceivedSort({
                          key: "date",
                          direction:
                            receivedSort.key === "date" &&
                              receivedSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Date{" "}
                      {receivedSort.key === "date" &&
                        (receivedSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-xs text-right">
                      Quantity
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalReceivedData.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-xs">
                        {item.erp}
                      </TableCell>
                      <TableCell className="text-xs">{item.material}</TableCell>
                      <TableCell className="text-xs max-w-48 truncate">
                        {item.party}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-700">
                        {item.invoiceNumber || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.billImage ? (
                          <a
                            href={item.billImage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-gray-100 text-blue-600"
                          >
                            <Eye className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{item.truck}</TableCell>
                      <TableCell className="text-xs">
                        {item.date ? new Date(item.date).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {item.qty}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PURCHASE DATA → PENDING TAB */}
        <TabsContent value="purchase" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <h3 className="text-lg font-semibold">
                Pending Orders from PO Sheet
              </h3>
            </div>
            <Badge variant="secondary" className="bg-orange-50 text-orange-700">
              {finalPendingData.length} Orders
            </Badge>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by ERP, material, or party..."
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(finalPendingData, "pending-data.csv")}
              className="flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              Export CSV
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="text-xs">ERP PO Number</TableHead>
                    <TableHead className="text-xs">Material Name</TableHead>
                    <TableHead className="text-xs">Party Name</TableHead>
                    <TableHead className="text-xs text-right">Quantity</TableHead>
                    <TableHead className="text-xs text-center">PO Copy</TableHead>
                    <TableHead className="text-xs">Warehouse</TableHead>
                    <TableHead className="text-xs">Lead Time</TableHead>
                    <TableHead className="text-xs">Exp. Delivery</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedPendingData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No pending purchase orders available
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupedPendingData.map((group: any) => {
                      const isExpanded = !!expandedPOs[group.erp];
                      const count = group.items.length;

                      return (
                        <Fragment key={group.erp}>
                          <TableRow
                            className="cursor-pointer hover:bg-slate-50/80 font-medium"
                            onClick={() => togglePOExpand(group.erp)}
                          >
                            <TableCell className="text-xs w-8 p-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => togglePOExpand(group.erp)}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-500" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell className="font-semibold text-xs">
                              {group.erp}
                            </TableCell>
                            <TableCell className="text-xs font-normal text-muted-foreground">
                              {count} {count === 1 ? "material" : "materials"}
                            </TableCell>
                            <TableCell className="text-xs">{group.party}</TableCell>
                            <TableCell className="text-right text-xs font-semibold">
                              {group.totalQty.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-xs text-center" onClick={(e) => e.stopPropagation()}>
                              {group.poCopy ? (
                                <a
                                  href={group.poCopy}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-gray-100 text-blue-600 transition-colors"
                                  title="View PO Copy"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">-</TableCell>
                            <TableCell className="text-xs">-</TableCell>
                            <TableCell className="text-xs">-</TableCell>
                          </TableRow>

                          {/* Expanded child rows for individual PO materials */}
                          {isExpanded &&
                            group.items.map((subItem: any, subIdx: number) => (
                              <TableRow
                                key={`${group.erp}-sub-${subIdx}`}
                                className="bg-slate-50/80 hover:bg-slate-100/80 border-l-2 border-l-blue-500"
                              >
                                <TableCell className="text-xs"></TableCell>
                                <TableCell className="text-xs text-muted-foreground pl-4 font-mono">
                                  └ IND-{subItem.indentNo || subItem.erp}
                                </TableCell>
                                <TableCell className="text-xs font-medium text-blue-900">
                                  {subItem.material}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {subItem.party}
                                </TableCell>
                                <TableCell className="text-right text-xs font-medium">
                                  {typeof subItem.qty === 'number' ? subItem.qty.toFixed(2) : subItem.qty}
                                </TableCell>
                                <TableCell className="text-xs text-center">
                                  {subItem.poCopy ? (
                                    <a
                                      href={subItem.poCopy}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-gray-100 text-blue-600 transition-colors"
                                      title="View PO Copy"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs">{subItem.warehouse || "-"}</TableCell>
                                <TableCell className="text-xs">{subItem.leadTime || "-"}</TableCell>
                                <TableCell className="text-xs">{formatExpDeliveryDate(subItem.expDelivery)}</TableCell>
                              </TableRow>
                            ))}
                        </Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Serial-Generation TAB */}
        <TabsContent value="warranty" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-semibold">Serial Generation</h3>
            </div>
            <Badge variant="secondary" className="bg-amber-50 text-amber-700">
              {finalWarrantyData.length} Items
            </Badge>
          </div>

          {/* Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              placeholder="Search by Indent, serial, or vendor..."
              value={warrantySearch}
              onChange={(e) => setWarrantySearch(e.target.value)}
              className="flex-1 sm:max-w-sm"
            />
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <Settings2 className="h-3 w-3" />
                    <span>Columns</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {[
                    { id: "indentNo", label: "Indent No." },
                    { id: "liftNo", label: "Unit Tracking No." },
                    { id: "serialNo", label: "Serial No." },
                    { id: "vendorName", label: "Vendor Name" },
                    { id: "itemName", label: "Item-Name" },
                    { id: "invoiceDate", label: "Invoice Date" },
                    { id: "warrantyEnd", label: "Warranty End" },
                  ].map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={warrantyVisibleColumns.includes(col.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setWarrantyVisibleColumns([...warrantyVisibleColumns, col.id]);
                        } else {
                          setWarrantyVisibleColumns(warrantyVisibleColumns.filter(c => c !== col.id));
                        }
                      }}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportToCSV(finalWarrantyData, "warranty-data.csv", warrantyVisibleColumns)
                }
                className="flex items-center justify-center gap-1"
              >
                <Download className="h-3 w-3" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">Export</span>
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Months Left:</span>
                <Input
                  type="number"
                  placeholder="e.g. 6"
                  className="h-8 w-20 text-xs"
                  value={warrantyMonthsFilter}
                  onChange={(e) => setWarrantyMonthsFilter(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {warrantyVisibleColumns.includes("indentNo") && (
                      <TableHead
                        className="text-xs cursor-pointer hover:bg-gray-50"
                        onClick={() =>
                          setWarrantySort({
                            key: "indentNo",
                            direction:
                              warrantySort.key === "indentNo" &&
                                warrantySort.direction === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Indent No.{" "}
                        {warrantySort.key === "indentNo" &&
                          (warrantySort.direction === "asc" ? "↑" : "↓")}
                      </TableHead>
                    )}
                    {warrantyVisibleColumns.includes("liftNo") && <TableHead className="text-xs">Unit Tracking No.</TableHead>}
                    {warrantyVisibleColumns.includes("serialNo") && (
                      <TableHead
                        className="text-xs cursor-pointer hover:bg-gray-50"
                        onClick={() =>
                          setWarrantySort({
                            key: "serialNo",
                            direction:
                              warrantySort.key === "serialNo" &&
                                warrantySort.direction === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Serial No.{" "}
                        {warrantySort.key === "serialNo" &&
                          (warrantySort.direction === "asc" ? "↑" : "↓")}
                      </TableHead>
                    )}
                    {warrantyVisibleColumns.includes("vendorName") && (
                      <TableHead
                        className="text-xs cursor-pointer hover:bg-gray-50"
                        onClick={() =>
                          setWarrantySort({
                            key: "vendorName",
                            direction:
                              warrantySort.key === "vendorName" &&
                                warrantySort.direction === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Vendor Name{" "}
                        {warrantySort.key === "vendorName" &&
                          (warrantySort.direction === "asc" ? "↑" : "↓")}
                      </TableHead>
                    )}
                    {warrantyVisibleColumns.includes("itemName") && (
                      <TableHead
                        className="text-xs cursor-pointer hover:bg-gray-50"
                        onClick={() =>
                          setWarrantySort({
                            key: "itemName",
                            direction:
                              warrantySort.key === "itemName" &&
                                warrantySort.direction === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Item-Name{" "}
                        {warrantySort.key === "itemName" &&
                          (warrantySort.direction === "asc" ? "↑" : "↓")}
                      </TableHead>
                    )}
                    {warrantyVisibleColumns.includes("invoiceDate") && <TableHead className="text-xs">Invoice Date</TableHead>}
                    {warrantyVisibleColumns.includes("warrantyEnd") && <TableHead className="text-xs">Warranty End</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalWarrantyData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={warrantyVisibleColumns.length} className="text-center py-8 text-muted-foreground">
                        No warranty data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    finalWarrantyData.map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        {warrantyVisibleColumns.includes("indentNo") && (
                          <TableCell className="font-medium text-xs">
                            {item.indentNo}
                          </TableCell>
                        )}
                        {warrantyVisibleColumns.includes("liftNo") && <TableCell className="text-xs">{item.liftNo}</TableCell>}
                        {warrantyVisibleColumns.includes("serialNo") && <TableCell className="text-xs">{item.serialNo}</TableCell>}
                        {warrantyVisibleColumns.includes("vendorName") && <TableCell className="text-xs">{item.vendorName}</TableCell>}
                        {warrantyVisibleColumns.includes("itemName") && <TableCell className="text-xs">{item.itemName}</TableCell>}
                        {warrantyVisibleColumns.includes("invoiceDate") && (
                          <TableCell className="text-xs">
                            {formatDate(item.invoiceDate)}
                          </TableCell>
                        )}
                        {warrantyVisibleColumns.includes("warrantyEnd") && (
                          <TableCell className="text-xs">
                            {(() => {
                              const date = new Date(item.warrantyEnd);
                              const today = new Date();
                              const nextMonth = new Date();
                              nextMonth.setMonth(today.getMonth() + 1);

                              const isExpiringSoon = !isNaN(date.getTime()) && date > today && date <= nextMonth;
                              const formattedDate = formatDate(item.warrantyEnd);

                              if (isExpiringSoon) {
                                return (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800 border border-red-200">
                                    {formattedDate}
                                  </span>
                                );
                              }
                              return formattedDate;
                            })()}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Debug - Remove after testing */}
      {formsMenuOpen && (
        <div className="fixed top-0 left-0 bg-red-500 text-white p-2 z-50">
          Modal State: OPEN
        </div>
      )}

      {/* Forms Menu Modal */}
      <Dialog open={formsMenuOpen} onOpenChange={setFormsMenuOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Form Type</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button
              variant="outline"
              className="h-20 flex items-center justify-start gap-4"
              onClick={() => {
                setFormsMenuOpen(false);
                setItemFormOpen(true);
              }}
            >
              <Package className="w-8 h-8 text-blue-600" />
              <div className="text-left">
                <div className="font-semibold">Item Form</div>
                <div className="text-xs text-muted-foreground">
                  Add new item details
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex items-center justify-start gap-4"
              onClick={() => {
                setFormsMenuOpen(false);
                setVendorFormOpen(true);
              }}
            >
              <Users className="w-8 h-8 text-green-600" />
              <div className="text-left">
                <div className="font-semibold">Vendor Form</div>
                <div className="text-xs text-muted-foreground">
                  Add new vendor details
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex items-center justify-start gap-4"
              onClick={() => {
                setFormsMenuOpen(false);
                setTransporterFormOpen(true);
              }}
            >
              <Truck className="w-8 h-8 text-orange-600" />
              <div className="text-left">
                <div className="font-semibold">Transporter Form</div>
                <div className="text-xs text-muted-foreground">
                  Add new transporter details
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Form Modal */}
      <Dialog open={itemFormOpen} onOpenChange={setItemFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setItemFormOpen(false);
              setItemForm({ category: "", itemName: "", uom: "" });
            }}
          >
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={itemForm.category}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, category: e.target.value })
                  }
                  required
                  placeholder="e.g. Electronics, Hardware"
                />
              </div>
              <div>
                <Label htmlFor="itemName">Item Name *</Label>
                <Input
                  id="itemName"
                  value={itemForm.itemName}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, itemName: e.target.value })
                  }
                  required
                  placeholder="e.g. Laptop, Screwdriver"
                />
              </div>
              <div>
                <Label htmlFor="uom">UOM (Unit of Measurement) *</Label>
                <Select
                  value={itemForm.uom}
                  onValueChange={(v) => setItemForm({ ...itemForm, uom: v })}
                >
                  <SelectTrigger id="uom">
                    <SelectValue placeholder="Select UOM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">Pieces (PCS)</SelectItem>
                    <SelectItem value="kg">Kilogram (KG)</SelectItem>
                    <SelectItem value="ltr">Liter (LTR)</SelectItem>
                    <SelectItem value="mtr">Meter (MTR)</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="set">Set</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setItemFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Item</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vendor Form Modal */}
      <Dialog open={vendorFormOpen} onOpenChange={setVendorFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Vendor</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setVendorFormOpen(false);
              setVendorForm({
                vendorName: "",
                contactPerson: "",
                phone: "",
                email: "",
                address: "",
              });
            }}
          >
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="vendorName">Vendor Name *</Label>
                <Input
                  id="vendorName"
                  value={vendorForm.vendorName}
                  onChange={(e) =>
                    setVendorForm({ ...vendorForm, vendorName: e.target.value })
                  }
                  required
                  placeholder="e.g. ABC Suppliers"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contactPerson">Contact Person *</Label>
                  <Input
                    id="contactPerson"
                    value={vendorForm.contactPerson}
                    onChange={(e) =>
                      setVendorForm({
                        ...vendorForm,
                        contactPerson: e.target.value,
                      })
                    }
                    required
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    value={vendorForm.phone}
                    onChange={(e) =>
                      setVendorForm({ ...vendorForm, phone: e.target.value })
                    }
                    required
                    placeholder="e.g. 9876543210"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={vendorForm.email}
                  onChange={(e) =>
                    setVendorForm({ ...vendorForm, email: e.target.value })
                  }
                  placeholder="e.g. vendor@example.com"
                />
              </div>
              <div>
                <Label htmlFor="address">Address *</Label>
                <textarea
                  id="address"
                  value={vendorForm.address}
                  onChange={(e) =>
                    setVendorForm({ ...vendorForm, address: e.target.value })
                  }
                  required
                  rows={3}
                  className="w-full px-3 py-2 border rounded resize-none"
                  placeholder="Enter complete address"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setVendorFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Vendor</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transporter Form Modal */}
      <Dialog open={transporterFormOpen} onOpenChange={setTransporterFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Transporter</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setTransporterFormOpen(false);
              setTransporterForm({
                transporterName: "",
                contactPerson: "",
                phone: "",
                vehicleType: "",
              });
            }}
          >
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="transporterName">Transporter Name *</Label>
                <Input
                  id="transporterName"
                  value={transporterForm.transporterName}
                  onChange={(e) =>
                    setTransporterForm({
                      ...transporterForm,
                      transporterName: e.target.value,
                    })
                  }
                  required
                  placeholder="e.g. Fast Logistics"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="transporterContact">Contact Person *</Label>
                  <Input
                    id="transporterContact"
                    value={transporterForm.contactPerson}
                    onChange={(e) =>
                      setTransporterForm({
                        ...transporterForm,
                        contactPerson: e.target.value,
                      })
                    }
                    required
                    placeholder="e.g. Jane Smith"
                  />
                </div>
                <div>
                  <Label htmlFor="transporterPhone">Phone *</Label>
                  <Input
                    id="transporterPhone"
                    value={transporterForm.phone}
                    onChange={(e) =>
                      setTransporterForm({
                        ...transporterForm,
                        phone: e.target.value,
                      })
                    }
                    required
                    placeholder="e.g. 9876543210"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="vehicleType">Vehicle Type *</Label>
                <Select
                  value={transporterForm.vehicleType}
                  onValueChange={(v) =>
                    setTransporterForm({ ...transporterForm, vehicleType: v })
                  }
                >
                  <SelectTrigger id="vehicleType">
                    <SelectValue placeholder="Select Vehicle Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="trailer">Trailer</SelectItem>
                    <SelectItem value="container">Container</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTransporterFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Transporter</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
