"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Database,
  Plus,
  Trash2,
  Search,
  Loader2,
  X,
  FileSpreadsheet,
  Users,
  Settings,
  UserCheck,
  Clock,
  Timer,
  UserCircle2,
  CalendarOff,
  Pencil,
  ChevronsUpDown,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { cn, minutesToDHM, dhmToMinutes, formatDurationShort } from "@/lib/utils";

const DROPDOWN_COLUMNS = [
  { key: "Created By", label: "Created By", fieldName: "createdByOptions" },
  { key: "Wharehouse", label: "Warehouse", fieldName: "warehouseOptions" },
  { key: "UOM", label: "UOM", fieldName: "uomOptions" },
  { key: "Payment Terms (Stage3)", label: "Payment Terms (Stage 3)", fieldName: "paymentTermsOptions" },
  { key: "Approved By", label: "Approved By", fieldName: "approvedByOptions" },
  { key: "Transporter", label: "Transporter", fieldName: "transporterOptions" },
  { key: "Purchaser", label: "Purchaser", fieldName: "purchaserOptions" },
  { key: "Accounts", label: "Accounts", fieldName: "accountsOptions" },
  { key: "Engineers", label: "Engineers", fieldName: "engineersOptions" },
  { key: "Responsible Person", label: "Responsible Person", fieldName: "responsiblePersonOptions" },
  { key: "QC-Checklist", label: "QC Checklist", fieldName: "qcChecklistOptions" },
  { key: "Reject Type (QC)", label: "Reject Type (QC)", fieldName: "rejectTypeQcOptions" },
];



interface ItemRecord {
  id: string;
  itemCode: string;
  category: string;
  itemName: string;
  purchaser?: string;
}

// Type-to-filter picker for a long options list (Item/Vendor Master can run into the
// thousands) — filters client-side against the already-fetched `options` array, but only
// ever renders the first SEARCH_SELECT_RENDER_LIMIT matches, so the popup never has to mount
// thousands of rows at once the way a plain <select> or an unbounded Command list would.
const SEARCH_SELECT_RENDER_LIMIT = 50;

