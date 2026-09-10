"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface AuthContextType {
  isAuthenticated: boolean;
  user: string | null;
  fullName: string | null;
  role: string | null;
  pageAccess: string[];
  records: string;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [pageAccess, setPageAccess] = useState<string[]>([]);
  const [records, setRecords] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check for existing session on mount and refresh data from Supabase
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = localStorage.getItem("user");
        const storedFullName = localStorage.getItem("fullName");
        const storedRole = localStorage.getItem("role");
        const storedAuth = localStorage.getItem("isAuthenticated");
        const storedAccess = localStorage.getItem("pageAccess");
        const storedRecords = localStorage.getItem("records");

        if (storedAuth === "true" && storedUser) {
          // 1. Instant Restore from LocalStorage
          setIsAuthenticated(true);
          setUser(storedUser);
          setFullName(storedFullName);
          setRole(storedRole);
          if (storedAccess) {
            try {
              setPageAccess(JSON.parse(storedAccess));
            } catch {
              setPageAccess([]);
            }
          }
          setRecords(storedRecords || "ALL");

          // 2. Background Refresh from Supabase API
          try {
            const response = await fetch(
              `/api/auth/me?username=${encodeURIComponent(storedUser)}`
            );
            if (response.ok) {
              const resData = await response.json();
              if (resData.success && resData.user) {
                const u = resData.user;
                const newFullName = u.fullName || storedUser;
                const newRole = u.role || "User";
                const newAccessList = Array.isArray(u.pageAccess)
                  ? u.pageAccess
                  : [];
                const newRecords = u.records || "ALL";

                // Update State
                setFullName(newFullName);
                setRole(newRole);
                setPageAccess(newAccessList);
                setRecords(newRecords);

                // Update Storage
                localStorage.setItem("fullName", newFullName);
                localStorage.setItem("role", newRole);
                localStorage.setItem("pageAccess", JSON.stringify(newAccessList));
                localStorage.setItem("records", newRecords);
              }
            }
          } catch (fetchErr) {
            console.error("Background session refresh failed:", fetchErr);
          }
        }
      } catch (e) {
        console.error("Auth initialization error:", e);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.user) {
        const u = data.user;
        const accessList = Array.isArray(u.pageAccess) ? u.pageAccess : ["ALL"];
        const recordsValue = u.records || "ALL";

        setIsAuthenticated(true);
        setUser(u.username);
        setFullName(u.fullName || u.username);
        setRole(u.role || "User");
        setPageAccess(accessList);
        setRecords(recordsValue);

        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("user", u.username);
        localStorage.setItem("fullName", u.fullName || u.username);
        localStorage.setItem("role", u.role || "User");
        localStorage.setItem("pageAccess", JSON.stringify(accessList));
        localStorage.setItem("records", recordsValue);

        router.push("/");
        return true;
      }

      return false;
    } catch (error) {
      console.error("Login Error:", error);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setFullName(null);
    setRole(null);
    setPageAccess([]);
    setRecords("ALL");

    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("user");
    localStorage.removeItem("fullName");
    localStorage.removeItem("role");
    localStorage.removeItem("pageAccess");
    localStorage.removeItem("records");

    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        fullName,
        role,
        pageAccess,
        records,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
