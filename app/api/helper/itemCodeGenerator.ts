import { ltoSupabase } from "@/utils/supabase/lto-server";

// Hardcoded category -> item-code prefix map. There's no deterministic formula behind these
// (confirmed by reverse-engineering pfms_item_master's existing ~5,000 codes — e.g.
// "BEDFI"->BDF and "CCDPL"->CDL pick different letter positions, "ABCFG"->AFG isn't a simple
// first-N-letters rule either) — this is a historical, human-assigned lookup, several
// categories sharing one prefix (e.g. AFG covers 3 categories, BTH covers 5). Kept as a plain
// hardcoded map per explicit decision (no pfms_item_code_prefix table) — update this object
// directly when a new category needs a specific (non-derived) prefix.
const CATEGORY_PREFIX_MAP: Record<string, string> = {
  "ANCHOR FASTENERS-ABCFG": "AFG",
  "FISCHER CHEMICAL-ABCFG": "AFG",
  "OTHERS-ABCFG": "AFG",
  "BOSCH PT-POWER TOOLS": "BPT",
  "BOSCH MT-POWER TOOLS": "BPT",
  "BOSCH-PT ACCESSORIES": "PTA",
  "POWER TOOL ACCESSORIES": "PTA",
  "LAB ITEM": "LAB",
  "SPARE-LAB": "LBS",
  "MINI CRANE-BCTCH": "BTH",
  "BAR BENDING MACHINE-BCTCH": "BTH",
  "BAR CUTTING MACHINE-BCTCH": "BTH",
  "TOWER HOIST-BCTCH": "BTH",
  "SUSPENDED PLATFORM-BCTCH": "BTH",
  "MIXER MACHINE-BCTCH": "BTH",
  "SPARE-BCTCH": "BTS",
  "EXPANSION JOINT SHEET-BEDFI": "BDF",
  "BACK UP ROD-BEDFI": "BDF",
  "DURA DEBOUNDING STRIP-BEDFI": "BDF",
  "TILE PROTECTOR SHEET-BEDFI": "BDF",
  "OTHERS-BEDFI": "BDF",
  "GREAVES CUTTER-CCDPL": "CDL",
  "PLATE COMPACTOR-CCDPL": "CDL",
  "ROLLER-CCDPL": "CDL",
  "NIDDLE VIBRATOR-CCDPL": "CDL",
  "OTHER-CCDPL": "CDL",
  "POWER TROWEL-CCDPL": "CDL",
  "SPARE-CCDPL": "CDS",
  "LAB ACCESSORIES": "LBA",
  "CAC-CURING COMPOUND-CHEMICAL": "CHM",
  "CAC-SEALENT-CHEMICAL": "CHM",
  "OTHERS-CHEMICAL": "CHM",
  "MOLECULE-CHEMICAL": "CHM",
  "BULWARK-CHEMICAL": "CHM",
  "ASIAN PAINTS": "ASN",
  "MISCELLANEOUS": "MIS",
  "ROAD FURNITURE": "RFT",
  "SAFETY ITEM": "SFY",
  "SOKKIA TOTAL STATION-SURVEY INSTRUMENTS": "SRI",
  "SURVEY INSTRUMENTS": "SRI",
  "SOKKIA AUTO LEVEL-SURVEY INSTRUMENTS": "SRI",
  "LEICA TOTAL STATION-SURVEY INSTRUMENTS": "SRI",
  "SURVEY ACCESSORIES": "SRA",
  "OTHER SURVEY SPARE": "SRA",
  "SERVICE": "SRV",
  "JOB WORKS ITEMS": "JWI",
  "NABL ASSETS": "NBL",
  "SPARE-BOSCH": "BOS",
  "SPARE-SOKKIA": "SKS",
  "DIVINE RENT EQUIP": "DRE",
  "DIVINE RENT QUIP SPARE": "DRS",
  "GEO SYNTHETIC": "GES",
  "OTHER BCTCH": "OBT",
  "PROMOTIONAL ITEM": "PMI",
  "FRIEGHT": "FRT",
};

