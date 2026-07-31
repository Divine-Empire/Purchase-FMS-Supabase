"use client";

import React from "react";
import { StageTable } from "@/components/stages/stage-table";

interface CreateIndentHistoryProps {
  history: any[];
}

export default function CreateIndentHistory({ history }: CreateIndentHistoryProps) {
  return ( 
    <div className="mt-0 outline-none flex-1 flex flex-col overflow-hidden">
      <StageTable
        title=""
        stage={1}
        pending={[]} // Strictly hide pending
        history={history}
        onSelectRecord={() => {}}
        showPending={false}
        hideTableTitle={true}
        columns={[
          { key: "indentNumber", label: "Indent" },
          { key: "createdBy", label: "Created By" },
          { key: "category", label: "Category" },
          { key: "warehouseLocation", label: "Warehouse" },
          { key: "leadTime", label: "Lead Time" },
          { key: "itemName", label: "Item" },
          { key: "quantity", label: "Qty" },
          { key: "uom", label: "UOM" },
          { key: "itemCode", label: "Item Code" },
          { key: "status", label: "Status" },
          { key: "attachment", label: "Attachment" },
        ]}
      />
    </div>
  );
}
