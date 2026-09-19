import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";
import { canViewPurchaserRecord } from "@/lib/utils";

// Short-lived in-memory cache for this heavy endpoint. /api/dashboard fans
// out into 6-10+ Supabase calls, and is hit repeatedly (dashboard page load,
// sidebar poll, multiple concurrent users). A 45s TTL means bursts of
// requests within that window reuse the same fetched data instead of each
// re-running the full set of Supabase queries. Cache lives per warm
// serverless instance (best-effort, not perfectly consistent across
// instances/cold starts), and dashboard data may lag by up to ~45s as a
// result.
//
// Only the raw fetched rows are cached here, not the final aggregated
// response: the aggregation (the for-loop below) also applies the
// requesting user's purchaser-based visibility filter (?role=&records=,
// mirroring lib/utils.ts#canViewPurchaserRecord), which differs per user.
// Re-running that in-memory loop per request is cheap (a single pass over
// already-fetched arrays); it's the Supabase round-trips that are worth
// sharing across requests.
const DASHBOARD_CACHE_TTL_MS = 45_000;
let dashboardRawCache: { data: RawDashboardData; expiresAt: number } | null = null;

interface RawDashboardData {
  indents: any[];
  cancelledNos: Set<string>;
  cancelledLiftNos: Set<string>;
  cancelledIndentNos: Set<string>;
  ledgerMap: Map<string, any>;
  warrantyClaimCount: number;
}

