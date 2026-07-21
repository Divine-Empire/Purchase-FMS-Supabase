import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const folder = formData.get("folder") as string || "general";

        if (!file) {
            return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Sanitize and create a unique filename
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
        const filePath = `${folder}/${fileName}`;

        // Upload to the 'pfms-purchase-fms' Supabase bucket
        const { data, error } = await supabase.storage
            .from("pfms-purchase-fms")
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: true
            });

        if (error) {
            throw error;
        }

        // Get the public URL for the uploaded file
        const { data: { publicUrl } } = supabase.storage
            .from("pfms-purchase-fms")
            .getPublicUrl(filePath);

        return NextResponse.json({ success: true, url: publicUrl, fileUrl: publicUrl });
    } catch (error: any) {
        console.error("Upload error:", error);
        return NextResponse.json({ success: false, error: error.message || "Upload failed" }, { status: 500 });
    }
}
