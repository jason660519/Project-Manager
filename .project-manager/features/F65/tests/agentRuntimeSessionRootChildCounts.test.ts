import { describe, expect, it } from 'vitest';
import {
  buildAgentRuntimeSessionImportPreview,
  scanAgentEnvironment,
  type AgentRuntimeFilesystemSnapshot,
} from '../../../../lib/agent-runtime';

const HOME = '/Users/example';
const PROJECT_ROOT = '/Users/example/project';
const SESSION_ROOT = `${HOME}/.codex/sessions`;
const SECRET_PATH = `${HOME}/.codex/auth.json`;

function snapshot(input: Partial<AgentRuntimeFilesystemSnapshot>): AgentRuntimeFilesystemSnapshot {
  return {
    existingPaths: [],
    availableCommands: [],
    homeDir: HOME,
    projectRoot: PROJECT_ROOT,
    ...input,
  };
}

describe('Agent Runtime session root child counts', () => {
  it('attaches child counts to sessions-root observations and import preview candidates', () => {
    const inventory = scanAgentEnvironment(
      snapshot({
        existingPaths: [`${HOME}/.codex`, SESSION_ROOT, SECRET_PATH],
        availableCommands: ['codex'],
        sessionRootChildCounts: {
          [SESSION_ROOT]: 3,
          [SECRET_PATH]: 99,
        },
        fileContents: {
          [SESSION_ROOT]: 'private transcript should never be read',
          [SECRET_PATH]: 'sk-ant-secret',
        },
      }),
      { homeDir: HOME, projectRoot: PROJECT_ROOT },
    );

    const codex = inventory.rows.find((row) => row.toolId === 'codex');
    const sessionRoot = codex?.paths.find((path) => path.kind === 'sessions-root' && path.path === SESSION_ROOT);
    const secretPath = codex?.paths.find((path) => path.path === SECRET_PATH);
    const preview = buildAgentRuntimeSessionImportPreview(codex!);
    const previewRoot = preview.rootCandidates.find((root) => root.path === SESSION_ROOT);
    const displayText = JSON.stringify({ sessionRoot, secretPath, preview });

    expect(sessionRoot?.childCount).toBe(3);
    expect(secretPath?.childCount).toBeUndefined();
    expect(previewRoot?.childCount).toBe(3);
    expect(displayText).not.toContain('private transcript should never be read');
    expect(displayText).not.toContain('sk-ant-secret');
    expect(displayText).not.toContain('99');
  });

  it('keeps older snapshots without child count metadata backward compatible', () => {
    const inventory = scanAgentEnvironment(
      snapshot({
        existingPaths: [`${HOME}/.codex`, SESSION_ROOT],
        availableCommands: ['codex'],
      }),
      { homeDir: HOME, projectRoot: PROJECT_ROOT },
    );

    const codex = inventory.rows.find((row) => row.toolId === 'codex');
    const preview = buildAgentRuntimeSessionImportPreview(codex!);

    expect(codex?.paths.find((path) => path.path === SESSION_ROOT)?.childCount).toBeUndefined();
    expect(preview.rootCandidates.find((root) => root.path === SESSION_ROOT)?.childCount).toBeUndefined();
  });
});
