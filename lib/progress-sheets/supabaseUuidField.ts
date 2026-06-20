import type { ProgressColumn } from '../types';

/** Stable column id for the Supabase primary-key slot on every progress sheet row. */
export const PROGRESS_ROW_UUID_FIELD_ID = 'uuid';

export const PROGRESS_ROW_UUID_FIELD_LABEL = 'UUID';

export function createProgressUuidColumn(): ProgressColumn {
  return {
    id: PROGRESS_ROW_UUID_FIELD_ID,
    label: PROGRESS_ROW_UUID_FIELD_LABEL,
    fieldType: 'uuid',
    order: 0,
    required: true,
    visible: true,
  };
}

export function isProgressUuidField(fieldId: string): boolean {
  return fieldId === PROGRESS_ROW_UUID_FIELD_ID;
}

/** Ensures the Supabase UUID column is present and pinned as the first column. */
export function ensureProgressUuidFirstColumn(columns: ProgressColumn[]): ProgressColumn[] {
  const rest = columns
    .filter((column) => !isProgressUuidField(column.id))
    .sort((a, b) => a.order - b.order);

  return [
    createProgressUuidColumn(),
    ...rest.map((column, index) => ({ ...column, order: index + 1 })),
  ];
}
