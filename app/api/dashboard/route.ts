import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    // 1. Fetch all indents with their full workflow stages and relations using pagination to surpass default 1000 row limit
    const indents: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data: pageIndents, error: indentError } = await supabase
        .from("pfms_indent-generation")
        .select(`
          *,
          approval:"pfms_indent-approval"(*),
          update3Vendors:"pfms_update-3-vendors"(*),
          negotiation:pfms_negotiation(*),
          poEntry:"pfms_po-entry"(*),
          lifts:pfms_lift(
            *,
            transporterFollowUp:"pfms_transporter-follow-up"(*),
            materialReceived:"pfms_material-received"(*),
            serials:"pfms_serial-number"(*),
            tallyEntry:"pfms_tally-entry"(*),
            submitInvoiceHO:"pfms_submit-invoice-ho"(*),
            submitInvoice:"pfms_submit-invoice"(*),
            accountsVerification:"pfms_accounts-verification"(*),
            materialTesting:"pfms_material-testing"(*),
            purchaseReturn:"pfms_purchase-return"(*),
            returnApproval:"pfms_return-approval"(*),
            vendorPaymentDetails:"pfms_vendor-payment-details"(*),
            freightPaymentDetails:"pfms_freight-payment-details"(*)
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

    // 2. Fetch list of cancelled indents
    const { data: cancelledList } = await supabase
      .from("pfms_order-cancellation")
      .select("indentNo");
    const cancelledNos = new Set((cancelledList || []).map((c: any) => c.indentNo));

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

      if (isCancelled) continue;

      // STAGE 2: Indent Approval
      if (!approval) {
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
        if (tfu && tfu.status === "received" && !mr) {
          stageCounts["Material Received"]++;
          if (isPast(lift.plannedMaterialRcd)) stageOverdueCounts["Material Received"]++;
        }

        // STAGE 9: Serial Generation
        if (mr && mr.qcRequired === "no" && serials.length === 0) {
          stageCounts["Serial Generation"]++;
          if (isPast(lift.plannedSerialGen)) stageOverdueCounts["Serial Generation"]++;
        }

        // STAGE 11: Receipt in Tally
        if (mr && !tally) {
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
        if (mr && mr.qcRequired === "yes" && (!qc || qc.qcDate === null)) {
          stageCounts["Material Testing"]++;
          if (isPast(mr.plannedMaterialTesting)) stageOverdueCounts["Material Testing"]++;
        }

        // STAGE 16: Purchase Return
        if (qc && qc.rejectedQty > 0 && !pr) {
          stageCounts["Purchase Return"]++;
          if (isPast(qc.plannedPurchaseReturns)) stageOverdueCounts["Purchase Return"]++;
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

    // 4. Fetch warranty claim counts
    let warrantyClaimCount = 0;
    try {
      const warrantySerials: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data: pageSerials, error: pageError } = await supabase
          .from("pfms_serial-number")
          .select(`
            id,
            plannedWarrantyClaim,
            warrantyClaim:"pfms_warranty-claim"(id)
          `)
          .not("plannedWarrantyClaim", "is", null)
          .range(page * pageSize, (page + 1) * pageSize - 1) as any;

        if (pageError) throw pageError;
        if (!pageSerials || pageSerials.length === 0) {
          hasMore = false;
        } else {
          warrantySerials.push(...pageSerials);
          if (pageSerials.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      const { data: activeClaims } = await supabase
        .from("pfms_warranty-claim")
        .select("id, status");

      for (const s of (warrantySerials || [])) {
        const hasClaim = Array.isArray(s.warrantyClaim) ? s.warrantyClaim.length > 0 : !!s.warrantyClaim;
        if (!hasClaim) {
          warrantyClaimCount++;
        }
      }
      for (const c of (activeClaims || [])) {
        if (c.status?.toLowerCase() === "pending") {
          warrantyClaimCount++;
        }
      }
    } catch (err) {
      console.error("Error calculating warranty claim count:", err);
    }
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

    return NextResponse.json({
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
    });
  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
