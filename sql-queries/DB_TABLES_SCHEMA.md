# PFMS — Full Column Schema Dump (all pfms_* tables & views)

> Companion to [DB_CONTEXT.md](./DB_CONTEXT.md) — see that file for the narrative summary, FK map, triggers, and the dropdown-migration plan. This file is the raw per-table column dump (scanned 2026-09-10).

### pfms_User  ⚠️ `records` column added 2026-09-10 (purchaser-based record access, see DB_CONTEXT.md §11)

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| username | text | NO |  |
| fullName | text | NO |  |
| password | text | NO |  |
| role | text | NO |  |
| pageAccess | text | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| records | text | YES | 'ALL'::text |

### pfms_accounts-verification

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| liftNo | text | NO |  |
| verifiedCheckedBy | text | NO |  |
| verificationDate | timestamp without time zone | NO |  |
| remarks | text | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |

### pfms_backup_indent-approval

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | YES |  |
| timestamp | timestamp without time zone | YES |  |
| indentNo | text | YES |  |
| status | text | YES |  |
| approvedQty | double precision | YES |  |
| vendorType | text | YES |  |
| remarks | text | YES |  |
| imgOptional | text | YES |  |
| approvedBy | text | YES |  |
| plannedUpdateVendors | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | YES |  |
| updatedAt | timestamp without time zone | YES |  |

### pfms_backup_indent-generation

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | YES |  |
| timestamp | timestamp without time zone | YES |  |
| indentNo | text | YES |  |
| createdBy | text | YES |  |
| category | text | YES |  |
| itemName | text | YES |  |
| quantity | double precision | YES |  |
| warehouseLocation | text | YES |  |
| itemCode | text | YES |  |
| leadTime | integer | YES |  |
| uom | text | YES |  |
| attachment | text | YES |  |
| status | text | YES |  |
| remarks | text | YES |  |
| plannedIndentApproval | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | YES |  |
| updatedAt | timestamp without time zone | YES |  |

### pfms_damaged-record

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| liftNo | text | NO |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |

### pfms_direct_serial_numbers

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| batchId | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| itemName | text | NO |  |
| vendorName | text | NO |  |
| invoiceDate | timestamp without time zone | YES |  |
| warrantyDuration | integer | YES |  |
| serialNo | text | NO |  |
| qrLink | text | YES |  |
| warrantyExpiry | timestamp without time zone | YES |  |
| productExpiry | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |

### pfms_dropdown  ⚠️ restructure target (see DB_CONTEXT.md §7)

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| Created By | text | YES |  |
| Wharehouse | text | YES |  |
| Payment Terms (Stage3) | text | YES |  |
| Approved By | text | YES |  |
| Checkers (Verification) | text | YES |  |
| Transporter | text | YES |  |
| Checked By | text | YES |  |
| Tally Done By | text | YES |  |
| UOM | text | YES |  |
| Location-Update | text | YES |  |
| QC-Checklist | text | YES |  |
| Reject Type (QC) | text | YES |  |

### pfms_for_ims

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| indent no. | text | YES |  |
| material name | text | YES |  |
| warehouse location | text | YES |  |
| indent qty | double precision | YES |  |
| po qty | double precision | YES |  |
| receiving qty | double precision | YES |  |
| transport details updated - expected delivery date | text | YES |  |
| receiving date | text | YES |  |
| tally entry date | text | YES |  |
| intransit qty | double precision | YES |  |
| createdAt | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| expiry date | text | YES |  |
| serial numbers | text | YES |  |

### pfms_freight-payment-details

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| liftNo | text | NO |  |
| totalAmount | double precision | NO |  |
| paidAmount | double precision | NO | 0 |
| plannedDate | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |

### pfms_indent-approval

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| timestamp | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| indentNo | text | NO |  |
| status | text | YES | 'pending'::text |
| approvedQty | double precision | YES |  |
| vendorType | text | YES |  |
| remarks | text | YES |  |
| imgOptional | text | YES |  |
| approvedBy | text | YES |  |
| plannedUpdateVendors | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |

