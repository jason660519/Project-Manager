import { isUuid, uuidv5 } from '../aiSdks/uuid';
import type { ProgressRow } from '../types';
import {
  isProgressUuidField,
  PROGRESS_ROW_UUID_FIELD_ID,
} from './supabaseUuidField';

/** Namespace for generated progress-row UUIDs when crypto.randomUUID is unavailable. */
export const PROGRESS_ROW_UUID_NAMESPACE = '2b8f4c1e-9a3d-4f6e-b5c0-8d1e2f3a4b5c';

export type ProgressRowUuidGenerator = () => string;

export function createProgressRowSupabaseUuid(
  generator: ProgressRowUuidGenerator = defaultProgressRowUuidGenerator,
): string {
  return generator();
}

function defaultProgressRowUuidGenerator(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return uuidv5(`${Date.now()}:${Math.random()}`, PROGRESS_ROW_UUID_NAMESPACE);
}

function readStoredUuid(row: ProgressRow): string | undefined {
  const raw = row.values[PROGRESS_ROW_UUID_FIELD_ID];
  return typeof raw === 'string' && isUuid(raw) ? raw : undefined;
}

/** Read-only: returns a Supabase PK UUID already stored on the row, if any. */
export function readProgressRowSupabaseUuid(row: ProgressRow): string | null {
  return readStoredUuid(row) ?? (isUuid(row.id) ? row.id : null);
}

/** Ensures `values.uuid` is set for Supabase sync without changing human row ids. */
export function ensureProgressRowSupabaseUuid(
  row: ProgressRow,
  generator: ProgressRowUuidGenerator = defaultProgressRowUuidGenerator,
): ProgressRow {
  const existing = readStoredUuid(row);
  if (existing) {
    return row;
  }

  const uuid = isUuid(row.id) ? row.id : createProgressRowSupabaseUuid(generator);
  return {
    ...row,
    values: {
      ...row.values,
      [PROGRESS_ROW_UUID_FIELD_ID]: uuid,
    },
  };
}

export function syncProgressSheetRowUuids(
  rows: ProgressRow[],
  generator?: ProgressRowUuidGenerator,
): ProgressRow[] {
  return rows.map((row) => ensureProgressRowSupabaseUuid(row, generator));
}

/** Column accessor helper: uuid field reads the Supabase PK slot, not arbitrary ids. */
export function progressRowColumnValue(row: ProgressRow, columnId: string): unknown {
  if (isProgressUuidField(columnId)) {
    return readProgressRowSupabaseUuid(row) ?? '—';
  }
  if (Object.prototype.hasOwnProperty.call(row.values, columnId)) {
    return row.values[columnId];
  }
  switch (columnId) {
    case 'id':
      return row.id;
    case 'title':
      return row.title;
    case 'status':
      return row.status;
    case 'owner':
      return row.owner;
    case 'progress':
      return row.progress;
    default:
      return undefined;
  }
}
