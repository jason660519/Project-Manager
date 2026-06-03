import { useCallback, useRef } from 'react';

const COMPOSITION_END_GUARD_MS = 30;

type KeyboardLikeEvent = {
  key: string;
  shiftKey?: boolean;
  nativeEvent?: Event & {
    isComposing?: boolean;
    keyCode?: number;
    which?: number;
  };
};

export interface ImeSafeSubmitHandlers {
  onCompositionStart: () => void;
  onCompositionUpdate: () => void;
  onCompositionEnd: () => void;
  shouldSubmitOnEnter: (event: KeyboardLikeEvent) => boolean;
}

export function isImeComposingEvent(event: KeyboardLikeEvent): boolean {
  const nativeEvent = event.nativeEvent;
  return nativeEvent?.isComposing === true || nativeEvent?.keyCode === 229 || nativeEvent?.which === 229;
}

export function useImeSafeSubmit(): ImeSafeSubmitHandlers {
  const composingRef = useRef(false);
  const compositionJustEndedRef = useRef(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCompositionEndGuard = useCallback(() => {
    if (clearTimerRef.current !== null) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    compositionJustEndedRef.current = false;
  }, []);

  const markComposing = useCallback(() => {
    clearCompositionEndGuard();
    composingRef.current = true;
  }, [clearCompositionEndGuard]);

  const handleCompositionEnd = useCallback(() => {
    composingRef.current = false;
    compositionJustEndedRef.current = true;
    if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      compositionJustEndedRef.current = false;
      clearTimerRef.current = null;
    }, COMPOSITION_END_GUARD_MS);
  }, []);

  const shouldSubmitOnEnter = useCallback((event: KeyboardLikeEvent) => {
    if (event.key !== 'Enter' || event.shiftKey) return false;
    if (composingRef.current || compositionJustEndedRef.current || isImeComposingEvent(event)) return false;
    return true;
  }, []);

  return {
    onCompositionStart: markComposing,
    onCompositionUpdate: markComposing,
    onCompositionEnd: handleCompositionEnd,
    shouldSubmitOnEnter,
  };
}
