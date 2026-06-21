import { describe, expect, it } from 'vitest';
import { createProgressSheetConfigFromTemplate } from '../lib/progress-sheets/sheetConfig';
import {
  addDevelopmentField,
  applyDevelopmentFieldColumns,
  createUniqueFieldId,
  defaultDevelopmentFieldColumns,
  isDevelopmentProgressSheet,
  moveDevelopmentField,
  normalizeDevelopmentFieldColumns,
  removeDevelopmentField,
  updateDevelopmentField,
  isFeatureBackedProgressSheet,
} from '../lib/progress-sheets/developmentFieldPreferences';

describe('development field preferences', () => {
  it('seeds defaults from the software desktop template', () => {
    const columns = defaultDevelopmentFieldColumns();
    expect(columns.map((column) => column.id)).toEqual([
      'uuid',
      'projectName',
      'featureId',
      'points',
      'category',
      'name',
      'progress',
      'status',
      'checklist',
      'upstreamDependencies',
      'downstreamDependencies',
      'locatedSection',
      'specPath',
      'tddPath',
      'unitIntegrationTestPath',
      'e2eAcceptanceTestScriptFolder',
      'tddProgress',
      'tddReportPath',
      'debugRetroPath',
      'testScenariosPath',
      'devLogFolder',
      'readmePath',
    ]);
  });

  it('adds, updates, moves, and removes custom fields while protecting core ids', () => {
    let columns = defaultDevelopmentFieldColumns();
    columns = addDevelopmentField(columns, 'Release Notes', 'text');
    expect(columns.some((column) => column.label === 'Release Notes')).toBe(true);

    const customId = columns.find((column) => column.label === 'Release Notes')?.id;
    expect(customId).toBeTruthy();
    columns = updateDevelopmentField(columns, customId!, { visible: false, required: true });
    expect(columns.find((column) => column.id === customId)).toMatchObject({
      visible: false,
      required: true,
    });

    columns = moveDevelopmentField(columns, customId!, 'up');
    expect(columns.findIndex((column) => column.id === customId)).toBe(columns.length - 2);

    const beforeProtectedRemoval = columns.length;
    columns = removeDevelopmentField(columns, 'uuid');
    expect(columns.length).toBe(beforeProtectedRemoval);

    columns = removeDevelopmentField(columns, 'featureId');
    expect(columns.length).toBe(beforeProtectedRemoval);

    columns = removeDevelopmentField(columns, customId!);
    expect(columns.some((column) => column.id === customId)).toBe(false);
  });

  it('creates unique field ids from labels', () => {
    const ids = new Set<string>(['release-notes']);
    expect(createUniqueFieldId('Release Notes', ids)).toBe('release-notes-2');
  });

  it('marks the software desktop template as feature-backed', () => {
    expect(isFeatureBackedProgressSheet('software-desktop-app')).toBe(true);
    expect(isFeatureBackedProgressSheet('marketing-campaign')).toBe(false);
  });

  it('applies customized columns to built-in progress sheet configs', () => {
    const config = createProgressSheetConfigFromTemplate('software-desktop-app');
    const customized = normalizeDevelopmentFieldColumns([
      ...defaultDevelopmentFieldColumns(),
      {
        id: 'release-notes',
        label: 'Release Notes',
        fieldType: 'text',
        order: 99,
        visible: true,
      },
    ]);

    expect(isDevelopmentProgressSheet(config)).toBe(true);
    expect(isDevelopmentProgressSheet(createProgressSheetConfigFromTemplate('hardware-rd'))).toBe(true);

    const applied = applyDevelopmentFieldColumns(config, customized);
    expect(applied.columns.some((column) => column.id === 'release-notes')).toBe(true);
  });
});
