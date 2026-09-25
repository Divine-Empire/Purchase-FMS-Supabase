"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, AlertCircle, Download, Search } from "lucide-react";
import { toast } from "sonner";

interface Balance {
  item_key: string;
  item_name: string;
  item_code: string | null;
  category: string | null;
  group_name: string | null;
  location_code: string;
  location_label: string;
  balance: number;
  max_level: number | null;
}

// Same UI/shape as OTP_Supabase's own /inventory page (that's where this
// data actually lives and gets written — see app/api/ims/route.ts) — just
// read-only here, with Export CSV instead of the CSV import controls.
export default function ImsPage() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ims?_t=${Date.now()}`);
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        setBalances(result.data);
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

  const groupOptions = useMemo(
    () => Array.from(new Set(balances.map((b) => b.group_name).filter((v): v is string => !!v))).sort(),
    [balances]
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set(balances.map((b) => b.category).filter((v): v is string => !!v))).sort(),
    [balances]
  );
  const locationOptions = useMemo(
    () => Array.from(new Set(balances.map((b) => b.location_label).filter((v): v is string => !!v))).sort(),
    [balances]
  );

  const filteredBalances = useMemo(() => {
    return balances.filter((b) => {
      if (groupFilter !== "all" && b.group_name !== groupFilter) return false;
      if (categoryFilter !== "all" && b.category !== categoryFilter) return false;
      if (locationFilter !== "all" && b.location_label !== locationFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const haystack = `${b.item_name} ${b.item_code || ""} ${b.group_name || ""} ${b.category || ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [balances, groupFilter, categoryFilter, locationFilter, searchTerm]);

  const exportToCsv = () => {
    if (filteredBalances.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = ["Group", "Category", "Item Code", "Item Name", "Location", "Balance", "Max Level"];
    const csvContent = [
      headers.join(","),
      ...filteredBalances.map((b) =>
        [
          `"${(b.group_name || "").replace(/"/g, '""')}"`,
          `"${(b.category || "").replace(/"/g, '""')}"`,
          `"${(b.item_code || "").replace(/"/g, '""')}"`,
          `"${b.item_name.replace(/"/g, '""')}"`,
          `"${b.location_label.replace(/"/g, '""')}"`,
          String(b.balance),
          b.max_level ?? "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `IMS_Stock_Report_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Report exported successfully");
  };

  if (error && !loading) {
    return (
      <div className="p-6">
        <Card className="border-red-300 bg-red-50/50">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
            <AlertCircle className="w-12 h-12 text-red-650" />
            <div className="text-center">
              <h3 className="text-lg font-bold text-red-950">Error Loading Data</h3>
              <p className="text-sm text-slate-700 mt-1 font-semibold">{error}</p>
            </div>
            <Button variant="outline" onClick={fetchData} className="mt-2">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Current Stock Balance</CardTitle>
              <CardDescription>Live from IMS (all IN/OUT recorded so far)</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search item, code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-80"
                />
              </div>
              <Button size="sm" variant="outline" onClick={exportToCsv} className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button size="sm" variant="outline" onClick={fetchData} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {groupOptions.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoryOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locationOptions.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Group</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Max Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBalances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {balances.length === 0 ? "No stock recorded yet" : "No rows match the current filters"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBalances.map((b, i) => (
                      <TableRow key={i}>
                        <TableCell>{b.group_name || ""}</TableCell>
                        <TableCell>{b.category || ""}</TableCell>
                        <TableCell>{b.item_name}</TableCell>
                        <TableCell>{b.item_code || ""}</TableCell>
                        <TableCell>{b.location_label}</TableCell>
                        <TableCell className={`text-right font-medium ${b.balance < 0 ? "text-destructive" : ""}`}>
                          {b.balance}
                        </TableCell>
                        <TableCell className="text-right">{b.max_level ?? ""}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