### pfms_indent_generation  ⚠️ renamed from `pfms_indent-generation` + `purchaser` column added 2026-09-10 (see DB_CONTEXT.md §11)

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| timestamp | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| indentNo | text | YES |  |
| createdBy | text | YES |  |
| category | text | YES |  |
| itemName | text | YES |  |
| quantity | double precision | YES |  |
| warehouseLocation | text | YES |  |
| itemCode | text | YES |  |
| leadTime | integer | YES |  |
| uom | text | YES |  |
| attachment | text | YES |  |
| status | text | YES | 'pending'::text |
| remarks | text | YES |  |
| plannedIndentApproval | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| purchaser | text | YES |  |

### pfms_indent-generation_backup

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | YES |  |
| timestamp | timestamp without time zone | YES |  |
| indentNo | text | YES |  |
| createdBy | text | YES |  |
| category | text | YES |  |
| itemName | text | YES |  |
| quantity | double precision | YES |  |
| warehouseLocation | text | YES |  |
| itemCode | text | YES |  |
| leadTime | integer | YES |  |
| uom | text | YES |  |
| attachment | text | YES |  |
| status | text | YES |  |
| remarks | text | YES |  |
| plannedIndentApproval | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | YES |  |
| updatedAt | timestamp without time zone | YES |  |

### pfms_item-master  ⚠️ rename target (see DB_CONTEXT.md §7)

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| ITEM CODE | text | YES |  |
| ITEM CATEGORY | text | YES |  |
| ITEM NAME | text | YES |  |

### pfms_lift

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| liftNo | text | NO |  |
| indentNo | text | NO |  |
| liftingQty | double precision | NO |  |
| transporterName | text | YES |  |
| vehicleNo | text | YES |  |
| contactNo | text | YES |  |
| lrNo | text | YES |  |
| dispatchDate | timestamp without time zone | YES |  |
| freightAmount | double precision | YES |  |
| advanceAmount | double precision | YES |  |
| paymentDate | timestamp without time zone | YES |  |
| paymentStatus | text | YES |  |
| biltyCopy | text | YES |  |
| followUpDate | timestamp without time zone | YES |  |
| remarks | text | YES |  |
| estimatedDate | timestamp without time zone | YES |  |
| remarksFollowUp | text | YES |  |
| plannedSerialGen | timestamp without time zone | YES |  |
| plannedMaterialRcd | timestamp without time zone | YES |  |
| plannedTransporterFlwUp | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |

### pfms_material-received

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| liftNo | text | NO |  |
| invoiceType | text | NO |  |
| invoiceNumber | text | NO |  |
| invoiceDate | timestamp without time zone | NO |  |
| receivedQty | double precision | NO |  |
| receivedItemImage | text | YES |  |
| billAttachment | text | YES |  |
| qcRequired | text | NO |  |
| extraFreight | double precision | YES |  |
| hydraAmt | double precision | YES |  |
| labourAmt | double precision | YES |  |
| hamaliAmt | double precision | YES |  |
| damagedQty | double precision | YES |  |
| damageReason | text | YES |  |
| damageImage | text | YES |  |
| plannedMaterialTesting | timestamp without time zone | YES |  |
| productExpiry | text | YES |  |
| productExpiryDate | timestamp without time zone | YES |  |
| warranty | text | YES |  |
| warrantyDuration | integer | YES |  |
| warrantyExpiry | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| plannedTallyEntry | timestamp without time zone | YES |  |
| delay | double precision | YES |  |

