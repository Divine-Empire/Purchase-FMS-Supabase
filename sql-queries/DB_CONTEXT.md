# PFMS Database Context (Supabase Postgres)

> Generated 2026-09-10 via direct `psql` scan against the pooler connection.
> Purpose: reusable reference so future work doesn't need to re-scan the DB from scratch.
> Re-run the scan and refresh this file if the schema changes significantly (new tables, renamed columns, new triggers, etc.)
>
> **⚠️ Since the original scan, both `pfms_item-master` → `pfms_item_master` and
> `pfms_indent-generation` → `pfms_indent_generation` have been renamed, and new
> columns (`purchaser` on the item-master/indent-generation tables, `records` on
> `pfms_User`) were added — see **[§11 Changes Log](#11-changes-log)** at the
> bottom for the full chronological record. The body below has been updated in
> place to use the current (renamed) table names except where it's describing
> historical/backup tables (`pfms_backup_indent-approval`,
> `pfms_backup_indent-generation`, `pfms_indent-generation_backup`), which were
> never renamed and still use the old naming.

**Connection** (pooler, session mode):
```
psql -h aws-1-ap-south-1.pooler.supabase.com -p 5432 -d postgres -U postgres.zpkikvgmmbtekbcuqahf
```
DB password is not stored in `.env` (only `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are there) — get it from the user or Supabase Dashboard → Project Settings → Database when a fresh scan/DDL session is needed.

Postgres version: **17.6** (aarch64, AWS ap-south-1).

---

## 1. Scope note

The DB has **62 tables/views total** in `public` schema, but only **35 tables + 2 views** are `pfms_*` (this app's domain). The rest belong to unrelated apps sharing the same Postgres instance:
- `event_*` tables — some event/quiz app (has its own triggers `trg_sync_participant`, functions `start_live_round`, `reveal_live_winner`, etc.)
- `whatsapp_portal_*` tables — a WhatsApp messaging portal
- `checklist`, `delegation`, `delegation_done`, `holidays`, `working_day_calender`, `users`, `pfms_User` — look like a separate task/delegation-tracking app (has its own delay/TAT trigger logic: `calculate_delay_if_late`, `calculate_dynamic_delay`, `manage_planned_date`, etc.) — **not** part of the Purchase-FMS Next.js app in this repo.

Everything below focuses on `pfms_*` objects unless noted.

---

## 2. All `pfms_*` tables (35 base tables + 2 views)

Full column-level schema (name, type, nullable, default) for every `pfms_*` table is in **[DB_TABLES_SCHEMA.md](./DB_TABLES_SCHEMA.md)** (kept as a separate file since it's long — ~700 lines).

Quick index of tables by purchase-flow stage:

| Stage | Table |
|---|---|
| 1. Create Indent | `pfms_indent_generation` |
| 2. Indent Approval | `pfms_indent-approval` |
| 3. Update 3 Vendors | `pfms_update-3-vendors` |
| 4. Negotiation | `pfms_negotiation` |
| 5. PO Entry | `pfms_po-entry` |
| 6. Follow-Up Vendor | (no dedicated table — driven off `pfms_po-entry` + `pfms_lift`) |
| 6.1 Transporter Follow-Up | `pfms_transporter-follow-up` (FK → `pfms_lift.liftNo`) |
| 7. Material Received | `pfms_material-received` (FK → `pfms_lift.liftNo`) |
| 7.5 Material Testing (QC) | `pfms_material-testing` (FK → `pfms_lift.liftNo`) — `qcBy` = QC "Checked By" field |
| 8. Tally Entry | `pfms_tally-entry` (FK → `pfms_lift.liftNo`) — `doneBy` = "Tally Done By", `checkedByAcc` = its own "Checked By" |
| 8.5 Accounts Verification | `pfms_accounts-verification` (FK → `pfms_lift.liftNo`) — `verifiedCheckedBy` = verification "Checked By" |
| 9. Submit Invoice | `pfms_submit-invoice` (FK → `pfms_lift.liftNo`) |
| 10. Submit Invoice HO | `pfms_submit-invoice-ho` (FK → `pfms_lift.liftNo`) |
| 11. Vendor Payment | `pfms_vendor-payment-details`, `pfms_paid-data` |
| Serial Generation | `pfms_serial-number` (FK → `pfms_lift.liftNo`), `pfms_direct_serial_numbers` |
| Warranty Claim | `pfms_warranty-claim` (FK → `pfms_serial-number.serialNo`) |
| Purchase Return / Damage | `pfms_purchase-return`, `pfms_return-approval`, `pfms_damaged-record` (all FK → `pfms_lift.liftNo`) |
| Freight | `pfms_freight-payment-details` (FK → `pfms_lift.liftNo`), `pfms_paid-freight-data` |
| Order Cancellation | `pfms_order-cancellation` |
| **Masters/Config** | `pfms_item-master`, `pfms_vendor-master`, `pfms_dropdown`, `pfms_tat`, `pfms_responsible_persons` |
| IMS sync | `pfms_for_ims` (synced from multiple stage tables via triggers, then pushed to an external Google Apps Script sheet) |
| Reports | `pfms_report_history` |
| Backups (stale, not used by app code) | `pfms_backup_indent-approval`, `pfms_backup_indent-generation`, `pfms_indent-generation_backup` |
| Reporting views | `pfms_view-indent-lift`, `pfms_view-receiving_accounts` (read-only aggregated views across the stage tables, used for dashboards — confirmed **no dependency** on `pfms_item-master` or `pfms_dropdown`) |

Notes:
- Most `pfms_*` table `id` columns are `text` (app generates `randomUUID()` client/server-side), **except**: `pfms_indent-approval`, `pfms_indent_generation`, `pfms_negotiation`, `pfms_po-entry`, `pfms_update-3-vendors`, `pfms_for_ims`, `pfms_responsible_persons` which use real `uuid` with `gen_random_uuid()` default.
- `pfms_item-master` and `pfms_dropdown` both use `id text` (no default — app supplies `randomUUID()`).
- `pfms_material-testing` has 3 `ARRAY` typed columns: `checklist`, `serialNumbers`, `images`.

---

## 3. Foreign Keys (pfms_* only)

Almost everything hangs off `liftNo` → `pfms_lift.liftNo`, and `indentNo` → `pfms_indent_generation.indentNo`:

```
pfms_accounts-verification.liftNo        → pfms_lift.liftNo
pfms_damaged-record.liftNo               → pfms_lift.liftNo
pfms_freight-payment-details.liftNo      → pfms_lift.liftNo
pfms_material-received.liftNo            → pfms_lift.liftNo
pfms_material-testing.liftNo             → pfms_lift.liftNo
pfms_purchase-return.liftNo              → pfms_lift.liftNo
pfms_return-approval.liftNo              → pfms_lift.liftNo
pfms_serial-number.liftNo                → pfms_lift.liftNo
pfms_submit-invoice.liftNo               → pfms_lift.liftNo
pfms_submit-invoice-ho.liftNo            → pfms_lift.liftNo
pfms_tally-entry.liftNo                  → pfms_lift.liftNo
pfms_transporter-follow-up.liftNo        → pfms_lift.liftNo
pfms_vendor-payment-details.liftNo       → pfms_lift.liftNo

pfms_indent-approval.indentNo            → pfms_indent_generation.indentNo
pfms_lift.indentNo                       → pfms_indent_generation.indentNo
pfms_negotiation.indentNo                → pfms_indent_generation.indentNo
pfms_po-entry.indentNo                   → pfms_indent_generation.indentNo
pfms_update-3-vendors.indentNo           → pfms_indent_generation.indentNo
pfms_for_ims."indent no."                → pfms_indent_generation.indentNo   (fk_pfms_for_ims_indent_no)

pfms_paid-data.invoiceId                 → pfms_vendor-payment-details.id
pfms_paid-freight-data.freightDetailId   → pfms_freight-payment-details.id
pfms_warranty-claim.serialNo             → pfms_serial-number.serialNo
```

**`pfms_item-master` and `pfms_dropdown` have ZERO foreign keys pointing to or from them** — confirmed safe to rename/restructure without FK fallout.

---

## 4. Triggers & Functions (pfms_* relevant ones)

All `pfms_*` triggers are `AFTER INSERT` (a few `AFTER UPDATE`) and exist purely to **sync data into `pfms_for_ims`** (an external IMS/inventory-sheet mirror) or push it to a Google Apps Script webhook. None of them touch `pfms_item-master` or `pfms_dropdown`.

| Table | Trigger | Fires | Function |
|---|---|---|---|
| `pfms_indent_generation` | `trigger_populate_pfms_for_ims` | AFTER INSERT | `populate_pfms_for_ims()` |
| `pfms_indent-approval` | `trigger_sync_approved_qty_to_ims` | AFTER INSERT | `sync_approved_qty_to_ims()` |
| `pfms_po-entry` | `trigger_sync_po_to_ims` | AFTER INSERT | `sync_po_to_ims()` |
| `pfms_material-received` | `trigger_sync_receipt_to_ims` | AFTER INSERT | `sync_receipt_to_ims()` |
| `pfms_order-cancellation` | `trigger_sync_cancelled_qty_to_ims` | AFTER INSERT | `sync_cancelled_qty_to_ims()` |
| `pfms_serial-number` | `trigger_sync_serials_to_ims` | AFTER INSERT | `sync_serials_to_ims()` |
| `pfms_tally-entry` | `trigger_sync_tally_to_ims` | AFTER INSERT | `sync_tally_to_ims()` |
| `pfms_transporter-follow-up` | `trigger_transporter_followup` | AFTER INSERT/UPDATE | `process_transporter_followup()` |
| `pfms_for_ims` | `pfms_for_ims_sheet_sync` | AFTER INSERT/UPDATE/DELETE | `supabase_functions.http_request(...)` → POSTs to a Google Apps Script URL (`?action=syncToIMS`) |

**Custom RPC functions used by app code** (called via `supabase.rpc(...)`):
- `pfms_generate_next_indent_no(batch_size integer) → text[]` — generates `IN-<seq><A/B/C...>` batch IDs. Defined in [pfms_sequencing.sql](./pfms_sequencing.sql).
- `pfms_generate_next_lift_nos(batch_size integer) → text[]` — generates `LIFT-<seq>` batch IDs. Same file.

No trigger/function/view in the DB references `pfms_item-master` or `pfms_dropdown` (verified via `information_schema.routines.routine_definition` and `information_schema.views.view_definition` ILIKE search — zero matches).

---

## 5. Sequences

| Sequence | Used by |
|---|---|
| `pfms_indent_no_seq` | `pfms_generate_next_indent_no()` |
| `pfms_lift_no_seq` | `pfms_generate_next_lift_nos()` |
| `checklist_task_id_seq`, `delegation_task_id_seq`, `holidays_id_seq`, `users_id_seq`, `working_day_calender_id_seq` | belong to the unrelated delegation/task app, not PFMS |

## 6. Enums

All 4 enums in `public` schema (`enable_reminder`, `role`, `status`, `user_status`) belong to the **unrelated delegation/task app** — PFMS tables don't use Postgres enums; status-like columns (`status`, `checkedStatus`, `paymentStatus`, etc.) are plain `text` with string values enforced only in application code.

---

## 7. Master/config tables in detail (relevant to the current Purchaser/Dropdown rework)

### `pfms_item_master` (renamed 2026-09-10 from `pfms_item-master`)
```
id             text  NOT NULL   -- randomUUID() from app
"ITEM CODE"    text
"ITEM CATEGORY" text
"ITEM NAME"    text
purchaser      text             -- added 2026-09-10, backfilled from CSV (see §9)
```
- 4,092 rows. No FKs in or out. No triggers. No RLS-relevant dependencies found.
- Prisma model: `ItemMaster` (`prisma/schema.prisma`) maps to `@@map("pfms_item_master")`.
- Referenced in code as the literal string `"pfms_item_master"` in: `app/api/dropdowns/route.ts` (GET fetch, POST addItem/updateItem, DELETE deleteItem), `app/api/create-indent/route.ts`, `app/api/serial-generation/route.ts`.

### `pfms_dropdown` (schema restructure target → category/value pairs)
Current shape — **one column per dropdown category, one new (mostly-null) row inserted per added option** (sparse wide table):
```
id text NOT NULL
"Created By" text
"Wharehouse" text
"Payment Terms (Stage3)" text
"Approved By" text
"Checkers (Verification)" text
"Transporter" text
"Checked By" text
"Tally Done By" text
"UOM" text
"Location-Update" text        -- present in DB, NOT exposed in current dropdownsMaster.tsx UI
"Reject Type (QC)" text
```
(`QC-Checklist` column also exists per app code but wasn't independently re-verified column-by-column beyond the DDL dump above — cross-check before dropping.)
- Only 29 rows total today (i.e. ~29 options added across all 11 categories combined since each option = 1 row).
- No FKs, no triggers.
- Read/written only via `app/api/dropdowns/route.ts` and displayed/edited via `stage-pages/master/dropdownsMaster.tsx`.

### Where each dropdown category is consumed in the app (field → table.column)

| Dropdown category (current) | UI file | Field (formData key) | DB column |
|---|---|---|---|
| Created By | create-indent | `createdBy` | `pfms_indent_generation.createdBy` |
| Wharehouse | create-indent | `warehouseLocation` | `pfms_indent_generation.warehouseLocation` |
| UOM | create-indent | `uom` | `pfms_indent_generation.uom` |
| Payment Terms (Stage3) | update-3-vendors | `vendor{n}Terms` | `pfms_update-3-vendors.vendor{1,2,3}Terms` |
| Approved By | indent-approval / negotiation | `approvedBy` / `finalApprovedBy` | `pfms_indent-approval.approvedBy`, `pfms_negotiation.finalApprovedBy` |
| Transporter | transporter-follow-up / lift | `transporterName` | `pfms_lift.transporterName` |
| **Checked By** (`checkedByOptions`) | **material-testing.tsx** (`qcBy`, placeholder "Select engineer") **and** **tally-entry.tsx** (`checkedByAcc`) | two different real-world meanings sharing one dropdown today | `pfms_material-testing.qcBy`, `pfms_tally-entry.checkedByAcc` |
| **Tally Done By** (`tallyDoneByOptions`) | tally-entry.tsx | `doneBy` | `pfms_tally-entry.doneBy` |
| **Checkers (Verification)** (`checkersVerificationOptions`) | verification.tsx | `checkedBy` | `pfms_accounts-verification.verifiedCheckedBy` |
| QC-Checklist | material-testing.tsx | `checklist[]` | `pfms_material-testing.checklist` (array) |
| Reject Type (QC) | material-testing.tsx | `rejectType` | `pfms_material-testing.rejectType` |

**Confirmed plan (per user decision 2026-09-10):**
- New **`Accounts`** category (8 names: T VISHAL PATNAIK, NANDINI NIRMALKAR, DIPIKA DEWANGAN, TARINI KUMBHAKAR, KIRAN YADAV, YUVRAJ NIRMALKAR, JYOTI GAYAKWAD, AKASH NANDI) replaces **Checked By + Checkers (Verification) + Tally Done By** everywhere **except** material-testing.
- New **`Engineers`** category (5 names: JYOTI GAYAKWAD, AJAY KATIYAR, SHAILESH MACHHIRKE, CHANDAN DAS, NANDINI NIRMALKAR) becomes the source for **material-testing.tsx's `qcBy` ("Checked By")** field specifically (matches its existing "Select engineer" placeholder).
- New **`Purchaser`** category (seed: HARISH, AKASH) becomes the dropdown source for the new `pfms_item_master.purchaser` column.
- `pfms_dropdown` itself gets fully migrated to a normalized `(id, category, value)` pair schema — all 8 existing categories + 3 new ones live in the same table going forward.

---

## 8. App-code references that touch these two tables (migration — DONE 2026-09-10)

Files referencing `"pfms_item_master"` (table name string) or the `ItemMaster`/`Dropdown` Prisma models (all already updated to the new table names/schema):
- `prisma/schema.sql`, `prisma/schema.prisma` — `@@map("pfms_item_master")`, `@@map("pfms_dropdown")`
- `init-pfms.sql` — CREATE TABLE statements kept in sync for fresh-environment setup
- `app/api/dropdowns/route.ts` — heaviest user: GET (fetch all dropdown + item + vendor + responsible-person data), POST (addDropdownOption, addItem, **updateItem** — new action), DELETE (deleteDropdownOption, deleteItem)
- `app/api/create-indent/route.ts` — inserts newly-catalogued items (`saveNewItems`) into `pfms_item_master`
- `app/api/serial-generation/route.ts` — reads `pfms_item_master` for item code lookups
- `stage-pages/master/dropdownsMaster.tsx` — the admin UI (`DROPDOWN_COLUMNS` config array, Items Master tab)
- `stage-pages/material-testing/material-testing.tsx` — consumes `checkedByOptions` as `qcEngineerList`
- `stage-pages/tally-entry/tally-entry.tsx` — consumes `checkedByOptions` (as `checkerList`) and `tallyDoneByOptions` (as `accountantList`)
- `stage-pages/verification/verification.tsx` — consumes `checkersVerificationOptions` (as `checkersList`)

---

## 9. CSV data file for the Purchaser backfill

`IMS MOQ FOR 2026-27 - final data division.csv` (repo root, untracked):
- **5,190 data rows, no header row.** 2 columns: `item_name, purchaser`.
- Purchaser values seen: `AKASH`, `HARISH` (watch for stray trailing-space variants like `"AKASH "` — normalize/trim on import).
- Some item names contain embedded commas inside the text (not quoted consistently) — **do not** naive-split on `,`; use a proper CSV parser and take the **last** comma-separated field as the purchaser, everything before it (rejoined) as the item name, OR parse with a real CSV library that respects quoting.
- Matching strategy against `pfms_item_master."ITEM NAME"` (4,092 rows): case-insensitive, trimmed exact match, then a second "loose" pass (strip all punctuation/whitespace, apply only if unambiguous). **Result: 3,084/4,092 (75%) matched** (2,950 exact + 134 loose); 1,008 items are still unmatched (genuinely different formatting between the two sources) and were left with `purchaser = NULL` — to be set manually via the Item Master "Edit" modal in `dropdownsMaster.tsx`.

---

## 10. Raw scan artifacts

Full raw `psql` output (columns/constraints/indexes/triggers/sequences/enums) is also saved for reference in this session's scratchpad at:
`db-scan/columns.txt`, `constraints.txt`, `foreign_keys.txt`, `indexes.txt`, `triggers_functions.txt`, `table_types.txt` — these are temp-session files, not committed to the repo. This `DB_CONTEXT.md` + `DB_TABLES_SCHEMA.md` are the durable, committed summary.

---

## 11. Changes Log

Chronological record of DB/schema changes made after the original 2026-09-10 scan, so this file stays trustworthy without needing a full re-scan each time.

### 2026-09-10 — Item Master rename + Dropdown restructure + Purchaser backfill
- `pfms_item-master` → **`pfms_item_master`** (table rename)
- `pfms_item_master`: added **`purchaser`** column (text, nullable); backfilled 3,084/4,092 rows from the CSV (see §9)
- `pfms_dropdown`: fully restructured from the old sparse "one column per category" wide table to a normalized **`(id, category, value, createdAt)`** table with a `UNIQUE (category, value)` constraint. The old wide table was kept as a safety backup: **`pfms_dropdown_old_backup`** (not dropped, 29 rows, can be deleted once confident the migration is solid).
- New dropdown categories seeded: **Purchaser** (HARISH, AKASH), **Accounts** (8 names — T VISHAL PATNAIK, NANDINI NIRMALKAR, DIPIKA DEWANGAN, TARINI KUMBHAKAR, KIRAN YADAV, YUVRAJ NIRMALKAR, JYOTI GAYAKWAD, AKASH NANDI), **Engineers** (5 names — JYOTI GAYAKWAD, AJAY KATIYAR, SHAILESH MACHHIRKE, CHANDAN DAS, NANDINI NIRMALKAR). The old "Checked By" / "Tally Done By" / "Checkers (Verification)" categories were retired (not migrated into the new table) — replaced by Accounts/Engineers in the relevant forms (see §7 table).
- Migration script: [2026-09-10_item-master-rename_dropdown-restructure_purchaser-backfill.sql](./2026-09-10_item-master-rename_dropdown-restructure_purchaser-backfill.sql)

### 2026-09-10 — Indent Generation rename + purchaser propagation + per-user record access (in progress)
- `pfms_indent-generation` → **`pfms_indent_generation`** (table rename). All FK constraints (from `pfms_indent-approval`, `pfms_lift`, `pfms_negotiation`, `pfms_po-entry`, `pfms_update-3-vendors`, `pfms_for_ims`) and the `trigger_populate_pfms_for_ims` trigger followed automatically (Postgres tracks these by OID, not name) — confirmed via `\d "pfms_indent_generation"` showing all 6 "Referenced by" entries and the trigger intact post-rename.
- `pfms_indent_generation`: added **`purchaser`** column (text, nullable) — intended to be set per line-item at indent-creation time from the selected item's `pfms_item_master.purchaser` (implementation in progress as of this log entry).
- `pfms_User`: added **`records`** column (text, nullable, `DEFAULT 'ALL'`) — a single value (a Purchaser name, or `'ALL'`) controlling which purchaser's records a non-admin user can see across the app. Defaults to `'ALL'` so existing users aren't suddenly restricted. Admins always see everything regardless of this value. Enforcement is **client-side** (same pattern as the existing `pageAccess` field — see `lib/auth-context.tsx`, `components/sidebar.tsx`, `components/layout-wrapper.tsx`), not a server-side/query-level restriction.
- The backup/historical tables `pfms_backup_indent-approval`, `pfms_backup_indent-generation`, `pfms_indent-generation_backup` were **NOT** renamed or touched — they keep their original names.
- Note: `prisma/edit.sql` (a repeatable "add ON UPDATE/DELETE CASCADE to all FKs" script) and `sql-queries/pfms_sequencing.sql` (repeatable sequence-sync script) were also updated to reference `pfms_indent_generation` so they stay usable if re-run in the future.
