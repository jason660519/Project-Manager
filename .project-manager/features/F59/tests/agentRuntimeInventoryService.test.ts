import { describe, expect, it } from 'vitest';

import {
  loadAgentRuntimeInventory,
  type AgentRuntimeFilesystemSnapshot,
} from '../../../../lib/agent-runtime';

const HOME = '/Users/example';
const PROJECT_ROOT = '/Users/example/projects/project-manager';
const NOW = new Date('2026-06-23T00:00:00.000Z');

function emptySnapshot(): AgentRuntimeFilesystemSnapshot {
  return { existingPaths: [], availableCommands: [] };
}

describe('F59 Agent Runtime Inventory Service', () => {
  it('loads snapshot evidence through an injected loader and scans inventory rows', async () => {
    const requestedRoots: Array<string | undefined> = [];
    const snapshotLoader = async (projectRoot?: string): Promise<AgentRuntimeFilesystemSnapshot> => {
      requestedRoots.push(projectRoot);
      return {
        existingPaths: [`${HOME}/.codex`, `${HOME}/.codex/config.toml`],
        availableCommands: ['codex'],
      };
    };

    const result = await loadAgentRuntimeInventory({
      homeDir: HOME,
      projectRoot: PROJECT_ROOT,
      snapshotLoader,
      now: () => NOW,
    });

    const codex = result.inventory.rows.find((row) => row.rowId === 'agent-runtime:codex');
    expect(requestedRoots).toEqual([PROJECT_ROOT]);
    expect(result.loadedAt).toBe('2026-06-23T00:00:00.000Z');
    expect(result.diagnostics).toEqual([]);
    expect(codex?.commandAvailable).toBe(true);
    expect(codex?.status).not.toBe('missing');
  });

  it('returns deterministic default rows for an empty snapshot boundary', async () => {
    const first = await loadAgentRuntimeInventory({
      homeDir: HOME,
      projectRoot: PROJECT_ROOT,
      snapshotLoader: async () => emptySnapshot(),
      now: () => NOW,
    });
    const second = await loadAgentRuntimeInventory({
      homeDir: HOME,
      projectRoot: PROJECT_ROOT,
      snapshotLoader: async () => emptySnapshot(),
      now: () => NOW,
    });

    expect(first.diagnostics).toEqual([]);
    expect(first.inventory.rows.map((row) => row.rowId)).toEqual(second.inventory.rows.map((row) => row.rowId));
    expect(first.inventory.rows.map((row) => row.toolId)).toEqual([
      'codex',
      'claude-code',
      'gemini-cli',
      'opencode',
      'openclaw',
      'hermes-agent',
    ]);
  });

  it('converts snapshot loader failures into diagnostics without throwing', async () => {
    const result = await loadAgentRuntimeInventory({
      homeDir: HOME,
      projectRoot: PROJECT_ROOT,
      snapshotLoader: async () => {
        throw new Error('Permission denied');
      },
      now: () => NOW,
    });

    expect(result.snapshot).toEqual(emptySnapshot());
    expect(result.inventory.rows.length).toBeGreaterThan(0);
    expect(result.diagnostics).toEqual([
      {
        code: 'snapshot_load_failed',
        severity: 'error',
        message: 'Permission denied',
      },
    ]);
  });

  it('does not emit fixture-only file contents or secret values', async () => {
    const result = await loadAgentRuntimeInventory({
      homeDir: HOME,
      projectRoot: PROJECT_ROOT,
      snapshotLoader: async () => ({
        existingPaths: [`${HOME}/.codex/auth.json`, `${HOME}/.gemini/.env`],
        availableCommands: [],
        fileContents: {
          [`${HOME}/.codex/auth.json`]: '{"OPENAI_API_KEY":"sk-fake-secret"}',
          [`${HOME}/.gemini/.env`]: 'GEMINI_API_KEY=GEMINI_FAKE_SECRET',
        },
      }),
      now: () => NOW,
    });

    const serialized = JSON.stringify(result);
    expect(serialized).toContain(`${HOME}/.codex/auth.json`);
    expect(serialized).not.toContain('sk-fake-secret');
    expect(serialized).not.toContain('GEMINI_FAKE_SECRET');
    expect(serialized).not.toContain('fileContents');
  });
});