function normalizeCategory(category: string): string {
  return category.trim().toUpperCase();
}

/**
 * Fallback prefix derivation for a category that isn't in CATEGORY_PREFIX_MAP (e.g. a
 * brand-new category introduced from LTO/OTP/Service). Deterministic, no DB/state needed:
 * - 3+ words -> first letter of the first three words.
 * - 1-2 words -> first three letters of the words run together (padded with "X" if the
 *   category is shorter than 3 letters total, e.g. a single 1-2 letter word).
 */
export function deriveFallbackPrefix(category: string): string {
  const clean = normalizeCategory(category).replace(/[^A-Z\s-]/g, "");
  const words = clean.split(/[\s-]+/).filter(Boolean);

  let prefix: string;
  if (words.length >= 3) {
    prefix = words[0][0] + words[1][0] + words[2][0];
  } else {
    prefix = words.join("");
  }

  prefix = (prefix + "XXX").slice(0, 3);
  return prefix;
}

export function getPrefixForCategory(category: string): string {
  const normalized = normalizeCategory(category);
  if (CATEGORY_PREFIX_MAP[normalized]) return CATEGORY_PREFIX_MAP[normalized];
  return deriveFallbackPrefix(category);
}

// Numbers above this are treated as data anomalies (e.g. a manufacturer part number that
// happens to look like <letters><digits>, such as the legacy "SKS901590" row) and excluded
// from the max lookup — every genuine code issued so far is a 5-digit number, topping out
// around 14,400. Raise this only if the numbering genuinely grows past 99999 one day.
const MAX_SANE_SEQUENCE_NUMBER = 99999;

// One-time floor so the global sequence resumes from 14441 instead of the live DB max
// (14428 as of 2026-11-13) — set per explicit decision, not derived. Has no effect once the
// live DB max grows past this value on its own.
const SEQUENCE_FLOOR = 14440;

const PAGE_SIZE = 1000;

/**
 * Fetches every item_code in lto_items (paginated — the table has 4,900+ rows and Supabase
 * caps a single select at 1000).
 */
async function fetchAllItemCodes(): Promise<string[]> {
  const codes: string[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await ltoSupabase
      .from("lto_items")
      .select("item_code")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data || []) {
      if (row.item_code) codes.push(row.item_code);
    }
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return codes;
}

/**
 * Generates the next item code for a category: <prefix><number>. The numeric part is a
 * single global sequence shared across every prefix — it always continues from the highest
 * numeric suffix found anywhere in lto_items, never from that prefix's own max. This is
 * deliberate: prefixes are just a display label, so two different prefixes landing on the
 * same number (e.g. BPT10554 and PTA10554, which happened under the old per-prefix scheme)
 * can never happen, even if a prefix is later changed/removed. No separate sequence table —
 * "current max sirf DB me hi updated rahega" per explicit decision.
 * First-ever code (empty catalog) starts at <prefix>10001, matching the existing catalog's
 * starting range.
 */
export async function generateItemCode(category: string): Promise<string> {
  const prefix = getPrefixForCategory(category);

  const codes = await fetchAllItemCodes();

  let maxNumber = 0;
  const pattern = /^[A-Za-z]{2,5}0*([0-9]+)$/;
  for (const code of codes) {
    const trimmed = code.trim();
    const m = trimmed.match(pattern);
    if (!m) continue; // skip malformed/manufacturer/legacy codes (no clean letters+digits shape)
    const num = parseInt(m[1], 10);
    if (num > MAX_SANE_SEQUENCE_NUMBER) continue; // skip data anomalies, e.g. legacy SKS901590
    if (num > maxNumber) maxNumber = num;
  }

  const effectiveMax = Math.max(maxNumber, SEQUENCE_FLOOR);
  const nextNumber = effectiveMax > 0 ? effectiveMax + 1 : 10001;
  return `${prefix}${String(nextNumber).padStart(5, "0")}`;
}