### pfms_material-testing  ⚠️ `qcBy` = engineers-sourced "Checked By" (see plan)

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| liftNo | text | NO |  |
| qcBy | text | YES |  |
| qcDate | timestamp without time zone | YES |  |
| workingCondition | text | YES |  |
| remarks | text | YES |  |
| pendingQty | double precision | YES |  |
| approvedQty | double precision | YES |  |
| checklist | ARRAY | YES |  |
| serialNumbers | ARRAY | YES |  |
| images | ARRAY | YES |  |
| rejectType | text | YES |  |
| partName | text | YES |  |
| rejectedQty | double precision | YES |  |
| plannedPurchaseReturns | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |

### pfms_negotiation

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| timestamp | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| indentNo | text | YES |  |
| selectedVendorName | text | YES |  |
| finalApprovedBy | text | YES |  |
| negotiationRemarks | text | YES |  |
| plannedPOEntry | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |

### pfms_order-cancellation

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| indentNo | text | NO |  |
| poNumber | text | YES |  |
| itemName | text | NO |  |
| cancelStage | text | NO |  |
| cancelReason | text | NO |  |
| qty | double precision | NO |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| liftNo | text | YES |  |

### pfms_paid-data

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| invoiceId | text | NO |  |
| amountPaid | double precision | NO |  |
| paymentStatus | text | NO |  |
| paymentDate | timestamp without time zone | NO |  |
| paymentMode | text | NO |  |
| proof | text | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |

### pfms_paid-freight-data

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| freightDetailId | text | NO |  |
| amountPaid | double precision | NO |  |
| paymentStatus | text | NO |  |
| paymentDate | timestamp without time zone | NO |  |
| paymentMode | text | NO |  |
| proof | text | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |

### pfms_po-entry

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| indentNo | text | NO |  |
| poNumber | text | YES |  |
| basicValue | double precision | YES |  |
| totalWithTax | double precision | YES |  |
| hsn | text | YES |  |
| poCopy | text | YES |  |
| gst | text | YES |  |
| pkgAmount | double precision | YES |  |
| pkgGST | text | YES |  |
| plannedFollowUpVendor | timestamp without time zone | YES |  |
| estimatedFollowUpVendor | timestamp without time zone | YES |  |
| remarksFollowUpVendor | text | YES |  |
| createdAt | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |

### pfms_purchase-return

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| liftNo | text | NO |  |
| returnedQty | double precision | NO |  |
| returnRate | double precision | YES |  |
| returnAmount | double precision | YES |  |
| returnReason | text | YES |  |
| returnStatus | text | NO |  |
| returnItemImage | text | YES |  |
| creditNoteImage | text | YES |  |
| plannedReturnApproval | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |

### pfms_report_history

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| reportName | text | NO |  |
| reportLink | text | NO |  |

### pfms_responsible_persons

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| stageName | text | YES |  |
| responsibleName | text | YES |  |

### pfms_return-approval

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| liftNo | text | NO |  |
| dnNumber | text | NO |  |
| remarks | text | YES |  |
| returnImage | text | NO |  |
| approvalDate | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |

### pfms_serial-number

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| liftNo | text | NO |  |
| serialNo | text | NO |  |
| qrLink | text | YES |  |
| warrantyExpiry | timestamp without time zone | YES |  |
| productExpiry | timestamp without time zone | YES |  |
| plannedWarrantyClaim | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |

### pfms_submit-invoice

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| liftNo | text | NO |  |
| handoverBy | text | NO |  |
| invoiceSubmissionDate | timestamp without time zone | NO |  |
| plannedVerification | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |

### pfms_submit-invoice-ho

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| liftNo | text | NO |  |
| hardcopySubmitted | text | NO |  |
| submissionDate | timestamp without time zone | NO |  |
| plannedInvoice | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |

### pfms_tally-entry  ⚠️ `doneBy` + `checkedByAcc` = accounts-sourced (see plan)

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| liftNo | text | NO |  |
| doneBy | text | NO |  |
| doneDate | timestamp without time zone | YES |  |
| remarks | text | YES |  |
| checkedStatus | text | NO |  |
| checkedByAcc | text | YES |  |
| plannedInvoiceHO | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |

