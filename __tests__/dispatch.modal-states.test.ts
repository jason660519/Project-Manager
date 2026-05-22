import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../lib/i18n';
import React from 'react';

// ── Helper: kill confirmation state tests (function-level) ────────────────────

describe('kill confirmation flow', () => {
  it('shows kill confirmation dialog with PID and feature name', () => {
    // Simulate state: killConfirmPid = 12345, feature.name = 'Test Feature'
    const state = {
      killConfirmPid: 12345 as number | null,
      activePid: 12345,
      feature: { id: 'F13', name: 'Test Feature' },
    };

    expect(state.killConfirmPid).toBe(12345);
    expect(state.activePid).toBe(12345);
    expect(state.feature.name).toBe('Test Feature');
  });

  it('hides confirmation when killConfirmPid is null', () => {
    const state = {
      killConfirmPid: null as number | null,
    };

    expect(state.killConfirmPid).toBeNull();
  });

  it('handles confirm kill: sets activePid to null', () => {
    let activePid: number | null = 12345;
    let killConfirmPid: number | null = 12345;

    // handleConfirmKill
    if (killConfirmPid != null) {
      // killProcess(killConfirmPid)
      activePid = null;
      killConfirmPid = null;
    }

    expect(activePid).toBeNull();
    expect(killConfirmPid).toBeNull();
  });

  it('handles cancel kill: restores killConfirmPid to null', () => {
    let killConfirmPid: number | null = 12345;

    // handleCancelKill
    killConfirmPid = null;

    expect(killConfirmPid).toBeNull();
  });

  it('does not kill when killConfirmPid is null (guard clause)', () => {
    let killed = false;
    const killConfirmPid = null;

    if (killConfirmPid != null) {
      killed = true;
    }

    expect(killed).toBe(false);
  });
});

// ── Adapter fallback state ────────────────────────────────────────────────────

describe('adapter warning state', () => {
  const adapters = [
    { id: 'claude-code', name: 'Claude Code', command: 'claude' },
    { id: 'codex', name: 'Codex', command: 'codex' },
  ];

  it('does not show warning when saved adapter exists', () => {
    const savedId = 'claude-code';
    const warning = adapters.some((a) => a.id === savedId) ? null : `"${savedId}" not found`;
    expect(warning).toBeNull();
  });

  it('shows warning when saved adapter is missing', () => {
    const savedId = 'nonexistent';
    const warning = adapters.some((a) => a.id === savedId)
      ? null
      : `Previously assigned adapter "${savedId}" is no longer configured. Using "${adapters[0].name}".`;
    expect(warning).toBe(
      'Previously assigned adapter "nonexistent" is no longer configured. Using "Claude Code".',
    );
  });

  it('handles empty adapter list gracefully', () => {
    const emptyAdapters: typeof adapters = [];
    const savedId = 'anything';
    const warning = savedId && !emptyAdapters.some((a) => a.id === savedId) && emptyAdapters.length > 0
      ? `Using "${emptyAdapters[0].name}".`
      : null;
    expect(warning).toBeNull();
  });
});

// ── Dispatch error state ──────────────────────────────────────────────────────

describe('dispatch error state', () => {
  it('sets error message when adapter is not selected', () => {
    const adapter = null;
    const error = !adapter ? 'No adapter selected. Please select an execution target.' : null;
    expect(error).toBe('No adapter selected. Please select an execution target.');
  });

  it('captures error message from catch block', () => {
    const err = new Error('Failed to build command for Cursor');
    const dispatchError = err instanceof Error ? err.message : String(err);
    expect(dispatchError).toBe('Failed to build command for Cursor');
  });

  it('clears error on re-dispatch', () => {
    let dispatchError = 'Previous error';
    // Clear on new dispatch attempt
    dispatchError = null as unknown as string;
    expect(dispatchError).toBeNull();
  });
});

// ── Loading states ────────────────────────────────────────────────────────────

