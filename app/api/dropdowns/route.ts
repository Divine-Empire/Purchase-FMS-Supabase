import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { OFFICE_HOURS } from "@/app/api/helper/plannedCalculator";

// Maps the "column" key used by the frontend (DROPDOWN_COLUMNS in dropdownsMaster.tsx)
// to the `category` value stored in the normalized pfms_dropdown (id, category, value) table.
const DROPDOWN_CATEGORIES = [
  "Created By",
  "Wharehouse",
  "UOM",
  "Payment Terms (Stage3)",
  "Approved By",
  "Transporter",
  "Purchaser",
  "Accounts",
  "Engineers",
  "Responsible Person",
  "QC-Checklist",
  "Reject Type (QC)",
] as const;

async function fetchAllRows(tableName: string, selectQuery: string) {
  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectQuery)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return allRows;
}

export async function GET() {
  try {
    // 1. Fetch all dropdown options (normalized category/value pairs)
    const dropdownRows = await fetchAllRows("pfms_dropdown", "category, value");

    // 2. Fetch all catalog items using the batching loop
    const itemRows = await fetchAllRows(
      "pfms_item_master",
      'id, "ITEM CODE", "ITEM CATEGORY", "ITEM NAME", purchaser'
    );

    // 3. Fetch all vendors using the batching loop
    const vendorRows = await fetchAllRows(
      "pfms_vendor-master",
      'id, "Vendor Code", "Vendor List"'
    );

    // Fetch all stage TAT / responsible-person rows
    const responsibleRows = await fetchAllRows(
      "pfms_tat",
      "id, stage_name, duration_in_minutes, responsible_persons"
    );

    // Fetch holidays from pfms_holidays (fully managed from this Master page — a standalone
    // table with no triggers/links to any other system).
    let holidayRows: any[] = [];
    try {
      holidayRows = await fetchAllRows("pfms_holidays", "id, holiday_date, day, holiday_name");
    } catch (err) {
      console.error("Error fetching holidays in dropdowns GET:", err);
    }

    // 4. Group dropdown rows by category -> unique, non-empty option lists
    const optionsByCategory: Record<string, string[]> = {};
    for (const row of dropdownRows as any[]) {
      const cat = row.category?.trim();
      const val = row.value?.trim();
      if (!cat || !val) continue;
      if (!optionsByCategory[cat]) optionsByCategory[cat] = [];
      if (!optionsByCategory[cat].includes(val)) optionsByCategory[cat].push(val);
    }
    const getOptions = (category: string) => optionsByCategory[category] || [];

    const createdByOptions = getOptions("Created By");
    const warehouseOptions = getOptions("Wharehouse");
    const uomOptions = getOptions("UOM");
    const paymentTermsOptions = getOptions("Payment Terms (Stage3)");
    const approvedByOptions = getOptions("Approved By");
    const transporterOptions = getOptions("Transporter");
    const purchaserOptions = getOptions("Purchaser");
    const accountsOptions = getOptions("Accounts");
    const engineersOptions = getOptions("Engineers");
    const responsiblePersonOptions = getOptions("Responsible Person");
    const qcChecklistOptions = getOptions("QC-Checklist");
    const rejectTypeQcOptions = getOptions("Reject Type (QC)");

    const vendorListOptions = Array.from(
      new Set(
        vendorRows
          .map((r: any) => r["Vendor List"]?.trim())
          .filter(Boolean)
      )
    );

    const dropdownData = itemRows
      .filter((r: any) => r["ITEM CATEGORY"] && r["ITEM NAME"])
      .map((r: any) => ({
        itemCode: r["ITEM CODE"]?.trim() || "",
        category: r["ITEM CATEGORY"]?.trim() || "",
        itemName: r["ITEM NAME"]?.trim() || "",
      }));

    // Construct raw lists for items and vendors management
    const items = (itemRows || []).map((r: any) => ({
      id: r.id,
      itemCode: r["ITEM CODE"]?.trim() || "",
      category: r["ITEM CATEGORY"]?.trim() || "",
      itemName: r["ITEM NAME"]?.trim() || "",
      purchaser: r.purchaser?.trim() || "",
    }));

    const vendors = (vendorRows || []).map((r: any) => ({
      id: r.id,
      vendorCode: r["Vendor Code"]?.trim() || "",
      vendorName: r["Vendor List"]?.trim() || "",
    }));

    const responsiblePersons = (responsibleRows || []).map((r: any) => ({
      id: r.id,
      stageName: r.stage_name,
      durationMinutes: r.duration_in_minutes,
      responsibleNames: Array.isArray(r.responsible_persons) ? r.responsible_persons : [],
    }));

    const holidays = (holidayRows || [])
      .map((r: any) => ({
        id: r.id,
        date: r.holiday_date,
        day: r.day || "",
        name: r.holiday_name || "",
      }))
      .sort((a: any, b: any) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    return NextResponse.json({
      success: true,
      data: {
        createdByOptions,
        warehouseOptions,
        uomOptions,
        paymentTermsOptions,
        approvedByOptions,
        transporterOptions,
        vendorListOptions,
        purchaserOptions,
        accountsOptions,
        engineersOptions,
        responsiblePersonOptions,
        qcChecklistOptions,
        rejectTypeQcOptions,
        dropdownData,
        items,
        vendors,
        responsiblePersons,
        officeHours: OFFICE_HOURS,
        holidays,
      },
    });
  } catch (error: any) {
    console.error("Error in dropdowns API GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "addDropdownOption") {
      const { column, value } = body;
      if (!column || !value) {
        return NextResponse.json({ success: false, error: "Missing column or value" }, { status: 400 });
      }
      if (!DROPDOWN_CATEGORIES.includes(column)) {
        return NextResponse.json({ success: false, error: `Unknown dropdown category "${column}"` }, { status: 400 });
      }

      const { error } = await supabase
        .from("pfms_dropdown")
        .insert({
          id: randomUUID(),
          category: column,
          value: value.trim(),
        });

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "upsertResponsible") {
      const { id, stageName, responsiblePersons, durationMinutes } = body;
      if (!stageName) {
        return NextResponse.json({ success: false, error: "Missing stageName" }, { status: 400 });
      }

      // Normalize the responsible-person list: trim, uppercase, drop blanks/duplicates
      const normalizedNames: string[] = Array.from(
        new Set(
          (Array.isArray(responsiblePersons) ? responsiblePersons : [])
            .map((s: string) => s.trim().toUpperCase())
            .filter(Boolean)
        )
      );

      const minutes = durationMinutes !== undefined ? parseInt(durationMinutes) || 0 : 0;

      // Find the row by id or stage_name
      let targetId = id;
      if (!targetId) {
        const { data: existing, error: fetchError } = await supabase
          .from("pfms_tat")
          .select("id")
          .eq("stage_name", stageName.trim())
          .maybeSingle();
        if (fetchError) throw fetchError;
        targetId = existing?.id;
      }

      if (targetId) {
        // Update existing record in pfms_tat
        const { error: updateError } = await supabase
          .from("pfms_tat")
          .update({
            responsible_persons: normalizedNames,
            duration_in_minutes: minutes || 60,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetId);

        if (updateError) throw updateError;
      } else {
        // Insert new record in pfms_tat (id defaults via gen_random_uuid())
        const { error: insertError } = await supabase
          .from("pfms_tat")
          .insert({
            stage_name: stageName.trim(),
            duration_in_minutes: minutes || 60,
            responsible_persons: normalizedNames,
          });

        if (insertError) throw insertError;
      }

      return NextResponse.json({ success: true });
    }

    if (action === "addItem") {
      const { itemCode, category, itemName, purchaser } = body;
      if (!category || !itemName) {
        return NextResponse.json({ success: false, error: "Missing category or itemName" }, { status: 400 });
      }

      const { error } = await supabase
        .from("pfms_item_master")
        .insert({
          id: randomUUID(),
          "ITEM CODE": itemCode?.trim() || null,
          "ITEM CATEGORY": category.trim(),
          "ITEM NAME": itemName.trim(),
          purchaser: purchaser?.trim() || null,
        });

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "updateItem") {
      const { id, itemCode, category, itemName, purchaser } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
      }
      if (!category || !itemName) {
        return NextResponse.json({ success: false, error: "Missing category or itemName" }, { status: 400 });
      }

      const { error } = await supabase
        .from("pfms_item_master")
        .update({
          "ITEM CODE": itemCode?.trim() || null,
          "ITEM CATEGORY": category.trim(),
          "ITEM NAME": itemName.trim(),
          purchaser: purchaser?.trim() || null,
        })
        .eq("id", id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "addHoliday") {
      const { date, name } = body;
      if (!date || !name) {
        return NextResponse.json({ success: false, error: "Missing date or name" }, { status: 400 });
      }

      const day = new Date(date).toLocaleDateString("en-US", { weekday: "long" });

      const { error } = await supabase
        .from("pfms_holidays")
        .insert({
          holiday_date: date,
          day,
          holiday_name: name.trim(),
        });

      if (error) {
        if ((error as any).code === "23505") {
          return NextResponse.json({ success: false, error: "A holiday is already set for this date" }, { status: 400 });
        }
        throw error;
      }
      return NextResponse.json({ success: true });
    }

    if (action === "updateHoliday") {
      const { id, date, name } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
      }
      if (!date || !name) {
        return NextResponse.json({ success: false, error: "Missing date or name" }, { status: 400 });
      }

      const day = new Date(date).toLocaleDateString("en-US", { weekday: "long" });

      const { error } = await supabase
        .from("pfms_holidays")
        .update({
          holiday_date: date,
          day,
          holiday_name: name.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        if ((error as any).code === "23505") {
          return NextResponse.json({ success: false, error: "A holiday is already set for this date" }, { status: 400 });
        }
        throw error;
      }
      return NextResponse.json({ success: true });
    }

    if (action === "addVendor") {
      const { vendorCode, vendorName } = body;
      if (!vendorName) {
        return NextResponse.json({ success: false, error: "Missing vendorName" }, { status: 400 });
      }

      const { error } = await supabase
        .from("pfms_vendor-master")
        .insert({
          id: randomUUID(),
          "Vendor Code": vendorCode?.trim() || null,
          "Vendor List": vendorName.trim()
        });

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in POST /api/dropdowns:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "deleteDropdownOption") {
      const column = searchParams.get("column");
      const value = searchParams.get("value");

      if (!column || !value) {
        return NextResponse.json({ success: false, error: "Missing column or value" }, { status: 400 });
      }

      const { error } = await supabase
        .from("pfms_dropdown")
        .delete()
        .eq("category", column)
        .eq("value", value);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "deleteItem") {
      const id = searchParams.get("id");
      if (!id) {
        return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
      }

      const { error } = await supabase
        .from("pfms_item_master")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "deleteHoliday") {
      const id = searchParams.get("id");
      if (!id) {
        return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
      }

      const { error } = await supabase
        .from("pfms_holidays")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "deleteVendor") {
      const id = searchParams.get("id");
      if (!id) {
        return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
      }

      const { error } = await supabase
        .from("pfms_vendor-master")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in DELETE /api/dropdowns:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
