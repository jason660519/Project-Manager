import type {
  ProgressColumn,
  ProgressDiscipline,
  ProgressFieldType,
  ProgressOption,
} from '../types';
import { ensureProgressUuidFirstColumn } from './supabaseUuidField';
import { BUILT_IN_PROGRESS_TEMPLATES, type BuiltInProgressTemplate } from './templates';

export interface ProgressTemplateDefinition extends BuiltInProgressTemplate {
  systemDefaultFields?: ProgressColumn[];
  userDefaultFields?: ProgressColumn[];
  userDefaultSavedAt?: string;
}

export const CUSTOM_PROGRESS_TEMPLATES_STORAGE_KEY =
  'projectManager.progressDashboard.customTemplates';
export const CUSTOM_PROGRESS_TEMPLATES_CHANGED_EVENT = 'pm:progress-templates-changed';

interface CustomTemplateStore {
  version: 1;
  templates: ProgressTemplateDefinition[];
}

const SUPPORTED_DISCIPLINES = new Set<ProgressDiscipline>([
  'software',
  'hardware-rd',
  'industrial-design',
  'project-operations',
  'marketing-campaign',
  'content-production',
  'qa-validation',
  'construction-field',
  'procurement-vendor',
  'custom',
]);

const SUPPORTED_FIELD_TYPES = new Set<ProgressFieldType>([
  'uuid',
  'text',
  'number',
  'date',
  'select',
  'multiSelect',
  'tag',
  'person',
  'percent',
  'link',
  'file',
]);

const DEFAULT_STATUS_OPTIONS: ProgressOption[] = [
  { id: 'not-started', label: 'Not Started', color: 'neutral' },
  { id: 'in-progress', label: 'In Progress', color: 'blue' },
  { id: 'blocked', label: 'Blocked', color: 'red' },
  { id: 'in-review', label: 'In Review', color: 'amber' },
  { id: 'complete', label: 'Complete', color: 'green' },
];

function emptyStore(): CustomTemplateStore {
  return { version: 1, templates: [] };
}

function cloneOptions(options: ProgressOption[]): ProgressOption[] {
  return options.map((option) => ({ ...option }));
}

function cloneColumns(columns: ProgressColumn[]): ProgressColumn[] {
  return columns.map((column) => ({
    ...column,
    options: column.options ? cloneOptions(column.options) : undefined,
  }));
}

function cloneTemplate(template: ProgressTemplateDefinition): ProgressTemplateDefinition {
  return {
    ...template,
    fields: cloneColumns(template.fields),
    statusOptions: cloneOptions(template.statusOptions),
    phaseOptions: template.phaseOptions ? cloneOptions(template.phaseOptions) : undefined,
    systemDefaultFields: template.systemDefaultFields
      ? cloneColumns(template.systemDefaultFields)
      : undefined,
    userDefaultFields: template.userDefaultFields
      ? cloneColumns(template.userDefaultFields)
      : undefined,
  };
}

function normalizeColumns(input: unknown): ProgressColumn[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return ensureProgressUuidFirstColumn(
    input
      .map((field, index) => normalizeColumn(field, index))
      .filter((field): field is ProgressColumn => field != null)
      .filter((field) => {
        if (seen.has(field.id)) return false;
        seen.add(field.id);
        return true;
      })
      .sort((a, b) => a.order - b.order)
      .map((field, index) => ({ ...field, order: index })),
  );
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueTemplateId(label: string, existingIds: ReadonlySet<string>): string {
  const base = slugify(label) || 'custom-template';
  if (!existingIds.has(base)) return base;
  let suffix = 2;
  while (existingIds.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

function normalizeOption(input: unknown, fallbackId: string): ProgressOption | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<ProgressOption>;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : fallbackId;
  const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : null;
  if (!label) return null;
  return {
    id,
    label,
    color: typeof raw.color === 'string' && raw.color.trim() ? raw.color.trim() : undefined,
  };
}

function normalizeColumn(input: unknown, fallbackOrder: number): ProgressColumn | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<ProgressColumn>;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.label !== 'string' || !raw.label.trim()) return null;
  if (typeof raw.fieldType !== 'string' || !SUPPORTED_FIELD_TYPES.has(raw.fieldType as ProgressFieldType)) {
    return null;
  }
  const options = Array.isArray(raw.options)
    ? raw.options
      .map((option, index) => normalizeOption(option, `${raw.id}-option-${index + 1}`))
      .filter((option): option is ProgressOption => option != null)
    : undefined;
  return {
    id: raw.id.trim(),
    label: raw.label.trim(),
    fieldType: raw.fieldType as ProgressFieldType,
    order: typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : fallbackOrder,
    visible: raw.visible !== false,
    required: raw.required === true,
    defaultValue: raw.defaultValue,
    options: options && options.length > 0 ? options : undefined,
  };
}

