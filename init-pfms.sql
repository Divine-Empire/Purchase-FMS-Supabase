-- =========================================================================
-- PFMS DATABASE INITIALIZATION SCRIPT FOR COMPANY SUPABASE
-- All tables, indexes, constraints, and sequences are prefixed with "pfms_"
-- =========================================================================

-- Ensure public schema exists
CREATE SCHEMA IF NOT EXISTS "public";

-- 1. USER TABLE
CREATE TABLE IF NOT EXISTS "pfms_User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "pageAccess" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_User_pkey" PRIMARY KEY ("id")
);

-- 2. STAGE 1: INDENT GENERATION
CREATE TABLE IF NOT EXISTS "pfms_indent_generation" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indentNo" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "warehouseLocation" TEXT NOT NULL,
    "itemCode" TEXT,
    "leadTime" INTEGER,
    "uom" TEXT,
    "attachment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "remarks" TEXT,
    "plannedIndentApproval" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_indent_generation_pkey" PRIMARY KEY ("id")
);

-- 3. STAGE 2: INDENT APPROVAL
CREATE TABLE IF NOT EXISTS "pfms_indent-approval" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indentNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedQty" DOUBLE PRECISION,
    "vendorType" TEXT,
    "remarks" TEXT,
    "imgOptional" TEXT,
    "approvedBy" TEXT,
    "plannedUpdateVendors" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_indent-approval_pkey" PRIMARY KEY ("id")
);

-- 4. STAGE 3: UPDATE 3 VENDORS
CREATE TABLE IF NOT EXISTS "pfms_update-3-vendors" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indentNo" TEXT NOT NULL,
    "vendor1Name" TEXT,
    "vendor1Rate" DOUBLE PRECISION,
    "vendor1Terms" TEXT,
    "vendor1DeliveryDate" TIMESTAMP(3),
    "vendor1WarrantyType" TEXT,
    "vendor1WarrantyFrom" TIMESTAMP(3),
    "vendor1WarrantyTo" TIMESTAMP(3),
    "vendor1Attachment" TEXT,
    "vendor2Name" TEXT,
    "vendor2Rate" DOUBLE PRECISION,
    "vendor2Terms" TEXT,
    "vendor2DeliveryDate" TIMESTAMP(3),
    "vendor2WarrantyType" TEXT,
    "vendor2WarrantyFrom" TIMESTAMP(3),
    "vendor2WarrantyTo" TIMESTAMP(3),
    "vendor2Attachment" TEXT,
    "vendor3Name" TEXT,
    "vendor3Rate" DOUBLE PRECISION,
    "vendor3Terms" TEXT,
    "vendor3DeliveryDate" TIMESTAMP(3),
    "vendor3WarrantyType" TEXT,
    "vendor3WarrantyFrom" TIMESTAMP(3),
    "vendor3WarrantyTo" TIMESTAMP(3),
    "vendor3Attachment" TEXT,
    "plannedNegotiation" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_update-3-vendors_pkey" PRIMARY KEY ("id")
);

-- 5. STAGE 4: NEGOTIATION
CREATE TABLE IF NOT EXISTS "pfms_negotiation" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indentNo" TEXT NOT NULL,
    "selectedVendorName" TEXT NOT NULL,
    "finalApprovedBy" TEXT NOT NULL,
    "negotiationRemarks" TEXT,
    "plannedPOEntry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_negotiation_pkey" PRIMARY KEY ("id")
);

-- 6. STAGE 5: PO ENTRY
CREATE TABLE IF NOT EXISTS "pfms_po-entry" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indentNo" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "basicValue" DOUBLE PRECISION NOT NULL,
    "totalWithTax" DOUBLE PRECISION NOT NULL,
    "hsn" TEXT,
    "poCopy" TEXT,
    "gst" TEXT,
    "pkgAmount" DOUBLE PRECISION,
    "pkgGST" TEXT,
    "plannedFollowUpVendor" TIMESTAMP(3),
    "estimatedFollowUpVendor" TIMESTAMP(3),
    "remarksFollowUpVendor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_po-entry_pkey" PRIMARY KEY ("id")
);