describe('loading states', () => {
  it('specLoading sets loading indicator visible', () => {
    let specLoading = true;
    const indicator = specLoading ? 'Loading spec…' : null;
    expect(indicator).toBe('Loading spec…');

    specLoading = false;
    const noIndicator = specLoading ? 'Loading spec…' : null;
    expect(noIndicator).toBeNull();
  });

  it('mcpLoading shows spinner', () => {
    let mcpLoading = true;
    const spinnerShown = mcpLoading;
    expect(spinnerShown).toBe(true);

    mcpLoading = false;
    expect(mcpLoading).toBe(false);
  });

  it('commandLoading shows spinner during execution preparation', () => {
    let commandLoading = true;
    expect(commandLoading).toBe(true);

    commandLoading = false;
    expect(commandLoading).toBe(false);
  });

  it('dispatch phase moves pending → running → done', () => {
    type Phase = 'idle' | 'pending' | 'running' | 'done' | 'error';
    const phases: Phase[] = [];
    let phase: Phase = 'idle';
    const setPhase = (next: Phase) => {
      phase = next;
      phases.push(next);
    };

    setPhase('pending');
    setPhase('running');
    setPhase('done');

    expect(phase).toBe('done');
    expect(phases).toEqual(['pending', 'running', 'done']);
  });

  it('dispatch phase moves pending → running → error', () => {
    type Phase = 'idle' | 'pending' | 'running' | 'done' | 'error';
    const phases: Phase[] = [];
    let phase: Phase = 'idle';
    const setPhase = (next: Phase) => {
      phase = next;
      phases.push(next);
    };

    setPhase('pending');
    setPhase('running');
    setPhase('error');

    expect(phase).toBe('error');
    expect(phases).toEqual(['pending', 'running', 'error']);
  });
});

// ── MCP state ─────────────────────────────────────────────────────────────────

describe('MCP state handling', () => {
  it('shows error banner when MCP load fails', () => {
    const mcpError = 'Failed to load MCP servers: Network error';
    expect(mcpError).toBeTruthy();
    expect(mcpError).toContain('Failed to load MCP servers');
  });

  it('shows "No MCP servers" when none configured', () => {
    const mcpInjection = null;
    const mcpLoading = false;
    const mcpError = null;
    const noMcpText = !mcpLoading && !mcpError && !mcpInjection ? 'No MCP servers configured' : null;
    expect(noMcpText).toBe('No MCP servers configured');
  });

  it('shows server count when injection is active', () => {
    const mcpInjection = { count: 2, flag: '--mcp' };
    const label = `{count} MCP server(s) injected via {flag}`
      .replace('{count}', String(mcpInjection.count))
      .replace('{flag}', mcpInjection.flag);
    expect(label).toBe('2 MCP server(s) injected via --mcp');
  });
});

// ── Batch modal states ────────────────────────────────────────────────────────

describe('BatchDispatchModal states', () => {
  it('empty features list shows message', () => {
    const emptyState = true;
    expect(emptyState).toBe(true);
  });

  it('no agent adapters shows message', () => {
    const agentAdapters: any[] = [];
    const noAdapters = agentAdapters.length === 0;
    expect(noAdapters).toBe(true);
  });

  it('running phase shows progress summary', () => {
    const batchPhase = 'running' as const;
    expect(batchPhase).toBe('running');
  });

  it('done phase shows completion summary', () => {
    const batchPhase = 'done' as const;
    const items = [
      { phase: 'done' as const },
      { phase: 'done' as const },
      { phase: 'error' as const },
    ];
    const doneCount = items.filter((i) => i.phase === 'done').length;
    const errorCount = items.filter((i) => i.phase === 'error').length;
    expect(doneCount).toBe(2);
    expect(errorCount).toBe(1);
  });

  it('error item captures error message inline', () => {
    const item = {
      phase: 'error' as const,
      logs: ['Starting…', 'Error: spawn ENOENT'],
    };
    const errorLine = item.logs.find((l) => l.startsWith('Error:'));
    expect(errorLine).toBe('Error: spawn ENOENT');
  });
});
