import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AGENT_TOOL_SPECS,
  scanAgentEnvironment,
  type AgentRuntimeFilesystemSnapshot,
  type AgentRuntimeToolSpec,
} from '../../../../lib/agent-runtime';

const HOME = '/Users/example';
const PROJECT_ROOT = '/Users/example/Project/Project-Manager';

function snapshot(input: Partial<AgentRuntimeFilesystemSnapshot>): AgentRuntimeFilesystemSnapshot {
  return {
    existingPaths: [],
    availableCommands: [],
    ...input,
  };
}

describe('F57 agent environment scanner', () => {
  it('detects known tools from config roots and command evidence', () => {
    const result = scanAgentEnvironment(
      snapshot({
        existingPaths: [
          `${HOME}/.codex`,
          `${HOME}/.codex/config.toml`,
          `${HOME}/.codex/sessions`,
          `${HOME}/.claude`,
          `${HOME}/.claude/settings.json`,
          `${HOME}/.claude.json`,
          `${HOME}/.gemini`,
          `${HOME}/.gemini/.env`,
          `${HOME}/.config/opencode/opencode.json`,
          `${PROJECT_ROOT}/.project-manager/bin/openclaw`,
          `${HOME}/.openclaw/openclaw.json`,
          `${PROJECT_ROOT}/.project-manager/bin/hermes`,
          `${HOME}/.hermes/config.yaml`,
        ],
        availableCommands: ['codex', 'claude', 'gemini', 'opencode', 'openclaw', 'hermes'],
      }),
      { homeDir: HOME, projectRoot: PROJECT_ROOT },
    );

    expect(result.rows.map((row) => row.toolId)).toEqual([
      'codex',
      'claude-code',
      'gemini-cli',
      'opencode',
      'openclaw',
      'hermes-agent',
    ]);
    expect(result.rows.every((row) => row.status === 'ready')).toBe(true);
    expect(result.rows.find((row) => row.toolId === 'codex')?.capabilities).toMatchObject({
      runtime: true,
      mcp: true,
      skills: true,
      sessions: true,
      cost: true,
    });
  });

  it('marks command-only tools as partial with a config_root_missing warning', () => {
    const result = scanAgentEnvironment(
      snapshot({ availableCommands: ['codex'] }),
      { homeDir: HOME, projectRoot: PROJECT_ROOT },
    );

    const codex = result.rows.find((row) => row.toolId === 'codex');
    expect(codex?.status).toBe('partial');
    expect(codex?.warnings).toContainEqual({
      code: 'config_root_missing',
      message: 'Codex CLI command is available but config root is missing.',
      path: `${HOME}/.codex`,
      severity: 'warning',
    });
  });

  it('marks config-only tools as partial with a command_missing warning', () => {
    const result = scanAgentEnvironment(
      snapshot({ existingPaths: [`${HOME}/.gemini`, `${HOME}/.gemini/.env`] }),
      { homeDir: HOME, projectRoot: PROJECT_ROOT },
    );

    const gemini = result.rows.find((row) => row.toolId === 'gemini-cli');
    expect(gemini?.status).toBe('partial');
    expect(gemini?.warnings.some((warning) => warning.code === 'command_missing')).toBe(true);
  });

  it('returns missing instead of throwing when a known tool has no evidence', () => {
    const result = scanAgentEnvironment(snapshot({}), { homeDir: HOME, projectRoot: PROJECT_ROOT });

    const opencode = result.rows.find((row) => row.toolId === 'opencode');
    expect(opencode?.status).toBe('missing');
    expect(opencode?.warnings).toEqual([]);
  });

  it('reports secret-bearing files without leaking content fields', () => {
    const result = scanAgentEnvironment(
      snapshot({
        existingPaths: [
          `${HOME}/.codex`,
          `${HOME}/.codex/auth.json`,
          `${HOME}/.claude`,
          `${HOME}/.claude/settings.json`,
        ],
        availableCommands: ['codex', 'claude'],
        fileContents: {
          [`${HOME}/.codex/auth.json`]: '{"OPENAI_API_KEY":"sk-should-not-appear"}',
          [`${HOME}/.claude/settings.json`]: '{"ANTHROPIC_API_KEY":"sk-ant-should-not-appear"}',
        },
      }),
      { homeDir: HOME, projectRoot: PROJECT_ROOT },
    );

    const serialized = JSON.stringify(result);
    expect(serialized).toContain('auth.json');
    expect(serialized).toContain('settings.json');
    expect(serialized).not.toContain('sk-should-not-appear');
    expect(serialized).not.toContain('sk-ant-should-not-appear');
    expect(result.rows.flatMap((row) => row.warnings).some((warning) => warning.code === 'secret_file_not_parsed')).toBe(true);
  });

  it('is deterministic across repeated scans', () => {
    const input = snapshot({
      existingPaths: [`${HOME}/.codex`, `${HOME}/.codex/config.toml`, `${HOME}/.gemini`],
      availableCommands: ['gemini', 'codex'],
    });

    const first = scanAgentEnvironment(input, { homeDir: HOME, projectRoot: PROJECT_ROOT });
    const second = scanAgentEnvironment(input, { homeDir: HOME, projectRoot: PROJECT_ROOT });

    expect(second).toEqual(first);
    expect(first.rows.map((row) => row.rowId)).toEqual([
      'agent-runtime:codex',
      'agent-runtime:claude-code',
      'agent-runtime:gemini-cli',
      'agent-runtime:opencode',
      'agent-runtime:openclaw',
      'agent-runtime:hermes-agent',
    ]);
  });

  it('normalizes home and project placeholders into absolute paths', () => {
    const result = scanAgentEnvironment(
      snapshot({ existingPaths: [`${HOME}/.codex`, `${PROJECT_ROOT}/.project-manager/bin/openclaw`] }),
      { homeDir: HOME, projectRoot: PROJECT_ROOT },
    );

    const codexPaths = result.rows.find((row) => row.toolId === 'codex')?.paths.map((path) => path.path);
    const openclawPaths = result.rows.find((row) => row.toolId === 'openclaw')?.paths.map((path) => path.path);
    expect(codexPaths).toContain(`${HOME}/.codex`);
    expect(openclawPaths).toContain(`${PROJECT_ROOT}/.project-manager/bin/openclaw`);
  });

  it('supports explicit unsupported catalog entries', () => {
    const specs: AgentRuntimeToolSpec[] = [
      {
        id: 'future-agent',
        label: 'Future Agent',
        command: 'future-agent',
        supported: false,
        unsupportedReason: 'Future Agent is not supported on this platform.',
        capabilities: { runtime: true, mcp: false, skills: false, sessions: false, cost: false },
        paths: [{ kind: 'config-root', path: '~/.future-agent', required: true }],
      },
    ];

    const result = scanAgentEnvironment(snapshot({}), { homeDir: HOME, projectRoot: PROJECT_ROOT, specs });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      toolId: 'future-agent',
      status: 'unsupported',
      warnings: [
        {
          code: 'unsupported_tool',
          message: 'Future Agent is not supported on this platform.',
          severity: 'info',
        },
      ],
    });
  });

  it('keeps the default catalog focused on the six F57 tools', () => {
    expect(DEFAULT_AGENT_TOOL_SPECS.map((spec) => spec.id)).toEqual([
      'codex',
      'claude-code',
      'gemini-cli',
      'opencode',
      'openclaw',
      'hermes-agent',
    ]);
  });
});
