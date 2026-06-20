import type { ProgressColumn, ProgressFieldType, ProgressSheetConfig } from '../types';
import { BUILT_IN_PROGRESS_TEMPLATES } from './templates';
import {
  ensureProgressUuidFirstColumn,
  isProgressUuidField,
  PROGRESS_ROW_UUID_FIELD_ID,
} from './supabaseUuidField';

export const TEMPLATE_FIELD_PREFS_STORAGE_KEY =
  'projectManager.progressDashboard.templateFieldOverrides';

export const TEMPLATE_FIELD_PREFS_CHANGED_EVENT = 'pm:template-fields-changed';

/** @deprecated Legacy key — migrated into {@link TEMPLATE_FIELD_PREFS_STORAGE_KEY} on read. */
export const DEVELOPMENT_FIELD_PREFS_STORAGE_KEY =
  'projectManager.progressDashboard.developmentFieldOverrides';

export const DEVELOPMENT_FIELD_PREFS_CHANGED_EVENT = TEMPLATE_FIELD_PREFS_CHANGED_EVENT;

export const DEVELOPMENT_TEMPLATE_ID = 'software-desktop-app';

export const PROGRESS_FIELD_TYPE_OPTIONS: ReadonlyArray<{ value: ProgressFieldType; label: string }> = [
  { value: 'uuid', label: 'UUID' },
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
  { value: 'multiSelect', label: 'Multi-select' },
  { value: 'tag', label: 'Tag' },
  { value: 'person', label: 'Person' },
  { value: 'percent', label: 'Percent' },
  { value: 'link', label: 'Link' },
  { value: 'file', label: 'File' },
];

const SUPPORTED_FIELD_TYPES = new Set<ProgressFieldType>(
  PROGRESS_FIELD_TYPE_OPTIONS.map((option) => option.value),
);

interface TemplateFieldStore {
  version: 1;
  templates: Record<string, ProgressColumn[]>;
}

function cloneColumns(columns: ProgressColumn[]): ProgressColumn[] {
  return columns.map((column) => ({
    ...column,
    options: column.options?.map((option) => ({ ...option })),
  }));
}

export function builtInTemplateIds(): string[] {
  return BUILT_IN_PROGRESS_TEMPLATES.map((template) => template.id);
}

export function isBuiltInTemplateId(templateId: string): boolean {
  return BUILT_IN_PROGRESS_TEMPLATES.some((template) => template.id === templateId);
}

export function defaultTemplateFieldColumns(templateId: string): ProgressColumn[] {
  const template = BUILT_IN_PROGRESS_TEMPLATES.find((candidate) => candidate.id === templateId);
  return cloneColumns(template?.fields ?? []);
}

export function protectedFieldIdsForTemplate(templateId: string): Set<string> {
  const template = BUILT_IN_PROGRESS_TEMPLATES.find((candidate) => candidate.id === templateId);
  const requiredIds = template?.fields.filter((field) => field.required).map((field) => field.id) ?? [];
  return new Set([PROGRESS_ROW_UUID_FIELD_ID, ...requiredIds]);
}

/** @deprecated Use {@link protectedFieldIdsForTemplate}. */
export const PROTECTED_DEVELOPMENT_FIELD_IDS = protectedFieldIdsForTemplate(DEVELOPMENT_TEMPLATE_ID);

function slugifyFieldId(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'field';
}

export function createUniqueFieldId(label: string, existingIds: ReadonlySet<string>): string {
  const base = slugifyFieldId(label);
  if (!existingIds.has(base)) return base;
  let index = 2;
  while (existingIds.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

function normalizeColumn(input: unknown, fallbackOrder: number): ProgressColumn | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<ProgressColumn>;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.label !== 'string' || !raw.label.trim()) return null;
  if (typeof raw.fieldType !== 'string' || !SUPPORTED_FIELD_TYPES.has(raw.fieldType as ProgressFieldType)) {
    return null;
  }
  const order = typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : fallbackOrder;
  return {
    id: raw.id.trim(),
    label: raw.label.trim(),
    fieldType: raw.fieldType as ProgressFieldType,
    order,
    visible: raw.visible !== false,
    required: raw.required === true,
    defaultValue: raw.defaultValue,
    options: Array.isArray(raw.options)
      ? raw.options.filter(
        (option): option is NonNullable<ProgressColumn['options']>[number] => (
          !!option
          && typeof option.id === 'string'
          && typeof option.label === 'string'
        ),
      ).map((option) => ({ ...option }))
      : undefined,
  };
}