function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  searchPlaceholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    return base.slice(0, SEARCH_SELECT_RENDER_LIMIT);
  }, [options, search]);

  const selected = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-9 flex-grow justify-between text-xs font-semibold border-slate-350",
            !selected && "text-slate-500 font-medium"
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} className="text-xs" />
          <CommandList>
            <CommandEmpty className="py-3 px-4 text-xs text-slate-500">No match — try a different search.</CommandEmpty>
            <CommandGroup>
              {filtered.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.id}
                  onSelect={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check className={cn("mr-2 h-3.5 w-3.5", value === o.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {options.length > filtered.length && (
              <div className="px-3 py-1.5 text-[10.5px] text-slate-400 border-t border-slate-100">
                Showing {filtered.length} of {options.length} — keep typing to narrow it down.
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface VendorRecord {
  id: string;
  vendorCode: string;
  vendorName: string;
}

export default function DropdownsMaster() {
  const { role, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  // Controlled active tab state
  const [activeTab, setActiveTab] = useState<string>("dropdowns");

  // Search terms
  const [dropdownSearchTerms, setDropdownSearchTerms] = useState<Record<string, string>>({});
  const [itemsSearch, setItemsSearch] = useState("");
  const [vendorsSearch, setVendorsSearch] = useState("");
  const [responsibleSearch, setResponsibleSearch] = useState("");
  const [holidaySearch, setHolidaySearch] = useState("");

  // Modals for Responsible Persons, Items & Vendors
  const [openRespModal, setOpenRespModal] = useState(false);
  const [editingResp, setEditingResp] = useState({
    id: "",
    stageName: "",
    days: 0,
    hours: 0,
    minutes: 60,
    responsiblePersons: [] as string[],
  });
  const [isSavingResp, setIsSavingResp] = useState(false);
  const [itemsPage, setItemsPage] = useState(1);
  const [vendorsPage, setVendorsPage] = useState(1);
  const pageSize = 50;

  // UI States
  const [addingToCol, setAddingToCol] = useState<string | null>(null);
  const [newValueMap, setNewValueMap] = useState<Record<string, string>>({});

  // Modals for Items & Vendors
  const [openItemModal, setOpenItemModal] = useState(false);
  const [newItem, setNewItem] = useState({ itemCode: "", category: "", itemName: "", purchaser: "" });
  const [addItemError, setAddItemError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [manualCategory, setManualCategory] = useState("");

  // Edit Item Modal
  const [openEditItemModal, setOpenEditItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState({ id: "", itemCode: "", category: "", itemName: "", purchaser: "" });
  const [editSelectedCategory, setEditSelectedCategory] = useState("");
  const [editManualCategory, setEditManualCategory] = useState("");
  const [isSavingItem, setIsSavingItem] = useState(false);

  const [openVendorModal, setOpenVendorModal] = useState(false);
  const [newVendor, setNewVendor] = useState({ vendorCode: "", vendorName: "" });
  const [addVendorError, setAddVendorError] = useState("");

  // Edit Vendor Modal
  const [openEditVendorModal, setOpenEditVendorModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState({ id: "", vendorCode: "", vendorName: "" });
  const [isSavingVendor, setIsSavingVendor] = useState(false);

  // Modal for Holidays (add/edit)
  const [openHolidayModal, setOpenHolidayModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState({ id: "", date: "", name: "" });
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);

  // Mismatch-fix tool: item/vendor names used on real indents that don't match anything
  // currently in Master (typos, or names entered before the "select only" restriction).
  // Lets an admin remap every affected indent/negotiation row to a real Master entry in one go.
  const [openMismatchModal, setOpenMismatchModal] = useState<"items" | "vendors" | null>(null);
  const [mismatchData, setMismatchData] = useState<{
    unmatchedItems: { name: string; indentNos: string[]; count: number }[];
    totalUnmatchedItems: number;
    unmatchedVendors: { name: string; indentNos: string[]; count: number }[];
    totalUnmatchedVendors: number;
  }>({ unmatchedItems: [], totalUnmatchedItems: 0, unmatchedVendors: [], totalUnmatchedVendors: 0 });
  const [isLoadingMismatch, setIsLoadingMismatch] = useState(false);
  const [remapSelections, setRemapSelections] = useState<Record<string, string>>({});
  const [applyingRemapFor, setApplyingRemapFor] = useState<string | null>(null);

  const fetchMismatchReport = async () => {
    setIsLoadingMismatch(true);
    try {
      const res = await fetch("/api/dropdowns?report=mismatches");
      const json = await res.json();
      if (json.success) {
        setMismatchData({
          unmatchedItems: json.unmatchedItems || [],
          totalUnmatchedItems: json.totalUnmatchedItems ?? (json.unmatchedItems || []).length,
          unmatchedVendors: json.unmatchedVendors || [],
          totalUnmatchedVendors: json.totalUnmatchedVendors ?? (json.unmatchedVendors || []).length,
        });
      } else {
        toast.error(json.error || "Failed to load mismatch report");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load mismatch report");
    } finally {
      setIsLoadingMismatch(false);
    }
  };

  const openMismatchTool = (which: "items" | "vendors") => {
    setOpenMismatchModal(which);
    setRemapSelections({});
    fetchMismatchReport();
  };

  const handleApplyItemRename = async (fromName: string) => {
    const toItemId = remapSelections[fromName];
    if (!toItemId) {
      toast.error("Pick which Item Master entry this should map to first");
      return;
    }
    setApplyingRemapFor(fromName);
    try {
      const res = await fetch("/api/dropdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "renameItem", fromName, toItemId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Fixed ${json.updatedCount} indent${json.updatedCount === 1 ? "" : "s"}`);
        fetchMismatchReport();
      } else {
        toast.error(json.error || "Failed to remap item");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to remap item");
    } finally {
      setApplyingRemapFor(null);
    }
  };

  const handleApplyVendorRename = async (fromName: string) => {
    const toVendorId = remapSelections[fromName];
    if (!toVendorId) {
      toast.error("Pick which Vendor Master entry this should map to first");
      return;
    }
    setApplyingRemapFor(fromName);
    try {
      const res = await fetch("/api/dropdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "renameVendor", fromName, toVendorId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Fixed ${json.updatedCount} negotiation(s), ${json.updatedVendorSlots} vendor slot(s)`);
        fetchMismatchReport();
      } else {
        toast.error(json.error || "Failed to remap vendor");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to remap vendor");
    } finally {
      setApplyingRemapFor(null);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dropdowns?_t=${Date.now()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        toast.error("Failed to load options");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("An error occurred loading dropdown options");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role?.toUpperCase() === "ADMIN") {
      fetchData();
    }
  }, [role]);

  // Reset pagination to page 1 on search change
  useEffect(() => {
    setItemsPage(1);
  }, [itemsSearch]);

  useEffect(() => {
    setVendorsPage(1);
  }, [vendorsSearch]);

  // Extract unique sorted categories from existing items
  const existingCategories = useMemo(() => {
    const itemsList: ItemRecord[] = data.items || [];
    const cats = itemsList.map((item) => item.category?.trim()).filter(Boolean);
    return Array.from(new Set(cats)).sort();
  }, [data.items]);

  // Filters with Reverse Sorting (Newest/Latest items or vendors at the top)
  const filteredItems = useMemo(() => {
    const rawList: ItemRecord[] = data.items || [];
    // Reverse the list so newly inserted items appear first
    const itemsList = [...rawList].reverse();

    if (!itemsSearch.trim()) return itemsList;
    const lower = itemsSearch.toLowerCase();
    return itemsList.filter(
      (item) =>
        (item.itemCode || "").toLowerCase().includes(lower) ||
        (item.category || "").toLowerCase().includes(lower) ||
        (item.itemName || "").toLowerCase().includes(lower)
    );
  }, [data.items, itemsSearch]);

  const filteredVendors = useMemo(() => {
    const rawList: VendorRecord[] = data.vendors || [];
    // Reverse the list so newly inserted vendors appear first
    const vendorsList = [...rawList].reverse();

    if (!vendorsSearch.trim()) return vendorsList;
    const lower = vendorsSearch.toLowerCase();
    return vendorsList.filter(
      (vendor) =>
        (vendor.vendorCode || "").toLowerCase().includes(lower) ||
        (vendor.vendorName || "").toLowerCase().includes(lower)
    );
  }, [data.vendors, vendorsSearch]);

  const filteredHolidays = useMemo(() => {
    const list = data.holidays || [];
    const search = holidaySearch.toLowerCase().trim();
    if (!search) return list;
    return list.filter(
      (h: any) =>
        (h.name || "").toLowerCase().includes(search) ||
        (h.day || "").toLowerCase().includes(search) ||
        (h.date || "").toLowerCase().includes(search)
    );
  }, [data.holidays, holidaySearch]);

  const getFilteredOptions = (fieldName: string, colKey: string) => {
    const list: string[] = data[fieldName] || [];
    const search = dropdownSearchTerms[colKey] || "";
    if (!search.trim()) return list;
    return list.filter((opt) => opt.toLowerCase().includes(search.toLowerCase()));
  };

  // Pagination Computations
  const totalItemsPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (itemsPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, itemsPage]);

  const totalVendorsPages = Math.ceil(filteredVendors.length / pageSize) || 1;
  const paginatedVendors = useMemo(() => {
    const start = (vendorsPage - 1) * pageSize;
    return filteredVendors.slice(start, start + pageSize);
  }, [filteredVendors, vendorsPage]);

  // Actions - Options
  const handleAddOption = async (column: string) => {
    const val = newValueMap[column]?.trim();
    if (!val) {
      toast.error("Please enter a value");
      return;
    }

    // Duplicate Check
    const colConfig = DROPDOWN_COLUMNS.find((c) => c.key === column);
    if (colConfig) {
      const existingOptions: string[] = data[colConfig.fieldName] || [];
      const isDuplicate = existingOptions.some(
        (opt) => opt.trim().toLowerCase() === val.toLowerCase()
      );
      if (isDuplicate) {
        toast.warning(`Option "${val}" already exists in "${colConfig.label}".`);
        return;
      }
    }

    try {
      const res = await fetch("/api/dropdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addDropdownOption",
          column,
          value: val,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Option added to "${column}" successfully`);
        setNewValueMap((prev) => ({ ...prev, [column]: "" }));
        setAddingToCol(null);
        fetchData();
      } else {
        toast.error(json.error || "Failed to add option");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to add option");
    }
  };

  const handleDeleteOption = async (column: string, value: string) => {
    if (!window.confirm(`Are you sure you want to delete "${value}" from "${column}"?`)) {
      return;
    }

    try {
      const res = await fetch(
        `/api/dropdowns?action=deleteDropdownOption&column=${encodeURIComponent(
          column
        )}&value=${encodeURIComponent(value)}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (json.success) {
        toast.success(`Option deleted from "${column}"`);
        fetchData();
      } else {
        toast.error(json.error || "Failed to delete option");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete option");
    }
  };

  // Actions - Items
  const handleAddItem = async () => {
    setAddItemError("");

    // Determine the category name based on selection
    const finalCategory = selectedCategory === "OTHER" ? manualCategory.trim() : selectedCategory.trim();

    if (!finalCategory || !newItem.itemName.trim()) {
      setAddItemError("Category and Item Name are required.");
      return;
    }

    if (!newItem.itemCode.trim()) {
      setAddItemError("Item Code is required.");
      return;
    }

    // Duplicate Check: Category & Item Name combination
    const existingItems: ItemRecord[] = data.items || [];
    const isDuplicate = existingItems.some(
      (item) =>
        item.itemName.trim().toLowerCase() === newItem.itemName.trim().toLowerCase() &&
        item.category.trim().toLowerCase() === finalCategory.toLowerCase()
    );

    if (isDuplicate) {
      setAddItemError(`Item "${newItem.itemName}" already exists under category "${finalCategory}".`);
      return;
    }

    // Duplicate Check: Item Code
    const isCodeDuplicate = existingItems.some(
      (item) =>
        item.itemCode &&
        item.itemCode.trim().toLowerCase() === newItem.itemCode.trim().toLowerCase()
    );
    if (isCodeDuplicate) {
      setAddItemError(`Item code "${newItem.itemCode}" is already assigned to another item.`);
      return;
    }

    try {
      const res = await fetch("/api/dropdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addItem",
          itemCode: newItem.itemCode,
          category: finalCategory,
          itemName: newItem.itemName,
          purchaser: newItem.purchaser,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Item added successfully");
        setNewItem({ itemCode: "", category: "", itemName: "", purchaser: "" });
        setSelectedCategory("");
        setManualCategory("");
        setAddItemError("");
        setOpenItemModal(false);
        // Reset to page 1 to see the new item immediately at the top
        setItemsPage(1);
        fetchData();
      } else {
        // Server also runs the duplicate check (findItemDuplicate) — surface its message
        // inline the same way, in case the client's already-loaded list was stale.
        setAddItemError(json.error || "Failed to add item");
      }
    } catch (err) {
      console.error(err);
      setAddItemError("Failed to add item");
    }
  };

  const handleOpenEditItem = (item: ItemRecord) => {
    setEditingItem({
      id: item.id,
      itemCode: item.itemCode || "",
      category: item.category || "",
      itemName: item.itemName || "",
      purchaser: item.purchaser || "",
    });
    // Pre-select the existing category if it's a known one, else fall back to manual entry
    if (item.category && existingCategories.includes(item.category)) {
      setEditSelectedCategory(item.category);
      setEditManualCategory("");
    } else {
      setEditSelectedCategory("OTHER");
      setEditManualCategory(item.category || "");
    }
    setOpenEditItemModal(true);
  };

  const handleSaveEditItem = async () => {
    const finalCategory = editSelectedCategory === "OTHER" ? editManualCategory.trim() : editSelectedCategory.trim();

    if (!finalCategory || !editingItem.itemName.trim()) {
      toast.error("Category and Item Name are required");
      return;
    }

    setIsSavingItem(true);
    try {
      const res = await fetch("/api/dropdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateItem",
          id: editingItem.id,
          itemCode: editingItem.itemCode,
          category: finalCategory,
          itemName: editingItem.itemName,
          purchaser: editingItem.purchaser,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Item updated successfully");
        setOpenEditItemModal(false);
        fetchData();
      } else {
        toast.error(json.error || "Failed to update item");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update item");
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete item "${name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/dropdowns?action=deleteItem&id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Item deleted successfully");
        fetchData();
      } else {
        toast.error(json.error || "Failed to delete item");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete item");
    }
  };

  // Actions - Vendors
  const handleAddVendor = async () => {
    setAddVendorError("");

    if (!newVendor.vendorName.trim()) {
      setAddVendorError("Vendor Name is required.");
      return;
    }

    if (!newVendor.vendorCode.trim()) {
      setAddVendorError("Vendor Code is required.");
      return;
    }

    // Duplicate Check: Vendor Name
    const existingVendors: VendorRecord[] = data.vendors || [];
    const isDuplicate = existingVendors.some(
      (vendor) => vendor.vendorName.trim().toLowerCase() === newVendor.vendorName.trim().toLowerCase()
    );

    if (isDuplicate) {
      setAddVendorError(`Vendor "${newVendor.vendorName}" already exists.`);
      return;
    }

    // Duplicate Check: Vendor Code
    const isCodeDuplicate = existingVendors.some(
      (vendor) =>
        vendor.vendorCode &&
        vendor.vendorCode.trim().toLowerCase() === newVendor.vendorCode.trim().toLowerCase()
    );
    if (isCodeDuplicate) {
      setAddVendorError(`Vendor code "${newVendor.vendorCode}" is already assigned to another vendor.`);
      return;
    }

    try {
      const res = await fetch("/api/dropdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addVendor",
          vendorCode: newVendor.vendorCode,
          vendorName: newVendor.vendorName,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Vendor added successfully");
        setNewVendor({ vendorCode: "", vendorName: "" });
        setAddVendorError("");
        setOpenVendorModal(false);
        // Reset page to 1 to see the new vendor at the top
        setVendorsPage(1);
        fetchData();
      } else {
        // Server also runs the duplicate check (findVendorDuplicate) — surface its message
        // inline the same way, in case the client's already-loaded list was stale.
        setAddVendorError(json.error || "Failed to add vendor");
      }
    } catch (err) {
      console.error(err);
      setAddVendorError("Failed to add vendor");
    }
  };

  const handleOpenEditVendor = (vendor: VendorRecord) => {
    setEditingVendor({
      id: vendor.id,
      vendorCode: vendor.vendorCode || "",
      vendorName: vendor.vendorName || "",
    });
    setOpenEditVendorModal(true);
  };

  const handleSaveEditVendor = async () => {
    if (!editingVendor.vendorName.trim()) {
      toast.error("Vendor Name is required");
      return;
    }

    // Duplicate Check: Vendor Name (excluding this vendor's own current row)
    const existingVendors: VendorRecord[] = data.vendors || [];
    const isDuplicate = existingVendors.some(
      (vendor) =>
        vendor.id !== editingVendor.id &&
        vendor.vendorName.trim().toLowerCase() === editingVendor.vendorName.trim().toLowerCase()
    );
    if (isDuplicate) {
      toast.warning(`Vendor "${editingVendor.vendorName}" already exists.`);
      return;
    }

    // Duplicate Check: Vendor Code (excluding this vendor's own current row)
    if (editingVendor.vendorCode.trim()) {
      const isCodeDuplicate = existingVendors.some(
        (vendor) =>
          vendor.id !== editingVendor.id &&
          vendor.vendorCode &&
          vendor.vendorCode.trim().toLowerCase() === editingVendor.vendorCode.trim().toLowerCase()
      );
      if (isCodeDuplicate) {
        toast.warning(`Vendor code "${editingVendor.vendorCode}" is already assigned to another vendor.`);
        return;
      }
    }

    setIsSavingVendor(true);
    try {
      const res = await fetch("/api/dropdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateVendor",
          id: editingVendor.id,
          vendorCode: editingVendor.vendorCode,
          vendorName: editingVendor.vendorName,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Vendor updated successfully");
        setOpenEditVendorModal(false);
        fetchData();
      } else {
        toast.error(json.error || "Failed to update vendor");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update vendor");
    } finally {
      setIsSavingVendor(false);
    }
  };

  const handleDeleteVendor = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete vendor "${name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/dropdowns?action=deleteVendor&id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Vendor deleted successfully");
        fetchData();
      } else {
        toast.error(json.error || "Failed to delete vendor");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete vendor");
    }
  };

  // Holidays Handlers
  const openAddHolidayModal = () => {
    setEditingHoliday({ id: "", date: "", name: "" });
    setOpenHolidayModal(true);
  };

  const openEditHolidayModal = (h: any) => {
    setEditingHoliday({ id: String(h.id), date: h.date || "", name: h.name || "" });
    setOpenHolidayModal(true);
  };

  const handleSaveHoliday = async () => {
    if (!editingHoliday.date || !editingHoliday.name.trim()) {
      toast.error("Date and Holiday Name are required");
      return;
    }

    setIsSavingHoliday(true);
    try {
      const res = await fetch("/api/dropdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editingHoliday.id ? "updateHoliday" : "addHoliday",
          id: editingHoliday.id || undefined,
          date: editingHoliday.date,
          name: editingHoliday.name.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editingHoliday.id ? "Holiday updated successfully" : "Holiday added successfully");
        setOpenHolidayModal(false);
        fetchData();
      } else {
        toast.error(json.error || "Failed to save holiday");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save holiday");
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete holiday "${name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/dropdowns?action=deleteHoliday&id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Holiday deleted successfully");
        fetchData();
      } else {
        toast.error(json.error || "Failed to delete holiday");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete holiday");
    }
  };

  // Responsible Persons Handlers (dynamic from database TAT rows)
  const filteredStages = useMemo(() => {
    const list = data.responsiblePersons || [];
    const search = responsibleSearch.toLowerCase().trim();
    if (!search) return list;
    return list.filter((r: any) => {
      const stage = r.stageName || "";
      const names = (r.responsibleNames || []).join(", ");
      return stage.toLowerCase().includes(search) || names.toLowerCase().includes(search);
    });
  }, [data.responsiblePersons, responsibleSearch]);

  const renderResponsibleBadges = (names: string[]) => {
    if (!names || names.length === 0) {
      return <span className="text-slate-400 italic text-xs font-semibold">No assignees configured</span>;
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {names.map((name, i) => (
          <Badge key={i} variant="outline" className="bg-indigo-50/50 font-bold text-indigo-700 text-[10px] uppercase border-indigo-100 px-2 py-0.5 rounded-full">
            {name.trim()}
          </Badge>
        ))}
      </div>
    );
  };

  const handleEditResponsible = (record: any) => {
    const { days, hours, minutes } = minutesToDHM(record.durationMinutes || 0);
    setEditingResp({
      id: record.id,
      stageName: record.stageName,
      days,
      hours,
      minutes,
      responsiblePersons: Array.isArray(record.responsibleNames) ? [...record.responsibleNames] : [],
    });
    setOpenRespModal(true);
  };

  const toggleEditingRespPerson = (name: string, checked: boolean) => {
    setEditingResp((prev) => ({
      ...prev,
      responsiblePersons: checked
        ? Array.from(new Set([...prev.responsiblePersons, name]))
        : prev.responsiblePersons.filter((n) => n !== name),
    }));
  };

  const handleSaveResponsible = async () => {
    setIsSavingResp(true);
    const totalMinutes = dhmToMinutes({
      days: editingResp.days,
      hours: editingResp.hours,
      minutes: editingResp.minutes,
    });
    try {
      const res = await fetch("/api/dropdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsertResponsible",
          id: editingResp.id,
          stageName: editingResp.stageName,
          responsiblePersons: editingResp.responsiblePersons,
          durationMinutes: totalMinutes,
        })
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Responsible persons updated for "${editingResp.stageName}"`);
        setOpenRespModal(false);
        fetchData();
      } else {
        toast.error(json.error || "Failed to update responsible persons");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update responsible persons");
    } finally {
      setIsSavingResp(false);
    }
  };

  // Authentication Checks
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-900 mb-2" />
        <p className="text-sm font-semibold text-slate-750">Authenticating access...</p>
      </div>
    );
  }

  if (role?.toUpperCase() !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[calc(100vh-4rem)] text-center">
        <div className="p-4 bg-red-100 text-red-700 border border-red-300 rounded-full mb-4">
          <X className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-bold text-slate-950 tracking-tight">Access Denied</h2>
        <p className="text-slate-700 mt-2 max-w-md font-medium">
          This page is restricted to system administrators. Please contact your system administrator for access permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
      {/* Top Header Card */}
      <div className="p-6 bg-slate-50 border border-indigo-100 rounded-xl shadow-xs shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-lg shadow-indigo-100 shadow-lg text-white">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-indigo-950 tracking-tight">Master Management</h1>
            <p className="text-sm text-slate-700 font-medium mt-0.5">Manage global dropdowns, item lists, and vendors</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center flex-grow py-24 text-slate-750">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-black" />
          <p className="text-lg animate-pulse text-black font-semibold">Fetching options...</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-indigo-50/50 p-1 rounded-xl h-auto grid grid-cols-5 gap-1 border border-indigo-100/50 shrink-0">
            <TabsTrigger
              value="dropdowns"
              className="text-xs py-2.5 px-3 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-transparent data-[state=active]:border-indigo-600 text-slate-755 font-bold"
            >
              <Settings className="w-4 h-4" />
              <span>Dropdown Fields</span>
            </TabsTrigger>
            <TabsTrigger
              value="items"
              className="text-xs py-2.5 px-3 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-transparent data-[state=active]:border-indigo-600 text-slate-755 font-bold"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Items Master</span>
            </TabsTrigger>
            <TabsTrigger
              value="vendors"
              className="text-xs py-2.5 px-3 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-transparent data-[state=active]:border-indigo-600 text-slate-755 font-bold"
            >
              <Users className="w-4 h-4" />
              <span>Vendors Master</span>
            </TabsTrigger>
            <TabsTrigger
              value="responsible"
              className="text-xs py-2.5 px-3 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-transparent data-[state=active]:border-indigo-600 text-slate-755 font-bold"
            >
              <UserCheck className="w-4 h-4" />
              <span>Stage Master</span>
            </TabsTrigger>
            <TabsTrigger
              value="holidays"
              className="text-xs py-2.5 px-3 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-transparent data-[state=active]:border-indigo-600 text-slate-755 font-bold"
            >
              <CalendarOff className="w-4 h-4" />
              <span>Holidays</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: DROPDOWN OPTIONS GRID */}
          <TabsContent value="dropdowns" className="mt-4 outline-none flex-1 overflow-y-auto pr-2 pb-6 min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {DROPDOWN_COLUMNS.map((col) => {
                const isAdding = addingToCol === col.key;
                const options = getFilteredOptions(col.fieldName, col.key);
                return (
                  <Card key={col.key} className="border border-indigo-100 shadow-xs hover:shadow-sm transition-all flex flex-col h-[380px] bg-white">
                    <CardHeader className="p-4 border-b border-indigo-100 flex flex-row items-center justify-between space-y-0 shrink-0 bg-slate-100/70">
                      <div>
                        <CardTitle className="text-sm font-bold text-slate-950">{col.label}</CardTitle>
                        <CardDescription className="text-xs text-slate-700 font-semibold mt-0.5">
                          {options.length} options
                        </CardDescription>
                      </div>
                      <Button
                        size="icon"
                        variant={isAdding ? "destructive" : "outline"}
                        className={cn(
                          "h-8 w-8 cursor-pointer rounded-lg border transition-colors",
                          isAdding 
                            ? "bg-red-50 text-red-600 hover:bg-red-100 border-red-200" 
                            : "bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100/80 hover:text-indigo-700"
                        )}
                        onClick={() => {
                          setAddingToCol(isAdding ? null : col.key);
                          if (!isAdding) {
                            setNewValueMap((prev) => ({ ...prev, [col.key]: "" }));
                          }
                        }}
                      >
                        {isAdding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </CardHeader>

                    <CardContent className="p-4 flex-1 flex flex-col overflow-hidden min-h-0 space-y-3">
                      {/* Search Bar for Options */}
                      <div className="relative shrink-0">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
                        <Input
                          placeholder={`Filter options...`}
                          value={dropdownSearchTerms[col.key] || ""}
                          onChange={(e) =>
                            setDropdownSearchTerms((prev) => ({
                              ...prev,
                              [col.key]: e.target.value,
                            }))
                          }
                          className="pl-8 h-8 text-xs border-slate-350 focus-visible:ring-slate-900 bg-white placeholder-slate-500 font-medium text-slate-900"
                        />
                      </div>

                      {/* Inline Adding Textarea */}
                      {isAdding && (
                        <div className="p-2 border border-slate-350 rounded-lg bg-slate-100 space-y-2 shrink-0 animate-in fade-in slide-in-from-top-2 duration-200">
                          <Textarea
                            placeholder="Type new option name..."
                            value={newValueMap[col.key] || ""}
                            onChange={(e) =>
                              setNewValueMap((prev) => ({
                                ...prev,
                                [col.key]: e.target.value,
                              }))
                            }
                            rows={2}
                            className="text-xs resize-none border-slate-350 focus-visible:ring-slate-955 bg-white text-slate-955 placeholder-slate-600 font-semibold"
                          />
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-3 text-slate-700 border-slate-350 bg-white hover:bg-slate-200 rounded-md cursor-pointer font-bold"
                              onClick={() => setAddingToCol(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="text-xs h-7 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-md cursor-pointer font-bold"
                              onClick={() => handleAddOption(col.key)}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* List of Options */}
                      <div className="flex-grow overflow-y-auto space-y-1 pr-1 border border-slate-100 rounded-lg p-1 bg-slate-50/50">
                        {options.length === 0 ? (
                          <div className="text-center py-8 text-slate-600 text-xs font-bold">
                            No options found.
                          </div>
                        ) : (
                          options.map((opt, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-100/80 border border-transparent hover:border-slate-200 rounded-lg group transition-all"
                            >
                              <span className="text-xs font-semibold text-slate-900 break-all pr-2">
                                {opt}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-red-500 hover:bg-red-50 hover:text-red-700 cursor-pointer border border-transparent hover:border-red-200 rounded-md shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDeleteOption(col.key, opt)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* TAB 2: ITEM MASTER TABLE */}
          <TabsContent value="items" className="mt-4 outline-none flex-grow flex flex-col overflow-hidden">
            <Card className="border border-indigo-100 shadow-xs flex-grow flex flex-col overflow-hidden min-h-0 bg-white">
              <div className="p-4 bg-slate-100/70 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-indigo-50/50 border-indigo-100 text-indigo-700 font-bold px-3 py-1 text-xs">
                    Items ({filteredItems.length})
                  </Badge>
                  <div className="relative w-64 sm:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-650" />
                    <Input
                      placeholder="Search code, category, or name..."
                      value={itemsSearch}
                      onChange={(e) => setItemsSearch(e.target.value)}
                      className="pl-9 h-9 text-xs border-indigo-100 bg-white rounded-lg focus-visible:ring-slate-950 placeholder-slate-600 font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => openMismatchTool("items")}
                    className="border-amber-300 text-amber-800 hover:bg-amber-50 bg-amber-50/50 font-bold text-xs shadow-sm gap-2 h-9 rounded-lg cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    Fix Mismatched Items
                  </Button>
                  <Button
                    onClick={() => {
                      setNewItem({ itemCode: "", category: "", itemName: "", purchaser: "" });
                      setSelectedCategory("");
                      setManualCategory("");
                      setAddItemError("");
                      setOpenItemModal(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm gap-2 h-9 rounded-lg cursor-pointer border-none"
                  >
                    <Plus className="w-4 h-4" />
                    Add Catalog Item
                  </Button>
                </div>
              </div>

              {/* Table Body Container */}
              <div className="flex-grow overflow-y-auto min-h-0">
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow className="bg-slate-100 hover:bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-755 border-b border-slate-350">
                      <TableHead className="w-[130px] text-center font-bold text-slate-900">Actions</TableHead>
                      <TableHead className="font-bold text-slate-900">Item Code</TableHead>
                      <TableHead className="font-bold text-slate-900">Item Category</TableHead>
                      <TableHead className="font-bold text-slate-900">Item Name</TableHead>
                      <TableHead className="font-bold text-slate-900">Purchaser</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-slate-600 text-sm font-bold">
                          No items catalogued.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedItems.map((item) => (
                        <TableRow key={item.id} className="hover:bg-slate-50 border-b border-slate-200 transition-colors">
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px] text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 font-bold rounded-md cursor-pointer"
                                onClick={() => handleOpenEditItem(item)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-md cursor-pointer border border-transparent hover:border-red-200"
                                onClick={() => handleDeleteItem(item.id, item.itemName)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold text-slate-800">
                            {item.itemCode || "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-indigo-50/50 font-bold text-indigo-700 text-[10px] uppercase border-indigo-100 px-2 py-0.5 rounded-full">
                              {item.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold text-slate-900">{item.itemName}</TableCell>
                          <TableCell className="font-semibold text-slate-700">
                            {item.purchaser || <span className="text-slate-400 italic font-medium">Not set</span>}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Frontend Pagination Controls for Items */}
              {filteredItems.length > 0 && (
                <div className="p-4 bg-slate-100/70 border-t border-slate-355 flex items-center justify-between shrink-0">
                  <span className="text-xs text-slate-700 font-bold">
                    Showing {Math.min(filteredItems.length, (itemsPage - 1) * pageSize + 1)}-
                    {Math.min(filteredItems.length, itemsPage * pageSize)} of {filteredItems.length} items
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setItemsPage((prev) => Math.max(1, prev - 1))}
                      disabled={itemsPage === 1}
                      className="text-xs h-8 cursor-pointer rounded-lg bg-white border-slate-350 font-bold text-slate-900"
                    >
                      Previous
                    </Button>
                    <span className="text-xs font-extrabold text-slate-955 px-2">
                      Page {itemsPage} of {totalItemsPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setItemsPage((prev) => Math.min(totalItemsPages, prev + 1))}
                      disabled={itemsPage === totalItemsPages}
                      className="text-xs h-8 cursor-pointer rounded-lg bg-white border-slate-350 font-bold text-slate-900"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* TAB 3: VENDOR MASTER TABLE */}
          <TabsContent value="vendors" className="mt-4 outline-none flex-grow flex flex-col overflow-hidden">
            <Card className="border border-indigo-100 shadow-xs flex-grow flex flex-col overflow-hidden min-h-0 bg-white">
              <div className="p-4 bg-slate-100/70 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-indigo-50/50 border-indigo-100 text-indigo-700 font-bold px-3 py-1 text-xs">
                    Vendors ({filteredVendors.length})
                  </Badge>
                  <div className="relative w-64 sm:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-655" />
                    <Input
                      placeholder="Search vendor code or name..."
                      value={vendorsSearch}
                      onChange={(e) => setVendorsSearch(e.target.value)}
                      className="pl-9 h-9 text-xs border-indigo-100 bg-white rounded-lg focus-visible:ring-slate-950 placeholder-slate-600 font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => openMismatchTool("vendors")}
                    className="border-amber-300 text-amber-800 hover:bg-amber-50 bg-amber-50/50 font-bold text-xs shadow-sm gap-2 h-9 rounded-lg cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    Fix Mismatched Vendors
                  </Button>
                  <Button
                    onClick={() => {
                      setNewVendor({ vendorCode: "", vendorName: "" });
                      setAddVendorError("");
                      setOpenVendorModal(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm gap-2 h-9 rounded-lg cursor-pointer border-none"
                  >
                    <Plus className="w-4 h-4" />
                    Add Vendor
                  </Button>
                </div>
              </div>

              {/* Table Body Container */}
              <div className="flex-grow overflow-y-auto min-h-0">
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow className="bg-slate-100 hover:bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-755 border-b border-slate-350">
                      <TableHead className="w-[130px] text-center font-bold text-slate-900">Actions</TableHead>
                      <TableHead className="font-bold text-slate-900">Vendor Code</TableHead>
                      <TableHead className="font-bold text-slate-900">Vendor Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedVendors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-12 text-slate-600 text-sm font-bold">
                          No vendors catalogued.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedVendors.map((vendor) => (
                        <TableRow key={vendor.id} className="hover:bg-slate-50 border-b border-slate-200 transition-colors">
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px] text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 font-bold rounded-md cursor-pointer"
                                onClick={() => handleOpenEditVendor(vendor)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-md cursor-pointer border border-transparent hover:border-red-200"
                                onClick={() => handleDeleteVendor(vendor.id, vendor.vendorName)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold text-slate-800">
                            {vendor.vendorCode || "N/A"}
                          </TableCell>
                          <TableCell className="font-bold text-slate-900">{vendor.vendorName}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Frontend Pagination Controls for Vendors */}
              {filteredVendors.length > 0 && (
                <div className="p-4 bg-slate-100/70 border-t border-slate-355 flex items-center justify-between shrink-0">
                  <span className="text-xs text-slate-700 font-bold">
                    Showing {Math.min(filteredVendors.length, (vendorsPage - 1) * pageSize + 1)}-
                    {Math.min(filteredVendors.length, vendorsPage * pageSize)} of {filteredVendors.length} vendors
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVendorsPage((prev) => Math.max(1, prev - 1))}
                      disabled={vendorsPage === 1}
                      className="text-xs h-8 cursor-pointer rounded-lg bg-white border-slate-355 font-bold text-slate-900"
                    >
                      Previous
                    </Button>
                    <span className="text-xs font-extrabold text-slate-955 px-2">
                      Page {vendorsPage} of {totalVendorsPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVendorsPage((prev) => Math.min(totalVendorsPages, prev + 1))}
                      disabled={vendorsPage === totalVendorsPages}
                      className="text-xs h-8 cursor-pointer rounded-lg bg-white border-slate-355 font-bold text-slate-900"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* TAB 4: STAGE-WISE RESPONSIBLE PERSONS TABLE */}
          <TabsContent value="responsible" className="mt-4 outline-none flex-grow flex flex-col overflow-hidden space-y-4">
            {/* Office Hours info strip */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-violet-50/70 border border-violet-100">
                <div className="p-1.5 bg-violet-600 rounded-lg text-white shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-[9px] font-bold text-violet-500 uppercase tracking-wider leading-none">Office Hours</p>
                  <p className="text-xs font-extrabold text-violet-900 mt-0.5">{data.officeHours?.label || "9:30 AM – 6:30 PM"}</p>
                </div>
              </div>
            </div>

            <Card className="border border-indigo-100 shadow-xs flex-grow flex flex-col overflow-hidden min-h-0 bg-white">
              <div className="p-4 bg-slate-100/70 border-b border-indigo-100 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-indigo-50/50 border-indigo-100 text-indigo-700 font-bold px-3 py-1 text-xs">
                    Stages ({(data.responsiblePersons || []).length})
                  </Badge>
                  <div className="relative w-64 sm:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-655" />
                    <Input
                      placeholder="Search stage or assigned person..."
                      value={responsibleSearch}
                      onChange={(e) => setResponsibleSearch(e.target.value)}
                      className="pl-9 h-9 text-xs border-indigo-100 bg-white rounded-lg focus-visible:ring-slate-950 placeholder-slate-600 font-semibold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Table Container */}
              <div className="flex-grow overflow-y-auto min-h-0">
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow className="bg-slate-100 hover:bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-755 border-b border-indigo-100">
                      <TableHead className="w-[100px] text-center font-bold text-slate-900">Actions</TableHead>
                      <TableHead className="font-bold text-slate-900">Stage Name</TableHead>
                      <TableHead className="w-[120px] text-center font-bold text-slate-900">TAT (Limit)</TableHead>
                      <TableHead className="font-bold text-slate-900">Responsible Person(s)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-slate-600 text-sm font-bold">
                          No matching stages found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStages.map((record: any) => {
                        const names: string[] = record.responsibleNames || [];
                        const tatDisplay = formatDurationShort(record.durationMinutes || 0);
                        return (
                          <TableRow key={record.id} className="hover:bg-slate-50 border-b border-indigo-50/60 transition-colors">
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 px-3 text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 font-bold rounded-lg cursor-pointer"
                                onClick={() => handleEditResponsible(record)}
                              >
                                Edit
                              </Button>
                            </TableCell>
                            <TableCell className="font-bold text-slate-900">{record.stageName}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="bg-violet-50/70 border-violet-200 text-violet-700 font-bold text-[11px] px-2 py-0.5 rounded-full">
                                {tatDisplay}
                              </Badge>
                            </TableCell>
                            <TableCell>{renderResponsibleBadges(names)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 5: HOLIDAYS MASTER */}
          <TabsContent value="holidays" className="mt-4 outline-none flex-grow flex flex-col overflow-hidden">
            <Card className="border border-amber-100 shadow-xs flex-grow flex flex-col overflow-hidden min-h-0 bg-white">
              <div className="p-4 bg-slate-100/70 border-b border-amber-100 flex items-center justify-between gap-3 shrink-0 flex-wrap">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-amber-50/60 border-amber-100 text-amber-700 font-bold px-3 py-1 text-xs">
                    Holidays ({(data.holidays || []).length})
                  </Badge>
                  <div className="relative w-64 sm:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-655" />
                    <Input
                      placeholder="Search holiday name, day or date..."
                      value={holidaySearch}
                      onChange={(e) => setHolidaySearch(e.target.value)}
                      className="pl-9 h-9 text-xs border-amber-100 bg-white rounded-lg focus-visible:ring-amber-500 placeholder-slate-600 font-semibold text-slate-900"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={openAddHolidayModal}
                  className="h-9 px-3.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Add Holiday
                </Button>
              </div>

              {/* Table Container */}
              <div className="flex-grow overflow-y-auto min-h-0">
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow className="bg-slate-100 hover:bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-755 border-b border-amber-100">
                      <TableHead className="w-[100px] text-center font-bold text-slate-900">Actions</TableHead>
                      <TableHead className="w-[130px] font-bold text-slate-900">Date</TableHead>
                      <TableHead className="w-[120px] font-bold text-slate-900">Day</TableHead>
                      <TableHead className="font-bold text-slate-900">Holiday Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHolidays.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-slate-600 text-sm font-bold">
                          No holidays configured.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHolidays.map((h: any, i: number) => (
                        <TableRow key={h.id ?? i} className="hover:bg-slate-50 border-b border-amber-50/60 transition-colors">
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 px-2.5 text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 font-bold rounded-lg cursor-pointer"
                                onClick={() => openEditHolidayModal(h)}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 px-2.5 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 font-bold rounded-lg cursor-pointer"
                                onClick={() => handleDeleteHoliday(String(h.id), h.name || "this holiday")}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-amber-50/70 border-amber-200 text-amber-700 font-bold text-[11px] px-2 py-0.5 rounded-full">
                              {h.date}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-700 font-semibold">{h.day}</TableCell>
                          <TableCell className="font-bold text-slate-900">{h.name || "Holiday"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Add / Edit Holiday Modal */}
      <Dialog open={openHolidayModal} onOpenChange={setOpenHolidayModal}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-amber-900">
              {editingHoliday.id ? "Edit Holiday" : "Add Holiday"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Date</Label>
              <Input
                type="date"
                value={editingHoliday.date}
                onChange={(e) => setEditingHoliday((prev) => ({ ...prev, date: e.target.value }))}
                className="h-9 text-sm border-amber-200 focus-visible:ring-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Holiday Name</Label>
              <Input
                placeholder="e.g. Diwali"
                value={editingHoliday.name}
                onChange={(e) => setEditingHoliday((prev) => ({ ...prev, name: e.target.value }))}
                className="h-9 text-sm border-amber-200 focus-visible:ring-amber-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenHolidayModal(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveHoliday}
              disabled={isSavingHoliday}
              className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            >
              {isSavingHoliday ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {editingHoliday.id ? "Save Changes" : "Add Holiday"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Responsible Persons Modal */}
      <Dialog open={openRespModal} onOpenChange={setOpenRespModal}>
        <DialogContent className="max-w-lg bg-white border-0 rounded-2xl p-0 shadow-2xl overflow-hidden">
          <DialogHeader className="p-6 pb-5 bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 space-y-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm ring-1 ring-white/20">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white tracking-tight">Edit Stage TAT & Responsible Persons</DialogTitle>
                <p className="text-[11px] font-medium text-indigo-100 mt-0.5">Configure turnaround time and assignees for this stage</p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Stage Name */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Stage Name</Label>
              <Input
                value={editingResp.stageName}
                disabled
                className="h-10 text-sm border-slate-200 bg-slate-100 font-bold text-slate-700 focus-visible:ring-0 cursor-not-allowed"
              />
            </div>

            {/* TAT */}
            <div className="space-y-2 p-4 rounded-xl bg-violet-50/60 border border-violet-100">
              <Label className="text-[11px] font-bold text-violet-800 uppercase tracking-wider flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5" />
                Turnaround Time (TAT)
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Input
                    type="number"
                    min="0"
                    value={editingResp.days === 0 ? "" : editingResp.days}
                    placeholder="0"
                    onChange={(e) => setEditingResp((prev) => ({ ...prev, days: parseInt(e.target.value) || 0 }))}
                    className="h-10 text-sm text-center border-violet-200 bg-white rounded-lg focus-visible:ring-violet-500 font-bold text-slate-900"
                  />
                  <p className="text-[10px] text-center font-bold text-violet-600 uppercase tracking-wide">Days</p>
                </div>
                <div className="space-y-1">
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    value={editingResp.hours === 0 ? "" : editingResp.hours}
                    placeholder="0"
                    onChange={(e) => setEditingResp((prev) => ({ ...prev, hours: parseInt(e.target.value) || 0 }))}
                    className="h-10 text-sm text-center border-violet-200 bg-white rounded-lg focus-visible:ring-violet-500 font-bold text-slate-900"
                  />
                  <p className="text-[10px] text-center font-bold text-violet-600 uppercase tracking-wide">Hours</p>
                </div>
                <div className="space-y-1">
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={editingResp.minutes === 0 ? "" : editingResp.minutes}
                    placeholder="0"
                    onChange={(e) => setEditingResp((prev) => ({ ...prev, minutes: parseInt(e.target.value) || 0 }))}
                    className="h-10 text-sm text-center border-violet-200 bg-white rounded-lg focus-visible:ring-violet-500 font-bold text-slate-900"
                  />
                  <p className="text-[10px] text-center font-bold text-violet-600 uppercase tracking-wide">Minutes</p>
                </div>
              </div>
              <p className="text-[10px] font-semibold text-violet-700 pt-1">
                Total: {formatDurationShort(dhmToMinutes(editingResp))}
              </p>
            </div>

            {/* Responsible Persons */}
            <div className="space-y-2 p-4 rounded-xl bg-indigo-50/60 border border-indigo-100">
              <Label className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
                <UserCircle2 className="w-3.5 h-3.5" />
                Responsible Person(s)
              </Label>
              {(data.responsiblePersonOptions || []).length === 0 ? (
                <p className="text-xs font-semibold text-slate-500 bg-white border border-dashed border-indigo-200 rounded-lg p-3">
                  No names configured yet. Add names under "Responsible Person" in the Dropdown Fields tab first.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {(data.responsiblePersonOptions || []).map((name: string) => {
                    const checked = editingResp.responsiblePersons.includes(name);
                    return (
                      <label
                        key={name}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-xs font-bold",
                          checked
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                            : "bg-white border-indigo-100 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleEditingRespPerson(name, !!v)}
                          className={cn(
                            "shrink-0",
                            checked ? "border-white data-[state=checked]:bg-white data-[state=checked]:text-indigo-600" : "border-indigo-300"
                          )}
                        />
                        <span className="truncate">{name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-indigo-600/80 font-semibold pt-0.5">
                {editingResp.responsiblePersons.length} selected
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t border-slate-100 p-4 bg-slate-50/70">
            <Button
              variant="outline"
              onClick={() => setOpenRespModal(false)}
              className="text-xs h-9 rounded-lg cursor-pointer border-slate-300 bg-white font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveResponsible}
              disabled={isSavingResp}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 rounded-lg cursor-pointer font-bold gap-2 shadow-sm shadow-indigo-200"
            >
              {isSavingResp && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Modal */}
      <Dialog open={openItemModal} onOpenChange={setOpenItemModal}>
        <DialogContent className="max-w-md bg-white border border-slate-355 rounded-xl p-6 shadow-xl">
          <DialogHeader className="border-b border-slate-200 pb-2">
            <DialogTitle className="text-lg font-bold text-slate-955 tracking-tight">Add New Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            {addItemError && (
              <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {addItemError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="itemCode" className="text-xs font-bold text-slate-900">
                Item Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="itemCode"
                placeholder="e.g. ITM-001"
                value={newItem.itemCode}
                onChange={(e) => setNewItem((prev) => ({ ...prev, itemCode: e.target.value }))}
                className="h-9 text-xs border-slate-350 focus-visible:ring-slate-950 font-semibold"
                required
              />
            </div>

            {/* Category Dropdown Selection & Other Manually option */}
            <div className="space-y-1.5">
              <Label htmlFor="categorySelect" className="text-xs font-bold text-slate-900">Item Category</Label>
              <select
                id="categorySelect"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-350 bg-white px-3 py-1 text-xs font-semibold shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-slate-950 cursor-pointer"
              >
                <option value="">Select Category...</option>
                <option value="OTHER">OTHER (ENTER MANUALLY)</option>
                {existingCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {selectedCategory === "OTHER" && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <Label htmlFor="categoryManual" className="text-xs font-bold text-slate-900">Enter Category Manually</Label>
                <Input
                  id="categoryManual"
                  placeholder="e.g. Cables"
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  className="h-9 text-xs border-slate-355 focus-visible:ring-slate-900 font-semibold text-slate-905"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="itemName" className="text-xs font-bold text-slate-900">Item Name</Label>
              <Input
                id="itemName"
                placeholder="e.g. 3 Core Copper Cable"
                value={newItem.itemName}
                onChange={(e) => setNewItem((prev) => ({ ...prev, itemName: e.target.value }))}
                className="h-9 text-xs border-slate-350 focus-visible:ring-slate-950 font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="purchaserSelect" className="text-xs font-bold text-slate-900">Purchaser</Label>
              <select
                id="purchaserSelect"
                value={newItem.purchaser}
                onChange={(e) => setNewItem((prev) => ({ ...prev, purchaser: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-slate-350 bg-white px-3 py-1 text-xs font-semibold shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-slate-950 cursor-pointer"
              >
                <option value="">Select Purchaser...</option>
                {(data.purchaserOptions || []).map((p: string) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 border-t border-slate-200 pt-3">
            <Button
              variant="outline"
              onClick={() => setOpenItemModal(false)}
              className="text-xs h-9 rounded-lg cursor-pointer border-slate-350 font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddItem}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-9 rounded-lg cursor-pointer font-bold"
            >
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Modal */}
      <Dialog open={openEditItemModal} onOpenChange={setOpenEditItemModal}>
        <DialogContent className="max-w-md bg-white border border-slate-355 rounded-xl p-6 shadow-xl">
          <DialogHeader className="border-b border-slate-200 pb-2">
            <DialogTitle className="text-lg font-bold text-slate-955 tracking-tight">Edit Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <div className="space-y-1.5">
              <Label htmlFor="editItemCode" className="text-xs font-bold text-slate-900">Item Code (Optional)</Label>
              <Input
                id="editItemCode"
                placeholder="e.g. ITM-001"
                value={editingItem.itemCode}
                onChange={(e) => setEditingItem((prev) => ({ ...prev, itemCode: e.target.value }))}
                className="h-9 text-xs border-slate-350 focus-visible:ring-slate-950 font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editCategorySelect" className="text-xs font-bold text-slate-900">Item Category</Label>
              <select
                id="editCategorySelect"
                value={editSelectedCategory}
                onChange={(e) => setEditSelectedCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-350 bg-white px-3 py-1 text-xs font-semibold shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-slate-950 cursor-pointer"
              >
                <option value="">Select Category...</option>
                <option value="OTHER">OTHER (ENTER MANUALLY)</option>
                {existingCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {editSelectedCategory === "OTHER" && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <Label htmlFor="editCategoryManual" className="text-xs font-bold text-slate-900">Enter Category Manually</Label>
                <Input
                  id="editCategoryManual"
                  placeholder="e.g. Cables"
                  value={editManualCategory}
                  onChange={(e) => setEditManualCategory(e.target.value)}
                  className="h-9 text-xs border-slate-355 focus-visible:ring-slate-900 font-semibold text-slate-905"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="editItemName" className="text-xs font-bold text-slate-900">Item Name</Label>
              <Input
                id="editItemName"
                placeholder="e.g. 3 Core Copper Cable"
                value={editingItem.itemName}
                onChange={(e) => setEditingItem((prev) => ({ ...prev, itemName: e.target.value }))}
                className="h-9 text-xs border-slate-350 focus-visible:ring-slate-950 font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editPurchaserSelect" className="text-xs font-bold text-slate-900">Purchaser</Label>
              <select
                id="editPurchaserSelect"
                value={editingItem.purchaser}
                onChange={(e) => setEditingItem((prev) => ({ ...prev, purchaser: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-slate-350 bg-white px-3 py-1 text-xs font-semibold shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-slate-950 cursor-pointer"
              >
                <option value="">Select Purchaser...</option>
                {(data.purchaserOptions || []).map((p: string) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 border-t border-slate-200 pt-3">
            <Button
              variant="outline"
              onClick={() => setOpenEditItemModal(false)}
              className="text-xs h-9 rounded-lg cursor-pointer border-slate-350 font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditItem}
              disabled={isSavingItem}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-9 rounded-lg cursor-pointer font-bold gap-2"
            >
              {isSavingItem && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Vendor Modal */}
      <Dialog open={openEditVendorModal} onOpenChange={setOpenEditVendorModal}>
        <DialogContent className="max-w-md bg-white border border-slate-355 rounded-xl p-6 shadow-xl">
          <DialogHeader className="border-b border-slate-200 pb-2">
            <DialogTitle className="text-lg font-bold text-slate-955 tracking-tight">Edit Vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <div className="space-y-1.5">
              <Label htmlFor="editVendorCode" className="text-xs font-bold text-slate-900">Vendor Code (Optional)</Label>
              <Input
                id="editVendorCode"
                placeholder="e.g. VND-901"
                value={editingVendor.vendorCode}
                onChange={(e) => setEditingVendor((prev) => ({ ...prev, vendorCode: e.target.value }))}
                className="h-9 text-xs border-slate-350 focus-visible:ring-slate-900 font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editVendorName" className="text-xs font-bold text-slate-900">Vendor Name</Label>
              <Input
                id="editVendorName"
                placeholder="e.g. Acme Corp Industries"
                value={editingVendor.vendorName}
                onChange={(e) => setEditingVendor((prev) => ({ ...prev, vendorName: e.target.value }))}
                className="h-9 text-xs border-slate-350 focus-visible:ring-slate-950 font-semibold"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 border-t border-slate-200 pt-3">
            <Button
              variant="outline"
              onClick={() => setOpenEditVendorModal(false)}
              className="text-xs h-9 rounded-lg cursor-pointer border-slate-350 font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditVendor}
              disabled={isSavingVendor}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-9 rounded-lg cursor-pointer font-bold gap-2"
            >
              {isSavingVendor && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Modal */}
      <Dialog open={openVendorModal} onOpenChange={setOpenVendorModal}>
        <DialogContent className="max-w-md bg-white border border-slate-355 rounded-xl p-6 shadow-xl">
          <DialogHeader className="border-b border-slate-200 pb-2">
            <DialogTitle className="text-lg font-bold text-slate-955 tracking-tight">Add New Vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            {addVendorError && (
              <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {addVendorError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="vendorCode" className="text-xs font-bold text-slate-900">
                Vendor Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="vendorCode"
                placeholder="e.g. VND-901"
                value={newVendor.vendorCode}
                onChange={(e) => setNewVendor((prev) => ({ ...prev, vendorCode: e.target.value }))}
                className="h-9 text-xs border-slate-350 focus-visible:ring-slate-900 font-semibold"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendorName" className="text-xs font-bold text-slate-900">Vendor Name</Label>
              <Input
                id="vendorName"
                placeholder="e.g. Acme Corp Industries"
                value={newVendor.vendorName}
                onChange={(e) => setNewVendor((prev) => ({ ...prev, vendorName: e.target.value }))}
                className="h-9 text-xs border-slate-350 focus-visible:ring-slate-950 font-semibold"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 border-t border-slate-200 pt-3">
            <Button
              variant="outline"
              onClick={() => setOpenVendorModal(false)}
              className="text-xs h-9 rounded-lg cursor-pointer border-slate-350 font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddVendor}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-9 rounded-lg cursor-pointer font-bold"
            >
              Add Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mismatch Fix Tool — remaps an item/vendor name used on real indents (that doesn't
          match anything in Master) onto an actual Master entry, in one shot across every
          affected record. */}
      <Dialog open={openMismatchModal !== null} onOpenChange={(v) => !v && setOpenMismatchModal(null)}>
        <DialogContent className="max-w-2xl bg-white border border-slate-355 rounded-xl p-6 shadow-xl max-h-[85vh] flex flex-col">
          <DialogHeader className="border-b border-slate-200 pb-2 shrink-0">
            <DialogTitle className="text-lg font-bold text-slate-955 tracking-tight">
              {openMismatchModal === "vendors" ? "Fix Mismatched Vendor Names" : "Fix Mismatched Item Names"}
            </DialogTitle>
            <p className="text-xs text-slate-600 font-medium mt-1">
              {openMismatchModal === "vendors"
                ? "These vendor names appear on real Negotiation/Update-3-Vendors records but don't match anything in Vendor Master. Map each one to the correct Master entry — every affected record is updated in one go."
                : "These item names appear on real indents but don't match anything in Item Master. Map each one to the correct Master entry — every affected indent is updated in one go."}
            </p>
          </DialogHeader>

          <div className="flex-grow overflow-y-auto min-h-0 my-3 space-y-2">
            {isLoadingMismatch ? (
              <div className="flex items-center justify-center py-12 text-slate-500 text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning indents…
              </div>
            ) : (() => {
              const rows = openMismatchModal === "vendors" ? mismatchData.unmatchedVendors : mismatchData.unmatchedItems;
              const total = openMismatchModal === "vendors" ? mismatchData.totalUnmatchedVendors : mismatchData.totalUnmatchedItems;
              if (rows.length === 0) {
                return (
                  <div className="text-center py-12 text-slate-500 text-sm font-semibold">
                    Nothing to fix — every {openMismatchModal === "vendors" ? "vendor" : "item"} name in use matches Master. 🎉
                  </div>
                );
              }
              const targetOptions = openMismatchModal === "vendors"
                ? (data.vendors || []).map((v: VendorRecord) => ({
                    id: v.id,
                    label: `${v.vendorName}${v.vendorCode ? ` (${v.vendorCode})` : ""}`,
                  }))
                : (data.items || []).map((i: ItemRecord) => ({
                    id: i.id,
                    label: `${i.itemName} — ${i.category}${i.itemCode ? ` (${i.itemCode})` : ""}`,
                  }));
              return (
                <>
                  {total > rows.length && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-semibold mb-2">
                      Showing the top {rows.length} of {total}, sorted by how many indents each one affects. Fix these, then reopen this tool for the next batch.
                    </div>
                  )}
                  {rows.map((row) => (
                    <div key={row.name} className="border border-slate-200 rounded-lg p-3 bg-slate-50/60 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-slate-900">{row.name}</div>
                          <div className="text-[11px] text-slate-500 font-semibold">
                            {row.count} indent{row.count === 1 ? "" : "s"} &middot; {row.indentNos.slice(0, 4).join(", ")}{row.indentNos.length > 4 ? ` +${row.indentNos.length - 4} more` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <SearchSelect
                          options={targetOptions}
                          value={remapSelections[row.name] || ""}
                          onChange={(id) => setRemapSelections((prev) => ({ ...prev, [row.name]: id }))}
                          placeholder={openMismatchModal === "vendors" ? "Map to Vendor Master entry…" : "Map to Item Master entry…"}
                          searchPlaceholder={openMismatchModal === "vendors" ? "Search vendors…" : "Search items…"}
                        />
                        <Button
                          size="sm"
                          disabled={!remapSelections[row.name] || applyingRemapFor === row.name}
                          onClick={() =>
                            openMismatchModal === "vendors"
                              ? handleApplyVendorRename(row.name)
                              : handleApplyItemRename(row.name)
                          }
                          className="h-9 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-md cursor-pointer gap-1.5 shrink-0"
                        >
                          {applyingRemapFor === row.name && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Apply
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t border-slate-200 pt-3 shrink-0">
            <p className="text-[11px] text-slate-500 font-medium mr-auto self-center">
              Not in Master yet? Add it under {openMismatchModal === "vendors" ? '"Add Vendor"' : '"Add Catalog Item"'} first, then come back here to map it.
            </p>
            <Button
              variant="outline"
              onClick={() => setOpenMismatchModal(null)}
              className="text-xs h-9 rounded-lg cursor-pointer border-slate-350 font-bold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
