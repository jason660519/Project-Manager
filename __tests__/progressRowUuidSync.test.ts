import { describe, expect, it } from 'vitest';
import type { ProgressRow } from '../lib/types';
import {
  ensureProgressRowSupabaseUuid,
  progressRowColumnValue,
  readProgressRowSupabaseUuid,
  syncProgressSheetRowUuids,
} from '../lib/progress-sheets/progressRowUuidSync';
import { PROGRESS_ROW_UUID_FIELD_ID } from '../lib/progress-sheets/supabaseUuidField';

const FIXED_UUID = '11111111-1111-4111-8111-111111111111';

function row(partial: Partial<ProgressRow> & Pick<ProgressRow, 'id' | 'title'>): ProgressRow {
  return {
    status: 'todo',
    values: {},
    createdAt: '2026-06-21T00:00:00.000Z',
    updatedAt: '2026-06-21T00:00:00.000Z',
    ...partial,
  };
}

describe('progress row Supabase UUID sync', () => {
  it('reads values.uuid when present', () => {
    const source = row({
      id: 'F01',
      title: 'Feature',
      values: { [PROGRESS_ROW_UUID_FIELD_ID]: FIXED_UUID },
    });

    expect(readProgressRowSupabaseUuid(source)).toBe(FIXED_UUID);
    expect(progressRowColumnValue(source, PROGRESS_ROW_UUID_FIELD_ID)).toBe(FIXED_UUID);
  });

  it('falls back to row.id when it is already a UUID', () => {
    const source = row({ id: FIXED_UUID, title: 'Feature' });
    expect(readProgressRowSupabaseUuid(source)).toBe(FIXED_UUID);
  });

  it('ensures values.uuid without overwriting human row ids', () => {
    const source = row({ id: 'F01', title: 'Feature' });
    const next = ensureProgressRowSupabaseUuid(source, () => FIXED_UUID);

    expect(next.id).toBe('F01');
    expect(next.values[PROGRESS_ROW_UUID_FIELD_ID]).toBe(FIXED_UUID);
  });

  it('syncs every row in a sheet batch', () => {
    const rows = [
      row({ id: 'F01', title: 'One' }),
      row({
        id: 'F02',
        title: 'Two',
        values: { [PROGRESS_ROW_UUID_FIELD_ID]: FIXED_UUID },
      }),
    ];

    const synced = syncProgressSheetRowUuids(rows, () => '22222222-2222-4222-8222-222222222222');

    expect(synced[0]?.values[PROGRESS_ROW_UUID_FIELD_ID]).toBe('22222222-2222-4222-8222-222222222222');
    expect(synced[1]?.values[PROGRESS_ROW_UUID_FIELD_ID]).toBe(FIXED_UUID);
  });
});
