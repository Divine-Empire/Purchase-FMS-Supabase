-- Return Approval used to match an approval to a return by liftNo alone, so a
-- second return batch on the same lift (e.g. "Repair Failed" after a "Direct
-- QC Reject") looked already approved. An approval now points at the exact
-- pfms_purchase-return row it approves. Nullable: approvals made before this
-- column existed (none at the time of writing) keep matching by liftNo.
ALTER TABLE "pfms_return-approval"
  ADD COLUMN IF NOT EXISTS "returnId" TEXT REFERENCES "pfms_purchase-return"(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "pfms_return-approval_returnId_key" ON "pfms_return-approval" ("returnId") WHERE "returnId" IS NOT NULL;
