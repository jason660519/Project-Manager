import { describe, expect, it } from 'vitest';
import type { ProgressFieldType } from '../lib/types';
import { createProgressSheetConfigFromTemplate } from '../lib/progress-sheets/sheetConfig';
import { BUILT_IN_PROGRESS_TEMPLATES } from '../lib/progress-sheets/templates';

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

describe('F55 built-in progress sheet templates', () => {
  it('registers exactly the F55 built-in template ids with no duplicates', () => {
    const ids = BUILT_IN_PROGRESS_TEMPLATES.map((template) => template.id);

    expect(ids).toEqual([
      'software-desktop-app',
      'software-backend-api',
      'hardware-rd',
      'marketing-campaign',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only F55-supported field types and unique ordered fields per template', () => {
    for (const template of BUILT_IN_PROGRESS_TEMPLATES) {
      const fieldIds = template.fields.map((field) => field.id);
      const fieldOrders = template.fields.map((field) => field.order);

      expect(fieldIds.length, template.id).toBeGreaterThan(0);
      expect(new Set(fieldIds).size, template.id).toBe(fieldIds.length);
      expect(new Set(fieldOrders).size, template.id).toBe(fieldOrders.length);
      for (const field of template.fields) {
        expect(SUPPORTED_FIELD_TYPES.has(field.fieldType), `${template.id}.${field.id}`).toBe(true);
      }
    }
  });
});

describe('createProgressSheetConfigFromTemplate', () => {
  it('creates an empty sheet config from the hardware R&D template snapshot', () => {
    const config = createProgressSheetConfigFromTemplate('hardware-rd', {
      id: 'hardware-main',
      title: 'Hardware Program Progress',
      now: '2026-06-20T10:00:00.000Z',
    });

    expect(config).toMatchObject({
      schemaVersion: 1,
      id: 'hardware-main',
      sheetTitle: 'Hardware Program Progress',
      discipline: 'hardware-rd',
      rows: [],
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-20T10:00:00.000Z',
    });
    expect(config.templateSnapshot).toMatchObject({
      id: 'hardware-rd',
      label: 'Hardware R&D',
      discipline: 'hardware-rd',
      version: 1,
      capturedAt: '2026-06-20T10:00:00.000Z',
    });
    expect(config.columns.map((column) => column.id)).toEqual(config.templateSnapshot.fields.map((field) => field.id));
    expect(config.statusOptions.map((option) => option.id)).toEqual([
      'not-started',
      'in-progress',
      'blocked',
      'in-review',
      'complete',
    ]);
  });

  it('deep-copies template fields and options so later template mutation does not mutate the sheet config', () => {
    const template = BUILT_IN_PROGRESS_TEMPLATES.find((candidate) => candidate.id === 'hardware-rd');
    expect(template).toBeDefined();

    const config = createProgressSheetConfigFromTemplate('hardware-rd', {
      id: 'hardware-copy-check',
      now: '2026-06-20T10:00:00.000Z',
    });
    const originalFirstColumnLabel = config.columns[0].label;
    const originalFirstStatusLabel = config.statusOptions[0].label;

    template!.fields[0].label = 'Mutated field label';
    template!.statusOptions[0].label = 'Mutated status label';

    expect(config.columns[0].label).toBe(originalFirstColumnLabel);
    expect(config.templateSnapshot.fields[0].label).toBe(originalFirstColumnLabel);
    expect(config.statusOptions[0].label).toBe(originalFirstStatusLabel);
    expect(config.templateSnapshot.statusOptions[0].label).toBe(originalFirstStatusLabel);

    template!.fields[0].label = originalFirstColumnLabel;
    template!.statusOptions[0].label = originalFirstStatusLabel;
  });
});
