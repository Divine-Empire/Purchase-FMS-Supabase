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

/**
 * Server-side duplicate guard for pfms_item_master, used by addItem/updateItem.
 * Mirrors the client-side check in dropdownsMaster.tsx (case-insensitive, trimmed),
 * but re-verified against the DB so a stale client list or a concurrent add can't slip
 * a duplicate through. `excludeId` is passed on update so the row isn't compared to itself.
 * Returns an error message string if a duplicate is found, or null if the entry is clear.
 */
async function findItemDuplicate(
  category: string,
  itemName: string,
  itemCode: string | undefined,
  excludeId?: string
): Promise<string | null> {
  // Category + Item Name combination must be unique.
  let nameQuery = supabase
    .from("pfms_item_master")
    .select("id")
    .ilike("ITEM NAME", itemName)
    .ilike("ITEM CATEGORY", category)
    .limit(1);
  if (excludeId) nameQuery = nameQuery.neq("id", excludeId);
  const { data: nameMatch, error: nameError } = await nameQuery;
  if (nameError) throw nameError;
  if (nameMatch && nameMatch.length > 0) {
    return `Item "${itemName}" already exists under category "${category}".`;
  }

  // Item Code, if given, must be unique across all items.
  if (itemCode) {
    let codeQuery = supabase
      .from("pfms_item_master")
      .select("id")
      .ilike("ITEM CODE", itemCode)
      .limit(1);
    if (excludeId) codeQuery = codeQuery.neq("id", excludeId);
    const { data: codeMatch, error: codeError } = await codeQuery;
    if (codeError) throw codeError;
    if (codeMatch && codeMatch.length > 0) {
      return `Item code "${itemCode}" is already assigned to another item.`;
    }
  }

  return null;
}

/**
 * Server-side duplicate guard for pfms_vendor-master, used by addVendor/updateVendor.
 * Same shape as findItemDuplicate above.
 */
async function findVendorDuplicate(
  vendorName: string,
  vendorCode: string | undefined,
  excludeId?: string
): Promise<string | null> {
  let nameQuery = supabase
    .from("pfms_vendor-master")
    .select("id")
    .ilike("Vendor List", vendorName)
    .limit(1);
  if (excludeId) nameQuery = nameQuery.neq("id", excludeId);
  const { data: nameMatch, error: nameError } = await nameQuery;
  if (nameError) throw nameError;
  if (nameMatch && nameMatch.length > 0) {
    return `Vendor "${vendorName}" already exists.`;
  }

  if (vendorCode) {
    let codeQuery = supabase
      .from("pfms_vendor-master")
      .select("id")
      .ilike("Vendor Code", vendorCode)
      .limit(1);
    if (excludeId) codeQuery = codeQuery.neq("id", excludeId);
    const { data: codeMatch, error: codeError } = await codeQuery;
    if (codeError) throw codeError;
    if (codeMatch && codeMatch.length > 0) {
      return `Vendor code "${vendorCode}" is already assigned to another vendor.`;
    }
  }

  return null;
}

// Live "which Item/Vendor names on real records don't match anything in Master" report,
// used by the Master page's rename/remap tool. Computed on demand (not cached) so it always
// reflects the current state of pfms_indent_generation / pfms_negotiation / pfms_item_master
// / pfms_vendor-master. Kept out of the main GET payload above since it's a heavier,
// multi-table scan that the normal dropdowns page load doesn't need.
const MISMATCH_REPORT_LIMIT = 50;

