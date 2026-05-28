import { describe, expect, test, vi } from 'vitest';
import {
  applyFontZoomScale,
  clampFontZoomScale,
  FONT_ZOOM_BASE_SCALE,
  FONT_ZOOM_CSS_VAR,
  FONT_ZOOM_MAX_SCALE,
  FONT_ZOOM_MIN_SCALE,
  FONT_ZOOM_STORAGE_KEY,
  getFontZoomActionFromKeyboardEvent,
  getNextFontZoomScale,
  nextFontZoomScale,
  readStoredFontZoomScale,
} from '../lib/fontZoom';

describe('font zoom scaling', () => {
  test('clamps font zoom to 30% through 300% of the base size', () => {
    expect(clampFontZoomScale(0.01)).toBe(FONT_ZOOM_MIN_SCALE);
    expect(clampFontZoomScale(99)).toBe(FONT_ZOOM_MAX_SCALE);
    expect(clampFontZoomScale(Number.NaN)).toBe(FONT_ZOOM_BASE_SCALE);
  });

  test('increments and decrements in stable 10% steps', () => {
    expect(nextFontZoomScale(1, 'in')).toBe(1.1);
    expect(nextFontZoomScale(1, 'out')).toBe(0.9);
    expect(nextFontZoomScale(2.95, 'in')).toBe(FONT_ZOOM_MAX_SCALE);
    expect(nextFontZoomScale(0.34, 'out')).toBe(FONT_ZOOM_MIN_SCALE);
    expect(getNextFontZoomScale(1.8, 'reset')).toBe(FONT_ZOOM_BASE_SCALE);
  });

  test('maps foreground key combinations to zoom actions', () => {
    expect(
      getFontZoomActionFromKeyboardEvent(
        new KeyboardEvent('keydown', {
          key: '=',
          code: 'Equal',
          metaKey: true,
        }),
      ),
    ).toBe('in');
    expect(
      getFontZoomActionFromKeyboardEvent(
        new KeyboardEvent('keydown', {
          key: '-',
          code: 'NumpadSubtract',
          metaKey: true,
        }),
      ),
    ).toBe('out');
    expect(
      getFontZoomActionFromKeyboardEvent(
        new KeyboardEvent('keydown', {
          key: '0',
          code: 'Digit0',
          ctrlKey: true,
        }),
      ),
    ).toBe('reset');
    expect(
      getFontZoomActionFromKeyboardEvent(
        new KeyboardEvent('keydown', {
          key: '=',
          code: 'Equal',
        }),
      ),
    ).toBeNull();
  });

  test('applies the zoom CSS variable and persists the current scale', () => {
    const element = document.createElement('html');
    const storage = window.localStorage;

    const applied = applyFontZoomScale(element, storage, 1.23);

    expect(applied).toBe(1.23);
    expect(element.style.getPropertyValue(FONT_ZOOM_CSS_VAR)).toBe('1.23');
    expect(element.getAttribute('data-pm-font-zoom')).toBe('1.23');
    expect(storage.getItem(FONT_ZOOM_STORAGE_KEY)).toBe('1.23');
  });

  test('falls back to base scale when storage cannot be read', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('denied');
      }),
    } as unknown as Storage;

    expect(readStoredFontZoomScale(storage)).toBe(FONT_ZOOM_BASE_SCALE);
  });

  test('still applies zoom when storage cannot be written', () => {
    const element = document.createElement('html');
    const storage = {
      setItem: vi.fn(() => {
        throw new Error('denied');
      }),
    } as unknown as Storage;

    const applied = applyFontZoomScale(element, storage, 1.4);

    expect(applied).toBe(1.4);
    expect(element.style.getPropertyValue(FONT_ZOOM_CSS_VAR)).toBe('1.4');
    expect(element.getAttribute('data-pm-font-zoom')).toBe('1.4');
  });
});
