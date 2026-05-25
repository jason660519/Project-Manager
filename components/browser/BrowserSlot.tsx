'use client';

import { useCallback, useEffect, useRef } from 'react';
import { measureBrowserSlotBounds } from './browser-bounds';
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

  const applyBounds = useCallback(() => {
    const slot = slotRef.current;
    if (!slot || backendKind() !== 'tauri') return;
    const bounds = measureBrowserSlotBounds(slot);
    if (!bounds) return;
    setBounds(itemId, bounds.x, bounds.y, bounds.width, bounds.height);
  }, [itemId]);

  const applyBoundsForced = useCallback(() => {
    const slot = slotRef.current;
    if (!slot || backendKind() !== 'tauri') return;
    const bounds = measureBrowserSlotBounds(slot);
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
    // After Enter / Go the native webview is often created on the first valid
    // bounds tick — force a remeasure so it does not cover the URL chrome.
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
    let stopped = false;
    let hiddenAcknowledged = false;

    const tick = () => {
      if (stopped) return;
      const bounds = measureBrowserSlotBounds(slot);
      if (bounds) {
        setBounds(itemId, bounds.x, bounds.y, bounds.width, bounds.height);
        hiddenAcknowledged = false;
      } else if (!hiddenAcknowledged) {
        setSlotHidden(itemId);
        hiddenAcknowledged = true;
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

  return <div ref={slotRef} className="relative z-0 min-h-0 min-w-0 flex-1" />;
}
