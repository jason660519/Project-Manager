export type FontZoomDirection = 'in' | 'out';
export type FontZoomAction = FontZoomDirection | 'reset';

export const FONT_ZOOM_BASE_SCALE = 1;
export const FONT_ZOOM_MIN_SCALE = 0.3;
export const FONT_ZOOM_MAX_SCALE = 3;
export const FONT_ZOOM_STEP = 0.1;
export const FONT_ZOOM_STORAGE_KEY = 'project-manager:font-zoom-scale';
export const FONT_ZOOM_CSS_VAR = '--pm-font-zoom';

function roundFontZoomScale(scale: number): number {
  return Math.round(scale * 100) / 100;
}

export function clampFontZoomScale(scale: number): number {
  if (!Number.isFinite(scale)) return FONT_ZOOM_BASE_SCALE;
  return roundFontZoomScale(
    Math.min(FONT_ZOOM_MAX_SCALE, Math.max(FONT_ZOOM_MIN_SCALE, scale)),
  );
}

export function nextFontZoomScale(
  currentScale: number,
  direction: FontZoomDirection,
): number {
  const delta = direction === 'in' ? FONT_ZOOM_STEP : -FONT_ZOOM_STEP;
  return clampFontZoomScale(currentScale + delta);
}

export function getNextFontZoomScale(
  currentScale: number,
  action: FontZoomAction,
): number {
  if (action === 'reset') return FONT_ZOOM_BASE_SCALE;
  return nextFontZoomScale(currentScale, action);
}

export function getFontZoomActionFromKeyboardEvent(
  event: KeyboardEvent,
): FontZoomAction | null {
  if (!event.metaKey && !event.ctrlKey) return null;

  if (
    event.key === '+' ||
    event.key === '=' ||
    event.code === 'Equal' ||
    event.code === 'NumpadAdd'
  ) {
    return 'in';
  }

  if (
    event.key === '-' ||
    event.key === '_' ||
    event.code === 'Minus' ||
    event.code === 'NumpadSubtract'
  ) {
    return 'out';
  }

  if (
    event.key === '0' ||
    event.code === 'Digit0' ||
    event.code === 'Numpad0'
  ) {
    return 'reset';
  }

  return null;
}

export function readStoredFontZoomScale(storage: Storage | undefined): number {
  if (!storage) return FONT_ZOOM_BASE_SCALE;
  try {
    const raw = storage.getItem(FONT_ZOOM_STORAGE_KEY);
    if (!raw) return FONT_ZOOM_BASE_SCALE;
    return clampFontZoomScale(Number(raw));
  } catch {
    return FONT_ZOOM_BASE_SCALE;
  }
}

export function applyFontZoomScale(
  documentElement: HTMLElement,
  storage: Storage | undefined,
  scale: number,
): number {
  const safeScale = clampFontZoomScale(scale);
  documentElement.style.setProperty(FONT_ZOOM_CSS_VAR, String(safeScale));
  documentElement.setAttribute('data-pm-font-zoom', String(safeScale));
  try {
    storage?.setItem(FONT_ZOOM_STORAGE_KEY, String(safeScale));
  } catch {
    // Font zoom still applies for this session when storage is unavailable.
  }
  return safeScale;
}
