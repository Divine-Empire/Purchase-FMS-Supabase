-- CG sub-godown tracking (Warehouse, Maniquip, Service Inbound, Head Office).
-- Indent Generation's top-level "Wharehouse" dropdown/field is UNCHANGED —
-- sub-godown is only captured at Material Received, and only matters when
-- the indent's top-level warehouse is CG (NE/WB/OD stay single flat
-- godowns, no sub-split).

-- Separate dropdown category so the existing "Wharehouse" category (used by
-- Indent Generation/Approval) is never touched.
INSERT INTO "pfms_dropdown" (id, category, value) VALUES
  (gen_random_uuid()::text, 'CG Godown', 'Warehouse'),
  (gen_random_uuid()::text, 'CG Godown', 'Maniquip'),
  (gen_random_uuid()::text, 'CG Godown', 'Service Inbound'),
  (gen_random_uuid()::text, 'CG Godown', 'Head Office')
ON CONFLICT (category, value) DO NOTHING;

-- Which exact CG sub-godown this receipt physically landed in (nullable —
-- only applicable/filled for CG indents).
ALTER TABLE "pfms_material-received" ADD COLUMN IF NOT EXISTS "godownLocation" TEXT;

-- Per-user default godown (optional — most users aren't a godown in-charge).
-- Follows the same raw-Supabase-column precedent as the existing "records"
-- column (not tracked in prisma/schema.prisma, read/written directly).
ALTER TABLE "pfms_User" ADD COLUMN IF NOT EXISTS "defaultGodown" TEXT;