-- 7. STAGE 6: LIFT (FOLLOW-UP VENDOR & DISPATCH)
CREATE TABLE IF NOT EXISTS "pfms_lift" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftNo" TEXT NOT NULL,
    "indentNo" TEXT NOT NULL,
    "liftingQty" DOUBLE PRECISION NOT NULL,
    "transporterName" TEXT,
    "vehicleNo" TEXT,
    "contactNo" TEXT,
    "lrNo" TEXT,
    "dispatchDate" TIMESTAMP(3),
    "freightAmount" DOUBLE PRECISION,
    "advanceAmount" DOUBLE PRECISION,
    "paymentDate" TIMESTAMP(3),
    "paymentStatus" TEXT,
    "biltyCopy" TEXT,
    "followUpDate" TIMESTAMP(3),
    "remarks" TEXT,
    "estimatedDate" TIMESTAMP(3),
    "remarksFollowUp" TEXT,
    "plannedSerialGen" TIMESTAMP(3),
    "plannedMaterialRcd" TIMESTAMP(3),
    "plannedTransporterFlwUp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_lift_pkey" PRIMARY KEY ("id")
);

-- 8. STAGE 6.1: TRANSPORTER FOLLOW-UP
CREATE TABLE IF NOT EXISTS "pfms_transporter-follow-up" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftNo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expectedDeliveryDate" TIMESTAMP(3),
    "nextFollowUpDate" TIMESTAMP(3),
    "remarks" TEXT,
    "lastFollowUpDate" TIMESTAMP(3),
    "totalFollowUps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_transporter-follow-up_pkey" PRIMARY KEY ("id")
);

-- 9. STAGE 7: MATERIAL RECEIVED
CREATE TABLE IF NOT EXISTS "pfms_material-received" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftNo" TEXT NOT NULL,
    "invoiceType" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "receivedQty" DOUBLE PRECISION NOT NULL,
    "receivedItemImage" TEXT,
    "billAttachment" TEXT,
    "qcRequired" TEXT NOT NULL,
    "extraFreight" DOUBLE PRECISION,
    "hydraAmt" DOUBLE PRECISION,
    "labourAmt" DOUBLE PRECISION,
    "hamaliAmt" DOUBLE PRECISION,
    "damagedQty" DOUBLE PRECISION,
    "damageReason" TEXT,
    "damageImage" TEXT,
    "plannedMaterialTesting" TIMESTAMP(3),
    "plannedTallyEntry" TIMESTAMP(3),
    "productExpiry" TEXT,
    "productExpiryDate" TIMESTAMP(3),
    "warranty" TEXT,
    "warrantyDuration" INTEGER,
    "warrantyExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_material-received_pkey" PRIMARY KEY ("id")
);

-- 10. STAGE 7.1: DAMAGED RECORD
CREATE TABLE IF NOT EXISTS "pfms_damaged-record" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftNo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_damaged-record_pkey" PRIMARY KEY ("id")
);

-- 11. STAGE 7.5: SERIAL NUMBER
CREATE TABLE IF NOT EXISTS "pfms_serial-number" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftNo" TEXT NOT NULL,
    "serialNo" TEXT NOT NULL,
    "qrLink" TEXT,
    "warrantyExpiry" TIMESTAMP(3),
    "productExpiry" TIMESTAMP(3),
    "plannedWarrantyClaim" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_serial-number_pkey" PRIMARY KEY ("id")
);

-- 11.1 STAGE 7.5.1: DIRECT SERIAL NUMBER
CREATE TABLE IF NOT EXISTS "pfms_direct_serial_numbers" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemName" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3),
    "warrantyDuration" INTEGER,
    "serialNo" TEXT NOT NULL,
    "qrLink" TEXT,
    "warrantyExpiry" TIMESTAMP(3),
    "productExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_direct_serial_numbers_pkey" PRIMARY KEY ("id")
);

