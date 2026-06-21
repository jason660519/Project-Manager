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

const CUSTOM_TEMPLATES_STORAGE_KEY = 'projectManager.progressDashboard.customTemplates';
const SHEET_ORDER_STORAGE_KEY = 'projectManager.progressTemplatesSetting.sheetOrder';

function renderView() {
  return render(
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

async function addCustomSheet(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('button', { name: /add sheet/i }));
  await user.type(screen.getByPlaceholderText(/mobile app qa/i), label);
  await user.click(screen.getByRole('button', { name: /create/i }));
}

describe('ProgressTemplatesSettingView', () => {
  afterEach(() => {
    window.localStorage.clear();
    window.location.hash = '';
  });

  it('renders bottom sheet tabs for each built-in template', () => {
    const { container } = renderView();
    const addSheetButton = screen.getByRole('button', { name: /add sheet/i });
    const firstSheetButton = screen.getByRole('button', { name: /Desktop App Development sheet/i });

    expect(
      Boolean(addSheetButton.compareDocumentPosition(firstSheetButton) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    expect(container.querySelector('button[title="Add sheet"]')).toBe(addSheetButton);
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

  it('lets the user add a custom sheet cloned from the active template', async () => {
    const user = userEvent.setup();
    renderView();

    expect(screen.queryByText(/^Add Sheet$/i)).not.toBeInTheDocument();

    await addCustomSheet(user, 'Mobile App QA');

    expect(await screen.findByRole('button', { name: /mobile app qa sheet/i })).toBeInTheDocument();
    expect(screen.getByText('Mobile App QA Progress')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Project Name')).toBeInTheDocument();
  });

  it('saves and restores custom sheet user defaults separately from the system snapshot', async () => {
    const user = userEvent.setup();
    renderView();

    await addCustomSheet(user, 'Mobile App QA');
    expect(await screen.findByRole('button', { name: /mobile app qa sheet/i })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/release notes/i), 'Release Notes');
    await user.click(screen.getByRole('button', { name: /add field/i }));
    expect(await screen.findByDisplayValue('Release Notes')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save as user default/i }));

    await user.type(screen.getByPlaceholderText(/release notes/i), 'Audit Evidence');
    await user.click(screen.getByRole('button', { name: /add field/i }));
    expect(await screen.findByDisplayValue('Audit Evidence')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reset to user default/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Release Notes')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Audit Evidence')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /reset to system default/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Project Name')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Release Notes')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('Audit Evidence')).not.toBeInTheDocument();
    });
  });

  it('deletes a custom sheet and removes stale display order and hash state', async () => {
    const user = userEvent.setup();
    renderView();

    await addCustomSheet(user, 'Mobile App QA');
    expect(await screen.findByRole('button', { name: /mobile app qa sheet/i })).toBeInTheDocument();
    expect(window.location.hash).toBe('#mobile-app-qa');

    window.localStorage.setItem(
      SHEET_ORDER_STORAGE_KEY,
      JSON.stringify(['mobile-app-qa', DEVELOPMENT_TEMPLATE_ID, 'mobile-app-qa']),
    );

    await user.click(screen.getByRole('button', { name: /delete sheet/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /mobile app qa sheet/i })).not.toBeInTheDocument();
      expect(window.location.hash).toBe(`#${DEVELOPMENT_TEMPLATE_ID}`);
    });

    expect(window.localStorage.getItem(CUSTOM_TEMPLATES_STORAGE_KEY)).not.toContain('mobile-app-qa');
    expect(window.localStorage.getItem(SHEET_ORDER_STORAGE_KEY)).not.toContain('mobile-app-qa');
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
