"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Search,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import CreateUserForm, { UserFormData } from "./createUserForm";

export interface UserRecord {
  id: string;
  fullName: string;
  username: string;
  password: string;
  role: string;
  pageAccess: string;
  records?: string;
  createdAt?: string;
}

export default function SettingsPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserFormData | null>(null);

  // Track password visibility per row id
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();

      if (data.success) {
        setUsers(data.data || []);
      } else {
        toast.error(data.error || "Failed to fetch users");
      }
    } catch (err: any) {
      console.error("Fetch users error:", err);
      toast.error("Failed to load user records");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCreateNew = () => {
    setEditingUser(null);
    setShowModal(true);
  };

  const handleEdit = (user: UserRecord) => {
    // Parse pageAccess into string array for form
    let accessList: string[] = [];
    if (user.pageAccess) {
      if (user.pageAccess.toUpperCase() === "ALL") {
        accessList = ["ALL"];
      } else {
        accessList = user.pageAccess.split(",").map((p) => p.trim()).filter(Boolean);
      }
    }

    setEditingUser({
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      password: user.password,
      role: user.role,
      pageAccess: accessList,
      records: user.records || "ALL",
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`User "${name}" deleted successfully`);
        fetchUsers();
      } else {
        toast.error(data.error || "Failed to delete user");
      }
    } catch (err: any) {
      console.error("Delete user error:", err);
      toast.error("An error occurred while deleting user");
    }
  };

  // Filter users based on search string
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const lower = searchTerm.toLowerCase();
    return users.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(lower) ||
        u.username?.toLowerCase().includes(lower) ||
        u.role?.toLowerCase().includes(lower)
    );
  }, [users, searchTerm]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage system users & roles</p>
        </div>
        <div>
          <Button
            onClick={handleCreateNew}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm gap-2"
          >
            <Plus className="w-4 h-4" />
            Create User
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Settings</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {users.length} {users.length === 1 ? "user" : "users"}
            </p>
          </div>
        </div>

        {/* Card wrapper */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Sub Header & Search Filter Bar */}
          <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-white border-slate-200 text-slate-700 font-semibold px-3 py-1 text-xs">
                Users ({users.length})
              </Badge>
              <div className="relative w-64 sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs border-slate-300 bg-white rounded-lg focus-visible:ring-blue-500"
                />
              </div>
            </div>

            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:bg-white border border-slate-200">
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </div>

          {/* Table View */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <TableHead className="w-[100px] text-center font-bold text-slate-700">ACTIONS</TableHead>
                  <TableHead className="font-bold text-slate-700">FULL NAME</TableHead>
                  <TableHead className="font-bold text-slate-700">USERNAME</TableHead>
                  <TableHead className="font-bold text-slate-700">PASSWORD</TableHead>
                  <TableHead className="font-bold text-slate-700">ROLE</TableHead>
                  <TableHead className="font-bold text-slate-700">PAGE ACCESS</TableHead>
                  <TableHead className="font-bold text-slate-700">RECORDS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-xs font-medium">Loading users...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-slate-500 text-sm">
                      No user records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const isPasswordVisible = !!visiblePasswords[user.id];
                    const isAdmin = user.role?.toUpperCase() === "ADMIN";

                    return (
                      <TableRow key={user.id} className="hover:bg-slate-50/80 transition-colors text-sm">
                        {/* Actions */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(user)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                              title="Edit User"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(user.id, user.fullName)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>

                        {/* Full Name */}
                        <TableCell className="font-semibold text-slate-900">
                          {user.fullName}
                        </TableCell>

                        {/* Username */}
                        <TableCell className="font-medium text-slate-600">
                          {user.username}
                        </TableCell>

                        {/* Password */}
                        <TableCell>
                          <div className="flex items-center gap-2 font-mono text-slate-600">
                            <span>{isPasswordVisible ? user.password : "••••••"}</span>
                            <button
                              onClick={() => togglePasswordVisibility(user.id)}
                              className="text-slate-400 hover:text-slate-600 transition-colors"
                              title={isPasswordVisible ? "Hide password" : "Show password"}
                            >
                              {isPasswordVisible ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </TableCell>

                        {/* Role Badge */}
                        <TableCell>
                          <Badge
                            className={
                              isAdmin
                                ? "bg-blue-600 hover:bg-blue-600 text-white font-bold text-[10px] px-2.5 py-0.5 tracking-wider uppercase"
                                : "bg-slate-100 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10px] px-2.5 py-0.5 tracking-wider uppercase"
                            }
                          >
                            {user.role || "USER"}
                          </Badge>
                        </TableCell>

                        {/* Page Access */}
                        <TableCell className="text-xs text-slate-600 max-w-xs truncate" title={user.pageAccess || "ALL"}>
                          <span className="font-semibold text-slate-800">
                            {user.pageAccess || "ALL"}
                          </span>
                        </TableCell>

                        {/* Records Access */}
                        <TableCell className="text-xs">
                          <Badge
                            variant="outline"
                            className="bg-indigo-50/50 font-bold text-indigo-700 text-[10px] uppercase border-indigo-100 px-2 py-0.5 rounded-full"
                          >
                            {user.records || "ALL"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Create / Edit User Form Modal */}
      <CreateUserForm
        open={showModal}
        onOpenChange={setShowModal}
        initialData={editingUser}
        onSubmitSuccess={fetchUsers}
      />
    </div>
  );
}
