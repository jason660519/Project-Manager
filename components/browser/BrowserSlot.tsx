'use client';

import { useEffect, useRef } from 'react';
import {
  attach,
  backendKind,
  detach,
  navigate,
  setBounds,
  setSlotHidden,
} from './BrowserRegistry';

// Position sync strategy:
//   - For iframe backend: no-op, CSS lays out the iframe inside the slot.
//   - For Tauri native webview: poll slot rect every frame, fire setBounds
//     only when the rect actually changed. This catches resize, scroll,
//     parent layout changes, AND position-only shifts (sibling closed → slot
//     moves but its own size didn't change → ResizeObserver wouldn't fire).
//
// 60Hz polling looks expensive but getBoundingClientRect is ~µs and IPC only
// fires on diff. CPU cost is negligible; the alternative (10 different
// observers) is far more fragile.
export function BrowserSlot({ itemId, url }: { itemId: string; url: string }) {
  const slotRef = useRef<HTMLDivElement>(null);

  // Attach / detach. URL stays out of deps so the host DIV doesn't bounce.
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    attach(itemId, slot, url);
    return () => detach(itemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  useEffect(() => {
    navigate(itemId, url);
  }, [itemId, url]);

  useEffect(() => {
    if (backendKind() !== 'tauri') return;
    const slot = slotRef.current;
    if (!slot) return;

    let rafId: number | null = null;
    let last: { x: number; y: number; width: number; height: number } | null = null;
    let stopped = false;

    let hiddenAcknowledged = false;
    const tick = () => {
      if (stopped) return;
      const r = slot.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        // Visible slot → push bounds (which also re-shows if previously hidden).
        if (
          !last ||
          last.x !== r.x ||
          last.y !== r.y ||
          last.width !== r.width ||
          last.height !== r.height
        ) {
          last = { x: r.x, y: r.y, width: r.width, height: r.height };
          setBounds(itemId, r.x, r.y, r.width, r.height);
        }
        hiddenAcknowledged = false;
      } else {
        // Slot is display:none / detached. Without this, the OS webview would
        // remain `set_visible(true)` and overlap other tabs' webviews in the
        // same block (they all share parent coords). Flip it to hidden so the
        // active tab's webview is the only one drawn.
        if (!hiddenAcknowledged) {
          setSlotHidden(itemId);
          hiddenAcknowledged = true;
        }
        last = null;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [itemId]);

  return <div ref={slotRef} className="min-h-0 min-w-0 flex-1" />;
}
