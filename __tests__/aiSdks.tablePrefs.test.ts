import { describe, expect, it } from 'vitest';
import {
  normalizeTableView,
  MIN_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  MIN_ROW_HEIGHT,
  MAX_ROW_HEIGHT,
} from '../app/ui/views/AiSdks/useAiSdksTablePrefs';

const ARGS = {
  storageKey: 'test',
  columnIds: ['col-id', 'col-provider', 'col-model', 'col-type', 'col-param-temperature'],
  rowIds: ['anthropic:claude-opus-4-7', 'anthropic:claude-sonnet-4-6'],
  defaultSizing: { 'col-id': 220 },
  defaultFrozenColumnIds: ['col-id'],
};

describe('normalizeTableView', () => {
  it('returns defaults for non-object input', () => {
    const v = normalizeTableView(null, ARGS);
    expect(v.density).toBe('comfortable');
    expect(v.typeFilter).toBe('all');
    expect(v.frozenColumnIds).toEqual(['col-id']);
    expect(v.sorting).toEqual([]);
    expect(v.hiddenRowIds).toEqual([]);
  });

  it('clamps column widths and row heights to bounds', () => {
    const v = normalizeTableView(
      {
        columnSizing: { 'col-id': 5000, 'col-model': 10 },
        rowHeightById: { 'anthropic:claude-opus-4-7': 9000, 'anthropic:claude-sonnet-4-6': 1 },
      },
      ARGS,
    );
    expect(v.columnSizing['col-id']).toBe(MAX_COLUMN_WIDTH);
    expect(v.columnSizing['col-model']).toBe(MIN_COLUMN_WIDTH);
    expect(v.rowHeightById['anthropic:claude-opus-4-7']).toBe(MAX_ROW_HEIGHT);
    expect(v.rowHeightById['anthropic:claude-sonnet-4-6']).toBe(MIN_ROW_HEIGHT);
  });

  it('drops unknown column/row ids and dedupes', () => {
    const v = normalizeTableView(
      {
        frozenColumnIds: ['col-id', 'col-id', 'ghost-col'],
        sorting: [{ id: 'col-model', desc: true }, { id: 'ghost', desc: false }],
        hiddenRowIds: ['anthropic:claude-opus-4-7', 'ghost-row', 'anthropic:claude-opus-4-7'],
        rowHeightById: { 'ghost-row': 50 },
      },
      ARGS,
    );
    expect(v.frozenColumnIds).toEqual(['col-id']);
    expect(v.sorting).toEqual([{ id: 'col-model', desc: true }]);
    expect(v.hiddenRowIds).toEqual(['anthropic:claude-opus-4-7']);
    expect(v.rowHeightById).toEqual({});
  });

  it('falls back to comfortable density and all-types for garbage values', () => {
    const v = normalizeTableView({ density: 'gigantic', typeFilter: 42 }, ARGS);
    expect(v.density).toBe('comfortable');
    expect(v.typeFilter).toBe('all');
  });

  it('keeps a valid stored view intact', () => {
    const v = normalizeTableView(
      {
        columnVisibility: { 'col-param-temperature': false },
        sorting: [{ id: 'col-id', desc: false }],
        typeFilter: 'VLM',
        density: 'compact',
      },
      ARGS,
    );
    expect(v.columnVisibility['col-param-temperature']).toBe(false);
    expect(v.columnVisibility['col-id']).toBe(true);
    expect(v.sorting).toEqual([{ id: 'col-id', desc: false }]);
    expect(v.typeFilter).toBe('VLM');
    expect(v.density).toBe('compact');
  });
});
