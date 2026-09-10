"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { PAGE_ACCESS_OPTIONS } from "@/lib/constants";

export interface UserFormData {
  id?: string;
  fullName: string;
  username: string;
  password: string;
  role: string;
  pageAccess: string[];
  records?: string;
}

interface CreateUserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: UserFormData | null;
  onSubmitSuccess: () => void;
}

export default function CreateUserForm({
  open,
  onOpenChange,
  initialData,
  onSubmitSuccess,
}: CreateUserFormProps) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("USER");
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [recordsAccess, setRecordsAccess] = useState("ALL");
  const [purchaserOptions, setPurchaserOptions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Fetch the current Purchaser list (from the Master > Dropdown Fields config)
    // so "Records Access" always reflects whatever purchasers exist right now.
    fetch("/api/dropdowns")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setPurchaserOptions(json.data.purchaserOptions || []);
        }
      })
      .catch((err) => console.error("Failed to load purchaser options:", err));
  }, []);

  useEffect(() => {
    setShowPassword(false);
    if (initialData) {
      setFullName(initialData.fullName || "");
      setUsername(initialData.username || "");
      setPassword(initialData.password || "");
      setRole(initialData.role || "USER");
      setRecordsAccess(initialData.records || "ALL");

      // Extract raw page access items
      let rawAccess: string[] = [];
      if (Array.isArray(initialData.pageAccess)) {
        rawAccess = initialData.pageAccess;
      } else if (typeof initialData.pageAccess === "string") {
        rawAccess = (initialData.pageAccess as string)
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
      }

      const hasAll = rawAccess.some((p) => p.toUpperCase() === "ALL");
      if (hasAll) {
        setSelectedPages([...PAGE_ACCESS_OPTIONS]);
      } else {
        // Match raw access items to PAGE_ACCESS_OPTIONS case-insensitively
        const matched = PAGE_ACCESS_OPTIONS.filter((opt) =>
          rawAccess.some(
            (r) =>
              r.toLowerCase() === opt.toLowerCase() ||
              (opt === "Verification by Accounts" &&
                r.toLowerCase().includes("verification"))
          )
        );
        setSelectedPages(matched);
      }
    } else {
      setFullName("");
      setUsername("");
      setPassword("");
      setRole("USER");
      setSelectedPages([]);
      setRecordsAccess("ALL");
    }
  }, [initialData, open]);

  const isAllSelected =
    PAGE_ACCESS_OPTIONS.length > 0 &&
    PAGE_ACCESS_OPTIONS.every((page) => selectedPages.includes(page));

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedPages([...PAGE_ACCESS_OPTIONS]);
    } else {
      setSelectedPages([]);
    }
  };

  const handleTogglePage = (page: string, checked: boolean) => {
    if (checked) {
      setSelectedPages((prev) => Array.from(new Set([...prev, page])));
    } else {
      setSelectedPages((prev) => prev.filter((p) => p !== page));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error("Full Name is required");
      return;
    }
    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (!password.trim()) {
      toast.error("Password is required");
      return;
    }

    setIsSubmitting(true);
    try {
      // Determine pageAccess payload
      const pageAccessPayload = isAllSelected ? ["ALL"] : selectedPages;

      const payload = {
        id: initialData?.id,
        fullName: fullName.trim(),
        username: username.trim(),
        password: password.trim(),
        role: role.toUpperCase(),
        pageAccess: pageAccessPayload,
        records: recordsAccess,
      };

      const method = initialData?.id ? "PUT" : "POST";
      const res = await fetch("/api/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(
          initialData?.id
            ? "User updated successfully"
            : "User created successfully"
        );
        onSubmitSuccess();
        onOpenChange(false);
      } else {
        toast.error(data.error || "Failed to save user");
      }
    } catch (err: any) {
      console.error("Save user error:", err);
      toast.error("An error occurred while saving the user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-xl p-6 bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200">
        <DialogHeader className="pb-4 border-b border-slate-100">
          <DialogTitle className="text-xl font-bold text-slate-900">
            {initialData?.id ? "Edit User" : "Create User"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {/* Top Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Full Name</Label>
              <Input
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-10 border-slate-300 focus-visible:ring-blue-500 rounded-md"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Username</Label>
              <Input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-10 border-slate-300 focus-visible:ring-blue-500 rounded-md"
                required
              />
            </div>

            {/* Password Input with Eye Toggle */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 pr-10 border-slate-300 focus-visible:ring-blue-500 rounded-md"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Role</Label>
              <Select value={role} onValueChange={(val) => setRole(val)}>
                <SelectTrigger className="h-10 border-slate-300 focus:ring-blue-500 rounded-md bg-white">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">USER</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* PAGE ACCESS Section */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="text-xs font-bold tracking-wider text-slate-700 uppercase">
              PAGE ACCESS *
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-3 gap-x-2 pt-1 text-sm">
              {/* ALL Checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="page-access-all"
                  checked={isAllSelected}
                  onCheckedChange={(checked) => handleToggleAll(!!checked)}
                  className="border-slate-400 data-[state=checked]:bg-blue-600"
                />
                <label
                  htmlFor="page-access-all"
                  className="font-bold text-slate-900 cursor-pointer text-xs uppercase"
                >
                  ALL
                </label>
              </div>

              {/* Individual Page Access Checkboxes */}
              {PAGE_ACCESS_OPTIONS.map((page) => {
                const isChecked = selectedPages.includes(page);
                const pageId = `page-access-${page.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
                return (
                  <div key={page} className="flex items-center space-x-2">
                    <Checkbox
                      id={pageId}
                      checked={isChecked}
                      onCheckedChange={(checked) =>
                        handleTogglePage(page, !!checked)
                      }
                      className="border-slate-300 data-[state=checked]:bg-blue-600"
                    />
                    <label
                      htmlFor={pageId}
                      className="text-xs font-medium text-slate-700 cursor-pointer select-none truncate"
                      title={page}
                    >
                      {page}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RECORDS ACCESS Section */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="text-xs font-bold tracking-wider text-slate-700 uppercase">
              Records Access *
            </div>
            <p className="text-[11px] text-slate-500 -mt-1">
              Controls which purchaser's records this user can see across the app.
            </p>
            <Select value={recordsAccess} onValueChange={(val) => setRecordsAccess(val)}>
              <SelectTrigger className="h-10 border-slate-300 focus:ring-blue-500 rounded-md bg-white sm:w-64">
                <SelectValue placeholder="Select Records Access" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ALL</SelectItem>
                {purchaserOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Modal Footer Actions */}
          <DialogFooter className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="px-5 border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
            >
              {isSubmitting
                ? "Saving..."
                : initialData?.id
                ? "Update User"
                : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
