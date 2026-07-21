import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";

async function getUserTable() {
  const { error } = await supabase.from("pfms_User").select("id").limit(1);
  if (error && error.code === "42P01") {
    return "pfms_User";
  }
  return "pfms_User";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password are required." },
        { status: 400 }
      );
    }

    const tableName = await getUserTable();
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    // Fetch user from Supabase by username
    const { data: users, error } = await supabase
      .from(tableName)
      .select("*")
      .ilike("username", cleanUsername);

    if (error) {
      console.error("Supabase login query error:", error);
      return NextResponse.json(
        { success: false, error: "Database error during login." },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password." },
        { status: 401 }
      );
    }

    // Find exact match (case-sensitive or exact trim)
    const foundUser = users.find(
      (u: any) =>
        u.username?.trim().toLowerCase() === cleanUsername.toLowerCase() &&
        u.password?.trim() === cleanPassword
    );

    if (!foundUser) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password." },
        { status: 401 }
      );
    }

    // Parse pageAccess into string array
    let accessList: string[] = [];
    if (Array.isArray(foundUser.pageAccess)) {
      accessList = foundUser.pageAccess;
    } else if (typeof foundUser.pageAccess === "string") {
      const str = foundUser.pageAccess.trim();
      if (str.toUpperCase() === "ALL") {
        accessList = ["ALL"];
      } else {
        accessList = str.split(",").map((p: string) => p.trim()).filter(Boolean);
      }
    } else {
      accessList = ["ALL"];
    }

    return NextResponse.json({
      success: true,
      user: {
        id: foundUser.id,
        username: foundUser.username,
        fullName: foundUser.fullName || foundUser.username,
        role: foundUser.role || "USER",
        pageAccess: accessList,
      },
    });
  } catch (err: any) {
    console.error("Login API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Authentication failed." },
      { status: 500 }
    );
  }
}
