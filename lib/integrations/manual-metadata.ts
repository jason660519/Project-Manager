import type { IntegrationManualFields, IntegrationManualStore, IntegrationRow } from './types';

const STORAGE_KEY = 'projectManager.personal.integrationsManual';

function readStore(): IntegrationManualStore {
  if (typeof window === 'undefined') {
    return { schemaVersion: 1, entries: {} };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { schemaVersion: 1, entries: {} };
    const parsed = JSON.parse(raw) as IntegrationManualStore;
    if (parsed?.schemaVersion !== 1 || typeof parsed.entries !== 'object') {
      return { schemaVersion: 1, entries: {} };
    }
    return parsed;
  } catch {
    return { schemaVersion: 1, entries: {} };
  }
}

function writeStore(store: IntegrationManualStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

export function loadManualFields(rowKey: string): IntegrationManualFields {
  return readStore().entries[rowKey] ?? {};
}

export function saveManualFields(rowKey: string, fields: IntegrationManualFields): void {
  const store = readStore();
  const next = { ...store.entries[rowKey], ...fields };
  if (
    next.lv === undefined &&
    !next.notes &&
    !next.category1Override &&
    !next.category2Override &&
    !next.companyOverride
  ) {
    const { [rowKey]: _, ...rest } = store.entries;
    writeStore({ schemaVersion: 1, entries: rest });
    return;
  }
  writeStore({ schemaVersion: 1, entries: { ...store.entries, [rowKey]: next } });
}

export function loadAllManualFields(): Record<string, IntegrationManualFields> {
  return readStore().entries;
}

/** Merge manual overrides into a row (manual wins for editable display fields). */
export function mergeManualIntoRow(
  row: IntegrationRow,
  manual?: IntegrationManualFields,
): IntegrationRow {
  if (!manual) return row;
  return {
    ...row,
    lv: manual.lv ?? row.lv,
    notes: manual.notes ?? row.notes,
    category1: manual.category1Override || row.category1,
    category2: manual.category2Override || row.category2,
    company: manual.companyOverride || row.company,
  };
}

export function mergeAllManual(rows: IntegrationRow[]): IntegrationRow[] {
  const all = loadAllManualFields();
  return rows.map((r) => mergeManualIntoRow(r, all[r.rowKey]));
}
