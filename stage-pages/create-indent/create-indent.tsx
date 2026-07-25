"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useWorkflow } from "@/lib/workflow-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Search, PlusCircle, ClipboardList, History as HistoryIcon, Loader2 } from "lucide-react";
import { parseSheetDate, cn } from "@/lib/utils";
import CreateIndentPending from "./create-indent-pending";
import CreateIndentHistory from "./create-indent-history";

export default function Stage1() {
  const { setIndentCounter } = useWorkflow();

  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [openCreateModal, setOpenCreateModal] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/create-indent?_t=${Date.now()}`);
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

  const matchesSearch = (r: any) => {
    const searchLower = searchTerm.toLowerCase();
    const indNum = r.data.indentNumber || "";
    const iName = r.data.itemName || "";
    const qty = r.data.quantity ? r.data.quantity.toString() : "";
    const vType = r.data.vendorType || "";

    return (
      indNum.toLowerCase().includes(searchLower) ||
      iName.toLowerCase().includes(searchLower) ||
      qty.toLowerCase().includes(searchLower) ||
      vType.toLowerCase().includes(searchLower)
    );
  };

  const pending = useMemo(() =>
    sheetRecords
      .filter((r) => r.status === "pending")
      .filter(matchesSearch)
    , [sheetRecords, searchTerm]);

  const history = useMemo(() =>
    sheetRecords
      .filter((r) => r.status === "completed")
      .filter(matchesSearch)
    , [sheetRecords, searchTerm]);

  return (
    <div className="p-6 h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
      {/* Header Card */}
      <div className="mb-6 p-6 bg-gradient-to-r from-indigo-50/50 via-blue-50/20 to-white border border-indigo-100/60 rounded-xl shadow-xs shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg shadow-indigo-100 shadow-xl text-white">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-indigo-950 tracking-tight">Stage 1: Create Indent</h2>
            </div>
          </div>

          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-indigo-500" />
            <Input
              placeholder="Search by Indent No, Item Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white border-indigo-100 focus-visible:ring-indigo-500"
            />
          </div>

          {activeTab === "pending" && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button
                onClick={() => setOpenCreateModal(true)}
                className="px-6 h-11 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-md shadow-indigo-200 transition-all rounded-lg text-white font-bold"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Create Indent
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-black" />
          <p className="text-lg animate-pulse text-black font-medium">Loading records...</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-indigo-50/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1.5 border border-indigo-100/50 w-[420px] shadow-2xs">
            <TabsTrigger
              value="pending"
              className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-3 transition-all cursor-pointer text-slate-700"
            >
              <ClipboardList className="w-5 h-5 opacity-80" />
              <div className="flex flex-col items-start leading-none gap-1 text-left">
                <span className="font-bold">Pending</span>
                <span className="text-[10px] opacity-70 font-medium">Awaiting processing</span>
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
                {history.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-0 outline-none flex-1 flex flex-col overflow-hidden">
            <CreateIndentPending
              pending={pending}
              fetchData={fetchData}
              openCreateModal={openCreateModal}
              setOpenCreateModal={setOpenCreateModal}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-0 outline-none flex-1 flex flex-col overflow-hidden">
            <CreateIndentHistory history={history} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
