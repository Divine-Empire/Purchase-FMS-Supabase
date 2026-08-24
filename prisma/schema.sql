-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.


CREATE TABLE public.pfms_User (
  id text NOT NULL,
  username text NOT NULL,
  fullName text NOT NULL,
  password text NOT NULL,
  role text NOT NULL,
  pageAccess text,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_User_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pfms_indent-generation (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  indentNo text,
  createdBy text,
  category text,
  itemName text,
  quantity double precision,
  warehouseLocation text,
  itemCode text,
  leadTime integer,
  uom text,
  attachment text,
  status text DEFAULT 'pending'::text,
  remarks text,
  plannedIndentApproval timestamp without time zone,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_indent-generation_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pfms_indent-approval (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  indentNo text NOT NULL,
  status text DEFAULT 'pending'::text,
  approvedQty double precision,
  vendorType text,
  remarks text,
  imgOptional text,
  approvedBy text,
  plannedUpdateVendors timestamp without time zone,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_indent-approval_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_indent-approval_indentNo_fkey FOREIGN KEY (indentNo) REFERENCES public.pfms_indent-generation(indentNo)
);
CREATE TABLE public.pfms_update-3-vendors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  indentNo text,
  vendor1Name text,
  vendor1Rate double precision,
  vendor1Terms text,
  vendor1DeliveryDate timestamp without time zone,
  vendor1WarrantyType text,
  vendor1WarrantyFrom timestamp without time zone,
  vendor1WarrantyTo timestamp without time zone,
  vendor1Attachment text,
  vendor2Name text,
  vendor2Rate double precision,
  vendor2Terms text,
  vendor2DeliveryDate timestamp without time zone,
  vendor2WarrantyType text,
  vendor2WarrantyFrom timestamp without time zone,
  vendor2WarrantyTo timestamp without time zone,
  vendor2Attachment text,
  vendor3Name text,
  vendor3Rate double precision,
  vendor3Terms text,
  vendor3DeliveryDate timestamp without time zone,
  vendor3WarrantyType text,
  vendor3WarrantyFrom timestamp without time zone,
  vendor3WarrantyTo timestamp without time zone,
  vendor3Attachment text,
  plannedNegotiation timestamp without time zone,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_update-3-vendors_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_update-3-vendors_indentNo_fkey FOREIGN KEY (indentNo) REFERENCES public.pfms_indent-generation(indentNo)
);
CREATE TABLE public.pfms_negotiation (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  indentNo text,
  selectedVendorName text,
  finalApprovedBy text,
  negotiationRemarks text,
  plannedPOEntry timestamp without time zone,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_negotiation_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_negotiation_indentNo_fkey FOREIGN KEY (indentNo) REFERENCES public.pfms_indent-generation(indentNo)
);
CREATE TABLE public.pfms_po-entry (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  indentNo text NOT NULL,
  poNumber text,
  basicValue double precision,
  totalWithTax double precision,
  hsn text,
  poCopy text,
  gst text,
  pkgAmount double precision,
  pkgGST text,
  plannedFollowUpVendor timestamp without time zone,
  estimatedFollowUpVendor timestamp without time zone,
  remarksFollowUpVendor text,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_po-entry_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_po-entry_indentNo_fkey FOREIGN KEY (indentNo) REFERENCES public.pfms_indent-generation(indentNo)
);
CREATE TABLE public.pfms_lift (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  liftNo text NOT NULL,
  indentNo text NOT NULL,
  liftingQty double precision NOT NULL,
  transporterName text,
  vehicleNo text,
  contactNo text,
  lrNo text,
  dispatchDate timestamp without time zone,
  freightAmount double precision,
  advanceAmount double precision,
  paymentDate timestamp without time zone,
  paymentStatus text,
  biltyCopy text,
  followUpDate timestamp without time zone,
  remarks text,
  estimatedDate timestamp without time zone,
  remarksFollowUp text,
  plannedSerialGen timestamp without time zone,
  plannedMaterialRcd timestamp without time zone,
  plannedTransporterFlwUp timestamp without time zone,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_lift_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_lift_indentNo_fkey FOREIGN KEY (indentNo) REFERENCES public.pfms_indent-generation(indentNo)
);
CREATE TABLE public.pfms_transporter-follow-up (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  liftNo text NOT NULL,
  status text NOT NULL,
  expectedDeliveryDate timestamp without time zone,
  nextFollowUpDate timestamp without time zone,
  remarks text,
  lastFollowUpDate timestamp without time zone,
  totalFollowUps integer NOT NULL DEFAULT 0,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_transporter-follow-up_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_transporter-follow-up_liftNo_fkey FOREIGN KEY (liftNo) REFERENCES public.pfms_lift(liftNo)
);
CREATE TABLE public.pfms_material-received (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  liftNo text NOT NULL,
  invoiceType text NOT NULL,
  invoiceNumber text NOT NULL,
  invoiceDate timestamp without time zone NOT NULL,
  receivedQty double precision NOT NULL,
  receivedItemImage text,
  billAttachment text,
  qcRequired text NOT NULL,
  extraFreight double precision,
  hydraAmt double precision,
  labourAmt double precision,
  hamaliAmt double precision,
  damagedQty double precision,
  damageReason text,
  damageImage text,
  plannedMaterialTesting timestamp without time zone,
  plannedTallyEntry timestamp without time zone,
  productExpiry text,
  productExpiryDate timestamp without time zone,
  warranty text,
  warrantyDuration integer,
  warrantyExpiry timestamp without time zone,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_material-received_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_material-received_liftNo_fkey FOREIGN KEY (liftNo) REFERENCES public.pfms_lift(liftNo)
);
CREATE TABLE public.pfms_damaged-record (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  liftNo text NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_damaged-record_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_damaged-record_liftNo_fkey FOREIGN KEY (liftNo) REFERENCES public.pfms_lift(liftNo)
);
CREATE TABLE public.pfms_serial-number (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  liftNo text NOT NULL,
  serialNo text NOT NULL,
  qrLink text,
  warrantyExpiry timestamp without time zone,
  productExpiry timestamp without time zone,
  plannedWarrantyClaim timestamp without time zone,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_serial-number_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_serial-number_liftNo_fkey FOREIGN KEY (liftNo) REFERENCES public.pfms_lift(liftNo)
);
CREATE TABLE public.pfms_warranty-claim (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  serialNo text NOT NULL,
  invoiceNo text,
  invoiceCopy text,
  issueDescription text NOT NULL,
  photoVideo text,
  claimType text NOT NULL,
  status text NOT NULL DEFAULT 'Pending'::text,
  claimedBy text,
  plannedClosure timestamp without time zone,
  closureDate timestamp without time zone,
  remarks text,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_warranty-claim_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_warranty-claim_serialNo_fkey FOREIGN KEY (serialNo) REFERENCES public.pfms_serial-number(serialNo)
);
CREATE TABLE public.pfms_tally-entry (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  liftNo text NOT NULL,
  doneBy text NOT NULL,
  doneDate timestamp without time zone,
  remarks text,
  checkedStatus text NOT NULL,
  checkedByAcc text,
  plannedInvoiceHO timestamp without time zone,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_tally-entry_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_tally-entry_liftNo_fkey FOREIGN KEY (liftNo) REFERENCES public.pfms_lift(liftNo)
);
CREATE TABLE public.pfms_submit-invoice-ho (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  liftNo text NOT NULL,
  hardcopySubmitted text NOT NULL,
  submissionDate timestamp without time zone NOT NULL,
  plannedInvoice timestamp without time zone,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_submit-invoice-ho_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_submit-invoice-ho_liftNo_fkey FOREIGN KEY (liftNo) REFERENCES public.pfms_lift(liftNo)
);
CREATE TABLE public.pfms_submit-invoice (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  liftNo text NOT NULL,
  handoverBy text NOT NULL,
  invoiceSubmissionDate timestamp without time zone NOT NULL,
  plannedVerification timestamp without time zone,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_submit-invoice_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_submit-invoice_liftNo_fkey FOREIGN KEY (liftNo) REFERENCES public.pfms_lift(liftNo)
);
CREATE TABLE public.pfms_accounts-verification (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  liftNo text NOT NULL,
  verifiedCheckedBy text NOT NULL,
  verificationDate timestamp without time zone NOT NULL,
  remarks text,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_accounts-verification_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_accounts-verification_liftNo_fkey FOREIGN KEY (liftNo) REFERENCES public.pfms_lift(liftNo)
);
CREATE TABLE public.pfms_material-testing (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  liftNo text NOT NULL,
  qcBy text,
  qcDate timestamp without time zone,
  workingCondition text,
  remarks text,
  pendingQty double precision,
  approvedQty double precision,
  checklist ARRAY,
  serialNumbers ARRAY,
  images ARRAY,
  rejectType text,
  partName text,
  rejectedQty double precision,
  plannedPurchaseReturns timestamp without time zone,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_material-testing_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_material-testing_liftNo_fkey FOREIGN KEY (liftNo) REFERENCES public.pfms_lift(liftNo)
);
CREATE TABLE public.pfms_purchase-return (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  liftNo text NOT NULL,
  returnedQty double precision NOT NULL,
  returnRate double precision,
  returnAmount double precision,
  returnReason text,
  returnStatus text NOT NULL,
  returnItemImage text,
  creditNoteImage text,
  plannedReturnApproval timestamp without time zone,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_purchase-return_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_purchase-return_liftNo_fkey FOREIGN KEY (liftNo) REFERENCES public.pfms_lift(liftNo)
);
CREATE TABLE public.pfms_return-approval (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  liftNo text NOT NULL,
  dnNumber text NOT NULL,
  remarks text,
  returnImage text NOT NULL,
  approvalDate timestamp without time zone,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_return-approval_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_return-approval_liftNo_fkey FOREIGN KEY (liftNo) REFERENCES public.pfms_lift(liftNo)
);
CREATE TABLE public.pfms_vendor-payment-details (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  liftNo text NOT NULL,
  totalAmount double precision NOT NULL,
  paidAmount double precision NOT NULL DEFAULT 0,
  dueDate timestamp without time zone,
  plannedDate timestamp without time zone,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_vendor-payment-details_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_vendor-payment-details_liftNo_fkey FOREIGN KEY (liftNo) REFERENCES public.pfms_lift(liftNo)
);
CREATE TABLE public.pfms_paid-data (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  invoiceId text NOT NULL,
  amountPaid double precision NOT NULL,
  paymentStatus text NOT NULL,
  paymentDate timestamp without time zone NOT NULL,
  paymentMode text NOT NULL,
  proof text,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_paid-data_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_paid-data_invoiceId_fkey FOREIGN KEY (invoiceId) REFERENCES public.pfms_vendor-payment-details(id)
);
CREATE TABLE public.pfms_freight-payment-details (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  liftNo text NOT NULL,
  totalAmount double precision NOT NULL,
  paidAmount double precision NOT NULL DEFAULT 0,
  plannedDate timestamp without time zone,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_freight-payment-details_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_freight-payment-details_liftNo_fkey FOREIGN KEY (liftNo) REFERENCES public.pfms_lift(liftNo)
);
CREATE TABLE public.pfms_paid-freight-data (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  freightDetailId text NOT NULL,
  amountPaid double precision NOT NULL,
  paymentStatus text NOT NULL,
  paymentDate timestamp without time zone NOT NULL,
  paymentMode text NOT NULL,
  proof text,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_paid-freight-data_pkey PRIMARY KEY (id),
  CONSTRAINT pfms_paid-freight-data_freightDetailId_fkey FOREIGN KEY (freightDetailId) REFERENCES public.pfms_freight-payment-details(id)
);
CREATE TABLE public.pfms_order-cancellation (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  indentNo text NOT NULL,
  poNumber text,
  itemName text NOT NULL,
  cancelStage text NOT NULL,
  cancelReason text NOT NULL,
  qty double precision NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_order-cancellation_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pfms_tat (
  id text NOT NULL,
  stageName text NOT NULL,
  actionTime integer NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responsibleNames text,
  CONSTRAINT pfms_tat_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pfms_item-master (
  id text NOT NULL,
  ITEM CODE text,
  ITEM CATEGORY text,
  ITEM NAME text,
  CONSTRAINT pfms_item-master_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pfms_vendor-master (
  id text NOT NULL,
  Vendor Code text,
  Vendor List text,
  CONSTRAINT pfms_vendor-master_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pfms_dropdown (
  id text NOT NULL,
  Created By text,
  Wharehouse text,
  Payment Terms (Stage3) text,
  Approved By text,
  Checkers (Verification) text,
  Transporter text,
  Checked By text,
  Tally Done By text,
  UOM text,
  Location-Update text,
  QC-Checklist text,
  Reject Type (QC) text,
  CONSTRAINT pfms_dropdown_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pfms_for_ims (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  indent no. text,
  material name text,
  warehouse location text,
  indent qty double precision,
  po qty double precision,
  receiving qty double precision,
  transport details updated - expected delivery date text,
  receiving date text,
  tally entry date text,
  intransit qty double precision,
  "expiry date" text,
  "serial numbers" text,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pfms_for_ims_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pfms_report_history (
  id text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reportName text NOT NULL,
  reportLink text NOT NULL,
  CONSTRAINT pfms_report_history_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pfms_responsible_persons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  stageName text,
  responsibleName text,
  CONSTRAINT pfms_responsible_persons_pkey PRIMARY KEY (id)
);


-- ==========================================================
-- VIEW: pfms_view-indent-lift
-- ==========================================================
CREATE VIEW public."pfms_view-indent-lift" AS
SELECT
    ig."timestamp" AS "timestamp_stage1",
    ig."indentNo" AS "indent_number",
    ig."createdBy" AS "created_by",
    ig."itemName" AS "item_name",
    ig."quantity" AS "qty",
    ig."warehouseLocation" AS "warehouse_location",
    ig."plannedIndentApproval" AS "planned_stage2",
    ia."timestamp" AS "actual_stage2",
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (ia."timestamp" - ig."plannedIndentApproval")) / 86400, 0)) AS "delay_stage2",
    ia."approvedQty" AS "approved_qty",
    ia."plannedUpdateVendors" AS "planned_stage3",
    uv."timestamp" AS "actual_stage3",
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (uv."timestamp" - ia."plannedUpdateVendors")) / 86400, 0)) AS "delay_stage3",
    uv."vendor1Name" AS "vendor1_name",
    uv."vendor2Name" AS "vendor2_name",
    uv."vendor3Name" AS "vendor3_name",
    uv."plannedNegotiation" AS "planned_stage4",
    neg."timestamp" AS "actual_stage4",
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (neg."timestamp" - uv."plannedNegotiation")) / 86400, 0)) AS "delay_stage4",
    neg."selectedVendorName" AS "selected_vendor_name",
    neg."plannedPOEntry" AS "planned_stage5",
    po."timestamp" AS "actual_stage5",
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (po."timestamp" - neg."plannedPOEntry")) / 86400, 0)) AS "delay_stage5",
    po."poNumber" AS "po_number",
    po."plannedFollowUpVendor" AS "planned_stage6",
    (
        SELECT l."timestamp"
        FROM public."pfms_lift" l
        WHERE l."indentNo" = ig."indentNo"
        ORDER BY l."timestamp" DESC
        LIMIT 1
    ) AS "actual_stage6",
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (
        (SELECT l."timestamp" FROM public."pfms_lift" l WHERE l."indentNo" = ig."indentNo" ORDER BY l."timestamp" DESC LIMIT 1) - po."plannedFollowUpVendor"
    )) / 86400, 0)) AS "delay_stage6",
    (
        SELECT tfu."expectedDeliveryDate"
        FROM public."pfms_transporter-follow-up" tfu
        JOIN public."pfms_lift" l ON tfu."liftNo" = l."liftNo"
        WHERE l."indentNo" = ig."indentNo"
          AND tfu."expectedDeliveryDate" IS NOT NULL
        ORDER BY tfu."updatedAt" DESC
        LIMIT 1
    ) AS "expected_delivery_date",
    (
        SELECT l."estimatedDate"
        FROM public."pfms_lift" l
        WHERE l."indentNo" = ig."indentNo"
        ORDER BY l."timestamp" DESC
        LIMIT 1
    ) AS "estimated_date",
    (
        SELECT l."remarksFollowUp"
        FROM public."pfms_lift" l
        WHERE l."indentNo" = ig."indentNo"
        ORDER BY l."timestamp" DESC
        LIMIT 1
    ) AS "remarks_follow_up"
