-- The godown list is now the same 5 physical locations OTP and IMS use
-- (labels match OTP_Supabase/lib/locations.ts and IMS-Supabase/lib/godown-codes.ts):
--   Warehouse-CG, Head-Office-CG, Service-Inbound-CG, Maniquip-CG, Warehouse-NE
-- It replaces the earlier 4-value "CG Godown" list (which had no NE).
-- pfms_indent_generation.warehouseLocation and its "Wharehouse" dropdown are
-- deliberately untouched — godown is only captured at Material Received and
-- Purchase Return.

-- Existing rows saved with the old 4 values -> the new labels (all were CG).
UPDATE "pfms_material-received" SET "godownLocation" = CASE "godownLocation"
  WHEN 'Warehouse' THEN 'Warehouse-CG'
  WHEN 'Maniquip' THEN 'Maniquip-CG'
  WHEN 'Service Inbound' THEN 'Service-Inbound-CG'
  WHEN 'Head Office' THEN 'Head-Office-CG'
  ELSE "godownLocation" END
WHERE "godownLocation" IN ('Warehouse', 'Maniquip', 'Service Inbound', 'Head Office');

UPDATE "pfms_User" SET "defaultGodown" = CASE "defaultGodown"
  WHEN 'Warehouse' THEN 'Warehouse-CG'
  WHEN 'Maniquip' THEN 'Maniquip-CG'
  WHEN 'Service Inbound' THEN 'Service-Inbound-CG'
  WHEN 'Head Office' THEN 'Head-Office-CG'
  ELSE "defaultGodown" END
WHERE "defaultGodown" IN ('Warehouse', 'Maniquip', 'Service Inbound', 'Head Office');

DELETE FROM "pfms_dropdown" WHERE category = 'CG Godown';

INSERT INTO "pfms_dropdown" (id, category, value) VALUES
  (gen_random_uuid()::text, 'Godown', 'Warehouse-CG'),
  (gen_random_uuid()::text, 'Godown', 'Head-Office-CG'),
  (gen_random_uuid()::text, 'Godown', 'Service-Inbound-CG'),
  (gen_random_uuid()::text, 'Godown', 'Maniquip-CG'),
  (gen_random_uuid()::text, 'Godown', 'Warehouse-NE')
ON CONFLICT (category, value) DO NOTHING;
