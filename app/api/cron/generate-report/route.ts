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

        // 2. Fetch cancellation list and TAT responsible persons in parallel
        const [cancelRes, respRes] = await Promise.all([
            supabase.from("pfms_order-cancellation").select("indentNo"),
            supabase.from("pfms_tat").select("stageName, responsibleNames")
        ]);

        if (cancelRes.error) throw cancelRes.error;
        if (respRes.error) throw respRes.error;

        const cancelledList = cancelRes.data || [];
        const responsibles = respRes.data || [];

        const cancelledNos = new Set(cancelledList.map((c: any) => c.indentNo));

        // Map responsible persons by stageName (lowercased for case-insensitive lookup)
        const respMap: Record<string, string> = {};
        responsibles.forEach((r: any) => {
            if (r.stageName && r.responsibleNames) {
                respMap[r.stageName.trim().toLowerCase()] = r.responsibleNames.trim();
            }
        });

        // 3. Fetch indents and their stage relations using pagination to avoid 1,000-row truncation
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
                        transporterFollowUp:"pfms_transporter-follow-up"(*)
                    )
                `)
                .order("timestamp", { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1) as any;

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

        // Delay must be reported in HOURS (formatDelay() in report-pdf.tsx treats a
        // plain numeric delay value as hours), so compute it that way everywhere below.
        const getDelayHours = (plannedDateStr: string) => {
            const planned = new Date(plannedDateStr);
            if (isNaN(planned.getTime())) return 0;
            const diffMs = now.getTime() - planned.getTime();
            return Math.max(0, diffMs / (1000 * 60 * 60));
        };

        const followUpVendorPOs = new Set<string>();

        // 5. Evaluate all stages per indent
        indents.forEach((row: any) => {
            const indentNo = row.indentNo;
            if (cancelledNos.has(indentNo)) return;

            const approval = Array.isArray(row.approval) ? row.approval[0] : row.approval;
            const nego = Array.isArray(row.negotiation) ? row.negotiation[0] : row.negotiation;
            const poEntry = Array.isArray(row.poEntry) ? row.poEntry[0] : row.poEntry;
            const lifts = row.lifts || [];

            // A. Indent Approval Stage (Stage 2)
            if (!approval) {
                totalCounts["Indent Approval"]++;
                if (row.plannedIndentApproval) {
                    const planned = new Date(row.plannedIndentApproval);
                    if (now > planned) {
                        overdueCounts["Indent Approval"]++;
                        detailed.push({
                            indent: indentNo,
                            party: row.createdBy || "-",
                            item: row.itemName || "-",
                            qty: row.quantity || 0,
                            stage: "Indent Approval",
                            delay: getDelayHours(row.plannedIndentApproval).toFixed(2),
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
                        let party = row.createdBy || "-";
                        if (nego.selectedVendorName) {
                            party = nego.selectedVendorName;
                        }

                        detailed.push({
                            indent: indentNo,
                            party: party,
                            item: row.itemName || "-",
                            qty: approval ? (approval.approvedQty || row.quantity) : row.quantity,
                            stage: "PO Entry",
                            delay: getDelayHours(nego.plannedPOEntry).toFixed(2),
                            poNumber: "-"
                        });
                    }
                }
            }

            // C. Follow-Up Vendor Stage (Stage 6)
            if (poEntry) {
                const approvedQty = approval?.approvedQty !== null && approval?.approvedQty !== undefined ? approval.approvedQty : row.quantity;
                const totalLifted = lifts.reduce((sum: number, l: any) => sum + (parseFloat(l.liftingQty) || 0), 0);

                if (totalLifted < approvedQty) {
                    totalCounts["Follow-Up Vendor"]++;
                    if (poEntry.plannedFollowUpVendor) {
                        const planned = new Date(poEntry.plannedFollowUpVendor);
                        if (now > planned) {
                            overdueCounts["Follow-Up Vendor"]++;
                            let party = nego ? (nego.selectedVendorName || row.createdBy) : (row.createdBy || "-");

                            const poNumKey = (poEntry.poNumber || "").toUpperCase().replace(/\s+/g, '');
                            if (poNumKey) {
                                followUpVendorPOs.add(poNumKey);
                            }

                            detailed.push({
                                indent: indentNo,
                                party: party,
                                item: row.itemName || "-",
                                qty: approvedQty - totalLifted,
                                stage: "Follow-Up Vendor",
                                delay: getDelayHours(poEntry.plannedFollowUpVendor).toFixed(2),
                                poNumber: poEntry.poNumber || "-",
                                plannedDate: poEntry.plannedFollowUpVendor ? new Date(poEntry.plannedFollowUpVendor).toISOString().split('T')[0] : "-"
                            });
                        }
                    }
                }
            }

            // D. Transporter Follow-Up Stage (Stage 6.1)
            for (const lift of lifts) {
                const tfuArray = lift.transporterFollowUp;
                const tfu = Array.isArray(tfuArray) ? tfuArray[0] : tfuArray;

                if (tfu && tfu.status === "intransit") {
                    totalCounts["Transporter Follow-Up"]++;
                    if (lift.plannedTransporterFlwUp) {
                        const planned = new Date(lift.plannedTransporterFlwUp);
                        if (now > planned) {
                            overdueCounts["Transporter Follow-Up"]++;
                            let expectedDate = tfu.nextFollowUpDate || tfu.expectedDeliveryDate || lift.plannedTransporterFlwUp || "-";
                            if (expectedDate && expectedDate !== "-") {
                                expectedDate = new Date(expectedDate).toISOString().split('T')[0];
                            }

                            detailed.push({
                                indent: indentNo,
                                liftNo: lift.liftNo || "-",
                                party: lift.transporterName || nego?.selectedVendorName || "-",
                                item: row.itemName || "-",
                                qty: lift.liftingQty || 0,
                                stage: "Transporter Follow-Up",
                                delay: getDelayHours(lift.plannedTransporterFlwUp).toFixed(2),
                                expectedDate: expectedDate,
                                transporterName: lift.transporterName || "-",
                                poNumber: poEntry?.poNumber || "-"
                            });
                        }
                    }
                }
            }
        });

        // 7. Format summary stats for the PDF generator
        detailed.forEach(d => {
            if (d.stage === "Follow-Up Vendor" && d.poNumber && d.poNumber !== "-") {
                followUpVendorPOs.add(d.poNumber.toUpperCase().replace(/\s+/g, ''));
            }
        });

        const stageSlugMap: Record<string, string[]> = {
            "Indent Approval": ["indent-approval"],
            "PO Entry": ["po-entry"],
            "Follow-Up Vendor": ["follow-up-vendor"],
            "Transporter Follow-Up": ["transporter-flw-up", "transporter-follow-up"]
        };

        const getResponsible = (stage: string) => {
            const keys = [
                ...(stageSlugMap[stage] || []),
                stage.toLowerCase(),
                stage.toLowerCase().replace(/\s+/g, '-')
            ];
            for (const key of keys) {
                if (respMap[key]) return respMap[key];
            }
            return "-";
        };

        const summaryData = allowedStages
            .filter(name => overdueCounts[name] > 0)
            .map(name => ({
                stage: name,
                pending: overdueCounts[name],
                responsible: getResponsible(name),
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

            try {
                const uploadRes = await fetch(API_URI, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const uploadResult = await uploadRes.json();

                if (!uploadResult.success) {
                    fileUrl = `Upload failed: ${uploadResult.error}`;
                } else {
                    fileUrl = uploadResult.fileUrl;
                }
            } catch (uploadErr: any) {
                console.error("Google Apps Script upload error:", uploadErr);
                fileUrl = `Upload failed: ${uploadErr.message}`;
            }
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
