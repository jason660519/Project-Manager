import { describe, expect, it } from 'vitest';

import {
  loadAgentRuntimeInventory,
  type AgentRuntimeFilesystemSnapshot,
} from '../../../../lib/agent-runtime';

const HOME = '/Users/example';
const OTHER_HOME = '/Users/other';
const PROJECT_ROOT = '/Users/example/projects/project-manager';
const NOW = new Date('2026-06-23T00:00:00.000Z');

describe('F61 Agent Runtime snapshot root metadata', () => {
  it('uses snapshot homeDir when the caller omits homeDir', async () => {
    const result = await loadAgentRuntimeInventory({
      projectRoot: PROJECT_ROOT,
      snapshotLoader: async (): Promise<AgentRuntimeFilesystemSnapshot> => ({
        homeDir: HOME,
        projectRoot: PROJECT_ROOT,
        existingPaths: [`${HOME}/.codex`, `${HOME}/.codex/config.toml`],
        availableCommands: ['codex'],
      }),
      now: () => NOW,
    });

    const codex = result.inventory.rows.find((row) => row.toolId === 'codex');
    expect(result.snapshot.homeDir).toBe(HOME);
    expect(result.snapshot.projectRoot).toBe(PROJECT_ROOT);
    expect(codex?.status).toBe('ready');
    expect(codex?.paths.some((path) => path.path === `${HOME}/.codex` && path.exists)).toBe(true);
  });

  it('lets explicit homeDir take precedence over snapshot homeDir', async () => {
    const result = await loadAgentRuntimeInventory({
      homeDir: HOME,
      projectRoot: PROJECT_ROOT,
      snapshotLoader: async (): Promise<AgentRuntimeFilesystemSnapshot> => ({
        homeDir: OTHER_HOME,
        projectRoot: PROJECT_ROOT,
        existingPaths: [`${HOME}/.codex`, `${HOME}/.codex/config.toml`],
        availableCommands: ['codex'],
      }),
      now: () => NOW,
    });

    const codex = result.inventory.rows.find((row) => row.toolId === 'codex');
    expect(result.snapshot.homeDir).toBe(OTHER_HOME);
    expect(codex?.status).toBe('ready');
    expect(codex?.paths.some((path) => path.path.startsWith(`${HOME}/`) && path.exists)).toBe(true);
  });

  it('keeps root metadata while dropping fixture-only fileContents and secret values', async () => {
    const result = await loadAgentRuntimeInventory({
      projectRoot: PROJECT_ROOT,
      snapshotLoader: async (): Promise<AgentRuntimeFilesystemSnapshot> => ({
        homeDir: HOME,
        projectRoot: PROJECT_ROOT,
        existingPaths: [`${HOME}/.codex/auth.json`],
        availableCommands: [],
        fileContents: {
          [`${HOME}/.codex/auth.json`]: '{"OPENAI_API_KEY":"sk-fake-secret"}',
        },
      }),
      now: () => NOW,
    });

    const serialized = JSON.stringify(result);
    expect(serialized).toContain(HOME);
    expect(serialized).toContain(PROJECT_ROOT);
    expect(serialized).toContain(`${HOME}/.codex/auth.json`);
    expect(serialized).not.toContain('sk-fake-secret');
    expect(serialized).not.toContain('fileContents');
  });

  it('still returns deterministic fallback rows when the loader fails before roots are available', async () => {
    const result = await loadAgentRuntimeInventory({
      projectRoot: PROJECT_ROOT,
      snapshotLoader: async () => {
        throw new Error('Permission denied');
      },
      now: () => NOW,
    });

    expect(result.snapshot).toEqual({ existingPaths: [], availableCommands: [] });
    expect(result.diagnostics[0]?.code).toBe('snapshot_load_failed');
    expect(result.inventory.rows.length).toBeGreaterThan(0);
  });
});
