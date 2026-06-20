import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ProgressTemplatesSettingView } from '../app/ui/views/ProgressTemplatesSettingView';
import {
  DEVELOPMENT_TEMPLATE_ID,
  defaultTemplateFieldColumns,
  TEMPLATE_FIELD_PREFS_STORAGE_KEY,
} from '../lib/progress-sheets/templateFieldPreferences';
import { I18nProvider } from '../lib/i18n';

function renderView() {
  render(
    <I18nProvider>
      <ProgressTemplatesSettingView />
    </I18nProvider>,
  );
}

function readStoredColumns(templateId: string) {
  const raw = window.localStorage.getItem(TEMPLATE_FIELD_PREFS_STORAGE_KEY);
  if (!raw) return undefined;
  const parsed = JSON.parse(raw) as { templates?: Record<string, Array<{ label: string; visible?: boolean }>> };
  return parsed.templates?.[templateId];
}

describe('ProgressTemplatesSettingView', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders bottom sheet tabs for each built-in template', () => {
    renderView();
    expect(screen.getByRole('button', { name: /Desktop App Development sheet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hardware R&D sheet/i })).toBeInTheDocument();
  });

  it('lets the user add a custom field to the active template', async () => {
    const user = userEvent.setup();
    renderView();

    await user.type(screen.getByPlaceholderText(/release notes/i), 'Release Notes');
    await user.click(screen.getByRole('button', { name: /add field/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Release Notes')).toBeInTheDocument();
    });

    const stored = readStoredColumns(DEVELOPMENT_TEMPLATE_ID);
    expect(stored?.some((column) => column.label === 'Release Notes')).toBe(true);
  });

  it('resets template fields back to the built-in defaults', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      TEMPLATE_FIELD_PREFS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        templates: {
          [DEVELOPMENT_TEMPLATE_ID]: [
            ...defaultTemplateFieldColumns(DEVELOPMENT_TEMPLATE_ID),
            {
              id: 'release-notes',
              label: 'Release Notes',
              fieldType: 'text',
              order: 99,
              visible: true,
            },
          ],
        },
      }),
    );

    renderView();
    expect(screen.getByDisplayValue('Release Notes')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reset to defaults/i }));

    await waitFor(() => {
      expect(screen.queryByDisplayValue('Release Notes')).not.toBeInTheDocument();
    });
    expect(readStoredColumns(DEVELOPMENT_TEMPLATE_ID)).toBeUndefined();
  });

  it('toggles field visibility from the editor table', async () => {
    renderView();

    const projectNameRow = screen.getByDisplayValue('Project Name');
    const row = projectNameRow.closest('tr');
    expect(row).toBeTruthy();

    const visibleCheckbox = row!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(visibleCheckbox.checked).toBe(true);
    fireEvent.click(visibleCheckbox);

    await waitFor(() => {
      const stored = readStoredColumns(DEVELOPMENT_TEMPLATE_ID);
      const projectName = stored?.find((column) => column.label === 'Project Name');
      expect(projectName?.visible).toBe(false);
    });
  });
});
