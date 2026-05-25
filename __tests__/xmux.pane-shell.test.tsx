import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaneShell, type PaneActions } from '../components/terminal/PaneShell';
import { TerminalPaneGroup } from '../components/terminal/TerminalPaneGroup';

describe('PaneShell (F28 T-1, T-4, T-20)', () => {
  it('T-1: renders tab strip with selectable tab + four action buttons', () => {
    const onSelectTab = vi.fn();
    const onAddTerminal = vi.fn();
    const onAddBrowser = vi.fn();
    const onSplitRight = vi.fn();
    const onSplitDown = vi.fn();
    const actions: PaneActions = { onAddTerminal, onAddBrowser, onSplitRight, onSplitDown };

    render(
      <PaneShell
        tabs={[{ id: 'a', label: 'A', type: 'terminal', active: true }]}
        onSelectTab={onSelectTab}
        actions={actions}
      >
        <div data-testid="content">content</div>
      </PaneShell>,
    );

    const tab = screen.getByRole('button', { name: /^A$/ });
    expect(tab).toHaveAttribute('aria-pressed', 'true');

    expect(screen.getByLabelText('New terminal in this pane')).toBeInTheDocument();
    expect(screen.getByLabelText('New browser tab')).toBeInTheDocument();
    expect(screen.getByLabelText('Split pane to the right')).toBeInTheDocument();
    expect(screen.getByLabelText('Split pane downward')).toBeInTheDocument();

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('T-4: action button is disabled when no callback wired', () => {
    render(
      <PaneShell
        tabs={[{ id: 'a', label: 'A', type: 'terminal', active: true }]}
        onSelectTab={vi.fn()}
        actions={{}}
      >
        <div />
      </PaneShell>,
    );

    const button = screen.getByLabelText('New terminal in this pane');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('T-20: each action button independently reflects its callback presence', () => {
    const { rerender } = render(
      <PaneShell
        tabs={[{ id: 'a', label: 'A', type: 'terminal', active: true }]}
        onSelectTab={vi.fn()}
        actions={{ onAddBrowser: vi.fn() }}
      >
        <div />
      </PaneShell>,
    );

    expect(screen.getByLabelText('New terminal in this pane')).toBeDisabled();
    expect(screen.getByLabelText('New browser tab')).not.toBeDisabled();
    expect(screen.getByLabelText('Split pane to the right')).toBeDisabled();
    expect(screen.getByLabelText('Split pane downward')).toBeDisabled();

    rerender(
      <PaneShell
        tabs={[{ id: 'a', label: 'A', type: 'terminal', active: true }]}
        onSelectTab={vi.fn()}
        actions={{ onSplitRight: vi.fn(), onSplitDown: vi.fn() }}
      >
        <div />
      </PaneShell>,
    );
    expect(screen.getByLabelText('Split pane to the right')).not.toBeDisabled();
    expect(screen.getByLabelText('Split pane downward')).not.toBeDisabled();
    expect(screen.getByLabelText('New browser tab')).toBeDisabled();
  });
});

describe('TerminalPaneGroup (F28 T-2)', () => {
  it('T-2: terminal pane has no standalone "+" button; only the canonical SquareTerminal entry', () => {
    render(<TerminalPaneGroup paneId="p1" workspaceId="w1" cwd="/tmp" />);

    const allButtons = screen.getAllByRole('button');
    expect(allButtons.find((btn) => btn.textContent?.trim() === '+')).toBeUndefined();

    const addTerminal = screen.getAllByLabelText('New terminal in this pane');
    expect(addTerminal.length).toBe(1);
  });

  it('T-2 (alt): clicking SquareTerminal action adds a new terminal tab', () => {
    render(<TerminalPaneGroup paneId="p2" workspaceId="w2" cwd="/tmp" />);

    const initialTabs = screen.getAllByRole('button', { name: /^zsh/ });
    expect(initialTabs).toHaveLength(1);

    const tabStrip = screen.getByLabelText('New terminal in this pane');
    fireEvent.click(tabStrip);

    const tabsAfter = screen.getAllByRole('button', { name: /^zsh/ });
    expect(tabsAfter).toHaveLength(2);
  });
});
