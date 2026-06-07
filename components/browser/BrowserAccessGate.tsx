'use client';

// BrowserAccessGate — propagates the active engineer's browser-access policy
// (ADR-017, L2a) down to the xmux browser panes, which sit deep under
// LayoutRenderer/Block and can't be reached by prop drilling.
//
// Semantics:
//   - `governed: false` → no engineer owner is assigned to this browser surface;
//     the human user browses freely (the pre-ADR-017 default). The gate is inert.
//   - `governed: true`  → an engineer owns the surface; `allowed` is the
//     fail-closed verdict from `isBrowserLaunchAllowed(owner.browserAccess)`.
//     When `allowed` is false the pane renders blocked and never creates a
//     native webview OR an iframe (so there is no "fall back to unrestricted"
//     security-illusion path).

import { createContext, useContext, type ReactNode } from 'react';

export interface BrowserAccessGateValue {
  /** Whether an engineer owner governs this browser surface. */
  governed: boolean;
  /** Launch verdict. Always `true` when ungoverned; fail-closed when governed. */
  allowed: boolean;
  /** Display name of the governing engineer, when governed. */
  ownerLabel?: string;
}

const UNGOVERNED: BrowserAccessGateValue = { governed: false, allowed: true };

const BrowserAccessGateContext = createContext<BrowserAccessGateValue>(UNGOVERNED);

export function BrowserAccessGateProvider({
  value,
  children,
}: {
  value: BrowserAccessGateValue;
  children: ReactNode;
}) {
  return (
    <BrowserAccessGateContext.Provider value={value}>
      {children}
    </BrowserAccessGateContext.Provider>
  );
}

export function useBrowserAccessGate(): BrowserAccessGateValue {
  return useContext(BrowserAccessGateContext);
}
