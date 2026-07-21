import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";

export async function GET() {
  try {
    // 1. Fetch dropdown options (createdBy, warehouse, uom, paymentTerms, approvedBy)
    const { data: dropdownRows, error: dropdownError } = await supabase
      .from("pfms_dropdown")
      .select('"Created By", "Wharehouse", "UOM", "Payment Terms (Stage3)", "Approved By", "Transporter", "Checked By", "Tally Done By", "Checkers (Verification)", "QC-Checklist", "Reject Type (QC)"');

    if (dropdownError) throw dropdownError;

    // 2. Fetch catalog items
    const { data: itemRows, error: itemError } = await supabase
      .from("pfms_item-master")
      .select('"ITEM CODE", "ITEM CATEGORY", "ITEM NAME"');

    if (itemError) throw itemError;

    // 3. Fetch vendor list from vendor-master
    const { data: vendorRows, error: vendorError } = await supabase
      .from("pfms_vendor-master")
      .select('"Vendor List"');

    if (vendorError) throw vendorError;

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
      },
    });
  } catch (error: any) {
    console.error("Error in dropdowns API:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