-- 12. STAGE 7.6: WARRANTY CLAIM
CREATE TABLE IF NOT EXISTS "pfms_warranty-claim" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serialNo" TEXT NOT NULL,
    "invoiceNo" TEXT,
    "invoiceCopy" TEXT,
    "issueDescription" TEXT NOT NULL,
    "photoVideo" TEXT,
    "claimType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "claimedBy" TEXT,
    "plannedClosure" TIMESTAMP(3),
    "closureDate" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_warranty-claim_pkey" PRIMARY KEY ("id")
);

-- 13. STAGE 8: TALLY ENTRY
CREATE TABLE IF NOT EXISTS "pfms_tally-entry" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftNo" TEXT NOT NULL,
    "doneBy" TEXT NOT NULL,
    "doneDate" TIMESTAMP(3),
    "remarks" TEXT,
    "checkedStatus" TEXT NOT NULL,
    "checkedByAcc" TEXT,
    "plannedInvoiceHO" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_tally-entry_pkey" PRIMARY KEY ("id")
);

-- 14. STAGE 8.5: SUBMIT INVOICE TO HO
CREATE TABLE IF NOT EXISTS "pfms_submit-invoice-ho" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftNo" TEXT NOT NULL,
    "hardcopySubmitted" TEXT NOT NULL,
    "submissionDate" TIMESTAMP(3) NOT NULL,
    "plannedInvoice" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_submit-invoice-ho_pkey" PRIMARY KEY ("id")
);

-- 15. STAGE 9: SUBMIT INVOICE
CREATE TABLE IF NOT EXISTS "pfms_submit-invoice" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftNo" TEXT NOT NULL,
    "handoverBy" TEXT NOT NULL,
    "invoiceSubmissionDate" TIMESTAMP(3) NOT NULL,
    "plannedVerification" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_submit-invoice_pkey" PRIMARY KEY ("id")
);

-- 16. STAGE 10: ACCOUNTS VERIFICATION
CREATE TABLE IF NOT EXISTS "pfms_accounts-verification" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftNo" TEXT NOT NULL,
    "verifiedCheckedBy" TEXT NOT NULL,
    "verificationDate" TIMESTAMP(3) NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_accounts-verification_pkey" PRIMARY KEY ("id")
);

-- 17. STAGE 11: MATERIAL TESTING
CREATE TABLE IF NOT EXISTS "pfms_material-testing" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftNo" TEXT NOT NULL,
    "qcBy" TEXT,
    "qcDate" TIMESTAMP(3),
    "workingCondition" TEXT,
    "remarks" TEXT,
    "pendingQty" DOUBLE PRECISION,
    "approvedQty" DOUBLE PRECISION,
    "checklist" TEXT[],
    "serialNumbers" TEXT[],
    "images" TEXT[],
    "rejectType" TEXT,
    "partName" TEXT,
    "rejectedQty" DOUBLE PRECISION,
    "plannedPurchaseReturns" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_material-testing_pkey" PRIMARY KEY ("id")
);

-- 18. STAGE 11.5: PURCHASE RETURN
CREATE TABLE IF NOT EXISTS "pfms_purchase-return" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftNo" TEXT NOT NULL,
    "returnedQty" DOUBLE PRECISION NOT NULL,
    "returnRate" DOUBLE PRECISION,
    "returnAmount" DOUBLE PRECISION,
    "returnReason" TEXT,
    "returnStatus" TEXT NOT NULL,
    "returnItemImage" TEXT,
    "creditNoteImage" TEXT,
    "plannedReturnApproval" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_purchase-return_pkey" PRIMARY KEY ("id")
);

-- 19. STAGE 12: RETURN APPROVAL
CREATE TABLE IF NOT EXISTS "pfms_return-approval" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftNo" TEXT NOT NULL,
    "dnNumber" TEXT NOT NULL,
    "remarks" TEXT,
    "returnImage" TEXT NOT NULL,
    "approvalDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_return-approval_pkey" PRIMARY KEY ("id")
);

