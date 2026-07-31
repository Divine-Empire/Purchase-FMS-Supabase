-- SQL commands to apply ON UPDATE CASCADE and ON DELETE CASCADE on all foreign key constraints in pfms tables

-- 1. pfms_indent-approval -> pfms_indent-generation
ALTER TABLE public."pfms_indent-approval" 
  DROP CONSTRAINT IF EXISTS "pfms_indent-approval_indentNo_fkey";
ALTER TABLE public."pfms_indent-approval" 
  ADD CONSTRAINT "pfms_indent-approval_indentNo_fkey" 
  FOREIGN KEY ("indentNo") REFERENCES public."pfms_indent-generation"("indentNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 2. pfms_update-3-vendors -> pfms_indent-generation
ALTER TABLE public."pfms_update-3-vendors" 
  DROP CONSTRAINT IF EXISTS "pfms_update-3-vendors_indentNo_fkey";
ALTER TABLE public."pfms_update-3-vendors" 
  ADD CONSTRAINT "pfms_update-3-vendors_indentNo_fkey" 
  FOREIGN KEY ("indentNo") REFERENCES public."pfms_indent-generation"("indentNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 3. pfms_negotiation -> pfms_indent-generation
ALTER TABLE public."pfms_negotiation" 
  DROP CONSTRAINT IF EXISTS "pfms_negotiation_indentNo_fkey";
ALTER TABLE public."pfms_negotiation" 
  ADD CONSTRAINT "pfms_negotiation_indentNo_fkey" 
  FOREIGN KEY ("indentNo") REFERENCES public."pfms_indent-generation"("indentNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 4. pfms_po-entry -> pfms_indent-generation
ALTER TABLE public."pfms_po-entry" 
  DROP CONSTRAINT IF EXISTS "pfms_po-entry_indentNo_fkey";
ALTER TABLE public."pfms_po-entry" 
  ADD CONSTRAINT "pfms_po-entry_indentNo_fkey" 
  FOREIGN KEY ("indentNo") REFERENCES public."pfms_indent-generation"("indentNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 5. pfms_lift -> pfms_indent-generation
ALTER TABLE public."pfms_lift" 
  DROP CONSTRAINT IF EXISTS "pfms_lift_indentNo_fkey";
ALTER TABLE public."pfms_lift" 
  ADD CONSTRAINT "pfms_lift_indentNo_fkey" 
  FOREIGN KEY ("indentNo") REFERENCES public."pfms_indent-generation"("indentNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 6. pfms_transporter-follow-up -> pfms_lift
ALTER TABLE public."pfms_transporter-follow-up" 
  DROP CONSTRAINT IF EXISTS "pfms_transporter-follow-up_liftNo_fkey";
ALTER TABLE public."pfms_transporter-follow-up" 
  ADD CONSTRAINT "pfms_transporter-follow-up_liftNo_fkey" 
  FOREIGN KEY ("liftNo") REFERENCES public."pfms_lift"("liftNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 7. pfms_material-received -> pfms_lift
ALTER TABLE public."pfms_material-received" 
  DROP CONSTRAINT IF EXISTS "pfms_material-received_liftNo_fkey";
ALTER TABLE public."pfms_material-received" 
  ADD CONSTRAINT "pfms_material-received_liftNo_fkey" 
  FOREIGN KEY ("liftNo") REFERENCES public."pfms_lift"("liftNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 8. pfms_damaged-record -> pfms_lift
ALTER TABLE public."pfms_damaged-record" 
  DROP CONSTRAINT IF EXISTS "pfms_damaged-record_liftNo_fkey";
ALTER TABLE public."pfms_damaged-record" 
  ADD CONSTRAINT "pfms_damaged-record_liftNo_fkey" 
  FOREIGN KEY ("liftNo") REFERENCES public."pfms_lift"("liftNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 9. pfms_serial-number -> pfms_lift
ALTER TABLE public."pfms_serial-number" 
  DROP CONSTRAINT IF EXISTS "pfms_serial-number_liftNo_fkey";
ALTER TABLE public."pfms_serial-number" 
  ADD CONSTRAINT "pfms_serial-number_liftNo_fkey" 
  FOREIGN KEY ("liftNo") REFERENCES public."pfms_lift"("liftNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 10. pfms_warranty-claim -> pfms_serial-number
ALTER TABLE public."pfms_warranty-claim" 
  DROP CONSTRAINT IF EXISTS "pfms_warranty-claim_serialNo_fkey";
ALTER TABLE public."pfms_warranty-claim" 
  ADD CONSTRAINT "pfms_warranty-claim_serialNo_fkey" 
  FOREIGN KEY ("serialNo") REFERENCES public."pfms_serial-number"("serialNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 11. pfms_tally-entry -> pfms_lift
ALTER TABLE public."pfms_tally-entry" 
  DROP CONSTRAINT IF EXISTS "pfms_tally-entry_liftNo_fkey";
ALTER TABLE public."pfms_tally-entry" 
  ADD CONSTRAINT "pfms_tally-entry_liftNo_fkey" 
  FOREIGN KEY ("liftNo") REFERENCES public."pfms_lift"("liftNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 12. pfms_submit-invoice-ho -> pfms_lift
ALTER TABLE public."pfms_submit-invoice-ho" 
  DROP CONSTRAINT IF EXISTS "pfms_submit-invoice-ho_liftNo_fkey";
ALTER TABLE public."pfms_submit-invoice-ho" 
  ADD CONSTRAINT "pfms_submit-invoice-ho_liftNo_fkey" 
  FOREIGN KEY ("liftNo") REFERENCES public."pfms_lift"("liftNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 13. pfms_submit-invoice -> pfms_lift
ALTER TABLE public."pfms_submit-invoice" 
  DROP CONSTRAINT IF EXISTS "pfms_submit-invoice_liftNo_fkey";
ALTER TABLE public."pfms_submit-invoice" 
  ADD CONSTRAINT "pfms_submit-invoice_liftNo_fkey" 
  FOREIGN KEY ("liftNo") REFERENCES public."pfms_lift"("liftNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 14. pfms_accounts-verification -> pfms_lift
ALTER TABLE public."pfms_accounts-verification" 
  DROP CONSTRAINT IF EXISTS "pfms_accounts-verification_liftNo_fkey";
ALTER TABLE public."pfms_accounts-verification" 
  ADD CONSTRAINT "pfms_accounts-verification_liftNo_fkey" 
  FOREIGN KEY ("liftNo") REFERENCES public."pfms_lift"("liftNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 15. pfms_material-testing -> pfms_lift
ALTER TABLE public."pfms_material-testing" 
  DROP CONSTRAINT IF EXISTS "pfms_material-testing_liftNo_fkey";
ALTER TABLE public."pfms_material-testing" 
  ADD CONSTRAINT "pfms_material-testing_liftNo_fkey" 
  FOREIGN KEY ("liftNo") REFERENCES public."pfms_lift"("liftNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 16. pfms_purchase-return -> pfms_lift
ALTER TABLE public."pfms_purchase-return" 
  DROP CONSTRAINT IF EXISTS "pfms_purchase-return_liftNo_fkey";
ALTER TABLE public."pfms_purchase-return" 
  ADD CONSTRAINT "pfms_purchase-return_liftNo_fkey" 
  FOREIGN KEY ("liftNo") REFERENCES public."pfms_lift"("liftNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 17. pfms_return-approval -> pfms_lift
ALTER TABLE public."pfms_return-approval" 
  DROP CONSTRAINT IF EXISTS "pfms_return-approval_liftNo_fkey";
ALTER TABLE public."pfms_return-approval" 
  ADD CONSTRAINT "pfms_return-approval_liftNo_fkey" 
  FOREIGN KEY ("liftNo") REFERENCES public."pfms_lift"("liftNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 18. pfms_vendor-payment-details -> pfms_lift
ALTER TABLE public."pfms_vendor-payment-details" 
  DROP CONSTRAINT IF EXISTS "pfms_vendor-payment-details_liftNo_fkey";
ALTER TABLE public."pfms_vendor-payment-details" 
  ADD CONSTRAINT "pfms_vendor-payment-details_liftNo_fkey" 
  FOREIGN KEY ("liftNo") REFERENCES public."pfms_lift"("liftNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 19. pfms_paid-data -> pfms_vendor-payment-details
ALTER TABLE public."pfms_paid-data" 
  DROP CONSTRAINT IF EXISTS "pfms_paid-data_invoiceId_fkey";
ALTER TABLE public."pfms_paid-data" 
  ADD CONSTRAINT "pfms_paid-data_invoiceId_fkey" 
  FOREIGN KEY ("invoiceId") REFERENCES public."pfms_vendor-payment-details"("id") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 20. pfms_freight-payment-details -> pfms_lift
ALTER TABLE public."pfms_freight-payment-details" 
  DROP CONSTRAINT IF EXISTS "pfms_freight-payment-details_liftNo_fkey";
ALTER TABLE public."pfms_freight-payment-details" 
  ADD CONSTRAINT "pfms_freight-payment-details_liftNo_fkey" 
  FOREIGN KEY ("liftNo") REFERENCES public."pfms_lift"("liftNo") 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 21. pfms_paid-freight-data -> pfms_freight-payment-details
ALTER TABLE public."pfms_paid-freight-data" 
  DROP CONSTRAINT IF EXISTS "pfms_paid-freight-data_freightDetailId_fkey";
ALTER TABLE public."pfms_paid-freight-data" 
  ADD CONSTRAINT "pfms_paid-freight-data_freightDetailId_fkey" 
  FOREIGN KEY ("freightDetailId") REFERENCES public."pfms_freight-payment-details"("id") 
  ON UPDATE CASCADE ON DELETE CASCADE;
