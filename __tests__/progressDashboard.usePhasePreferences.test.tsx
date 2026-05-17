import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePhasePreferences } from '../app/project-progress-dashboard/_lib/usePhasePreferences';

const STORAGE_PREFIX = 'projectManager.progressDashboard.phase.';

describe('usePhasePreferences', () => {
  it('seeds defaults on first read', () => {
    const { result } = renderHook(() => usePhasePreferences('development'));
    expect(result.current.prefs.colWidths.length).toBeGreaterThan(0);
    expect(result.current.prefs.customRows).toEqual([]);
    expect(result.current.prefs.hiddenRowKeys).toEqual([]);
  });

  it('persists patches to localStorage under the phase-specific key', () => {
    const { result } = renderHook(() => usePhasePreferences('testing'));

    act(() => {
      result.current.patch({
        customRows: [{ rowId: 'C-1', name: 'demo', category: 'Custom', percentage: 25, phase: 'testing' }],
      });
    });

    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}testing`);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).customRows[0].rowId).toBe('C-1');
  });

  it('reset wipes storage and restores defaults', () => {
    const { result } = renderHook(() => usePhasePreferences('deployment'));
    act(() => {
      result.current.patch({ hiddenRowKeys: ['feature::F01'] });
    });
    expect(window.localStorage.getItem(`${STORAGE_PREFIX}deployment`)).not.toBeNull();

    act(() => result.current.reset());

    expect(window.localStorage.getItem(`${STORAGE_PREFIX}deployment`)).toBeNull();
    expect(result.current.prefs.hiddenRowKeys).toEqual([]);
  });

  it('falls back to defaults when localStorage contains malformed JSON', () => {
    // Simulate a previous tab leaving garbage in storage.
    window.localStorage.setItem(`${STORAGE_PREFIX}operations`, '{not json');
    const { result } = renderHook(() => usePhasePreferences('operations'));
    expect(result.current.prefs.customRows).toEqual([]);
    expect(result.current.prefs.colWidths.length).toBeGreaterThan(0);
  });

  it('ignores a stored colWidths array of the wrong length — protects against schema drift', () => {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}development`,
      JSON.stringify({ colWidths: [1, 2] /* too short on purpose */, customRows: [] }),
    );
    const { result } = renderHook(() => usePhasePreferences('development'));
    expect(result.current.prefs.colWidths.length).toBeGreaterThan(2);
  });
});
