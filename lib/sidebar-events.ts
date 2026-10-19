// Event-driven invalidation for the Sidebar's stage-count badges (replaces
// the earlier interval-based polling). Any mutation that can change a stage's
// pending count — an approval, a submit, a cancellation, a qty/status edit —
// calls `invalidateSidebarCounts()` once it has confirmed success from the
// server. Sidebar listens for this event and refetches `/api/dashboard?fields=counts`.
//
// A plain `window` CustomEvent is used instead of a new context/store: every
// stage page already lives under the same window, mutation handlers are
// plain fetch calls (not funneled through one shared layer), and the only
// listener is Sidebar itself — a context provider would add a dependency
// edge from every stage page to a new provider for no benefit over this.
export const SIDEBAR_COUNTS_INVALIDATED_EVENT = "pfms:sidebar-counts-invalidated";

/**
 * Call this after a mutation that can change sidebar stage-count badges has
 * been confirmed successful by the server (never before, and never for a
 * failed request). Safe to call from anywhere on the client; no-op on the
 * server (SSR) since `window` doesn't exist there.
 */
export function invalidateSidebarCounts(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SIDEBAR_COUNTS_INVALIDATED_EVENT));
}
