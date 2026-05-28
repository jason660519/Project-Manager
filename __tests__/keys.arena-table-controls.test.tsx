import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  parseModelRowsFromText,
  useArenaTablePrefs,
  validateImportedModels,
} from '../app/ui/views/Keys/ArenaTableViewControls';

const STORAGE_KEY = 'projectManager.test.arenaTablePrefs';

function PrefsHarness() {
  const prefs = useArenaTablePrefs({
    storageKey: STORAGE_KEY,
    columnIds: ['col-a', 'col-b'],
    defaultSizing: { 'col-a': 120, 'col-b': 180 },
    defaultFrozenColumnIds: ['col-a'],
  });
  return (
    <pre data-testid="prefs">
      {JSON.stringify({
        columnSizing: prefs.columnSizing,
        columnVisibility: prefs.columnVisibility,
        frozenColumnIds: prefs.frozenColumnIds,
      })}
    </pre>
  );
}

describe('Keys / Arena table controls', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('parses JSON and CSV provider/model row imports', () => {
    expect(parseModelRowsFromText('[{"provider":"openai","model":"gpt-5"}]')).toEqual([
      { provider: 'openai', model: 'gpt-5' },
    ]);

    expect(parseModelRowsFromText('provider,model\nanthropic,claude-opus-4-1\nopenai,o1')).toEqual([
      { provider: 'anthropic', model: 'claude-opus-4-1' },
      { provider: 'openai', model: 'o1' },
    ]);
  });

  it('keeps only supported imported models and respects the row cap', () => {
    const rows = validateImportedModels(
      [
        { provider: 'openai', model: 'gpt-5' },
        { provider: 'openai', model: 'gpt-5' },
        { provider: 'openai', model: 'missing' },
        { provider: 'anthropic', model: 'claude-opus-4-1' },
      ],
      [
        { id: 'openai', availableModels: ['gpt-5'] },
        { id: 'anthropic', availableModels: ['claude-opus-4-1'] },
      ],
      1,
    );

    expect(rows).toEqual([{ provider: 'openai', model: 'gpt-5' }]);
  });

  it('normalizes persisted column preferences by canonical column ids', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        columnSizing: { 'col-a': 10, 'col-b': 9999, stale: 300 },
        columnVisibility: { 'col-a': false, stale: false },
        frozenColumnIds: ['stale', 'col-b', 'col-b', 'col-a'],
      }),
    );

    render(<PrefsHarness />);

    const prefs = JSON.parse(screen.getByTestId('prefs').textContent ?? '{}');
    expect(prefs.columnSizing).toEqual({ 'col-a': 56, 'col-b': 720 });
    expect(prefs.columnVisibility).toEqual({ 'col-a': false, 'col-b': true });
    expect(prefs.frozenColumnIds).toEqual(['col-b', 'col-a']);
  });
});