### pfms_tat  ⚠️ rebuilt 2026-09-11 (was id/stageName/actionTime/responsibleNames text; see DB_CONTEXT.md §11)

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| stage_name | text | NO |  |
| duration_in_minutes | integer | NO | 60 |
| responsible_persons | text[] | NO | '{}' |
| created_at | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | NO | CURRENT_TIMESTAMP |

(Old table renamed to `pfms_tat_old_backup`, not dropped.)

### pfms_transporter-follow-up

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| liftNo | text | NO |  |
| status | text | NO |  |
| expectedDeliveryDate | timestamp without time zone | YES |  |
| nextFollowUpDate | timestamp without time zone | YES |  |
| remarks | text | YES |  |
| lastFollowUpDate | timestamp without time zone | YES |  |
| totalFollowUps | integer | NO | 0 |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |

### pfms_update-3-vendors

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| timestamp | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| indentNo | text | YES |  |
| vendor1Name | text | YES |  |
| vendor1Rate | double precision | YES |  |
| vendor1Terms | text | YES |  |
| vendor1DeliveryDate | timestamp without time zone | YES |  |
| vendor1WarrantyType | text | YES |  |
| vendor1WarrantyFrom | timestamp without time zone | YES |  |
| vendor1WarrantyTo | timestamp without time zone | YES |  |
| vendor1Attachment | text | YES |  |
| vendor2Name | text | YES |  |
| vendor2Rate | double precision | YES |  |
| vendor2Terms | text | YES |  |
| vendor2DeliveryDate | timestamp without time zone | YES |  |
| vendor2WarrantyType | text | YES |  |
| vendor2WarrantyFrom | timestamp without time zone | YES |  |
| vendor2WarrantyTo | timestamp without time zone | YES |  |
| vendor2Attachment | text | YES |  |
| vendor3Name | text | YES |  |
| vendor3Rate | double precision | YES |  |
| vendor3Terms | text | YES |  |
| vendor3DeliveryDate | timestamp without time zone | YES |  |
| vendor3WarrantyType | text | YES |  |
| vendor3WarrantyFrom | timestamp without time zone | YES |  |
| vendor3WarrantyTo | timestamp without time zone | YES |  |
| vendor3Attachment | text | YES |  |
| plannedNegotiation | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |

### pfms_vendor-master

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| Vendor Code | text | YES |  |
| Vendor List | text | YES |  |

### pfms_vendor-payment-details

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| liftNo | text | NO |  |
| totalAmount | double precision | NO |  |
| paidAmount | double precision | NO | 0 |
| dueDate | timestamp without time zone | YES |  |
| plannedDate | timestamp without time zone | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |

### pfms_view-indent-lift  (VIEW)

| Column | Type | Nullable | Default |
|---|---|---|---|
| timestamp_stage1 | timestamp without time zone | YES |  |
| indent_number | text | YES |  |
| created_by | text | YES |  |
| item_name | text | YES |  |
| qty | double precision | YES |  |
| warehouse_location | text | YES |  |
| planned_stage2 | timestamp without time zone | YES |  |
| actual_stage2 | timestamp without time zone | YES |  |
| delay_stage2 | numeric | YES |  |
| approved_qty | double precision | YES |  |
| planned_stage3 | timestamp without time zone | YES |  |
| actual_stage3 | timestamp without time zone | YES |  |
| delay_stage3 | numeric | YES |  |
| vendor1_name | text | YES |  |
| vendor2_name | text | YES |  |
| vendor3_name | text | YES |  |
| planned_stage4 | timestamp without time zone | YES |  |
| actual_stage4 | timestamp without time zone | YES |  |
| delay_stage4 | numeric | YES |  |
| selected_vendor_name | text | YES |  |
| planned_stage5 | timestamp without time zone | YES |  |
| actual_stage5 | timestamp without time zone | YES |  |
| delay_stage5 | numeric | YES |  |
| po_number | text | YES |  |
| planned_stage6 | timestamp without time zone | YES |  |
| actual_stage6 | timestamp without time zone | YES |  |
| delay_stage6 | numeric | YES |  |
| expected_delivery_date | timestamp without time zone | YES |  |
| estimated_date | timestamp without time zone | YES |  |
| remarks_follow_up | text | YES |  |

