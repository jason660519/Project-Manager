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

export function BrowserSlot({ itemId, url }: { itemId: string; url: string }) {
  const slotRef = useRef<HTMLDivElement>(null);

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
      } else if (!hiddenAcknowledged) {
        setSlotHidden(itemId);
        hiddenAcknowledged = true;
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

  return <div ref={slotRef} className="relative z-0 min-h-0 min-w-0 flex-1" />;
}