function normalizeTemplate(input: unknown): ProgressTemplateDefinition | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<ProgressTemplateDefinition>;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.label !== 'string' || !raw.label.trim()) return null;
  if (typeof raw.sheetTitle !== 'string' || !raw.sheetTitle.trim()) return null;

  const discipline =
    typeof raw.discipline === 'string' && SUPPORTED_DISCIPLINES.has(raw.discipline as ProgressDiscipline)
      ? raw.discipline as ProgressDiscipline
      : 'custom';

  const fields = normalizeColumns(raw.fields);
  if (fields.length === 0) return null;
  const systemDefaultFields = normalizeColumns(raw.systemDefaultFields);
  const userDefaultFields = normalizeColumns(raw.userDefaultFields);

  const statusOptions = Array.isArray(raw.statusOptions)
    ? raw.statusOptions
      .map((option, index) => normalizeOption(option, `status-${index + 1}`))
      .filter((option): option is ProgressOption => option != null)
    : [];

  const phaseOptions = Array.isArray(raw.phaseOptions)
    ? raw.phaseOptions
      .map((option, index) => normalizeOption(option, `phase-${index + 1}`))
      .filter((option): option is ProgressOption => option != null)
    : undefined;

  return {
    id: raw.id.trim(),
    label: raw.label.trim(),
    sheetTitle: raw.sheetTitle.trim(),
    discipline,
    version:
      typeof raw.version === 'number' && Number.isFinite(raw.version) && raw.version > 0
        ? Math.floor(raw.version)
        : 1,
    fields,
    statusOptions: statusOptions.length > 0 ? statusOptions : cloneOptions(DEFAULT_STATUS_OPTIONS),
    phaseOptions: phaseOptions && phaseOptions.length > 0 ? phaseOptions : undefined,
    systemDefaultFields: systemDefaultFields.length > 0 ? systemDefaultFields : cloneColumns(fields),
    userDefaultFields: userDefaultFields.length > 0 ? userDefaultFields : cloneColumns(fields),
    userDefaultSavedAt: typeof raw.userDefaultSavedAt === 'string' ? raw.userDefaultSavedAt : undefined,
  };
}

function readStore(): CustomTemplateStore {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = window.localStorage.getItem(CUSTOM_PROGRESS_TEMPLATES_STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<CustomTemplateStore>;
    if (parsed.version !== 1 || !Array.isArray(parsed.templates)) return emptyStore();
    const seen = new Set<string>();
    const templates = parsed.templates
      .map((template) => normalizeTemplate(template))
      .filter((template): template is ProgressTemplateDefinition => template != null)
      .filter((template) => {
        if (isBuiltInTemplateId(template.id) || seen.has(template.id)) return false;
        seen.add(template.id);
        return true;
      });
    return { version: 1, templates };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: CustomTemplateStore): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CUSTOM_PROGRESS_TEMPLATES_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(CUSTOM_PROGRESS_TEMPLATES_CHANGED_EVENT));
}

export function isBuiltInTemplateId(templateId: string): boolean {
  return BUILT_IN_PROGRESS_TEMPLATES.some((template) => template.id === templateId);
}

