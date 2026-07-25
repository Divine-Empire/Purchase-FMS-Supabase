import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ReportDocument } from "@/components/report-pdf";
import { supabase } from "@/utils/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
    // 1. Basic security check (Optional but recommended)
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        // Retrieve Apps Script URL from environment for PDF upload (optional)
        const API_URI = process.env.NEXT_PUBLIC_IMS_API_URI;

        // 2. Fetch all required tables from Supabase in parallel
        const [
            indentRes,
            approvalRes,
            negoRes,
            poRes,
            liftRes,
            transporterRes,
            cancelRes,
            respRes
        ] = await Promise.all([
            supabase.from("pfms_indent-generation").select("*"),
            supabase.from("pfms_indent-approval").select("*"),
            supabase.from("pfms_negotiation").select("*"),
            supabase.from("pfms_po-entry").select("*"),
            supabase.from("pfms_lift").select("*"),
            supabase.from("pfms_transporter-follow-up").select(`
                id,
                liftNo,
                status,
                expectedDeliveryDate,
                nextFollowUpDate,
                remarks,
                lastFollowUpDate,
                totalFollowUps,
                lift:pfms_lift!inner (
                  plannedTransporterFlwUp,
                  liftingQty,
                  transporterName,
                  vehicleNo,
                  contactNo,
                  lrNo,
                  biltyCopy,
                  freightAmount,
                  indent:pfms_indent-generation!inner (
                    indentNo,
                    itemName,
                    negotiation:pfms_negotiation (
                      selectedVendorName
                    ),
                    poEntry:pfms_po-entry (
                      poNumber
                    )
                  )
                )
            `),
            supabase.from("pfms_order-cancellation").select("indentNo"),
            supabase.from("pfms_tat").select("stageName, responsibleNames")
        ]);

        // Error validation
        if (indentRes.error) throw indentRes.error;
        if (approvalRes.error) throw approvalRes.error;
        if (negoRes.error) throw negoRes.error;
        if (poRes.error) throw poRes.error;
        if (liftRes.error) throw liftRes.error;
        if (transporterRes.error) throw transporterRes.error;
        if (cancelRes.error) throw cancelRes.error;
        if (respRes.error) throw respRes.error;

        const indents = indentRes.data || [];
        const approvals = approvalRes.data || [];
        const negotiations = negoRes.data || [];
        const poEntries = poRes.data || [];
        const lifts = liftRes.data || [];
        const transporterFollowups = transporterRes.data || [];
        const cancellations = cancelRes.data || [];
        const responsibles = respRes.data || [];

        // 3. Prepare lookups
        const cancelledNos = new Set(cancellations.map((c: any) => c.indentNo));
        const approvalMap = new Map(approvals.map((a: any) => [a.indentNo, a]));
        const negoMap = new Map(negotiations.map((n: any) => [n.indentNo, n]));
        const poMap = new Map(poEntries.map((p: any) => [p.indentNo, p]));
        
        // Group lifts by indentNo
        const liftsByIndent = new Map<string, any[]>();
        lifts.forEach((l: any) => {
            const list = liftsByIndent.get(l.indentNo) || [];
            list.push(l);
            liftsByIndent.set(l.indentNo, list);
        });

        // Map responsible persons by stageName
        const respMap: Record<string, string> = {};
        responsibles.forEach((r: any) => {
            if (r.stageName && r.responsibleNames) {
                respMap[r.stageName.trim()] = r.responsibleNames.trim();
            }
        });

        // 4. Overdue Evaluation Setup
        const allowedStages = ["Indent Approval", "PO Entry", "Follow-Up Vendor", "Transporter Follow-Up"];
        const totalCounts: Record<string, number> = {};
        const overdueCounts: Record<string, number> = {};
        allowedStages.forEach(name => {
            totalCounts[name] = 0;
            overdueCounts[name] = 0;
        });

        const detailed: any[] = [];
        const now = new Date();

        // 5. Evaluate Indent Approval, PO Entry, and Follow-Up Vendor stages
        indents.forEach((row: any) => {
            if (cancelledNos.has(row.indentNo)) return;

            const approval = approvalMap.get(row.indentNo);
            const poEntry = poMap.get(row.indentNo);
            const nego = negoMap.get(row.indentNo);
            const indentLifts = liftsByIndent.get(row.indentNo) || [];

            // A. Indent Approval Stage (Stage 2)
            if (!approval) {
                totalCounts["Indent Approval"]++;
                if (row.plannedIndentApproval) {
                    const planned = new Date(row.plannedIndentApproval);
                    if (now > planned) {
                        overdueCounts["Indent Approval"]++;
                        const delayDays = Math.floor((now.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24));
                        detailed.push({
                            indent: row.indentNo,
                            party: row.createdBy || "-",
                            item: row.itemName || "-",
                            qty: row.quantity || 0,
                            stage: "Indent Approval",
                            delay: Math.max(0, delayDays),
                            poNumber: "-"
                        });
                    }
                }
            }

            // B. PO Entry Stage (Stage 5)
            if (nego && !poEntry) {
                totalCounts["PO Entry"]++;
                if (nego.plannedPOEntry) {
                    const planned = new Date(nego.plannedPOEntry);
                    if (now > planned) {
                        overdueCounts["PO Entry"]++;
                        const delayDays = Math.floor((now.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24));
                        
                        let party = row.createdBy || "-";
                        if (nego.selectedVendorName) {
                            party = nego.selectedVendorName;
                        }

                        detailed.push({
                            indent: row.indentNo,
                            party: party,
                            item: row.itemName || "-",
                            qty: approval ? (approval.approvedQty || row.quantity) : row.quantity,
                            stage: "PO Entry",
                            delay: Math.max(0, delayDays),
                            poNumber: "-"
                        });
                    }
                }
            }

            // C. Follow-Up Vendor Stage (Stage 6)
            if (poEntry && indentLifts.length === 0) {
                totalCounts["Follow-Up Vendor"]++;
                if (poEntry.plannedFollowUpVendor) {
                    const planned = new Date(poEntry.plannedFollowUpVendor);
                    if (now > planned) {
                        overdueCounts["Follow-Up Vendor"]++;
                        const delayDays = Math.floor((now.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24));
                        
                        let party = nego ? (nego.selectedVendorName || row.createdBy) : (row.createdBy || "-");

                        detailed.push({
                            indent: row.indentNo,
                            party: party,
                            item: row.itemName || "-",
                            qty: approval ? (approval.approvedQty || row.quantity) : row.quantity,
                            stage: "Follow-Up Vendor",
                            delay: Math.max(0, delayDays),
                            poNumber: poEntry.poNumber || "-",
                            plannedDate: poEntry.plannedFollowUpVendor ? new Date(poEntry.plannedFollowUpVendor).toISOString().split('T')[0] : "-"
                        });
                    }
                }
            }
        });

        // 6. Evaluate Transporter Follow-Up stage (Stage 7)
        transporterFollowups.forEach((row: any) => {
            const lift = row.lift || {};
            const indent = lift.indent || {};
            if (!indent.indentNo || cancelledNos.has(indent.indentNo)) return;

            if (row.status !== "received") {
                totalCounts["Transporter Follow-Up"]++;
                if (lift.plannedTransporterFlwUp) {
                    const planned = new Date(lift.plannedTransporterFlwUp);
                    if (now > planned) {
                        overdueCounts["Transporter Follow-Up"]++;
                        const delayDays = Math.floor((now.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24));
                        
                        let expectedDate = row.nextFollowUpDate || row.expectedDeliveryDate || lift.plannedTransporterFlwUp || "-";
                        if (expectedDate && expectedDate !== "-") {
                            expectedDate = new Date(expectedDate).toISOString().split('T')[0];
                        }

                        const poNumber = (indent.poEntry && indent.poEntry.length > 0) ? (indent.poEntry[0].poNumber || "-") : "-";

                        detailed.push({
                            indent: indent.indentNo,
                            party: lift.transporterName || "-",
                            item: indent.itemName || "-",
                            qty: lift.liftingQty || 0,
                            stage: "Transporter Follow-Up",
                            delay: Math.max(0, delayDays),
                            expectedDate: expectedDate,
                            transporterName: lift.transporterName || "-",
                            poNumber: poNumber
                        });
                    }
                }
            }
        });

        // 7. Format summary stats for the PDF generator
        // Calculate follow-up vendor unique PO counts if relevant
        const followUpVendorPOs = new Set<string>();
        detailed.forEach(d => {
            if (d.stage === "Follow-Up Vendor" && d.poNumber && d.poNumber !== "-") {
                followUpVendorPOs.add(d.poNumber.toUpperCase().replace(/\s+/g, ''));
            }
        });

        const summaryData = allowedStages
            .filter(name => overdueCounts[name] > 0)
            .map(name => ({
                stage: name,
                pending: overdueCounts[name],
                responsible: respMap[name] || "-",
                uniquePoCount: name === "Follow-Up Vendor" ? followUpVendorPOs.size : undefined
            }));

        // Sort detailed overdue data by stage sequence for consistent visual output
        detailed.sort((a, b) => {
            const indexA = allowedStages.indexOf(a.stage);
            const indexB = allowedStages.indexOf(b.stage);
            return indexA - indexB;
        });

        // 8. Generate PDF Document
        const doc = React.createElement(ReportDocument, { summaryData, detailedData: detailed }) as any;
        const buffer = await renderToBuffer(doc);
        const base64Pdf = buffer.toString('base64');
        const filename = `Purchase_Report_${new Date().toISOString().split('T')[0]}.pdf`;

        // 9. Upload PDF via Google Apps Script Web App (only if configured)
        let fileUrl = "skipped (NEXT_PUBLIC_IMS_API_URI not set)";
        if (API_URI) {
            const folderId = process.env.REPORT_FOLDER_ID || "";
            const payload = {
                action: "uploadReport",
                base64Data: base64Pdf,
                fileName: filename,
                folderId: folderId
            };

            const uploadRes = await fetch(API_URI, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const uploadResult = await uploadRes.json();

            if (!uploadResult.success) {
                throw new Error(`Google Apps Script Upload failed: ${uploadResult.error}`);
            }
            fileUrl = uploadResult.fileUrl;
        }

        return NextResponse.json({
            success: true,
            message: API_URI 
              ? "Purchase Report generated from Supabase and uploaded successfully" 
              : "Purchase Report generated from Supabase successfully (Drive upload skipped)",
            fileUrl: fileUrl,
            overdueSummary: summaryData,
            overdueDetailedCount: detailed.length
        });

    } catch (error: any) {
        console.error("Cron Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