### pfms_view-receiving_accounts  (VIEW)

| Column | Type | Nullable | Default |
|---|---|---|---|
| timestamp_lift | timestamp without time zone | YES |  |
| lift_no | text | YES |  |
| indent_no | text | YES |  |
| item_name | text | YES |  |
| vendor_name | text | YES |  |
| po_number | text | YES |  |
| po_basic_value | double precision | YES |  |
| po_copy | text | YES |  |
| approved_qty | double precision | YES |  |
| lifting_qty | double precision | YES |  |
| transporter_name | text | YES |  |
| vehicle_no | text | YES |  |
| planned_stage6_1 | timestamp without time zone | YES |  |
| planned_stage7 | timestamp without time zone | YES |  |
| planned_stage7_5 | timestamp without time zone | YES |  |
| actual_stage6_1 | timestamp without time zone | YES |  |
| delay_stage6_1 | numeric | YES |  |
| expected_delivery_date | timestamp without time zone | YES |  |
| actual_stage7 | timestamp without time zone | YES |  |
| delay_stage7 | numeric | YES |  |
| invoice_number | text | YES |  |
| received_qty | double precision | YES |  |
| planned_stage8 | timestamp without time zone | YES |  |
| planned_stage11 | timestamp without time zone | YES |  |
| actual_stage7_5 | timestamp without time zone | YES |  |
| delay_stage7_5 | numeric | YES |  |
| actual_stage8 | timestamp without time zone | YES |  |
| delay_stage8 | numeric | YES |  |
| tally_done_by | text | YES |  |
| tally_done_date | timestamp without time zone | YES |  |
| tally_checked_by_acc | text | YES |  |
| planned_stage8_5 | timestamp without time zone | YES |  |
| actual_stage8_5 | timestamp without time zone | YES |  |
| delay_stage8_5 | numeric | YES |  |
| planned_stage9 | timestamp without time zone | YES |  |
| actual_stage9 | timestamp without time zone | YES |  |
| delay_stage9 | numeric | YES |  |
| invoice_handover_by | text | YES |  |
| planned_stage10 | timestamp without time zone | YES |  |
| actual_stage10 | timestamp without time zone | YES |  |
| delay_stage10 | numeric | YES |  |
| accounts_verified_by | text | YES |  |
| actual_stage11 | timestamp without time zone | YES |  |
| delay_stage11 | numeric | YES |  |
| testing_approved_qty | double precision | YES |  |
| testing_rejected_qty | double precision | YES |  |
| planned_stage11_5 | timestamp without time zone | YES |  |
| actual_stage11_5 | timestamp without time zone | YES |  |
| delay_stage11_5 | numeric | YES |  |
| pr_returned_qty | double precision | YES |  |
| planned_stage12 | timestamp without time zone | YES |  |
| actual_stage12 | timestamp without time zone | YES |  |
| delay_stage12 | numeric | YES |  |
| paid_amount | double precision | YES |  |

### pfms_warranty-claim

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NO |  |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| serialNo | text | NO |  |
| invoiceNo | text | YES |  |
| invoiceCopy | text | YES |  |
| issueDescription | text | NO |  |
| photoVideo | text | YES |  |
| claimType | text | NO |  |
| status | text | NO | 'Pending'::text |
| claimedBy | text | YES |  |
| plannedClosure | timestamp without time zone | YES |  |
| closureDate | timestamp without time zone | YES |  |
| remarks | text | YES |  |
| createdAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| delay | double precision | YES |  |