export function normalizeTemplateFieldColumns(
  templateId: string,
  input: unknown,
): ProgressColumn[] {
  if (!isBuiltInTemplateId(templateId)) return [];

  if (!Array.isArray(input)) return defaultTemplateFieldColumns(templateId);

  const seen = new Set<string>();
  const normalized: ProgressColumn[] = [];
  input.forEach((item, index) => {
    const column = normalizeColumn(item, index);
    if (!column || seen.has(column.id)) return;
    seen.add(column.id);
    normalized.push(column);
  });

  if (normalized.length === 0) return defaultTemplateFieldColumns(templateId);

  return ensureProgressUuidFirstColumn(
    normalized
      .sort((a, b) => a.order - b.order)
      .map((column, index) => ({ ...column, order: index })),
  );
}

function emptyStore(): TemplateFieldStore {
  return { version: 1, templates: {} };
}

function readLegacyDevelopmentStore(): TemplateFieldStore['templates'] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DEVELOPMENT_FIELD_PREFS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { templateId?: string; columns?: unknown };
    if (parsed.templateId !== DEVELOPMENT_TEMPLATE_ID) return null;
    return {
      [DEVELOPMENT_TEMPLATE_ID]: normalizeTemplateFieldColumns(
        DEVELOPMENT_TEMPLATE_ID,
        parsed.columns,
      ),
    };
  } catch {
    return null;
  }
}

function readStore(): TemplateFieldStore {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = window.localStorage.getItem(TEMPLATE_FIELD_PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TemplateFieldStore>;
      if (parsed.version === 1 && parsed.templates && typeof parsed.templates === 'object') {
        const templates: Record<string, ProgressColumn[]> = {};
        for (const [templateId, columns] of Object.entries(parsed.templates)) {
          if (!isBuiltInTemplateId(templateId)) continue;
          templates[templateId] = normalizeTemplateFieldColumns(templateId, columns);
        }
        return { version: 1, templates };
      }
    }
  } catch {
    /* fall through to legacy migration */
  }

  const legacy = readLegacyDevelopmentStore();
  if (legacy) {
    const migrated = { version: 1 as const, templates: legacy };
    writeStore(migrated);
    window.localStorage.removeItem(DEVELOPMENT_FIELD_PREFS_STORAGE_KEY);
    return migrated;
  }

  return emptyStore();
}

function writeStore(store: TemplateFieldStore): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TEMPLATE_FIELD_PREFS_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(TEMPLATE_FIELD_PREFS_CHANGED_EVENT));
}

export function readStoredTemplateFieldColumns(templateId: string): ProgressColumn[] {
  if (!isBuiltInTemplateId(templateId)) return [];
  const store = readStore();
  return store.templates[templateId] ?? defaultTemplateFieldColumns(templateId);
}

export function hasStoredTemplateFieldColumns(templateId: string): boolean {
  if (!isBuiltInTemplateId(templateId)) return false;
  if (typeof window === 'undefined') return false;
  const store = readStore();
  return Object.prototype.hasOwnProperty.call(store.templates, templateId);
}

export function persistTemplateFieldColumns(templateId: string, columns: ProgressColumn[]): void {
  if (!isBuiltInTemplateId(templateId)) return;
  const store = readStore();
  store.templates[templateId] = normalizeTemplateFieldColumns(templateId, columns);
  writeStore(store);
}

export function clearStoredTemplateFieldColumns(templateId: string): void {
  if (!isBuiltInTemplateId(templateId)) return;
  const store = readStore();
  delete store.templates[templateId];
  writeStore(store);
}

export function resolveProgressSheetTemplateId(config: ProgressSheetConfig | null | undefined): string | null {
  if (!config) return null;
  return config.templateSnapshot.id;
}

export function isBuiltInProgressSheet(config: ProgressSheetConfig | null | undefined): boolean {
  const templateId = resolveProgressSheetTemplateId(config);
  return templateId ? isBuiltInTemplateId(templateId) : false;
}

/** @deprecated Use {@link isBuiltInProgressSheet}. */
export function isDevelopmentProgressSheet(config: ProgressSheetConfig | null | undefined): boolean {
  return isBuiltInProgressSheet(config);
}

export function applyTemplateFieldColumns(
  config: ProgressSheetConfig,
  columns: ProgressColumn[],
): ProgressSheetConfig {
  const templateId = resolveProgressSheetTemplateId(config);
  if (!templateId) return config;
  return {
    ...config,
    columns: cloneColumns(normalizeTemplateFieldColumns(templateId, columns)),
  };
}

/** @deprecated Use {@link applyTemplateFieldColumns}. */
export function applyDevelopmentFieldColumns(
  config: ProgressSheetConfig,
  columns: ProgressColumn[],
): ProgressSheetConfig {
  return applyTemplateFieldColumns(config, columns);
}

