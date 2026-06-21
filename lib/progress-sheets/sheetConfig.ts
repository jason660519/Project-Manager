import type {
  ProgressColumn,
  ProgressOption,
  ProgressSheetConfig,
  ProgressTemplateSnapshot,
} from '../types';
import {
  resolveProgressTemplate,
  type ProgressTemplateDefinition,
} from './catalog';

interface CreateProgressSheetConfigOptions {
  id?: string;
  title?: string;
  now?: string;
  templateCatalog?: ReadonlyArray<ProgressTemplateDefinition>;
}

export function createProgressSheetConfigFromTemplate(
  templateId: string,
  options: CreateProgressSheetConfigOptions = {},
): ProgressSheetConfig {
  const template = resolveProgressTemplate(templateId, options.templateCatalog);
  if (!template) {
    throw new Error(`Unknown progress sheet template: ${templateId}`);
  }

  const timestamp = options.now ?? new Date().toISOString();
  const templateSnapshot = createTemplateSnapshot(template, timestamp);

  return {
    schemaVersion: 1,
    id: options.id ?? template.id,
    sheetTitle: options.title ?? template.sheetTitle,
    discipline: template.discipline,
    templateSnapshot,
    columns: cloneColumns(template.fields),
    statusOptions: cloneOptions(template.statusOptions),
    phaseOptions: template.phaseOptions ? cloneOptions(template.phaseOptions) : undefined,
    rows: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createTemplateSnapshot(
  template: ProgressTemplateDefinition,
  capturedAt: string,
): ProgressTemplateSnapshot {
  return {
    id: template.id,
    label: template.label,
    discipline: template.discipline,
    version: template.version,
    fields: cloneColumns(template.fields),
    statusOptions: cloneOptions(template.statusOptions),
    phaseOptions: template.phaseOptions ? cloneOptions(template.phaseOptions) : undefined,
    capturedAt,
  };
}

function cloneColumns(columns: ProgressColumn[]): ProgressColumn[] {
  return columns.map((column) => ({
    ...column,
    defaultValue: cloneValue(column.defaultValue),
    options: column.options ? cloneOptions(column.options) : undefined,
  }));
}

function cloneOptions(options: ProgressOption[]): ProgressOption[] {
  return options.map((option) => ({ ...option }));
}

function cloneValue<T>(value: T): T {
  if (value === undefined || value === null) return value;
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  if (typeof value === 'object') {
    return JSON.parse(JSON.stringify(value)) as T;
  }
  return value;
}
