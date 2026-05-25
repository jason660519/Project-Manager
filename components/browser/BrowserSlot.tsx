'use client';

import { useCallback, useEffect, useRef } from 'react';
import { measureBrowserSlotBounds, toNativeWebviewBounds } from './browser-bounds';
import {
  attach,
  backendKind,
  detach,
  forceNativeBoundsSync,
  navigate,
  notifySlotVisible,
  setBounds,
  setSlotHidden,
} from './BrowserRegistry';

// Position sync strategy:
//   - For iframe backend: no-op, CSS lays out the iframe inside the slot.
//   - For Tauri native webview: poll slot rect every frame, fire setBounds
//     only when the safe slot bounds actually changed. This catches resize,
//     scroll, parent layout changes, and position-only shifts.
//
// Native webviews draw above React DOM. Bounds must be measured from the settled
// content slot below the URL chrome; otherwise the native view can cover the URL
// input and make it look like the field disappeared while the user edits it.
export function BrowserSlot({
  itemId,
  url,
  isActive = true,
}: {
  itemId: string;
  url: string;
  isActive?: boolean;
}) {
  const slotRef = useRef<HTMLDivElement>(null);

  const applyBoundsForced = useCallback(() => {
    const slot = slotRef.current;
    if (!slot || backendKind() !== 'tauri') return;
    const slotBounds = measureBrowserSlotBounds(slot);
    const bounds = slotBounds ? toNativeWebviewBounds(slotBounds) : null;
    if (!bounds) return;
    forceNativeBoundsSync(itemId, bounds);
  }, [itemId]);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    attach(itemId, slot, url);
    return () => detach(itemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  useEffect(() => {
    navigate(itemId, url);
    if (backendKind() !== 'tauri' || !isActive) return;
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        applyBoundsForced();
      });
    });
    return () => {
      cancelAnimationFrame(outerRaf);
      if (innerRaf) cancelAnimationFrame(innerRaf);
    };
  }, [itemId, url, isActive, applyBoundsForced]);

  useEffect(() => {
    if (backendKind() !== 'tauri') return;
    if (!isActive) {
      setSlotHidden(itemId);
      return;
    }
    notifySlotVisible(itemId);
    applyBoundsForced();
  }, [isActive, itemId, applyBoundsForced]);

  useEffect(() => {
    if (backendKind() !== 'tauri' || !isActive) return;
    const slot = slotRef.current;
    if (!slot) return;

    const pane = slot.closest('[data-browser-pane]');
    let rafId: number | null = null;
    let last: { x: number; y: number; width: number; height: number } | null = null;
    let stopped = false;
    let hiddenAcknowledged = false;

    const tick = () => {
      if (stopped) return;
      const slotBounds = measureBrowserSlotBounds(slot);
      const bounds = slotBounds ? toNativeWebviewBounds(slotBounds) : null;
      if (bounds) {
        if (
          !last ||
          last.x !== bounds.x ||
          last.y !== bounds.y ||
          last.width !== bounds.width ||
          last.height !== bounds.height
        ) {
          last = bounds;
          setBounds(itemId, bounds.x, bounds.y, bounds.width, bounds.height);
        }
        hiddenAcknowledged = false;
      } else {
        if (!hiddenAcknowledged) {
          setSlotHidden(itemId);
          hiddenAcknowledged = true;
        }
        last = null;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => {
      applyBoundsForced();
    });
    ro.observe(slot);
    if (pane) ro.observe(pane);

    return () => {
      stopped = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro.disconnect();
      setSlotHidden(itemId);
    };
  }, [itemId, isActive, applyBoundsForced]);

  return <div ref={slotRef} data-browser-slot className="relative z-0 min-h-0 min-w-0 flex-1" />;
}