async function fetchRawDashboardData(): Promise<RawDashboardData> {
    // 1. Fetch all indents with their full workflow stages and relations using pagination to surpass default 1000 row limit
    const indents: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data: pageIndents, error: indentError } = await supabase
        .from("pfms_indent_generation")
        .select(`
          indentNo,
          createdBy,
          category,
          itemName,
          quantity,
          warehouseLocation,
          plannedIndentApproval,
          leadTime,
          timestamp,
          purchaser,
          approval:"pfms_indent-approval"(status, plannedUpdateVendors, approvedQty),
          update3Vendors:"pfms_update-3-vendors"(plannedNegotiation),
          negotiation:pfms_negotiation(selectedVendorName, plannedPOEntry),
          poEntry:"pfms_po-entry"(poNumber, poCopy, plannedFollowUpVendor, estimatedFollowUpVendor),
          lifts:pfms_lift(
            liftNo,
            liftingQty,
            vehicleNo,
            dispatchDate,
            freightAmount,
            plannedTransporterFlwUp,
            plannedMaterialRcd,
            plannedSerialGen,
            transporterFollowUp:"pfms_transporter-follow-up"(status),
            materialReceived:"pfms_material-received"(invoiceNumber, invoiceDate, receivedQty, receivedItemImage, billAttachment, qcRequired, timestamp, plannedMaterialTesting, plannedTallyEntry),
            serials:"pfms_serial-number"(id, serialNo, warrantyExpiry),
            tallyEntry:"pfms_tally-entry"(plannedInvoiceHO),
            submitInvoiceHO:"pfms_submit-invoice-ho"(plannedInvoice),
            submitInvoice:"pfms_submit-invoice"(plannedVerification),
            accountsVerification:"pfms_accounts-verification"(id),
            materialTesting:"pfms_material-testing"(id, qcDate, pendingQty, rejectedReturnQty, plannedPurchaseReturns),
            repairProcess:pfms_repair_process(id, failedQty, plannedPurchaseReturns),
            purchaseReturn:"pfms_purchase-return"(sourceId, plannedReturnApproval),
            returnApproval:"pfms_return-approval"(id),
            vendorPaymentDetails:"pfms_vendor-payment-details"(totalAmount, paidAmount, plannedDate),
            freightPaymentDetails:"pfms_freight-payment-details"(totalAmount, paidAmount, plannedDate)
          )
        `)
        .order("timestamp", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (indentError) throw indentError;

      if (!pageIndents || pageIndents.length === 0) {
        hasMore = false;
      } else {
        indents.push(...pageIndents);
        if (pageIndents.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    // 2. Fetch list of cancelled indents. `cancelledNos` (any cancellation row,
    // lift-specific or indent-wide) is what most stage routes exclude by. Follow-Up
    // Vendor and Transporter Follow-Up routes are more precise — a lift-specific
    // cancellation only hides that one lift, not the whole indent — so those two also
    // get the narrower `cancelledIndentNos` (indent-wide only) and `cancelledLiftNos`.
    const { data: cancelledList } = await supabase
      .from("pfms_order-cancellation")
      .select("indentNo, liftNo");
    const cancelledNos = new Set((cancelledList || []).map((c: any) => c.indentNo));
    const cancelledLiftNos = new Set((cancelledList || []).map((c: any) => c.liftNo).filter(Boolean));
    const cancelledIndentNos = new Set((cancelledList || []).filter((c: any) => !c.liftNo).map((c: any) => c.indentNo));

    // 3. Qty-resolution ledger, only relevant for lifts where QC was required. A QC=Yes
    // lift stays locked out of Receipt in Tally until Material Testing (and Repair
    // Process, if any qty was routed there) fully resolve it — mirrors the gating in
    // app/api/tally-entry/route.ts so this stage's count matches that page's pending list.
    const { data: ledgerRows, error: ledgerError } = await supabase
      .from("pfms_lift_qc_resolution")
      .select("liftNo, passedQty, repairedQty, isFullyResolved, releasedAt");
    if (ledgerError) throw ledgerError;
    const ledgerMap = new Map((ledgerRows || []).map((l: any) => [l.liftNo, l]));

    // 4. Fetch warranty claim counts
    let warrantyClaimCount = 0;
    try {
      const warrantySerials: any[] = [];
      let wPage = 0;
      const wPageSize = 1000;
      let wHasMore = true;
      while (wHasMore) {
        const { data: pageSerials, error: pageError } = await supabase
          .from("pfms_serial-number")
          .select(`
            id,
            plannedWarrantyClaim,
            warrantyClaim:"pfms_warranty-claim"(id),
            lift:pfms_lift!inner(indent:pfms_indent_generation!inner(indentNo))
          `)
          .not("plannedWarrantyClaim", "is", null)
          .range(wPage * wPageSize, (wPage + 1) * wPageSize - 1) as any;

        if (pageError) throw pageError;
        if (!pageSerials || pageSerials.length === 0) {
          wHasMore = false;
        } else {
          warrantySerials.push(...pageSerials);
          if (pageSerials.length < wPageSize) {
            wHasMore = false;
          } else {
            wPage++;
          }
        }
      }

      const { data: activeClaims } = await supabase
        .from("pfms_warranty-claim")
        .select(`
          id,
          status,
          serialNumber:"pfms_serial-number"!inner(lift:pfms_lift!inner(indent:pfms_indent_generation!inner(indentNo)))
        `) as any;

      // app/api/warranty-claim/route.ts excludes cancelled indents from both its
      // pending list and its closure-pending (status=pending claims) list.
      for (const s of (warrantySerials || [])) {
        const hasClaim = Array.isArray(s.warrantyClaim) ? s.warrantyClaim.length > 0 : !!s.warrantyClaim;
        const lift = Array.isArray(s.lift) ? s.lift[0] : s.lift;
        const indentNo = lift?.indent?.indentNo;
        if (!hasClaim && !cancelledNos.has(indentNo)) {
          warrantyClaimCount++;
        }
      }
      for (const c of (activeClaims || [])) {
        const serial = Array.isArray(c.serialNumber) ? c.serialNumber[0] : c.serialNumber;
        const lift = Array.isArray(serial?.lift) ? serial.lift[0] : serial?.lift;
        const indentNo = lift?.indent?.indentNo;
        if (c.status?.toLowerCase() === "pending" && !cancelledNos.has(indentNo)) {
          warrantyClaimCount++;
        }
      }
    } catch (err) {
      console.error("Error calculating warranty claim count:", err);
    }

    return { indents, cancelledNos, cancelledLiftNos, cancelledIndentNos, ledgerMap, warrantyClaimCount };
}

function computeDashboardData(
  raw: RawDashboardData,
  visibility: { role: string | null; records: string | null }
) {
    const { indents, cancelledNos, cancelledLiftNos, cancelledIndentNos, ledgerMap, warrantyClaimCount } = raw;

    // 3. Initialize metrics and counts
    let totalPurchaseOrders = (indents || []).length;
    let completedPOs = 0;
    let pendingPOs = 0;

    const stageCounts: Record<string, number> = {
      "Indent Approval": 0,
      "Update 3 Vendors": 0,
      "Negotiation": 0,
      "PO Entry": 0,
      "Follow-Up Vendor": 0,
      "Transporter Follow-Up": 0,
      "Material Received": 0,
      "Serial Generation": 0,
      "Receipt in Tally": 0,
      "Submit Invoice (HO)": 0,
      "Submit Invoice": 0,
      "Verification by Accounts": 0,
      "Material Testing": 0,
      "Purchase Return": 0,
      "Return Approval": 0,
      "Vendor Payment": 0,
      "Freight Payments": 0,
      "Warranty Claim": 0,
    };

    const stageOverdueCounts: Record<string, number> = { ...stageCounts };

    const overviewItems: any[] = [];
    const purchaseItems: any[] = [];
    const inTransitItems: any[] = [];
    const receivedItems: any[] = [];
    const warrantyItems: any[] = [];
    const vendorStats: Record<string, { totalCount: number; totalValue: number; products: Record<string, number> }> = {};

    const now = new Date();

    const isPast = (dateStr: any) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && d < now;
    };

    for (const row of (indents || [])) {
      const indentNo = row.indentNo;
      const isCancelled = cancelledNos.has(indentNo);

      const approval = Array.isArray(row.approval) ? row.approval[0] : row.approval;
      const update3Vendors = Array.isArray(row.update3Vendors) ? row.update3Vendors[0] : row.update3Vendors;
      const negotiation = Array.isArray(row.negotiation) ? row.negotiation[0] : row.negotiation;
      const poEntry = Array.isArray(row.poEntry) ? row.poEntry[0] : row.poEntry;
      const lifts = row.lifts || [];
      const canSeeRow = canViewPurchaserRecord(row.purchaser, visibility.records, visibility.role);

      // Determine Overview Status
      const isApproved = approval && approval.status?.toLowerCase() === "approved";
      let computedStatus = "Pending";
      if (isCancelled) {
        computedStatus = "Cancelled";
      } else if (!approval) {
        computedStatus = "Pending Indent";
      } else if (approval.status?.toLowerCase() === "rejected") {
        computedStatus = "Rejected Indent";
      } else {
        computedStatus = "Approved Indent";
      }

      overviewItems.push({
        indent: indentNo,
        createdBy: row.createdBy || "-",
        category: row.category || "-",
        item: row.itemName || "-",
        qty: row.quantity || 0,
        warehouse: row.warehouseLocation || "-",
        expDelivery: row.plannedIndentApproval || null,
        leadTime: row.leadTime || null,
        status: computedStatus,
      });

      // Purchaser-restricted users don't get this indent's lifts counted into their
      // stage badges (mirrors canViewPurchaserRecord filtering already applied
      // client-side on individual stage pages, e.g. stage-pages/tally-entry).
      // No-op (canSeeRow is always true) when the caller passes no role/records,
      // e.g. the main Dashboard page, which stays unfiltered as before.
      if (isCancelled || !canSeeRow) continue;

      // STAGE 2: Indent Approval
      // app/api/indent-approval/route.ts permanently excludes Direct-purchase indents
      // (IN-DIR- prefix / category "Direct") — they never get an approval row, so
      // without this check they'd inflate this count forever.
      const isDirectIndent = indentNo?.startsWith("IN-DIR-") || row.category === "Direct";
      if (!approval && !isDirectIndent) {
        stageCounts["Indent Approval"]++;
        if (isPast(row.plannedIndentApproval)) stageOverdueCounts["Indent Approval"]++;
      }

      // STAGE 3: Update 3 Vendors
      if (isApproved && !update3Vendors) {
        stageCounts["Update 3 Vendors"]++;
        if (isPast(approval.plannedUpdateVendors)) stageOverdueCounts["Update 3 Vendors"]++;
      }

      // STAGE 4: Negotiation
      if (update3Vendors && !negotiation) {
        stageCounts["Negotiation"]++;
        if (isPast(update3Vendors.plannedNegotiation)) stageOverdueCounts["Negotiation"]++;
      }

      // STAGE 5: PO Entry
      if (negotiation && !poEntry) {
        stageCounts["PO Entry"]++;
        if (isPast(negotiation.plannedPOEntry)) stageOverdueCounts["PO Entry"]++;
      }

      // STAGE 6: Follow-Up Vendor
      if (poEntry) {
        const approvedQty = approval?.approvedQty !== null && approval?.approvedQty !== undefined ? approval.approvedQty : row.quantity;
        const totalLifted = lifts.reduce((sum: number, l: any) => sum + (parseFloat(l.liftingQty) || 0), 0);
        
        if (totalLifted < approvedQty) {
          stageCounts["Follow-Up Vendor"]++;
          if (isPast(poEntry.plannedFollowUpVendor)) stageOverdueCounts["Follow-Up Vendor"]++;

          // This indent is also pending for lifting (Purchase Data tab)
          purchaseItems.push({
            erp: poEntry.poNumber || "-",
            indentNo: indentNo,
            material: row.itemName || "-",
            party: negotiation?.selectedVendorName || "-",
            qty: approvedQty - totalLifted,
            warehouse: row.warehouseLocation || "-",
            leadTime: row.leadTime || null,
            expDelivery: poEntry.estimatedFollowUpVendor || poEntry.plannedFollowUpVendor || null,
            poCopy: poEntry.poCopy || "",
          });
        }
      }

      // Track lift-level stages
      let allLiftsReceived = lifts.length > 0;
      for (const lift of lifts) {
        const tfuArray = lift.transporterFollowUp;
        const tfu = Array.isArray(tfuArray) ? tfuArray[0] : tfuArray;
        const mrArray = lift.materialReceived;
        const mr = Array.isArray(mrArray) ? mrArray[0] : mrArray;
        const serials = lift.serials || [];
        const tally = Array.isArray(lift.tallyEntry) ? lift.tallyEntry[0] : lift.tallyEntry;
        const invoiceHO = Array.isArray(lift.submitInvoiceHO) ? lift.submitInvoiceHO[0] : lift.submitInvoiceHO;
        const invoice = Array.isArray(lift.submitInvoice) ? lift.submitInvoice[0] : lift.submitInvoice;
        const accounts = Array.isArray(lift.accountsVerification) ? lift.accountsVerification[0] : lift.accountsVerification;
        const qc = Array.isArray(lift.materialTesting) ? lift.materialTesting[0] : lift.materialTesting;
        const pr = Array.isArray(lift.purchaseReturn) ? lift.purchaseReturn[0] : lift.purchaseReturn;
        const ra = Array.isArray(lift.returnApproval) ? lift.returnApproval[0] : lift.returnApproval;
        const vp = Array.isArray(lift.vendorPaymentDetails) ? lift.vendorPaymentDetails[0] : lift.vendorPaymentDetails;
        const fp = Array.isArray(lift.freightPaymentDetails) ? lift.freightPaymentDetails[0] : lift.freightPaymentDetails;

        if (!mr) allLiftsReceived = false;

        // STAGE 7: Transporter Follow-Up
        if (tfu && tfu.status === "intransit") {
          stageCounts["Transporter Follow-Up"]++;
          if (isPast(lift.plannedTransporterFlwUp)) stageOverdueCounts["Transporter Follow-Up"]++;

          inTransitItems.push({
            erp: indentNo,
            material: row.itemName || "-",
            party: negotiation?.selectedVendorName || "-",
            truck: lift.vehicleNo || "-",
            date: lift.dispatchDate || null,
            qty: lift.liftingQty || 0,
          });
        }

        // STAGE 8: Material Received
        // app/api/material-received/route.ts only queues a lift once plannedMaterialRcd
        // is set — one not yet assigned a planned date hasn't entered the queue.
        if (tfu && tfu.status === "received" && !mr && lift.plannedMaterialRcd != null) {
          stageCounts["Material Received"]++;
          if (isPast(lift.plannedMaterialRcd)) stageOverdueCounts["Material Received"]++;
        }

        // STAGE 9: Serial Generation — no longer gated on qcRequired/QC resolution, matching
        // the /api/serial-generation pending list (a lift is countable as soon as Material
        // Received exists and it has no serials yet).
        if (mr && serials.length === 0) {
          stageCounts["Serial Generation"]++;
          if (isPast(lift.plannedSerialGen)) stageOverdueCounts["Serial Generation"]++;
        }

        // STAGE 11: Receipt in Tally
        // app/api/tally-entry/route.ts only pulls materials where plannedTallyEntry has
        // been set (`.not("plannedTallyEntry", "is", null)`) — a received lift with no
        // plannedTallyEntry yet hasn't reached this stage's queue at all. It also skips
        // any QC-required lift until Material Testing/Repair Process fully resolve it
        // (ledger released). Both conditions must hold here too, or this count includes
        // lifts that page's pending list doesn't.
        const hasPlannedTally = mr?.plannedTallyEntry != null && mr.plannedTallyEntry !== "";
        const isReadyForTally =
          !hasPlannedTally
            ? false
            : !mr?.qcRequired || mr.qcRequired !== "yes"
            ? true
            : (() => {
                const ledger = ledgerMap.get(lift.liftNo);
                return !!ledger && ledger.isFullyResolved && !!ledger.releasedAt;
              })();
        if (mr && !tally && isReadyForTally) {
          stageCounts["Receipt in Tally"]++;
          if (isPast(mr.plannedTallyEntry)) stageOverdueCounts["Receipt in Tally"]++;
        }

        // STAGE 12: Submit Invoice (HO)
        if (tally && !invoiceHO) {
          stageCounts["Submit Invoice (HO)"]++;
          if (isPast(tally.plannedInvoiceHO)) stageOverdueCounts["Submit Invoice (HO)"]++;
        }

        // STAGE 13: Submit Invoice
        if (invoiceHO && !invoice) {
          stageCounts["Submit Invoice"]++;
          if (isPast(invoiceHO.plannedInvoice)) stageOverdueCounts["Submit Invoice"]++;
        }

        // STAGE 14: Verification by Accounts
        if (invoice && !accounts) {
          stageCounts["Verification by Accounts"]++;
          if (isPast(invoice.plannedVerification)) stageOverdueCounts["Verification by Accounts"]++;
        }

        // STAGE 15: QC Requirement (Material Testing)
        // app/api/material-testing/route.ts tracks pendingQty (persisted on the QC row,
        // decremented as Repair Process/Return resolve it), not just "has a first QC
        // round happened" — a lift can still have qty pending after qcDate is first set
        // (partial approve/reject rounds), and dashboard was undercounting those.
        if (mr && mr.qcRequired === "yes" && qc) {
          const testingPendingQty = qc.pendingQty !== null && qc.pendingQty !== undefined
            ? qc.pendingQty
            : (parseFloat(mr.receivedQty) || 0);
          if (testingPendingQty > 0) {
            stageCounts["Material Testing"]++;
            if (isPast(mr.plannedMaterialTesting)) stageOverdueCounts["Material Testing"]++;
          }
        }

        // STAGE 16: Purchase Return
        // app/api/purchase-return/route.ts tracks two independent pending sources per
        // lift, each keyed by its own sourceId (not just "this lift has no return yet"):
        // (a) Material Testing's rejectedReturnQty (Direct QC Reject), and (b) Repair
        // Process's failedQty (Repair Failed, from pfms_repair_process — a table the old
        // dashboard logic never looked at). A return row is matched to its source via
        // purchaseReturn.sourceId, not just "this lift has some return record".
        {
          const returnRowsArr = lift.purchaseReturn;
          const returnRows: any[] = Array.isArray(returnRowsArr) ? returnRowsArr : (returnRowsArr ? [returnRowsArr] : []);
          const processedSourceIds = new Set(returnRows.map((r: any) => r.sourceId).filter(Boolean));
          const testingRow = qc; // lift.materialTesting[0], same row used for STAGE 15
          const repairRowsArr = lift.repairProcess;
          const repairRows: any[] = Array.isArray(repairRowsArr) ? repairRowsArr : (repairRowsArr ? [repairRowsArr] : []);

          const hasPendingDirectReject = !!testingRow
            && (testingRow.rejectedReturnQty || 0) > 0
            && !processedSourceIds.has(testingRow.id);
          const pendingRepairFailure = repairRows.find(
            (r: any) => (r.failedQty || 0) > 0 && !processedSourceIds.has(r.id)
          );

          if (hasPendingDirectReject || pendingRepairFailure) {
            stageCounts["Purchase Return"]++;
            const plannedDate = hasPendingDirectReject
              ? testingRow.plannedPurchaseReturns
              : pendingRepairFailure?.plannedPurchaseReturns;
            if (isPast(plannedDate)) stageOverdueCounts["Purchase Return"]++;
          }
        }

        // STAGE 17: Return Approval
        if (pr && !ra) {
          stageCounts["Return Approval"]++;
          if (isPast(pr.plannedReturnApproval)) stageOverdueCounts["Return Approval"]++;
        }

        // STAGE 18: Vendor Payment
        if (vp && (vp.totalAmount - vp.paidAmount) > 0) {
          stageCounts["Vendor Payment"]++;
          if (isPast(vp.plannedDate)) stageOverdueCounts["Vendor Payment"]++;
        }

        // STAGE 19: Freight Payments
        if (fp && (fp.totalAmount - fp.paidAmount) > 0) {
          stageCounts["Freight Payments"]++;
          if (isPast(fp.plannedDate)) stageOverdueCounts["Freight Payments"]++;
        }

        // Received lift details list
        if (mr) {
          receivedItems.push({
            erp: indentNo,
            invoiceNumber: mr.invoiceNumber || "-",
            material: row.itemName || "-",
            party: negotiation?.selectedVendorName || "-",
            billImage: mr.billAttachment || mr.receivedItemImage || "",
            truck: lift.vehicleNo || "-",
            date: mr.timestamp || null,
            qty: mr.receivedQty || 0,
          });

          // Top Received Orders Aggregation
          const vendorName = negotiation?.selectedVendorName;
          const productName = row.itemName;
          const freightAmount = lift.freightAmount || 0;

          if (vendorName && productName) {
            if (!vendorStats[vendorName]) {
              vendorStats[vendorName] = { totalCount: 0, totalValue: 0, products: {} };
            }
            vendorStats[vendorName].totalCount++;
            vendorStats[vendorName].totalValue += freightAmount;

            if (!vendorStats[vendorName].products[productName]) {
              vendorStats[vendorName].products[productName] = 0;
            }
            vendorStats[vendorName].products[productName]++;
          }
        }

        // Serials warranty tracking list
        for (const s of serials) {
          warrantyItems.push({
            indentNo: indentNo,
            liftNo: lift.liftNo,
            serialCode: s.id,
            serialNo: s.serialNo,
            vendorName: negotiation?.selectedVendorName || "-",
            itemName: row.itemName || "-",
            invoiceDate: mr?.invoiceDate || null,
            warrantyEnd: s.warrantyExpiry || null,
            party: negotiation?.selectedVendorName || "-",
            material: row.itemName || "-",
            date: mr?.invoiceDate || null,
            erp: indentNo,
          });
        }
      }

      // Calculate completed vs pending PO totals
      if (poEntry) {
        if (lifts.length > 0 && allLiftsReceived) {
          completedPOs++;
        } else {
          pendingPOs++;
        }
      }
    }

    // Follow-Up Vendor / Transporter Follow-Up recovery pass.
    // app/api/follow-up-vendor & transporter-follow-up route.ts don't tie a
    // lift-specific cancellation to the whole indent — only an indent-wide
    // cancellation (no liftNo on the pfms_order-cancellation row) hides them there.
    // The blanket `isCancelled` skip in the main loop above (any cancellation row,
    // lift-specific or not) is correct for every other stage but wrongly drops these
    // two for an indent where just one of several lifts was cancelled. Recover those
    // here — this only does real work for the rare indents that hit that edge case,
    // everything else exits on the first check.
    for (const row of (indents || [])) {
      const indentNo = row.indentNo;
      if (cancelledIndentNos.has(indentNo)) continue; // truly indent-cancelled, correctly excluded above
      if (!cancelledNos.has(indentNo)) continue; // wasn't skipped above at all, already counted
      if (!canViewPurchaserRecord(row.purchaser, visibility.records, visibility.role)) continue;

      const approval = Array.isArray(row.approval) ? row.approval[0] : row.approval;
      const negotiation = Array.isArray(row.negotiation) ? row.negotiation[0] : row.negotiation;
      const poEntry = Array.isArray(row.poEntry) ? row.poEntry[0] : row.poEntry;
      const lifts = row.lifts || [];

      // STAGE 6: Follow-Up Vendor (mirrors follow-up-vendor/route.ts, which ignores
      // lift-level cancellation entirely for this computation)
      if (poEntry) {
        const approvedQty = approval?.approvedQty !== null && approval?.approvedQty !== undefined ? approval.approvedQty : row.quantity;
        const totalLifted = lifts.reduce((sum: number, l: any) => sum + (parseFloat(l.liftingQty) || 0), 0);

        if (totalLifted < approvedQty) {
          stageCounts["Follow-Up Vendor"]++;
          if (isPast(poEntry.plannedFollowUpVendor)) stageOverdueCounts["Follow-Up Vendor"]++;

          purchaseItems.push({
            erp: poEntry.poNumber || "-",
            indentNo: indentNo,
            material: row.itemName || "-",
            party: negotiation?.selectedVendorName || "-",
            qty: approvedQty - totalLifted,
            warehouse: row.warehouseLocation || "-",
            leadTime: row.leadTime || null,
            expDelivery: poEntry.estimatedFollowUpVendor || poEntry.plannedFollowUpVendor || null,
            poCopy: poEntry.poCopy || "",
          });
        }
      }

      // STAGE 7: Transporter Follow-Up (per-lift, still respects cancelledLiftNos)
      for (const lift of lifts) {
        if (cancelledLiftNos.has(lift.liftNo)) continue;
        const tfuArray = lift.transporterFollowUp;
        const tfu = Array.isArray(tfuArray) ? tfuArray[0] : tfuArray;
        if (tfu && tfu.status === "intransit") {
          stageCounts["Transporter Follow-Up"]++;
          if (isPast(lift.plannedTransporterFlwUp)) stageOverdueCounts["Transporter Follow-Up"]++;

          inTransitItems.push({
            erp: indentNo,
            material: row.itemName || "-",
            party: negotiation?.selectedVendorName || "-",
            truck: lift.vehicleNo || "-",
            date: lift.dispatchDate || null,
            qty: lift.liftingQty || 0,
          });
        }
      }
    }

    // Warranty claim count is global (not purchaser- or lift-scoped in the source
    // data), fetched once in fetchRawDashboardData and reused here as-is.
    stageCounts["Warranty Claim"] = warrantyClaimCount;

    // Process Top Orders
    const processedOrders = Object.entries(vendorStats).map(([vendor, stats]) => {
      let topProduct = "";
      let maxProdCount = 0;

      Object.entries(stats.products).forEach(([prod, count]) => {
        if (count > maxProdCount) {
          maxProdCount = count;
          topProduct = prod;
        }
      });

      return {
        vendor,
        product: topProduct,
        count: stats.products[topProduct] || 0,
        vendorTotalCount: stats.totalCount,
        value: stats.totalValue,
      };
    });

    processedOrders.sort((a, b) => b.vendorTotalCount - a.vendorTotalCount);
    const topReceivedOrders = processedOrders.slice(0, 10);

    const completionRate = totalPurchaseOrders > 0 ? Math.round((completedPOs / totalPurchaseOrders) * 100) : 0;

    return {
      success: true,
      data: {
        totalPurchaseOrders,
        pendingPOs,
        completedPOs,
        completionRate,
        overviewItems,
        purchaseItems,
        inTransitItems,
        receivedItems,
        warrantyItems,
        stageCounts,
        stageOverdueCounts,
        topReceivedOrders,
      },
    };
}

export async function GET(request: NextRequest) {
  try {
    let raw: RawDashboardData;
    if (dashboardRawCache && dashboardRawCache.expiresAt > Date.now()) {
      raw = dashboardRawCache.data;
    } else {
      raw = await fetchRawDashboardData();
      dashboardRawCache = { data: raw, expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS };
    }

    // ?role=&records= mirror the logged-in user's purchaser-based visibility
    // (lib/auth-context.tsx / lib/utils.ts#canViewPurchaserRecord), same
    // client-side-enforced trust model already used elsewhere in this app.
    // Callers that omit them (e.g. the main Dashboard page) get the
    // unfiltered, all-purchasers view exactly as before.
    const role = request.nextUrl.searchParams.get("role");
    const records = request.nextUrl.searchParams.get("records");

    const responseBody = computeDashboardData(raw, { role, records });
    return NextResponse.json(responseBody);
  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
