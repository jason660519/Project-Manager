import { describe, expect, it } from 'vitest';
import { developmentColumnsFromTemplatePrefs } from '../app/project-progress-dashboard/_lib/developmentTemplateColumns';
import { defaultTemplateFieldColumns } from '../lib/progress-sheets/templateFieldPreferences';

describe('developmentColumnsFromTemplatePrefs', () => {
  it('maps template field order and visibility onto legacy development columns', () => {
    const templateColumns = defaultTemplateFieldColumns('software-desktop-app').map((column) => (
      column.id === 'specPath' || column.id === 'tddPath'
        ? { ...column, visible: false }
        : column
    ));

    const columns = developmentColumnsFromTemplatePrefs(templateColumns);
    const headers = columns.map((column) => column.header);

    expect(headers).toContain('Function / Feature');
    expect(headers).toContain('Dispatch');
    expect(headers).not.toContain('Feature Spec');
    expect(headers).not.toContain('TDD Spec');
    expect(headers.indexOf('Function / Feature')).toBeLessThan(headers.indexOf('Progress'));
  });

  it('falls back to the full development table when template prefs are empty', () => {
    const columns = developmentColumnsFromTemplatePrefs([]);
    expect(columns.map((column) => column.header)).toContain('Feature Spec');
    expect(columns.map((column) => column.header)).toContain('Dispatch');
  });
});
