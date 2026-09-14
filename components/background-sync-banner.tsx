"use client";

import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Fixed, blinking banner shown while a History-edit is cascading changes across related
 * stage tables in the background. Meant to stop the admin from closing the tab/window
 * mid-save, since the cascade (e.g. Update 3 Vendors rate -> PO Entry values) touches more
 * than one table per request.
 */
export default function BackgroundSyncBanner({
  visible,
  label = "Background me records update ho rahe hai — window band na karein...",
}: {
  visible: boolean;
  label?: string;
}) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] animate-pulse">
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-amber-600 text-white shadow-lg shadow-amber-900/20 border border-amber-400/50">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
        </span>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs font-bold tracking-wide">{label}</span>
      </div>
    </div>
  );
}
