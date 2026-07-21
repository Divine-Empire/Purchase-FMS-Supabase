import {
    PlusCircle, CheckCircle2, Users, MessagesSquare, FileEdit,
    Phone, Package, ClipboardCheck, FileText, Upload, ShieldCheck,
    CornerUpLeft, CreditCard, Truck, TruckIcon, ShieldAlert, LayoutGrid, AlertCircle, XCircle, Settings
} from "lucide-react";

export const STAGES = [
    { num: 1, name: "Create Indent", slug: "create-indent", icon: PlusCircle },
    { num: 2, name: "Indent Approval", slug: "indent-approval", icon: CheckCircle2 },
    { num: 3, name: "Update 3 Vendors", slug: "update-3-vendors", icon: Users },
    { num: 4, name: "Negotiation", slug: "negotiation", icon: MessagesSquare },
    { num: 5, name: "PO Entry", slug: "po-entry", icon: FileEdit },
    { num: 6, name: "Follow-Up Vendor", slug: "follow-up-vendor", icon: Phone },
    { num: 6.1, name: "Transporter Follow-Up", slug: "transporter-follow-up", icon: TruckIcon },
    { num: 7, name: "Material Received", slug: "material-received", icon: Package },
    { num: 7.5, name: "Serial Generation", slug: "warranty-info", icon: ShieldAlert },
    { num: 7.6, name: "Warranty Claim", slug: "warranty-claim", icon: ShieldAlert },
    { num: 8, name: "Receipt in Tally", slug: "receipt-in-tally", icon: FileText },
    { num: 8.5, name: "Submit Invoice (HO)", slug: "submit-invoice-ho", icon: FileText },
    { num: 9, name: "Submit Invoice", slug: "submit-invoice", icon: Upload },
    { num: 10, name: "Verification by Accounts", slug: "verification", icon: ShieldCheck },
    { num: 11, name: "Material Testing", slug: "material-testing", icon: ClipboardCheck },
    { num: 12, name: "Purchase Return", slug: "purchase-return", icon: CornerUpLeft },
    { num: 13, name: "Return Approval", slug: "return-approval", icon: CornerUpLeft },
    { num: 14, name: "Vendor Payment", slug: "vendor-payment", icon: CreditCard },
    { num: 15, name: "Freight Payments", slug: "freight-payments", icon: Truck },
    { num: 16, name: "IMS", slug: "ims", icon: LayoutGrid },
    { num: 17, name: "Damaged Records", slug: "damaged-records", icon: AlertCircle },
    { num: 18, name: "Order Cancel", slug: "order-cancel", icon: XCircle },
    { num: 19, name: "Settings", slug: "settings", icon: Settings },
];

export const PAGE_ACCESS_OPTIONS = [
    "Dashboard",
    "Create Indent",
    "Indent Approval",
    "Update 3 Vendors",
    "Negotiation",
    "PO Entry",
    "Follow-Up Vendor",
    "Transporter Follow-Up",
    "Material Received",
    "Serial Generation",
    "Warranty Claim",
    "Receipt in Tally",
    "Submit Invoice (HO)",
    "Submit Invoice",
    "Verification by Accounts",
    "Material Testing",
    "Purchase Return",
    "Return Approval",
    "Vendor Payment",
    "Freight Payments",
    "IMS",
    "Damaged Records",
    "Order Cancel",
    "Settings",
];

export function isStageAccessGranted(
    stageName: string,
    pageAccess: string[] | null | undefined,
    role: string | null | undefined
): boolean {
    const isAdmin = role?.toUpperCase() === "ADMIN" || role?.toLowerCase() === "admin";
    if (isAdmin) return true;

    if (!pageAccess || pageAccess.length === 0) return false;
    if (pageAccess.includes("ALL")) return true;

    const normalizedUserPages = pageAccess.map(p => p.toLowerCase().trim());
    const normName = stageName.toLowerCase().trim();

    if (normalizedUserPages.includes(normName)) return true;

    // Check legacy / alternative names for backwards compatibility
    if (stageName === "Create Indent" && (normalizedUserPages.includes("indent management") || normalizedUserPages.includes("create indent"))) return true;
    if (stageName === "Indent Approval" && (normalizedUserPages.includes("approval purchase po") || normalizedUserPages.includes("indent approval"))) return true;
    if (stageName === "PO Entry" && (normalizedUserPages.includes("generate purchase po") || normalizedUserPages.includes("po entry"))) return true;
    if (stageName === "Follow-Up Vendor" && (normalizedUserPages.includes("follow-up") || normalizedUserPages.includes("send po to party") || normalizedUserPages.includes("follow-up vendor"))) return true;
    if (stageName === "Transporter Follow-Up" && (normalizedUserPages.includes("arrange logistics & get lifting") || normalizedUserPages.includes("transporter follow-up"))) return true;
    if (stageName === "Material Received" && (normalizedUserPages.includes("receive material") || normalizedUserPages.includes("lift receiver material") || normalizedUserPages.includes("material received"))) return true;
    if (stageName === "Receipt in Tally" && (normalizedUserPages.includes("tally entry") || normalizedUserPages.includes("receipt in tally"))) return true;
    if (stageName === "Verification by Accounts" && (normalizedUserPages.includes("verification") || normalizedUserPages.includes("verification by accounts"))) return true;
    if (stageName === "Material Testing" && (normalizedUserPages.includes("qc requirement") || normalizedUserPages.includes("material testing"))) return true;

    return false;
}
