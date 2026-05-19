/**
 * F12 — Suite B: Delete flow for SkillsView.
 *
 * Regression tests for F12-BUG-001:
 *   "Delete silently fails — error written to saveError which is only shown
 *   inside SkillModal, invisible during a delete attempt."
 *
 * Tests were written before the fix (TDD Red → Green).
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Bridge mock ────────────────────────────────────────────────────────────────

const skillListMock = vi.fn();
const skillUninstallMock = vi.fn();
const skillSaveMock = vi.fn();
const readFileMock = vi.fn();
const openPathMock = vi.fn();

vi.mock('../lib/bridge', () => ({
  skillList: (...args: unknown[]) => skillListMock(...args),
  skillUninstall: (...args: unknown[]) => skillUninstallMock(...args),
  skillSave: (...args: unknown[]) => skillSaveMock(...args),
  readFile: (...args: unknown[]) => readFileMock(...args),
  openPath: (...args: unknown[]) => openPathMock(...args),
}));

// ── react-markdown stub ────────────────────────────────────────────────────────
// Keep the stub lightweight — we only care about delete behaviour here.
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="md">{children}</div>,
}));

import { SkillsView } from '../app/ui/views/SkillsView';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const PROJECT_ROOT = '/project';
const SKILLS_DIR = `${PROJECT_ROOT}/.agents/skills`;

const SKILL_FILE = {
  absPath: `${SKILLS_DIR}/workflow/tdd-dev/SKILL.md`,
  relPath: 'workflow/tdd-dev/SKILL.md',
  modified: '2024-01-01T00:00:00Z',
  size: 200,
};

const SKILL_CONTENT = `---
name: TDD Dev
description: "Test-driven development"
version: 1.0.0
metadata:
  tags: [testing, tdd]
---

## Overview

Body content.
`;

// ── Setup ──────────────────────────────────────────────────────────────────────

function setup() {
  skillListMock.mockResolvedValue([SKILL_FILE]);
  readFileMock.mockResolvedValue(SKILL_CONTENT);
  skillUninstallMock.mockResolvedValue(undefined);
  skillSaveMock.mockResolvedValue(undefined);
  openPathMock.mockResolvedValue(undefined);
}

function renderView() {
  return render(<SkillsView projectRoot={PROJECT_ROOT} />);
}

// Wait for the skill card to appear after async load
async function waitForCard() {
  return await screen.findByText('TDD Dev', {}, { timeout: 3000 });
}

// Scope helpers — both the card header AND the modal contain "TDD Dev" / "Delete",
// so we must scope confirmations to within the modal element.
function getDeleteModal() {
  return screen.getByTestId('delete-confirm-modal');
}
function getConfirmBtn() {
  return within(getDeleteModal()).getByRole('button', { name: /^Delete$/ });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SkillsView — Delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  // B1 — Trash button opens delete confirmation modal
  it('B1 — opens delete modal when trash button is clicked', async () => {
    renderView();
    await waitForCard();

    const trashBtn = screen.getByTitle('Delete');
    await userEvent.click(trashBtn);

    const modal = getDeleteModal();
    // Modal heading
    expect(within(modal).getByText('Delete skill')).toBeInTheDocument();
    // Skill name referenced in confirm message (card ALSO has this text — scope to modal)
    expect(within(modal).getByText(/TDD Dev/)).toBeInTheDocument();
    // relPath shown
    expect(within(modal).getByText('workflow/tdd-dev/SKILL.md')).toBeInTheDocument();
  });

  // B2 — Cancel closes modal without calling the bridge
  it('B2 — cancel button closes modal without deleting', async () => {
    renderView();
    await waitForCard();

    await userEvent.click(screen.getByTitle('Delete'));
    expect(screen.getByText('Delete skill')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Delete skill')).not.toBeInTheDocument();
    });
    expect(skillUninstallMock).not.toHaveBeenCalled();
  });

  // B3 — Confirm calls skillUninstall with correct arguments
  it('B3 — confirm calls skillUninstall with absPath and skillsDir', async () => {
    renderView();
    await waitForCard();

    await userEvent.click(screen.getByTitle('Delete'));
    // Scope to modal — trash button also has accessible name "Delete"
    await userEvent.click(getConfirmBtn());

    await waitFor(() => {
      expect(skillUninstallMock).toHaveBeenCalledWith(
        SKILL_FILE.absPath,
        SKILLS_DIR,
      );
    });
  });

  // B4 — Successful delete closes modal and reloads skills
  it('B4 — successful delete: modal closes and skill list reloads', async () => {
    // After delete, second load returns empty list
    skillListMock
      .mockResolvedValueOnce([SKILL_FILE])
      .mockResolvedValueOnce([]);

    renderView();
    await waitForCard();

    await userEvent.click(screen.getByTitle('Delete'));
    await userEvent.click(getConfirmBtn());

    // Modal disappears
    await waitFor(() => {
      expect(screen.queryByText('Delete skill')).not.toBeInTheDocument();
    });
    // skillList called a second time (reload)
    expect(skillListMock).toHaveBeenCalledTimes(2);
  });

  // B5 — Failed delete shows error INSIDE the delete modal  ← BUG REGRESSION
  it('B5 — failed delete: error message appears inside the delete modal', async () => {
    skillUninstallMock.mockRejectedValueOnce(new Error('Permission denied'));

    renderView();
    await waitForCard();

    await userEvent.click(screen.getByTitle('Delete'));
    await userEvent.click(getConfirmBtn());

    // Error must be visible — scoped inside the delete modal
    const modal = getDeleteModal();
    expect(await within(modal).findByText(/Permission denied/)).toBeInTheDocument();
  });

  // B6 — Failed delete keeps modal open
  it('B6 — failed delete: modal remains open after error', async () => {
    skillUninstallMock.mockRejectedValueOnce(new Error('File not found'));

    renderView();
    await waitForCard();

    await userEvent.click(screen.getByTitle('Delete'));
    await userEvent.click(getConfirmBtn());

    // Wait for async rejection to settle, error appears inside modal
    const modal = getDeleteModal();
    await within(modal).findByText(/File not found/);

    // Modal is still open
    expect(within(modal).getByText('Delete skill')).toBeInTheDocument();
  });

  // B7 — Empty projectRoot: view shows placeholder, no bridge call
  it('B7 — empty projectRoot renders placeholder without calling bridge', () => {
    render(<SkillsView projectRoot="" />);

    expect(screen.getByText(/Select a project/i)).toBeInTheDocument();
    expect(skillListMock).not.toHaveBeenCalled();
  });
});