export function moveTemplateField(
  templateId: string,
  columns: ProgressColumn[],
  fieldId: string,
  direction: 'up' | 'down',
): ProgressColumn[] {
  if (isProgressUuidField(fieldId)) {
    return normalizeTemplateFieldColumns(templateId, columns);
  }

  const ordered = normalizeTemplateFieldColumns(templateId, columns);
  const index = ordered.findIndex((column) => column.id === fieldId);
  if (index < 0) return ordered;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ordered.length) return ordered;
  if (isProgressUuidField(ordered[targetIndex]!.id)) return ordered;

  const next = [...ordered];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return normalizeTemplateFieldColumns(
    templateId,
    next.map((column, orderIndex) => ({ ...column, order: orderIndex })),
  );
}

export function addTemplateField(
  templateId: string,
  columns: ProgressColumn[],
  label: string,
  fieldType: ProgressFieldType,
): ProgressColumn[] {
  const trimmed = label.trim();
  if (!trimmed) return normalizeTemplateFieldColumns(templateId, columns);
  const ordered = normalizeTemplateFieldColumns(templateId, columns);
  const existingIds = new Set(ordered.map((column) => column.id));
  const id = createUniqueFieldId(trimmed, existingIds);
  return normalizeTemplateFieldColumns(templateId, [
    ...ordered,
    {
      id,
      label: trimmed,
      fieldType,
      order: ordered.length,
      visible: true,
    },
  ]);
}

export function updateTemplateField(
  templateId: string,
  columns: ProgressColumn[],
  fieldId: string,
  patch: Partial<Pick<ProgressColumn, 'label' | 'fieldType' | 'visible' | 'required'>>,
): ProgressColumn[] {
  if (isProgressUuidField(fieldId)) {
    return normalizeTemplateFieldColumns(templateId, columns);
  }

  return normalizeTemplateFieldColumns(
    templateId,
    columns.map((column) => (
      column.id === fieldId
        ? {
          ...column,
          ...patch,
          label: patch.label?.trim() ? patch.label.trim() : column.label,
        }
        : column
    )),
  );
}

export function removeTemplateField(
  templateId: string,
  columns: ProgressColumn[],
  fieldId: string,
): ProgressColumn[] {
  if (protectedFieldIdsForTemplate(templateId).has(fieldId)) {
    return normalizeTemplateFieldColumns(templateId, columns);
  }
  return normalizeTemplateFieldColumns(
    templateId,
    columns.filter((column) => column.id !== fieldId),
  );
}

// ── Back-compat aliases (software-desktop-app only) ─────────────────────────

export function defaultDevelopmentFieldColumns(): ProgressColumn[] {
  return defaultTemplateFieldColumns(DEVELOPMENT_TEMPLATE_ID);
}

export function normalizeDevelopmentFieldColumns(input: unknown): ProgressColumn[] {
  return normalizeTemplateFieldColumns(DEVELOPMENT_TEMPLATE_ID, input);
}

export function readStoredDevelopmentFieldColumns(): ProgressColumn[] {
  return readStoredTemplateFieldColumns(DEVELOPMENT_TEMPLATE_ID);
}

export function persistDevelopmentFieldColumns(columns: ProgressColumn[]): void {
  persistTemplateFieldColumns(DEVELOPMENT_TEMPLATE_ID, columns);
}

export function clearStoredDevelopmentFieldColumns(): void {
  clearStoredTemplateFieldColumns(DEVELOPMENT_TEMPLATE_ID);
}

export function moveDevelopmentField(
  columns: ProgressColumn[],
  fieldId: string,
  direction: 'up' | 'down',
): ProgressColumn[] {
  return moveTemplateField(DEVELOPMENT_TEMPLATE_ID, columns, fieldId, direction);
}

export function addDevelopmentField(
  columns: ProgressColumn[],
  label: string,
  fieldType: ProgressFieldType,
): ProgressColumn[] {
  return addTemplateField(DEVELOPMENT_TEMPLATE_ID, columns, label, fieldType);
}

export function updateDevelopmentField(
  columns: ProgressColumn[],
  fieldId: string,
  patch: Partial<Pick<ProgressColumn, 'label' | 'fieldType' | 'visible' | 'required'>>,
): ProgressColumn[] {
  return updateTemplateField(DEVELOPMENT_TEMPLATE_ID, columns, fieldId, patch);
}

export function removeDevelopmentField(
  columns: ProgressColumn[],
  fieldId: string,
): ProgressColumn[] {
  return removeTemplateField(DEVELOPMENT_TEMPLATE_ID, columns, fieldId);
}
