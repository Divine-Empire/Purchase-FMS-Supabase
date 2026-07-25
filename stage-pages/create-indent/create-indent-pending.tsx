"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useWorkflow } from "@/lib/workflow-context";
import { StageTable } from "@/components/stages/stage-table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { X, Loader2, PlusCircle, FileText, Upload } from "lucide-react";
import { cn, getFmsTimestamp } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
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

interface CreateIndentPendingProps {
  pending: any[];
  fetchData: () => Promise<void>;
  openCreateModal: boolean;
  setOpenCreateModal: (open: boolean) => void;
}

export default function CreateIndentPending({
  pending,
  fetchData,
  openCreateModal,
  setOpenCreateModal,
}: CreateIndentPendingProps) {
  const { setIndentCounter } = useWorkflow();

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // === Edit Modal State ===
  const [editOpen, setEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState({
    createdBy: "",
    warehouseLocation: "",
    leadTime: "",
    category: "",
    itemName: "",
    quantity: "",
    uom: "",
    itemCode: "",
    attachment: null as File | null,
    existingAttachmentUrl: "",
  });

  const [formData, setFormData] = useState({
    createdBy: "",
    warehouseLocation: "",
    leadTime: "",
    attachment: null as File | null,
    items: [] as Array<{
      category: string;
      itemName: string;
      quantity: string;
      uom: string;
      itemCode: string;
    }>,
  });

  const [itemForm, setItemForm] = useState({
    items: [
      {
        category: "",
        itemName: "",
        quantity: "",
        uom: "",
        itemCode: "",
      },
    ],
  });

  // Fetch "Created By" options from Dropdown sheet column A
  const [createdByOptions, setCreatedByOptions] = useState<string[]>([]);
  // Fetch "Warehouse Location" options from Dropdown sheet column B
  const [warehouseOptions, setWarehouseOptions] = useState<string[]>([]);
  // Fetch "UOM" options from Dropdown sheet column N (Index 13)
  const [uomOptions, setUomOptions] = useState<string[]>([]);
  // Fetch dropdown data for Category (D), Item Name (E), Item Code (C)
  const [dropdownData, setDropdownData] = useState<Array<{ itemCode: string; category: string; itemName: string }>>([]);

  useEffect(() => {
    const fetchDropdownOptions = async () => {
      try {
        const res = await fetch(`/api/dropdowns`);
        const json = await res.json();
        if (json.success && json.data) {
          setCreatedByOptions(json.data.createdByOptions || []);
          setWarehouseOptions(json.data.warehouseOptions || []);
          setUomOptions(json.data.uomOptions || []);
          setDropdownData(json.data.dropdownData || []);
        }
      } catch (e) {
        console.error("Error fetching dropdown options:", e);
      }
    };
    fetchDropdownOptions();
  }, []);

  const categoryOptions = useMemo(() => [...new Set(dropdownData.map(item => item.category))].filter(Boolean), [dropdownData]);

  const getItemsByCategory = (category: string) => {
    const items = dropdownData.filter(item => item.category === category);
    return Array.from(new Map(items.map(item => [item.itemName, item])).values());
  };

  const checkAndSaveNewOptions = async (items: any[]) => {
    const newOptions: any[] = [];
    const newLocalDropdowns: any[] = [];

    items.forEach(item => {
      const exists = dropdownData.some(
        d => d.category === item.category &&
          d.itemName === item.itemName &&
          d.itemCode === item.itemCode
      );

      const alreadyQueued = newOptions.some(
        d => d.category === item.category &&
          d.itemName === item.itemName &&
          d.itemCode === item.itemCode
      );

      if (!exists && !alreadyQueued) {
        newOptions.push({
          category: item.category,
          itemName: item.itemName,
          itemCode: item.itemCode
        });
        newLocalDropdowns.push({
          category: item.category,
          itemName: item.itemName,
          itemCode: item.itemCode
        });
      }
    });

    if (newOptions.length > 0) {
      setDropdownData(prev => [...prev, ...newLocalDropdowns]);

      try {
        await fetch("/api/create-indent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "saveNewItems",
            items: newOptions,
          }),
        });
      } catch (e) {
        console.error("Failed to save new options:", e);
      }
    }
  };

  const submitToSheet = async (data: any, attachmentUrl: string): Promise<string[]> => {
    const res = await fetch("/api/create-indent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "insertIndent",
        createdBy: data.createdBy,
        warehouseLocation: data.warehouseLocation,
        leadTime: parseInt(data.leadTime) || null,
        attachment: attachmentUrl,
        items: data.items.map((item: any) => ({
          category: item.category,
          itemName: item.itemName,
          quantity: parseFloat(item.quantity) || 0,
          uom: item.uom,
          itemCode: item.itemCode,
        })),
      }),
    });
    const result = await res.json();

    if (result && result.success) {
      return result.generatedIds as string[];
    } else {
      throw new Error(result?.error || "insertIndent failed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      formData.createdBy &&
      formData.warehouseLocation &&
      formData.leadTime &&
      formData.items.length > 0
    ) {
      setIsSubmitting(true);

      const submitPromise = (async () => {
        let attachmentUrl = "";
        if (formData.attachment) {
          const fileData = new FormData();
          fileData.append("file", formData.attachment);
          fileData.append("folder", "indents");

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
        }

        const generatedIds = await submitToSheet({ ...formData }, attachmentUrl);

        const createdRecords = formData.items.map((item, i) => ({
          indentNumber: generatedIds[i] || "",
          ...item,
        }));
        checkAndSaveNewOptions(createdRecords);

        await fetchData();
        setFormData({ createdBy: "", warehouseLocation: "", leadTime: "", attachment: null, items: [] });
        setOpenCreateModal(false);
        return true;
      })();

      toast.promise(submitPromise, {
        loading: "Creating indent and uploading attachment...",
        success: "Indent created successfully!",
        error: (err) => `Failed to create indent: ${err.message}`,
      });

      try {
        await submitPromise;
      } catch (err) {
        console.error("Submission failed:", err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      itemForm.items.every(
        (item) =>
          item.category && item.itemName && item.quantity && item.itemCode && item.uom
      )
    ) {
      setFormData((prev) => ({
        ...prev,
        items: [...prev.items, ...itemForm.items],
      }));
      setItemForm({
        items: [
          {
            category: "",
            itemName: "",
            quantity: "",
            uom: "",
            itemCode: "",
          },
        ],
      });
      setAddItemOpen(false);
    }
  };

  const addNewItem = () => {
    setItemForm({
      ...itemForm,
      items: [
        ...itemForm.items,
        {
          category: "",
          itemName: "",
          quantity: "",
          uom: "",
          itemCode: "",
        },
      ],
    });
  };

  const removeItem = (index: number) => {
    if (itemForm.items.length > 1) {
      setItemForm({
        ...itemForm,
        items: itemForm.items.filter((_, i) => i !== index),
      });
    }
  };

  const updateItem = (index: number, field: string, value: string) => {
    const updatedItems = itemForm.items.map((item, i) => {
      if (i !== index) return item;

      if (field === "category") {
        return { ...item, category: value, itemName: "", itemCode: "" };
      }

      if (field === "itemName") {
        const selectedItem = dropdownData.find(
          d => d.category === item.category && d.itemName === value
        );

        return {
          ...item,
          itemName: value,
          itemCode: selectedItem?.itemCode || ""
        };
      }

      return { ...item, [field]: value };
    });
    setItemForm({ ...itemForm, items: updatedItems });
  };

  const handleEditRecord = (record: any) => {
    setEditingRecord(record);
    setEditFormData({
      createdBy: record.data.createdBy || "",
      warehouseLocation: record.data.warehouseLocation || "",
      leadTime: record.data.leadTime || "",
      category: record.data.category || "",
      itemName: record.data.itemName || "",
      quantity: record.data.quantity || "",
      uom: record.data.uom || "",
      itemCode: record.data.itemCode || "",
      attachment: null,
      existingAttachmentUrl: record.data.attachment || "",
    });
    setEditOpen(true);
  };

  const updateRecordInSheet = async () => {
    if (!editingRecord) return;

    setIsEditSubmitting(true);

    try {
      let finalAttachmentUrl = editFormData.existingAttachmentUrl;
      if (editFormData.attachment) {
        try {
          const fileData = new FormData();
          fileData.append("file", editFormData.attachment);
          fileData.append("folder", "indents");

          const uploadRes = await fetch("/api/upload-supabase", {
            method: "POST",
            body: fileData
          });
          if (!uploadRes.ok) throw new Error(`Upload failed with status ${uploadRes.status}`);
          const uploadJson = await uploadRes.json();
          if (uploadJson.success && uploadJson.url) {
            finalAttachmentUrl = uploadJson.url;
          } else {
            throw new Error(uploadJson.error || "Upload failed");
          }
        } catch (uploadErr) {
          console.error("Upload error during edit:", uploadErr);
        }
      }

      const res = await fetch("/api/create-indent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "updateIndent",
          id: editingRecord.dbId,
          createdBy: editFormData.createdBy,
          warehouseLocation: editFormData.warehouseLocation,
          leadTime: editFormData.leadTime ? parseInt(editFormData.leadTime) : null,
          category: editFormData.category,
          itemName: editFormData.itemName,
          quantity: editFormData.quantity ? parseFloat(editFormData.quantity) : 0,
          uom: editFormData.uom,
          itemCode: editFormData.itemCode,
          attachment: finalAttachmentUrl
        }),
      });
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to update record");
      }

      setEditOpen(false);
      setEditingRecord(null);
      await fetchData();
    } catch (error: any) {
      console.error("Error updating record:", error);
      alert("Error updating record: " + (error?.message || "Please check console."));
    } finally {
      setIsEditSubmitting(false);
    }
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

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
            disabled={disabled}
          >
            {value
              ? options.find((option) => option === value) || value
              : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput
              placeholder={searchPlaceholder}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                <div
                  className="py-2 px-4 text-sm text-indigo-600 cursor-pointer hover:bg-indigo-50 flex items-center gap-2 font-semibold"
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
              </CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => {
                      onChange(option);
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

  return (
    <div className="mt-0 outline-none flex-1 flex flex-col overflow-hidden">
      <StageTable
        title=""
        stage={1}
        pending={pending}
        history={[]}
        onSelectRecord={(record) => handleEditRecord(record)}
        showPending={true}
        hideTableTitle={true}
        columns={[
          { key: "indentNumber", label: "Indent" },
          { key: "createdBy", label: "Created By" },
          { key: "category", label: "Category" },
          { key: "warehouseLocation", label: "Warehouse" },
          { key: "leadTime", label: "Lead Time" },
          { key: "itemName", label: "Item" },
          { key: "quantity", label: "Qty" },
          { key: "uom", label: "UOM" },
          { key: "itemCode", label: "Item Code" },
          { key: "status", label: "Status" },
          { key: "attachment", label: "Attachment" },
        ]}
      />

      {/* === INDENT CREATION MODAL === */}
      <Dialog open={openCreateModal} onOpenChange={setOpenCreateModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Create New Indent</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="createdBy">Created By</Label>
                <Select
                  value={formData.createdBy}
                  onValueChange={(val) =>
                    setFormData({ ...formData, createdBy: val })
                  }
                >
                  <SelectTrigger id="createdBy">
                    <SelectValue placeholder="Select creator" />
                  </SelectTrigger>
                  <SelectContent>
                    {createdByOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="warehouseLocation">Warehouse Location</Label>
                <Select
                  value={formData.warehouseLocation}
                  onValueChange={(val) =>
                    setFormData({ ...formData, warehouseLocation: val })
                  }
                >
                  <SelectTrigger id="warehouseLocation">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="leadTime">Lead Time (Days)</Label>
                <Input
                  id="leadTime"
                  type="number"
                  min="1"
                  placeholder="e.g. 7"
                  value={formData.leadTime}
                  onChange={(e) =>
                    setFormData({ ...formData, leadTime: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Attachment (Optional)</Label>
                <div className="flex flex-col gap-2">
                  <input
                    id="indent-attachment"
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setFormData({ ...formData, attachment: file });
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="indent-attachment"
                    className="flex items-center justify-center w-full p-6 border-2 border-dashed border-indigo-200 bg-indigo-50/10 hover:bg-indigo-50/20 hover:border-indigo-400 transition-all rounded-xl cursor-pointer group"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-2.5 bg-indigo-100/60 rounded-full group-hover:bg-indigo-100 text-indigo-600 transition-colors">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-indigo-900">Click to upload document</p>
                        <p className="text-xs text-slate-500">PDF, JPG, PNG or DOC (max 10MB)</p>
                      </div>
                    </div>
                  </label>

                  {formData.attachment && (
                    <div className="flex items-center justify-between p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <FileText className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-900 truncate max-w-[250px]">
                            {formData.attachment.name}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {(formData.attachment.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        onClick={() => setFormData({ ...formData, attachment: null })}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Items</Label>
                  <Button
                    type="button"
                    onClick={() => setAddItemOpen(true)}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                  >
                    Add Item
                  </Button>
                </div>

                {formData.items.length === 0 ? (
                  <div className="p-4 sm:p-6 text-center border rounded-lg border-dashed">
                    <p className="text-sm text-gray-500">
                      No items added yet. Click "Add Item" to begin.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.items.map((item, index) => (
                      <div key={index} className="p-3.5 border border-indigo-100 bg-indigo-50/15 rounded-xl shadow-2xs hover:bg-indigo-50/30 transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="font-bold text-indigo-950">{item.itemName}</span>
                            </div>
                            <div>
                              <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-800 border-indigo-200">
                                {item.category}
                              </Badge>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-600">Qty: {item.quantity} {item.uom}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-xs font-mono text-slate-500">Item Code: {item.itemCode}</span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                items: formData.items.filter((_, i) => i !== index),
                              });
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-3 flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenCreateModal(false)}
              className="w-full sm:w-auto border-indigo-100 hover:bg-indigo-50/50 hover:text-indigo-600"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !formData.createdBy ||
                !formData.warehouseLocation ||
                !formData.leadTime ||
                formData.items.length === 0 ||
                isSubmitting
              }
              onClick={handleSubmit}
              className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold"
            >
              {isSubmitting ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  Create Indent ({formData.items.length} item{formData.items.length !== 1 ? "s" : ""})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === ADD ITEM SUB-MODAL === */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Add Multiple Items</DialogTitle>
            <p className="text-sm text-gray-600">Add one or more items to the indent.</p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            <form onSubmit={handleAddItem} className="space-y-3">
              {itemForm.items.map((item, index) => (
                <div key={index} className="border rounded-lg p-3 relative">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-sm">Item {index + 1}</h3>
                    {itemForm.items.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-700 h-8"
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Combobox
                        options={categoryOptions}
                        value={item.category}
                        onChange={(val) => updateItem(index, "category", val)}
                        placeholder="Select category"
                        searchPlaceholder="Search category..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Item Name</Label>
                      <Combobox
                        options={item.category ? getItemsByCategory(item.category).map(i => i.itemName) : []}
                        value={item.itemName}
                        onChange={(val) => updateItem(index, "itemName", val)}
                        placeholder={item.category ? "Select or type item" : "Select category first"}
                        searchPlaceholder="Search or create item..."
                        disabled={!item.category}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="e.g. 5"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>UOM</Label>
                      <Select
                        value={item.uom}
                        onValueChange={(val) => updateItem(index, "uom", val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {uomOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Item Code</Label>
                      <Input
                        type="text"
                        placeholder="e.g. IC-001"
                        value={item.itemCode}
                        onChange={(e) => updateItem(index, "itemCode", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addNewItem}
                  className="w-full border-indigo-200 text-indigo-700 bg-indigo-50/30 hover:bg-indigo-100 font-bold"
                  size="sm"
                >
                  + Add Another Item
                </Button>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddItemOpen(false)}
                  className="w-full sm:w-auto border-indigo-100 hover:bg-indigo-50/50 hover:text-indigo-600"
                >
                  Cancel
                </Button>
                <Button type="submit" className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold">
                  Add {itemForm.items.length} Item{itemForm.items.length > 1 ? "s" : ""} to Indent
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* === EDIT RECORD MODAL === */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Indent Record</DialogTitle>
            <p className="text-sm text-gray-600">
              {editingRecord ? `Editing: ${editingRecord.data.indentNumber}` : ""}
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateRecordInSheet();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Created By</Label>
                  <Select
                    value={editFormData.createdBy}
                    onValueChange={(val) =>
                      setEditFormData({ ...editFormData, createdBy: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select creator" />
                    </SelectTrigger>
                    <SelectContent>
                      {createdByOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Warehouse Location</Label>
                  <Select
                    value={editFormData.warehouseLocation}
                    onValueChange={(val) =>
                      setEditFormData({ ...editFormData, warehouseLocation: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Combobox
                    options={categoryOptions}
                    value={editFormData.category}
                    onChange={(val) =>
                      setEditFormData({
                        ...editFormData,
                        category: val,
                        itemName: "",
                        itemCode: ""
                      })
                    }
                    placeholder="Select category"
                    searchPlaceholder="Search category..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Item Name</Label>
                  <Combobox
                    options={editFormData.category ? getItemsByCategory(editFormData.category).map(i => i.itemName) : []}
                    value={editFormData.itemName}
                    onChange={(val) => {
                      const selectedItem = dropdownData.find(
                        d => d.category === editFormData.category && d.itemName === val
                      );
                      setEditFormData({
                        ...editFormData,
                        itemName: val,
                        itemCode: selectedItem?.itemCode || ""
                      });
                    }}
                    placeholder={editFormData.category ? "Select item" : "Select category first"}
                    searchPlaceholder="Search item..."
                    disabled={!editFormData.category}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Enter quantity"
                    value={editFormData.quantity}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, quantity: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>UOM</Label>
                  <Select
                    value={editFormData.uom}
                    onValueChange={(val) =>
                      setEditFormData({ ...editFormData, uom: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select UOM" />
                    </SelectTrigger>
                    <SelectContent>
                      {uomOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Lead Time (Days)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Enter lead time"
                    value={editFormData.leadTime}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, leadTime: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Item Code</Label>
                <Input
                  type="text"
                  placeholder="Auto-filled"
                  value={editFormData.itemCode}
                  readOnly
                  className="bg-slate-50 font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label>Attachment</Label>
                <div className="flex flex-col gap-3">
                  {editFormData.existingAttachmentUrl && !editFormData.attachment && (() => {
                    const isImage = editFormData.existingAttachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)|(drive\.google\.com.*(id=|\/d\/))/i);
                    let previewUrl = editFormData.existingAttachmentUrl;

                    if (previewUrl.includes('drive.google.com')) {
                      const fileId = previewUrl.match(/\/d\/(.+?)\//)?.[1] || previewUrl.match(/id=(.+?)(&|$)/)?.[1];
                      if (fileId) {
                        previewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
                      }
                    }

                    return (
                      <div className="relative group overflow-hidden rounded-xl border border-slate-200 bg-slate-100/50 aspect-video flex flex-col items-center justify-center transition-all hover:bg-slate-100">
                        {isImage ? (
                          <img
                            src={previewUrl}
                            alt="Previous attachment"
                            className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : null}

                        <div className="relative z-10 flex flex-col items-center gap-3">
                          <a
                            href={editFormData.existingAttachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 px-4 py-2 rounded-lg shadow-sm font-semibold text-slate-900 hover:bg-white hover:scale-105 transition-all text-sm"
                          >
                            <FileText className="w-4 h-4" />
                            Open Previous Attachment
                          </a>
                          {!isImage && (
                            <p className="text-[10px] text-slate-500 font-medium bg-slate-200/50 px-2 py-1 rounded">No image preview available</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <input
                    id="edit-indent-attachment"
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setEditFormData({ ...editFormData, attachment: file });
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="edit-indent-attachment"
                    className="flex items-center justify-center w-full py-4 px-4 border-2 border-dashed border-indigo-200 bg-indigo-50/10 hover:bg-indigo-50/20 hover:border-indigo-400 transition-all rounded-xl cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors text-indigo-600">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div className="text-left leading-tight">
                        <p className="text-sm font-semibold text-indigo-900">
                          {editFormData.attachment ? "Change Document" : "Update Document"}
                        </p>
                        <p className="text-[10px] text-slate-500">PDF, JPG, PNG or DOC (max 10MB)</p>
                      </div>
                    </div>
                  </label>

                  {editFormData.attachment && (
                    <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-lg animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center gap-3">
                        <div className="p-1 bg-blue-100 rounded-md">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex flex-col leading-none">
                          <span className="text-xs font-semibold text-slate-900 truncate max-w-[200px]">
                            {editFormData.attachment.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">New document selected</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-600"
                        onClick={() => setEditFormData({ ...editFormData, attachment: null })}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditOpen(false);
                    setEditingRecord(null);
                  }}
                  className="w-full sm:w-auto border-indigo-100 hover:bg-indigo-50/50 hover:text-indigo-600"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold"
                  disabled={isEditSubmitting}
                >
                  {isEditSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
