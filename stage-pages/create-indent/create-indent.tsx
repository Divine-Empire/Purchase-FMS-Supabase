"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useWorkflow } from "@/lib/workflow-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Search, PlusCircle, ClipboardList, History as HistoryIcon, Loader2 } from "lucide-react";
import { parseSheetDate } from "@/lib/utils";
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
      <div className="mb-6 p-6 bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-lg shadow-slate-100 shadow-xl text-white">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage 1: Create Indent</h2>
            </div>
          </div>

          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search by Indent No, Item Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>

          {activeTab === "pending" && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button
                onClick={() => setOpenCreateModal(true)}
                className="px-6 h-11 bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-100 transition-all rounded-lg text-white font-semibold"
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
          <TabsList className="bg-slate-100/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1 border border-slate-200/50">
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
              <HistoryIcon className="w-5 h-5" />
              <div className="flex flex-col items-start leading-none gap-1">
                <span className="font-bold">History</span>
                <span className="text-[10px] opacity-70">Completed records</span>
              </div>
              <Badge variant="secondary" className="bg-slate-100 text-black border-slate-200 px-2">
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
