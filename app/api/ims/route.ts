import { NextResponse } from "next/server";

export async function GET() {
  try {
    const API_URL = process.env.IMS_PAGE_SOURCE_API_URL;
    if (!API_URL) {
      console.error("IMS_PAGE_SOURCE_API_URL is not defined in environment variables");
      return NextResponse.json(
        { success: false, error: "IMS_PAGE_SOURCE_API_URL is not configured" },
        { status: 500 }
      );
    }

    // Safely append '?sheet=IMS' to the API URL
    const url = new URL(API_URL);
    url.searchParams.set("sheet", "IMS");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      next: { revalidate: 0 } // disable Next.js caching
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from sheet API: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Google Sheets API returned success=false");
    }

    const rows = result.data;
    if (!Array.isArray(rows) || rows.length <= 1) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Skip the first row (headers)
    const dataRows = rows.slice(1);
    const parsedData = dataRows.map((row: any[], index: number) => {
      const getNumericValue = (val: any) => {
        if (val === null || val === undefined || val === "") return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
      };

      return {
        id: index,
        group: row[0]?.toString().trim() || "",
        category: row[1]?.toString().trim() || "",
        itemCode: row[2]?.toString().trim() || "",
        itemName: row[3]?.toString().trim() || "",
        cg: getNumericValue(row[94]),
        ne: getNumericValue(row[95]),
        maniquip: getNumericValue(row[96]),
        headOffice: getNumericValue(row[97]),
      };
    });

    return NextResponse.json({ success: true, data: parsedData });
  } catch (err: any) {
    console.error("GET /api/ims error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch IMS tracker data" },
      { status: 500 }
    );
  }
}