FROM public."pfms_indent-generation" ig
LEFT JOIN public."pfms_indent-approval" ia ON ig."indentNo" = ia."indentNo"
LEFT JOIN public."pfms_update-3-vendors" uv ON ig."indentNo" = uv."indentNo"
LEFT JOIN public."pfms_negotiation" neg ON ig."indentNo" = neg."indentNo"
LEFT JOIN public."pfms_po-entry" po ON ig."indentNo" = po."indentNo";


-- ==========================================================
-- VIEW: pfms_view-receiving_accounts
-- ==========================================================
CREATE VIEW public."pfms_view-receiving_accounts" AS
SELECT
    l."timestamp" AS "timestamp_lift",
    l."liftNo" AS "lift_no",
    l."indentNo" AS "indent_no",
    ig."itemName" AS "item_name",
    neg."selectedVendorName" AS "vendor_name",
    po."poNumber" AS "po_number",
    po."basicValue" AS "po_basic_value",
    po."poCopy" AS "po_copy",
    ia."approvedQty" AS "approved_qty",
    l."liftingQty" AS "lifting_qty",
    l."transporterName" AS "transporter_name",
    l."vehicleNo" AS "vehicle_no",
    l."plannedTransporterFlwUp" AS "planned_stage6_1",
    l."plannedMaterialRcd" AS "planned_stage7",
    l."plannedSerialGen" AS "planned_stage7_5",
    tfu."timestamp" AS "actual_stage6_1",
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (tfu."timestamp" - l."plannedTransporterFlwUp")) / 86400, 0)) AS "delay_stage6_1",
    tfu."expectedDeliveryDate" AS "expected_delivery_date",
    mr."timestamp" AS "actual_stage7",
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (mr."timestamp" - l."plannedMaterialRcd")) / 86400, 0)) AS "delay_stage7",
    mr."invoiceNumber" AS "invoice_number",
    mr."receivedQty" AS "received_qty",
    mr."plannedTallyEntry" AS "planned_stage8",
    mr."plannedMaterialTesting" AS "planned_stage11",
    (
        SELECT MAX(sn."timestamp")
        FROM public."pfms_serial-number" sn
        WHERE sn."liftNo" = l."liftNo"
    ) AS "actual_stage7_5",
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (
        (SELECT MAX(sn."timestamp") FROM public."pfms_serial-number" sn WHERE sn."liftNo" = l."liftNo") - l."plannedSerialGen"
    )) / 86400, 0)) AS "delay_stage7_5",
    te."timestamp" AS "actual_stage8",
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (te."timestamp" - mr."plannedTallyEntry")) / 86400, 0)) AS "delay_stage8",
    te."doneBy" AS "tally_done_by",
    te."doneDate" AS "tally_done_date",
    te."checkedByAcc" AS "tally_checked_by_acc",
    te."plannedInvoiceHO" AS "planned_stage8_5",
    siho."timestamp" AS "actual_stage8_5",
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (siho."timestamp" - te."plannedInvoiceHO")) / 86400, 0)) AS "delay_stage8_5",
    siho."plannedInvoice" AS "planned_stage9",
    si."timestamp" AS "actual_stage9",
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (si."timestamp" - siho."plannedInvoice")) / 86400, 0)) AS "delay_stage9",
    si."handoverBy" AS "invoice_handover_by",
    si."plannedVerification" AS "planned_stage10",
    av."timestamp" AS "actual_stage10",
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (av."timestamp" - si."plannedVerification")) / 86400, 0)) AS "delay_stage10",
    av."verifiedCheckedBy" AS "accounts_verified_by",
    mt."timestamp" AS "actual_stage11",
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (mt."timestamp" - mr."plannedMaterialTesting")) / 86400, 0)) AS "delay_stage11",
    mt."approvedQty" AS "testing_approved_qty",
    mt."rejectedQty" AS "testing_rejected_qty",
    mt."plannedPurchaseReturns" AS "planned_stage11_5",
    pr."timestamp" AS "actual_stage11_5",
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (pr."timestamp" - mt."plannedPurchaseReturns")) / 86400, 0)) AS "delay_stage11_5",
    pr."returnedQty" AS "pr_returned_qty",
    pr."plannedReturnApproval" AS "planned_stage12",
    ra."timestamp" AS "actual_stage12",
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (ra."timestamp" - pr."plannedReturnApproval")) / 86400, 0)) AS "delay_stage12",
    vpd."paidAmount" AS "paid_amount"