-- 20. STAGE 13: VENDOR PAYMENT DETAILS
CREATE TABLE IF NOT EXISTS "pfms_vendor-payment-details" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftNo" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "plannedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_vendor-payment-details_pkey" PRIMARY KEY ("id")
);

-- 21. PAID DATA
CREATE TABLE IF NOT EXISTS "pfms_paid-data" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "proof" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_paid-data_pkey" PRIMARY KEY ("id")
);

-- 22. STAGE 14: FREIGHT PAYMENT DETAILS
CREATE TABLE IF NOT EXISTS "pfms_freight-payment-details" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftNo" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plannedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_freight-payment-details_pkey" PRIMARY KEY ("id")
);

-- 23. PAID FREIGHT DATA
CREATE TABLE IF NOT EXISTS "pfms_paid-freight-data" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "freightDetailId" TEXT NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "proof" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_paid-freight-data_pkey" PRIMARY KEY ("id")
);

-- 24. ORDER CANCELLATION
CREATE TABLE IF NOT EXISTS "pfms_order-cancellation" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indentNo" TEXT NOT NULL,
    "poNumber" TEXT,
    "itemName" TEXT NOT NULL,
    "cancelStage" TEXT NOT NULL,
    "cancelReason" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "liftNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_order-cancellation_pkey" PRIMARY KEY ("id")
);

-- 25. TAT (TURN AROUND TIME) CONFIG
CREATE TABLE IF NOT EXISTS "pfms_tat" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stage_name" TEXT NOT NULL,
    "duration_in_minutes" INTEGER NOT NULL DEFAULT 60,
    "responsible_persons" TEXT[] NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_tat_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pfms_tat_stage_name_key" UNIQUE ("stage_name")
);

-- 26. ITEM MASTER
CREATE TABLE IF NOT EXISTS "pfms_item_master" (
    "id" TEXT NOT NULL,
    "ITEM CODE" TEXT,
    "ITEM CATEGORY" TEXT,
    "ITEM NAME" TEXT,
    "purchaser" TEXT,

    CONSTRAINT "pfms_item_master_pkey" PRIMARY KEY ("id")
);

-- 27. VENDOR MASTER
CREATE TABLE IF NOT EXISTS "pfms_vendor-master" (
    "id" TEXT NOT NULL,
    "Vendor Code" TEXT,
    "Vendor List" TEXT,

    CONSTRAINT "pfms_vendor-master_pkey" PRIMARY KEY ("id")
);

-- 28. DROPDOWN OPTIONS
-- Normalized category/value pairs. Categories in use: Created By, Wharehouse,
-- UOM, Payment Terms (Stage3), Approved By, Transporter, Purchaser, Accounts,
-- Engineers, QC-Checklist, Reject Type (QC). ("Checked By" / "Tally Done By" /
-- "Checkers (Verification)" were retired in favor of "Accounts" / "Engineers" —
-- see sql-queries/DB_CONTEXT.md.)
CREATE TABLE IF NOT EXISTS "pfms_dropdown" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfms_dropdown_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pfms_dropdown_category_value_key" UNIQUE ("category", "value")
);

-- =========================================================================
-- UNIQUE INDEXES
-- =========================================================================
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_User_username_key" ON "pfms_User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_indent_generation_indentNo_key" ON "pfms_indent_generation"("indentNo");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_indent-approval_indentNo_key" ON "pfms_indent-approval"("indentNo");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_update-3-vendors_indentNo_key" ON "pfms_update-3-vendors"("indentNo");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_negotiation_indentNo_key" ON "pfms_negotiation"("indentNo");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_po-entry_indentNo_key" ON "pfms_po-entry"("indentNo");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_lift_liftNo_key" ON "pfms_lift"("liftNo");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_transporter-follow-up_liftNo_key" ON "pfms_transporter-follow-up"("liftNo");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_material-received_liftNo_key" ON "pfms_material-received"("liftNo");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_damaged-record_liftNo_key" ON "pfms_damaged-record"("liftNo");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_serial-number_serialNo_key" ON "pfms_serial-number"("serialNo");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_warranty-claim_serialNo_key" ON "pfms_warranty-claim"("serialNo");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_tally-entry_liftNo_key" ON "pfms_tally-entry"("liftNo");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_submit-invoice-ho_liftNo_key" ON "pfms_submit-invoice-ho"("liftNo");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_submit-invoice_liftNo_key" ON "pfms_submit-invoice"("liftNo");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_accounts-verification_liftNo_key" ON "pfms_accounts-verification"("liftNo");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_vendor-payment-details_liftNo_key" ON "pfms_vendor-payment-details"("liftNo");
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_freight-payment-details_liftNo_key" ON "pfms_freight-payment-details"("liftNo");

