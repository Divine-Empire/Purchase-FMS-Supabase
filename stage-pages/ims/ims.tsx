"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, RefreshCw, AlertCircle, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ImsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    group: "All",
    category: "All",
    itemSearch: ""
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ims?_t=${Date.now()}`);
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        setData(result.data);
      } else {
        throw new Error(result.error || "Failed to fetch IMS data");
      }
    } catch (err: any) {
      console.error("IMS Fetch Error:", err);
      setError(err.message);
      toast.error("Failed to load IMS data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const exportToExcel = () => {
    if (filteredData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "Group",
      "Category",
      "Item Code",
      "Name of Item",
      "CG",
      "NE",
      "Maniquip",
      "Head Office"
    ];

    const csvContent = [
      headers.join(","),
      ...filteredData.map((row) => {
        const group = row.group !== undefined ? `"${String(row.group).replace(/"/g, '""')}"` : "";
        const category = row.category !== undefined ? `"${String(row.category).replace(/"/g, '""')}"` : "";
        const itemCode = row.itemCode !== undefined ? `"${String(row.itemCode).replace(/"/g, '""')}"` : "";
        const itemName = row.itemName !== undefined ? `"${String(row.itemName).replace(/"/g, '""')}"` : "";
        const cg = row.cg !== null ? String(row.cg) : "0";
        const ne = row.ne !== null ? String(row.ne) : "0";
        const maniquip = row.maniquip !== null ? String(row.maniquip) : "0";
        const headOffice = row.headOffice !== null ? String(row.headOffice) : "0";
        
        return [
          group,
          category,
          itemCode,
          itemName,
          cg,
          ne,
          maniquip,
          headOffice
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `IMS_Stock_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Excel report exported successfully");
  };

  // Extract unique filters from data dynamically
  const uniqueGroups = useMemo(() => {
    const list = data.map((row) => row.group?.trim()).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [data]);

  const uniqueCategories = useMemo(() => {
    const list = data.map((row) => row.category?.trim()).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [data]);

  // Filtering Logic
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      const matchGroup =
        filters.group === "All" ||
        (row.group || "").trim() === filters.group;
      const matchCategory =
        filters.category === "All" ||
        (row.category || "").trim() === filters.category;
      
      const searchLower = filters.itemSearch.toLowerCase().trim();
      const matchSearch =
        !searchLower ||
        (row.itemCode || "").toLowerCase().includes(searchLower) ||
        (row.itemName || "").toLowerCase().includes(searchLower);
        
      return matchGroup && matchCategory && matchSearch;
    });
  }, [data, filters]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-slate-800" />
        <p className="text-slate-900 font-semibold animate-pulse">Fetching Stock Analysis Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-300 bg-red-50/50">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
            <AlertCircle className="w-12 h-12 text-red-650" />
            <div className="text-center">
              <h3 className="text-lg font-bold text-red-950">Error Loading Data</h3>
              <p className="text-sm text-slate-700 mt-1 font-semibold">{error}</p>
            </div>
            <Button variant="outline" onClick={fetchData} className="mt-2 border-slate-350 hover:bg-slate-100 font-bold">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-5 animate-in fade-in duration-500 max-w-7xl mx-auto h-[calc(100vh-2rem)] overflow-hidden">
      {/* Header & Filter Controls Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-blue-600 rounded-full" />
          <h2 className="text-xl font-extrabold text-slate-900 tracking-wider uppercase font-sans">
            Stock Analysis
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 flex-grow md:flex-grow-0 justify-end">
          {/* Group Filter */}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Group</span>
            <select
              className="bg-transparent border-none text-xs font-extrabold text-slate-800 focus:ring-0 outline-none cursor-pointer min-w-[125px]"
              value={filters.group}
              onChange={(e) => setFilters((prev) => ({ ...prev, group: e.target.value }))}
            >
              <option value="All">All Groups</option>
              {uniqueGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category</span>
            <select
              className="bg-transparent border-none text-xs font-extrabold text-slate-800 focus:ring-0 outline-none cursor-pointer max-w-[200px]"
              value={filters.category}
              onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
            >
              <option value="All">All Categories</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Item Filter (Search Input) */}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Item</span>
            <input
              type="text"
              placeholder="Search Code or Name..."
              className="bg-transparent border-none text-xs font-extrabold text-slate-800 focus:ring-0 outline-none w-44 placeholder-slate-400"
              value={filters.itemSearch}
              onChange={(e) => setFilters((prev) => ({ ...prev, itemSearch: e.target.value }))}
            />
          </div>

          {/* Items Found Badge */}
          <div className="bg-[#E6F4EA] text-[#137333] border border-emerald-250/20 font-extrabold rounded-full px-4 py-1.5 text-[11px] tracking-wider uppercase shadow-xs">
            {filteredData.length} Items Found
          </div>
        </div>
      </div>

      {/* Toolbar / Actions */}
      <div className="flex items-center justify-between shrink-0 bg-slate-50 border border-slate-350 rounded-lg p-2.5">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          <span className="text-xs font-bold text-slate-700">Stock Inventory Database</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={exportToExcel}
            size="sm"
            className="bg-white hover:bg-slate-100 border-slate-350 text-slate-900 font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>
          <Button
            variant="outline"
            onClick={fetchData}
            size="sm"
            className="bg-white hover:bg-slate-100 border-slate-350 text-slate-900 font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Table Container Card */}
      <Card className="border border-slate-350 shadow-xs bg-white overflow-hidden flex-grow flex flex-col min-h-0">
        <CardContent className="p-0 flex-grow flex flex-col overflow-hidden min-h-0">
          <div className="flex-grow overflow-auto relative">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100">
                  <th colSpan={4} className="px-4 py-3 text-left text-xs font-extrabold text-slate-700 border-r border-slate-300 uppercase tracking-wider bg-slate-50 select-none">
                    Item Details
                  </th>
                  <th rowSpan={2} className="bg-[#0B3C5D] text-white text-center font-bold px-3 py-4 w-44 border-r border-white/20 align-top">
                    <div className="text-sm tracking-wider font-extrabold">CG</div>
                    <div className="text-[9.5px] leading-tight font-bold text-blue-200 mt-2 font-sans select-none uppercase tracking-wide">
                      Reorder Quantity<br/>= Max Level - Live<br/>Stock - Indent Raised
                    </div>
                  </th>
                  <th rowSpan={2} className="bg-[#1D0C30] text-white text-center font-bold px-3 py-4 w-44 border-r border-white/20 align-top">
                    <div className="text-sm tracking-wider font-extrabold">NE</div>
                    <div className="text-[9.5px] leading-tight font-bold text-purple-200 mt-2 font-sans select-none uppercase tracking-wide">
                      Reorder Quantity<br/>= Max Level - Live<br/>Stock - Indent Raised
                    </div>
                  </th>
                  <th rowSpan={2} className="bg-[#5D001E] text-white text-center font-bold px-3 py-4 w-44 border-r border-white/20 align-top">
                    <div className="text-sm tracking-wider font-extrabold">Maniquip</div>
                    <div className="text-[9.5px] leading-tight font-bold text-red-200 mt-2 font-sans select-none uppercase tracking-wide">
                      Reorder Quantity<br/>= Max Level - Live Stock<br/>- Indent Raised
                    </div>
                  </th>
                  <th rowSpan={2} className="bg-[#005B54] text-white text-center font-bold px-3 py-4 w-44 align-top">
                    <div className="text-sm tracking-wider font-extrabold">Head Office</div>
                    <div className="text-[9.5px] leading-tight font-bold text-teal-200 mt-2 font-sans select-none uppercase tracking-wide">
                      Reorder Quantity<br/>= Max Level - Live<br/>Stock - Indent Raised
                    </div>
                  </th>
                </tr>
                <tr className="border-b border-slate-300 bg-slate-50">
                  <th className="px-4 py-2 text-left text-[11px] font-extrabold text-slate-600 border-r border-slate-300 uppercase tracking-wider select-none bg-slate-100">Group</th>
                  <th className="px-4 py-2 text-left text-[11px] font-extrabold text-slate-600 border-r border-slate-300 uppercase tracking-wider select-none bg-slate-100">Category</th>
                  <th className="px-4 py-2 text-left text-[11px] font-extrabold text-slate-600 border-r border-slate-300 uppercase tracking-wider select-none bg-slate-100">Item Code</th>
                  <th className="px-4 py-2 text-left text-[11px] font-extrabold text-slate-600 border-r border-slate-300 uppercase tracking-wider select-none bg-slate-100">Name of Item</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="h-40 text-center text-slate-500 font-bold text-sm bg-slate-50/50">
                      No matching records found
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="border-r border-slate-200 text-xs px-4 py-2.5 font-bold text-slate-900 font-mono">
                        {row.group || "-"}
                      </td>
                      <td className="border-r border-slate-200 text-xs px-4 py-2.5 font-semibold text-slate-800">
                        {row.category || "-"}
                      </td>
                      <td className="border-r border-slate-200 text-xs px-4 py-2.5 font-bold text-slate-900 font-mono">
                        {row.itemCode || "-"}
                      </td>
                      <td className="border-r border-slate-200 text-xs px-4 py-2.5 font-bold text-slate-900 truncate max-w-[280px]" title={row.itemName}>
                        {row.itemName || "-"}
                      </td>
                      
                      {/* Calculated locations */}
                      <td className="border-r border-slate-200 text-xs px-4 py-2.5 text-center font-bold font-mono">
                        <span className={row.cg < 0 ? "text-red-600" : "text-green-600"}>
                          {row.cg}
                        </span>
                      </td>
                      <td className="border-r border-slate-200 text-xs px-4 py-2.5 text-center font-bold font-mono">
                        <span className={row.ne < 0 ? "text-red-600" : "text-green-600"}>
                          {row.ne}
                        </span>
                      </td>
                      <td className="border-r border-slate-200 text-xs px-4 py-2.5 text-center font-bold font-mono">
                        <span className={row.maniquip < 0 ? "text-red-600" : "text-green-600"}>
                          {row.maniquip}
                        </span>
                      </td>
                      <td className="text-xs px-4 py-2.5 text-center font-bold font-mono">
                        <span className={row.headOffice < 0 ? "text-red-600" : "text-green-600"}>
                          {row.headOffice}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
        <div className="bg-slate-100 px-4 py-3 border-t border-slate-350 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-700 font-bold">Showing: {filteredData.length} records</p>
          <p className="text-[11px] text-slate-800 font-bold italic">Powered by Botivate Inventory Engine</p>
        </div>
      </Card>
    </div>
  );
}
