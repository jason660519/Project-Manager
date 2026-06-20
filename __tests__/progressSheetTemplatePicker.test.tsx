import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BUILT_IN_PROGRESS_TEMPLATES } from '../lib/progress-sheets/templates';
import { ProgressSheetTemplatePicker } from '../app/ui/views/_components/ProgressSheetTemplatePicker';

function renderPicker(
  selectedIds: string[] = ['software-desktop-app'],
  handlers: Partial<{
    onToggle: (templateId: string) => void;
    onSelectAll: () => void;
    onClear: () => void;
  }> = {},
) {
  const onToggle = handlers.onToggle ?? vi.fn();
  const onSelectAll = handlers.onSelectAll ?? vi.fn();
  const onClear = handlers.onClear ?? vi.fn();
  render(
    <ProgressSheetTemplatePicker
      templates={BUILT_IN_PROGRESS_TEMPLATES}
      selectedIds={selectedIds}
      onToggle={onToggle}
      onSelectAll={onSelectAll}
      onClear={onClear}
    />,
  );
  return { onToggle, onSelectAll, onClear };
}

describe('ProgressSheetTemplatePicker', () => {
  it('shows a compact summary instead of an inline checkbox grid', () => {
    renderPicker(['software-desktop-app', 'hardware-rd']);

    expect(screen.getByRole('button', { name: /desktop app development/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('opens a dropdown list and toggles templates from there', async () => {
    const { onToggle } = renderPicker(['software-desktop-app']);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /desktop app development/i }));

    const listbox = screen.getByRole('listbox');
    const hardwareOption = within(listbox).getByRole('checkbox', { name: /hardware r&d progress sheet/i });
    await user.click(hardwareOption);

    expect(onToggle).toHaveBeenCalledWith('hardware-rd');
  });

  it('calls select-all and clear handlers from the dropdown menu', async () => {
    const { onSelectAll, onClear } = renderPicker(['software-desktop-app']);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /desktop app development/i }));
    await user.click(screen.getByRole('button', { name: /select all/i }));
    expect(onSelectAll).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('closes when clicking outside', async () => {
    renderPicker(['software-desktop-app']);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /desktop app development/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
