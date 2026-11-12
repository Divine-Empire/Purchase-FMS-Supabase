import { createClient } from "@supabase/supabase-js";

// Client for the shared "Divine production" Supabase project (Lead-To-Order / OTP /
// Service-Support / Service-Inbound all live here). `lto_items` is the single shared item
// catalog across those apps, and is now also PFMS's source of truth for item name/category/
// code/purchaser — replacing pfms_item_master (which stays in place, unused, not dropped).
const ltoSupabaseUrl = process.env.LTO_SUPABASE_URL!;
const ltoSupabaseKey = process.env.LTO_SUPABASE_ANON_KEY!;

export const ltoSupabase = createClient(
    ltoSupabaseUrl,
    ltoSupabaseKey
);
