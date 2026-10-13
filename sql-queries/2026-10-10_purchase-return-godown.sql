-- Item-return (Purchase Return) now records which godown the returning user
-- manages (auto-filled from their profile, same as Material Received's
-- godownLocation) and which exact serials were picked for return, so IMS can
-- take precisely those units OUT of that location's stock.
-- pfms_indent_generation.warehouseLocation / the "Wharehouse" dropdown are
-- deliberately untouched.
ALTER TABLE "pfms_purchase-return" ADD COLUMN IF NOT EXISTS "godownLocation" TEXT;
ALTER TABLE "pfms_purchase-return" ADD COLUMN IF NOT EXISTS "serialNumbers" TEXT[];
