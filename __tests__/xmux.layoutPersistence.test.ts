import { describe, expect, it, vi } from 'vitest';
import { createInitialLayout } from '../components/terminal/blockLayout';
import {
  loadPersistedXmuxLayout,
  savePersistedXmuxLayout,
  XMUX_LAYOUT_STORAGE_KEY,
} from '../lib/xmux/layoutPersistence';

describe('xmux layout persistence', () => {
  it('saves and loads a valid workspace layout snapshot', () => {
    const layout = createInitialLayout('http://localhost:43187/', '/tmp/project-manager');

    expect(savePersistedXmuxLayout('project-manager', layout)).toBe(true);
    expect(loadPersistedXmuxLayout('project-manager')).toEqual(layout);
  });

  it('falls back when stored JSON is corrupt or from an incompatible version', () => {
    window.localStorage.setItem(XMUX_LAYOUT_STORAGE_KEY, '{broken-json');
    expect(loadPersistedXmuxLayout('project-manager')).toBeNull();

    window.localStorage.setItem(
      XMUX_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        version: 0,
        workspaces: {
          'project-manager': {
            savedAt: '2026-05-27T00:00:00.000Z',
            layout: createInitialLayout('http://localhost:43187/', '/tmp/project-manager'),
          },
        },
      }),
    );

    expect(loadPersistedXmuxLayout('project-manager')).toBeNull();
  });

  it('does not throw when localStorage rejects the snapshot write', () => {
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = vi.fn(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(
      savePersistedXmuxLayout(
        'project-manager',
        createInitialLayout('http://localhost:43187/', '/tmp/project-manager'),
      ),
    ).toBe(false);

    window.localStorage.setItem = originalSetItem;
  });
});
