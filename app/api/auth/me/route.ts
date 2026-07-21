import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";

async function getUserTable() {
  const { error } = await supabase.from("pfms_User").select("id").limit(1);
  if (error && error.code === "42P01") {
    return "pfms_User";
  }
  return "pfms_User";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json(
        { success: false, error: "Username parameter is required." },
        { status: 400 }
      );
    }

    const tableName = await getUserTable();
    const cleanUsername = username.trim();

    const { data: users, error } = await supabase
      .from(tableName)
      .select("*")
      .ilike("username", cleanUsername);

    if (error) {
      console.error("Supabase user fetch error:", error);
      return NextResponse.json(
        { success: false, error: "Database error fetching user profile." },
        { status: 500 }
      );
    }

    const foundUser = users?.find(
      (u: any) => u.username?.trim().toLowerCase() === cleanUsername.toLowerCase()
    );

    if (!foundUser) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    // Parse pageAccess
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
    console.error("User profile API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch user profile." },
      { status: 500 }
    );
  }
}