export function readStoredCustomProgressTemplates(): ProgressTemplateDefinition[] {
  return readStore().templates.map((template) => cloneTemplate(template));
}

export function listProgressTemplates(
  customTemplates: ReadonlyArray<ProgressTemplateDefinition> = readStoredCustomProgressTemplates(),
): ProgressTemplateDefinition[] {
  return [
    ...BUILT_IN_PROGRESS_TEMPLATES.map((template) => cloneTemplate(template)),
    ...customTemplates.map((template) => cloneTemplate(template)),
  ];
}

export function resolveProgressTemplate(
  templateId: string,
  templateCatalog: ReadonlyArray<ProgressTemplateDefinition> = listProgressTemplates(),
): ProgressTemplateDefinition | undefined {
  return templateCatalog.find((template) => template.id === templateId);
}

export function upsertCustomProgressTemplate(template: ProgressTemplateDefinition): void {
  if (isBuiltInTemplateId(template.id)) {
    throw new Error(`Cannot overwrite built-in progress template: ${template.id}`);
  }
  const normalized = normalizeTemplate(template);
  if (!normalized) {
    throw new Error(`Invalid progress template: ${template.id}`);
  }
  const store = readStore();
  const nextTemplates = store.templates.filter((current) => current.id !== normalized.id);
  nextTemplates.push(normalized);
  nextTemplates.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  writeStore({ version: 1, templates: nextTemplates });
}

export function updateStoredCustomProgressTemplate(
  templateId: string,
  updater: (template: ProgressTemplateDefinition) => ProgressTemplateDefinition,
): void {
  const current = readStore().templates.find((template) => template.id === templateId);
  if (!current) {
    throw new Error(`Unknown custom progress template: ${templateId}`);
  }
  upsertCustomProgressTemplate(updater(cloneTemplate(current)));
}

export function removeStoredCustomProgressTemplate(templateId: string): void {
  if (isBuiltInTemplateId(templateId)) {
    throw new Error(`Cannot delete built-in progress template: ${templateId}`);
  }
  const store = readStore();
  writeStore({
    version: 1,
    templates: store.templates.filter((template) => template.id !== templateId),
  });
}

export function saveCustomProgressTemplateUserDefault(templateId: string): void {
  updateStoredCustomProgressTemplate(templateId, (template) => ({
    ...template,
    userDefaultFields: cloneColumns(template.fields),
    userDefaultSavedAt: new Date().toISOString(),
    version: template.version + 1,
  }));
}

export function resetCustomProgressTemplateToUserDefault(templateId: string): void {
  updateStoredCustomProgressTemplate(templateId, (template) => ({
    ...template,
    fields: cloneColumns(template.userDefaultFields ?? template.fields),
    version: template.version + 1,
  }));
}

export function resetCustomProgressTemplateToSystemDefault(templateId: string): void {
  updateStoredCustomProgressTemplate(templateId, (template) => ({
    ...template,
    fields: cloneColumns(template.systemDefaultFields ?? template.fields),
    version: template.version + 1,
  }));
}

export function createCustomProgressTemplate(
  baseTemplate: ProgressTemplateDefinition,
  label: string,
  templateCatalog: ReadonlyArray<ProgressTemplateDefinition> = listProgressTemplates(),
): ProgressTemplateDefinition {
  const trimmedLabel = label.trim();
  if (!trimmedLabel) {
    throw new Error('Custom progress template label is required');
  }
  const existingIds = new Set(templateCatalog.map((template) => template.id));
  const templateId = uniqueTemplateId(trimmedLabel, existingIds);
  return {
    ...cloneTemplate(baseTemplate),
    id: templateId,
    label: trimmedLabel,
    sheetTitle: `${trimmedLabel} Progress`,
    discipline: baseTemplate.discipline ?? 'custom',
    version: 1,
    systemDefaultFields: cloneColumns(baseTemplate.fields),
    userDefaultFields: cloneColumns(baseTemplate.fields),
    userDefaultSavedAt: new Date().toISOString(),
  };
}
