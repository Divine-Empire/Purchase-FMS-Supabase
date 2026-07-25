import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { randomUUID } from "crypto";

// Helper function to safely quote column names for PostgREST filters (especially containing spaces or parentheses)
function quoteColumn(col: string) {
  if (col.startsWith('"') && col.endsWith('"')) {
    return col;
  }
  return `"${col}"`;
}

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
    // 1. Fetch dropdown options (createdBy, warehouse, uom, paymentTerms, approvedBy, etc.)
    const dropdownRows = await fetchAllRows(
      "pfms_dropdown",
      '"Created By", "Wharehouse", "UOM", "Payment Terms (Stage3)", "Approved By", "Transporter", "Checked By", "Tally Done By", "Checkers (Verification)", "QC-Checklist", "Reject Type (QC)"'
    );

    // 2. Fetch all catalog items using the batching loop
    const itemRows = await fetchAllRows(
      "pfms_item-master",
      'id, "ITEM CODE", "ITEM CATEGORY", "ITEM NAME"'
    );

    // 3. Fetch all vendors using the batching loop
    const vendorRows = await fetchAllRows(
      "pfms_vendor-master",
      'id, "Vendor Code", "Vendor List"'
    );

    // Fetch all responsible persons
    const responsibleRows = await fetchAllRows(
      "pfms_tat",
      "id, stageName, actionTime, responsibleNames"
    );

    // 4. Process lists to extract unique non-empty options
    const createdByOptions = Array.from(
      new Set(
        dropdownRows
          .map((r: any) => r["Created By"]?.trim())
          .filter(Boolean)
      )
    );

    const warehouseOptions = Array.from(
      new Set(
        dropdownRows
          .map((r: any) => r["Wharehouse"]?.trim())
          .filter(Boolean)
      )
    );

    const uomOptions = Array.from(
      new Set(
        dropdownRows
          .map((r: any) => r["UOM"]?.trim())
          .filter(Boolean)
      )
    );

    const paymentTermsOptions = Array.from(
      new Set(
        dropdownRows
          .map((r: any) => r["Payment Terms (Stage3)"]?.trim())
          .filter(Boolean)
      )
    );

    const approvedByOptions = Array.from(
      new Set(
        dropdownRows
          .map((r: any) => r["Approved By"]?.trim())
          .filter(Boolean)
      )
    );

    const transporterOptions = Array.from(
      new Set(
        dropdownRows
          .map((r: any) => r["Transporter"]?.trim())
          .filter(Boolean)
      )
    );

    const vendorListOptions = Array.from(
      new Set(
        vendorRows
          .map((r: any) => r["Vendor List"]?.trim())
          .filter(Boolean)
      )
    );

    const checkedByOptions = Array.from(
      new Set(
        dropdownRows
          .map((r: any) => r["Checked By"]?.trim())
          .filter(Boolean)
      )
    );

    const tallyDoneByOptions = Array.from(
      new Set(
        dropdownRows
          .map((r: any) => r["Tally Done By"]?.trim())
          .filter(Boolean)
      )
    );
    const checkersVerificationOptions = Array.from(
      new Set(
        dropdownRows
          .map((r: any) => r["Checkers (Verification)"]?.trim())
          .filter(Boolean)
      )
    );
    const qcChecklistOptions = Array.from(
      new Set(
        dropdownRows
          .map((r: any) => r["QC-Checklist"]?.trim())
          .filter(Boolean)
      )
    );

    const rejectTypeQcOptions = Array.from(
      new Set(
        dropdownRows
          .map((r: any) => r["Reject Type (QC)"]?.trim())
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
    }));

    const vendors = (vendorRows || []).map((r: any) => ({
      id: r.id,
      vendorCode: r["Vendor Code"]?.trim() || "",
      vendorName: r["Vendor List"]?.trim() || "",
    }));

    const responsiblePersons = (responsibleRows || []).map((r: any) => ({
      id: r.id,
      stageName: r.stageName,
      tat: r.actionTime,
      responsibleName: r.responsibleNames || ""
    }));

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
        checkedByOptions,
        tallyDoneByOptions,
        checkersVerificationOptions,
        qcChecklistOptions,
        rejectTypeQcOptions,
        dropdownData,
        items,
        vendors,
        responsiblePersons,
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

      const { data, error } = await supabase
        .from("pfms_dropdown")
        .insert({
          id: randomUUID(),
          [column]: value.trim()
        });

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "upsertResponsible") {
      const { id, stageName, responsibleName, tat } = body;
      if (!stageName) {
        return NextResponse.json({ success: false, error: "Missing stageName" }, { status: 400 });
      }

      // Format name list: split by comma, trim, uppercase, join
      const normalizedNames = (responsibleName || "")
        .split(",")
        .map((s: string) => s.trim().toUpperCase())
        .filter(Boolean)
        .join(", ");

      const tatHours = tat !== undefined ? parseInt(tat) || 0 : 0;

      // Find the row by id or stageName
      let targetId = id;
      if (!targetId) {
        const { data: existing, error: fetchError } = await supabase
          .from("pfms_tat")
          .select("id")
          .eq("stageName", stageName.trim())
          .maybeSingle();
        if (fetchError) throw fetchError;
        targetId = existing?.id;
      }

      if (targetId) {
        // Update existing record in pfms_tat
        const { error: updateError } = await supabase
          .from("pfms_tat")
          .update({
            responsibleNames: normalizedNames || null,
            actionTime: tatHours
          })
          .eq("id", targetId);

        if (updateError) throw updateError;
      } else {
        // Insert new record in pfms_tat
        const { error: insertError } = await supabase
          .from("pfms_tat")
          .insert({
            id: randomUUID(),
            stageName: stageName.trim(),
            actionTime: tatHours,
            responsibleNames: normalizedNames || null
          });

        if (insertError) throw insertError;
      }

      return NextResponse.json({ success: true });
    }

    if (action === "addItem") {
      const { itemCode, category, itemName } = body;
      if (!category || !itemName) {
        return NextResponse.json({ success: false, error: "Missing category or itemName" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("pfms_item-master")
        .insert({
          id: randomUUID(),
          "ITEM CODE": itemCode?.trim() || null,
          "ITEM CATEGORY": category.trim(),
          "ITEM NAME": itemName.trim()
        });

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "addVendor") {
      const { vendorCode, vendorName } = body;
      if (!vendorName) {
        return NextResponse.json({ success: false, error: "Missing vendorName" }, { status: 400 });
      }

      const { data, error } = await supabase
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

      // Update matching column fields to NULL
      const { error: updateError } = await supabase
        .from("pfms_dropdown")
        .update({ [column]: null })
        .eq(quoteColumn(column), value);

      if (updateError) throw updateError;

      // Clean up records where all dropdown fields are null
      const { error: cleanupError } = await supabase
        .from("pfms_dropdown")
        .delete()
        .is('"Created By"', null)
        .is('"Wharehouse"', null)
        .is('"Payment Terms (Stage3)"', null)
        .is('"Approved By"', null)
        .is('"Checkers (Verification)"', null)
        .is('"Transporter"', null)
        .is('"Checked By"', null)
        .is('"Tally Done By"', null)
        .is('"UOM"', null)
        .is('"Location-Update"', null)
        .is('"QC-Checklist"', null)
        .is('"Reject Type (QC)"', null);

      if (cleanupError) throw cleanupError;

      return NextResponse.json({ success: true });
    }

    if (action === "deleteItem") {
      const id = searchParams.get("id");
      if (!id) {
        return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
      }

      const { error } = await supabase
        .from("pfms_item-master")
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
