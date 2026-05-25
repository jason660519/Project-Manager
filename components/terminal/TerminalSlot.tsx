'use client';

import { useEffect, useRef } from 'react';
import { attach, detach, notifySlotVisible } from './TerminalRegistry';

// Thin React shell over TerminalRegistry: claims a slot for `itemId` on mount,
// returns it to limbo on unmount. PTY + xterm survive across mounts.
//
// `cwd` is only read when the registry first creates the session (subsequent
// attaches re-use the existing PTY regardless of cwd changes).
export function TerminalSlot({
  itemId,
  cwd,
  isActive = true,
}: {
  itemId: string;
  cwd: string;
  isActive?: boolean;
}) {
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    attach(itemId, slot, cwd);
    return () => detach(itemId);
  }, [itemId, cwd]);

  useEffect(() => {
    if (!isActive) return;
    notifySlotVisible(itemId);
  }, [isActive, itemId]);

  return <div ref={slotRef} className="h-full min-h-0 min-w-0 w-full overflow-hidden" />;
}