async function buildMismatchReport() {
  // The four source tables are independent of each other, so fetch them all in parallel
  // instead of one after another — this is what was actually making the tool feel slow to
  // open (four sequential paginated round-trips instead of one wave of concurrent ones).
  const [items, vendors, indents, negotiations] = await Promise.all([
    fetchAllRows("pfms_item_master", '"ITEM NAME"'),
    fetchAllRows("pfms_vendor-master", '"Vendor List"'),
    fetchAllRows("pfms_indent_generation", "indentNo, itemName"),
    fetchAllRows("pfms_negotiation", "indentNo, selectedVendorName"),
  ]);

  const itemNameSet = new Set((items as any[]).map((r) => (r["ITEM NAME"] || "").trim()).filter(Boolean));
  const vendorNameSet = new Set((vendors as any[]).map((r) => (r["Vendor List"] || "").trim()).filter(Boolean));

  const vendorNameByIndent = new Map<string, string>();
  for (const n of negotiations as any[]) {
    if (n.selectedVendorName) vendorNameByIndent.set(n.indentNo, n.selectedVendorName);
  }

  const itemGroups = new Map<string, Set<string>>();
  const vendorGroups = new Map<string, Set<string>>();
  for (const ind of indents as any[]) {
    const itemName = (ind.itemName || "").trim();
    if (itemName && !itemNameSet.has(itemName)) {
      if (!itemGroups.has(itemName)) itemGroups.set(itemName, new Set());
      itemGroups.get(itemName)!.add(ind.indentNo);
    }
    const vendorName = (vendorNameByIndent.get(ind.indentNo) || "").trim();
    if (vendorName && !vendorNameSet.has(vendorName)) {
      if (!vendorGroups.has(vendorName)) vendorGroups.set(vendorName, new Set());
      vendorGroups.get(vendorName)!.add(ind.indentNo);
    }
  }

  const allUnmatchedItems = Array.from(itemGroups.entries())
    .map(([name, indentSet]) => ({ name, indentNos: Array.from(indentSet), count: indentSet.size }))
    .sort((a, b) => b.count - a.count);
  const allUnmatchedVendors = Array.from(vendorGroups.entries())
    .map(([name, indentSet]) => ({ name, indentNos: Array.from(indentSet), count: indentSet.size }))
    .sort((a, b) => b.count - a.count);

  // Fixing the highest-impact names first (most affected indents) matters more than seeing
  // all of them at once, and rendering hundreds of rows in the modal is its own slowdown —
  // so only the top 50 of each go back to the client; totalXxxCount says how many remain.
  return {
    unmatchedItems: allUnmatchedItems.slice(0, MISMATCH_REPORT_LIMIT),
    totalUnmatchedItems: allUnmatchedItems.length,
    unmatchedVendors: allUnmatchedVendors.slice(0, MISMATCH_REPORT_LIMIT),
    totalUnmatchedVendors: allUnmatchedVendors.length,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("report") === "mismatches") {
      const report = await buildMismatchReport();
      return NextResponse.json({ success: true, ...report });
    }

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

      // Server-side duplicate guard — the client also checks this against its already-loaded
      // list, but that's bypassable (stale data, concurrent adds), so re-verify against the DB here.
      const dupError = await findItemDuplicate(category.trim(), itemName.trim(), itemCode?.trim());
      if (dupError) {
        return NextResponse.json({ success: false, error: dupError }, { status: 409 });
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

      const dupError = await findItemDuplicate(category.trim(), itemName.trim(), itemCode?.trim(), id);
      if (dupError) {
        return NextResponse.json({ success: false, error: dupError }, { status: 409 });
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

      const dupError = await findVendorDuplicate(vendorName.trim(), vendorCode?.trim());
      if (dupError) {
        return NextResponse.json({ success: false, error: dupError }, { status: 409 });
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

    if (action === "updateVendor") {
      const { id, vendorCode, vendorName } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
      }
      if (!vendorName) {
        return NextResponse.json({ success: false, error: "Missing vendorName" }, { status: 400 });
      }

      const dupError = await findVendorDuplicate(vendorName.trim(), vendorCode?.trim(), id);
      if (dupError) {
        return NextResponse.json({ success: false, error: dupError }, { status: 409 });
      }

      const { error } = await supabase
        .from("pfms_vendor-master")
        .update({
          "Vendor Code": vendorCode?.trim() || null,
          "Vendor List": vendorName.trim()
        })
        .eq("id", id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // --- Rename/remap an unmatched Item Name across existing indents (Master data-cleanup
    // tool). Only ever repoints itemName (and the itemCode/category that go with it) on
    // pfms_indent_generation and pfms_order-cancellation — Serial Generation, Dashboard,
    // etc. all read itemName by joining back to pfms_indent_generation, so nothing else
    // needs to change. `toItemId` must be an existing pfms_item_master row.
    if (action === "renameItem") {
      const { fromName, toItemId } = body;
      if (!fromName || !toItemId) {
        return NextResponse.json({ success: false, error: "Missing fromName or toItemId" }, { status: 400 });
      }

      const { data: target, error: targetError } = await supabase
        .from("pfms_item_master")
        .select('"ITEM CODE", "ITEM CATEGORY", "ITEM NAME"')
        .eq("id", toItemId)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!target) {
        return NextResponse.json({ success: false, error: "Target item not found in Item Master" }, { status: 404 });
      }

      const updatePayload = {
        itemName: target["ITEM NAME"],
        category: target["ITEM CATEGORY"],
        itemCode: target["ITEM CODE"],
      };

      const { data: updatedIndents, error: indentError } = await supabase
        .from("pfms_indent_generation")
        .update(updatePayload)
        .ilike("itemName", fromName.trim())
        .select("indentNo");
      if (indentError) throw indentError;

      const { error: cancelError } = await supabase
        .from("pfms_order-cancellation")
        .update({ itemName: target["ITEM NAME"] })
        .ilike("itemName", fromName.trim());
      if (cancelError) throw cancelError;

      return NextResponse.json({ success: true, updatedCount: (updatedIndents || []).length });
    }

    // --- Rename/remap an unmatched Vendor Name across existing records. Repoints
    // pfms_negotiation.selectedVendorName and the vendor1/2/3Name columns on
    // pfms_update-3-vendors wherever they hold the old (unmatched) name. `toVendorId`
    // must be an existing pfms_vendor-master row.
    if (action === "renameVendor") {
      const { fromName, toVendorId } = body;
      if (!fromName || !toVendorId) {
        return NextResponse.json({ success: false, error: "Missing fromName or toVendorId" }, { status: 400 });
      }

      const { data: target, error: targetError } = await supabase
        .from("pfms_vendor-master")
        .select('"Vendor List"')
        .eq("id", toVendorId)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!target) {
        return NextResponse.json({ success: false, error: "Target vendor not found in Vendor Master" }, { status: 404 });
      }
      const toName = target["Vendor List"];

      const { data: updatedNeg, error: negError } = await supabase
        .from("pfms_negotiation")
        .update({ selectedVendorName: toName })
        .ilike("selectedVendorName", fromName.trim())
        .select("indentNo");
      if (negError) throw negError;

      let updatedVendorSlots = 0;
      for (const col of ["vendor1Name", "vendor2Name", "vendor3Name"]) {
        const { data: updated, error: colError } = await supabase
          .from("pfms_update-3-vendors")
          .update({ [col]: toName })
          .ilike(col, fromName.trim())
          .select("indentNo");
        if (colError) throw colError;
        updatedVendorSlots += (updated || []).length;
      }

      return NextResponse.json({
        success: true,
        updatedCount: (updatedNeg || []).length,
        updatedVendorSlots,
      });
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