-- =========================================================================
-- FOREIGN KEY CONSTRAINTS
-- =========================================================================
ALTER TABLE "pfms_indent-approval" DROP CONSTRAINT IF EXISTS "pfms_indent-approval_indentNo_fkey";
ALTER TABLE "pfms_indent-approval" ADD CONSTRAINT "pfms_indent-approval_indentNo_fkey" FOREIGN KEY ("indentNo") REFERENCES "pfms_indent_generation"("indentNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_update-3-vendors" DROP CONSTRAINT IF EXISTS "pfms_update-3-vendors_indentNo_fkey";
ALTER TABLE "pfms_update-3-vendors" ADD CONSTRAINT "pfms_update-3-vendors_indentNo_fkey" FOREIGN KEY ("indentNo") REFERENCES "pfms_indent_generation"("indentNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_negotiation" DROP CONSTRAINT IF EXISTS "pfms_negotiation_indentNo_fkey";
ALTER TABLE "pfms_negotiation" ADD CONSTRAINT "pfms_negotiation_indentNo_fkey" FOREIGN KEY ("indentNo") REFERENCES "pfms_indent_generation"("indentNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_po-entry" DROP CONSTRAINT IF EXISTS "pfms_po-entry_indentNo_fkey";
ALTER TABLE "pfms_po-entry" ADD CONSTRAINT "pfms_po-entry_indentNo_fkey" FOREIGN KEY ("indentNo") REFERENCES "pfms_indent_generation"("indentNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_lift" DROP CONSTRAINT IF EXISTS "pfms_lift_indentNo_fkey";
ALTER TABLE "pfms_lift" ADD CONSTRAINT "pfms_lift_indentNo_fkey" FOREIGN KEY ("indentNo") REFERENCES "pfms_indent_generation"("indentNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_transporter-follow-up" DROP CONSTRAINT IF EXISTS "pfms_transporter-follow-up_liftNo_fkey";
ALTER TABLE "pfms_transporter-follow-up" ADD CONSTRAINT "pfms_transporter-follow-up_liftNo_fkey" FOREIGN KEY ("liftNo") REFERENCES "pfms_lift"("liftNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_material-received" DROP CONSTRAINT IF EXISTS "pfms_material-received_liftNo_fkey";
ALTER TABLE "pfms_material-received" ADD CONSTRAINT "pfms_material-received_liftNo_fkey" FOREIGN KEY ("liftNo") REFERENCES "pfms_lift"("liftNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_damaged-record" DROP CONSTRAINT IF EXISTS "pfms_damaged-record_liftNo_fkey";
ALTER TABLE "pfms_damaged-record" ADD CONSTRAINT "pfms_damaged-record_liftNo_fkey" FOREIGN KEY ("liftNo") REFERENCES "pfms_lift"("liftNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_serial-number" DROP CONSTRAINT IF EXISTS "pfms_serial-number_liftNo_fkey";
ALTER TABLE "pfms_serial-number" ADD CONSTRAINT "pfms_serial-number_liftNo_fkey" FOREIGN KEY ("liftNo") REFERENCES "pfms_lift"("liftNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_warranty-claim" DROP CONSTRAINT IF EXISTS "pfms_warranty-claim_serialNo_fkey";
ALTER TABLE "pfms_warranty-claim" ADD CONSTRAINT "pfms_warranty-claim_serialNo_fkey" FOREIGN KEY ("serialNo") REFERENCES "pfms_serial-number"("serialNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_tally-entry" DROP CONSTRAINT IF EXISTS "pfms_tally-entry_liftNo_fkey";
ALTER TABLE "pfms_tally-entry" ADD CONSTRAINT "pfms_tally-entry_liftNo_fkey" FOREIGN KEY ("liftNo") REFERENCES "pfms_lift"("liftNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_submit-invoice-ho" DROP CONSTRAINT IF EXISTS "pfms_submit-invoice-ho_liftNo_fkey";
ALTER TABLE "pfms_submit-invoice-ho" ADD CONSTRAINT "pfms_submit-invoice-ho_liftNo_fkey" FOREIGN KEY ("liftNo") REFERENCES "pfms_lift"("liftNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_submit-invoice" DROP CONSTRAINT IF EXISTS "pfms_submit-invoice_liftNo_fkey";
ALTER TABLE "pfms_submit-invoice" ADD CONSTRAINT "pfms_submit-invoice_liftNo_fkey" FOREIGN KEY ("liftNo") REFERENCES "pfms_lift"("liftNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_accounts-verification" DROP CONSTRAINT IF EXISTS "pfms_accounts-verification_liftNo_fkey";
ALTER TABLE "pfms_accounts-verification" ADD CONSTRAINT "pfms_accounts-verification_liftNo_fkey" FOREIGN KEY ("liftNo") REFERENCES "pfms_lift"("liftNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_material-testing" DROP CONSTRAINT IF EXISTS "pfms_material-testing_liftNo_fkey";
ALTER TABLE "pfms_material-testing" ADD CONSTRAINT "pfms_material-testing_liftNo_fkey" FOREIGN KEY ("liftNo") REFERENCES "pfms_lift"("liftNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_purchase-return" DROP CONSTRAINT IF EXISTS "pfms_purchase-return_liftNo_fkey";
ALTER TABLE "pfms_purchase-return" ADD CONSTRAINT "pfms_purchase-return_liftNo_fkey" FOREIGN KEY ("liftNo") REFERENCES "pfms_lift"("liftNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_return-approval" DROP CONSTRAINT IF EXISTS "pfms_return-approval_liftNo_fkey";
ALTER TABLE "pfms_return-approval" ADD CONSTRAINT "pfms_return-approval_liftNo_fkey" FOREIGN KEY ("liftNo") REFERENCES "pfms_lift"("liftNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_vendor-payment-details" DROP CONSTRAINT IF EXISTS "pfms_vendor-payment-details_liftNo_fkey";
ALTER TABLE "pfms_vendor-payment-details" ADD CONSTRAINT "pfms_vendor-payment-details_liftNo_fkey" FOREIGN KEY ("liftNo") REFERENCES "pfms_lift"("liftNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_paid-data" DROP CONSTRAINT IF EXISTS "pfms_paid-data_invoiceId_fkey";
ALTER TABLE "pfms_paid-data" ADD CONSTRAINT "pfms_paid-data_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "pfms_vendor-payment-details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_freight-payment-details" DROP CONSTRAINT IF EXISTS "pfms_freight-payment-details_liftNo_fkey";
ALTER TABLE "pfms_freight-payment-details" ADD CONSTRAINT "pfms_freight-payment-details_liftNo_fkey" FOREIGN KEY ("liftNo") REFERENCES "pfms_lift"("liftNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pfms_paid-freight-data" DROP CONSTRAINT IF EXISTS "pfms_paid-freight-data_freightDetailId_fkey";
ALTER TABLE "pfms_paid-freight-data" ADD CONSTRAINT "pfms_paid-freight-data_freightDetailId_fkey" FOREIGN KEY ("freightDetailId") REFERENCES "pfms_freight-payment-details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =========================================================================
-- PERMISSIONS & PRIVILEGES FOR SUPABASE API ROLES
-- =========================================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role, anon, authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role, anon, authenticated;