FROM public."pfms_lift" l
LEFT JOIN public."pfms_indent-generation" ig ON l."indentNo" = ig."indentNo"
LEFT JOIN public."pfms_indent-approval" ia ON ig."indentNo" = ia."indentNo"
LEFT JOIN public."pfms_negotiation" neg ON ig."indentNo" = neg."indentNo"
LEFT JOIN public."pfms_po-entry" po ON ig."indentNo" = po."indentNo"
LEFT JOIN public."pfms_transporter-follow-up" tfu ON l."liftNo" = tfu."liftNo"
LEFT JOIN public."pfms_material-received" mr ON l."liftNo" = mr."liftNo"
LEFT JOIN public."pfms_tally-entry" te ON l."liftNo" = te."liftNo"
LEFT JOIN public."pfms_submit-invoice-ho" siho ON l."liftNo" = siho."liftNo"
LEFT JOIN public."pfms_submit-invoice" si ON l."liftNo" = si."liftNo"
LEFT JOIN public."pfms_accounts-verification" av ON l."liftNo" = av."liftNo"
LEFT JOIN (
    SELECT DISTINCT ON ("liftNo") * FROM public."pfms_material-testing" ORDER BY "liftNo", "timestamp" DESC
) mt ON l."liftNo" = mt."liftNo"
LEFT JOIN (
    SELECT DISTINCT ON ("liftNo") * FROM public."pfms_purchase-return" ORDER BY "liftNo", "timestamp" DESC
) pr ON l."liftNo" = pr."liftNo"
LEFT JOIN (
    SELECT DISTINCT ON ("liftNo") * FROM public."pfms_return-approval" ORDER BY "liftNo", "timestamp" DESC
) ra ON l."liftNo" = ra."liftNo"
LEFT JOIN public."pfms_vendor-payment-details" vpd ON l."liftNo" = vpd."liftNo";