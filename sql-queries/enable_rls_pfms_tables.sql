-- Enables Row Level Security on every pfms_* TABLE (views are skipped — RLS doesn't
-- apply to views the same way, and neither is queried directly by app code anyway).
--
-- Safe to run: this app's Next.js API routes exclusively use the Supabase service-role
-- key (utils/supabase/server.ts), which always bypasses RLS regardless of policies.
-- No anon/publishable key exists in this project's client bundle. So enabling RLS here
-- changes nothing for the running app — it only closes the auto-generated public REST
-- API to any other caller (anon key, authenticated role, etc.), since no policies are
-- being added and RLS-enabled-with-no-policies means default-deny for everyone except
-- service_role.
--
-- Run this in the Supabase Dashboard -> SQL Editor (or via psql if you have a direct
-- connection string). Wrapped in a transaction so it's all-or-nothing.

BEGIN;

ALTER TABLE public."pfms_User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_accounts-verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_damaged-record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_direct_serial_numbers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_dropdown" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_for_ims" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_freight-payment-details" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_holidays" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_indent-approval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_indent_generation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_item_master" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_lift" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_lift_qc_resolution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_material-received" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_material-testing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_negotiation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_order-cancellation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_paid-data" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_paid-freight-data" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_po-entry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_purchase-return" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_repair_process" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_return-approval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_serial-number" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_submit-invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_submit-invoice-ho" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_tally-entry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_tat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_transporter-follow-up" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_update-3-vendors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_vendor-master" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_vendor-payment-details" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pfms_warranty-claim" ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verify afterwards with:
-- SELECT relname, relrowsecurity, relforcerowsecurity
-- FROM pg_class
-- WHERE relname LIKE 'pfms_%' AND relkind = 'r'
-- ORDER BY relname;
-- (relrowsecurity should read `true` for every row)
