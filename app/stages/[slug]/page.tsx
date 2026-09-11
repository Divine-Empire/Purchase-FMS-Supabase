"use client";

import { useParams } from "next/navigation";
import CreateIndent from "@/stage-pages/create-indent/create-indent";
import IndentApproval from "@/stage-pages/indent-approval/indent-approval";
import Update3Vendors from "@/stage-pages/update-3-vendors/update-3-vendors";
import Negotiation from "@/stage-pages/negotiation/negotiation";
import POEntry from "@/stage-pages/po-entry/po-entry";
import FollowUpVendor from "@/stage-pages/follow-up-vendor/follow-up-vendor";
import TransporterFollowUp from "@/stage-pages/transporter-follow-up/transporter-follow-up";
import MaterialReceived from "@/stage-pages/material-received/material-received";
import QCRequirement from "@/stage-pages/material-testing/material-testing";
import RepairProcess from "@/stage-pages/repair-process/repair-process";
import ReceiptInTally from "@/stage-pages/tally-entry/tally-entry";
import SubmitInvoice from "@/stage-pages/submit-invoice/submit-invoice";
import Verification from "@/stage-pages/verification/verification";
import PurchaseReturn from "@/stage-pages/purchase-return/purchase-return";
import VendorPayment from "@/stage-pages/vendor-payment/vendor-payment";
import FreightPayments from "@/stage-pages/freight-payments/freight-payments";
import ReturnApproval from "@/stage-pages/return-approval/return-approval";
import VerificationByAccounts from "@/stage-pages/verification/verification";

import SubmitInvoiceHO from "@/stage-pages/submit-invoice-ho/submit-invoice-ho";
import SerialGeneration from "@/stage-pages/serial-generation/serial-generation";
import WarrantyClaim from "@/stage-pages/warranty-claim/warranty-claim";
import ImsPage from "@/stage-pages/ims/ims";
import DamagedRecords from "@/stage-pages/damaged-records/damaged-records";
import OrderCancelPage from "@/stage-pages/order-cancel/order-cancel";
import SettingsPage from "@/stage-pages/settings/SettingsPage";
import DropdownsMaster from "@/stage-pages/master/dropdownsMaster";

const stageComponents: Record<string, React.ComponentType> = {
    "create-indent": CreateIndent,
    "indent-approval": IndentApproval,
    "update-3-vendors": Update3Vendors,
    "negotiation": Negotiation,
    "po-entry": POEntry,
    "follow-up-vendor": FollowUpVendor,
    "transporter-follow-up": TransporterFollowUp,
    "material-received": MaterialReceived,
    "material-testing": QCRequirement,
    "repair-process": RepairProcess,
    "receipt-in-tally": ReceiptInTally,
    "submit-invoice-ho": SubmitInvoiceHO,
    "submit-invoice": SubmitInvoice,
    "verification": Verification,
    "verification-by-accounts": VerificationByAccounts,
    "warranty-info": SerialGeneration,
    "warranty-claim": WarrantyClaim,
    "purchase-return": PurchaseReturn,
    "vendor-payment": VendorPayment,
    "freight-payments": FreightPayments,
    "return-approval": ReturnApproval,
    "ims": ImsPage,
    "damaged-records": DamagedRecords,
    "order-cancel": OrderCancelPage,
    "settings": SettingsPage,
    "master": DropdownsMaster,
};

export default function StagePage() {
    const params = useParams();
    const slug = params.slug as string;

    const StageComponent = stageComponents[slug];

    if (!StageComponent) {
        return <div className="p-6">Stage not found {slug}</div>;
    }

    return <StageComponent />;
}
