import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";

// Helper to determine whether table is "User" or "users"
async function getUserTable() {
  const { error } = await supabase.from("pfms_User").select("id").limit(1);
  if (error && error.code === "42P01") {
    return "pfms_User";
  }
  return "pfms_User";
}

export async function GET() {
  try {
    const tableName = await getUserTable();
    const { data: users, error } = await supabase
      .from(tableName)
      .select("*")
      .order("createdAt", { ascending: false });

    if (error) {
      console.error("Error fetching users from Supabase:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: users || [] });
  } catch (err: any) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, username, password, role, pageAccess, records } = body;

    if (!username || !fullName || !password) {
      return NextResponse.json(
        { success: false, error: "Full Name, Username, and Password are required." },
        { status: 400 }
      );
    }

    const tableName = await getUserTable();

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from(tableName)
      .select("id")
      .eq("username", username.trim())
      .single();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Username already exists. Please choose a different username." },
        { status: 400 }
      );
    }

    // Prepare pageAccess as comma-separated string or string value
    const pageAccessStr = Array.isArray(pageAccess)
      ? pageAccess.join(", ")
      : String(pageAccess || "ALL");

    const newUserPayload = {
      id: crypto.randomUUID(),
      fullName: fullName.trim(),
      username: username.trim(),
      password: password.trim(),
      role: role || "USER",
      pageAccess: pageAccessStr,
      records: String(records || "ALL").trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(tableName)
      .insert([newUserPayload])
      .select()
      .single();

    if (error) {
      console.error("Error creating user:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("POST /api/users error:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to create user" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, fullName, username, password, role, pageAccess, records } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "User ID is required for update." }, { status: 400 });
    }

    const tableName = await getUserTable();

    const pageAccessStr = Array.isArray(pageAccess)
      ? pageAccess.join(", ")
      : String(pageAccess || "ALL");

    const updatePayload: any = {
      updatedAt: new Date().toISOString(),
    };
    if (fullName !== undefined) updatePayload.fullName = fullName.trim();
    if (username !== undefined) updatePayload.username = username.trim();
    if (password !== undefined) updatePayload.password = password.trim();
    if (role !== undefined) updatePayload.role = role;
    if (pageAccess !== undefined) updatePayload.pageAccess = pageAccessStr;
    if (records !== undefined) updatePayload.records = String(records || "ALL").trim();

    const { data, error } = await supabase
      .from(tableName)
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating user:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("PUT /api/users error:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "User ID is required for deletion." }, { status: 400 });
    }

    const tableName = await getUserTable();

    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting user:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (err: any) {
    console.error("DELETE /api/users error:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to delete user" }, { status: 500 });
  }
}
