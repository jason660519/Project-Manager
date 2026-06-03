'use client';

import { useEffect, useRef } from 'react';
import {
  applyFontZoomScale,
  FONT_ZOOM_BASE_SCALE,
  getFontZoomActionFromKeyboardEvent,
  getNextFontZoomScale,
  readStoredFontZoomScale,
} from '../fontZoom';
import type { FontZoomAction } from '../fontZoom';
import { onFontZoomShortcut, safeUnlisten } from '../bridge';

function getFontZoomStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function useFontZoomShortcuts() {
  const scaleRef = useRef(FONT_ZOOM_BASE_SCALE);

  const applyAction = (action: FontZoomAction) => {
    const storage = getFontZoomStorage();
    const nextScale = getNextFontZoomScale(scaleRef.current, action);
    scaleRef.current = applyFontZoomScale(
      document.documentElement,
      storage,
      nextScale,
    );
  };

  useEffect(() => {
    const storage = getFontZoomStorage();
    const initialScale = readStoredFontZoomScale(storage);
    scaleRef.current = applyFontZoomScale(
      document.documentElement,
      storage,
      initialScale,
    );
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    onFontZoomShortcut(({ action, direction }) => {
      applyAction((action ?? direction) as FontZoomAction);
    })
      .then((cleanup) => {
        if (cancelled) {
          safeUnlisten(cleanup);
        } else {
          unlisten = cleanup;
        }
      })
      .catch((error) => {
        console.warn('Font zoom shortcut listener unavailable:', error);
      });

    return () => {
      cancelled = true;
      safeUnlisten(unlisten);
      unlisten = undefined;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = getFontZoomActionFromKeyboardEvent(event);
      if (!action) return;

      event.preventDefault();
      applyAction(action);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);
}
