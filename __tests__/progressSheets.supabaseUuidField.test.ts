import { describe, expect, it } from 'vitest';
import { BUILT_IN_PROGRESS_TEMPLATES } from '../lib/progress-sheets/templates';
import {
  createProgressUuidColumn,
  ensureProgressUuidFirstColumn,
  PROGRESS_ROW_UUID_FIELD_ID,
  PROGRESS_ROW_UUID_FIELD_LABEL,
} from '../lib/progress-sheets/supabaseUuidField';
import { defaultTemplateFieldColumns } from '../lib/progress-sheets/templateFieldPreferences';

describe('supabase UUID progress column', () => {
  it('pins UUID as the first column on every built-in template', () => {
    for (const template of BUILT_IN_PROGRESS_TEMPLATES) {
      expect(template.fields[0]).toMatchObject({
        id: PROGRESS_ROW_UUID_FIELD_ID,
        label: PROGRESS_ROW_UUID_FIELD_LABEL,
        fieldType: 'uuid',
        required: true,
        order: 0,
      });
    }
  });

  it('reorders stored overrides so UUID stays first', () => {
    const defaults = defaultTemplateFieldColumns('software-desktop-app');
    const shuffled = [...defaults.slice(1), defaults[0]!];
    const normalized = ensureProgressUuidFirstColumn(shuffled);

    expect(normalized[0]?.id).toBe(PROGRESS_ROW_UUID_FIELD_ID);
    expect(normalized.map((column) => column.id)).toEqual(defaults.map((column) => column.id));
  });

  it('creates a canonical uuid column definition', () => {
    expect(createProgressUuidColumn()).toEqual({
      id: 'uuid',
      label: 'UUID',
      fieldType: 'uuid',
      order: 0,
      required: true,
      visible: true,
    });
  });
});
