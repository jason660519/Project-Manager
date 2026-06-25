import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  listAgentRuntimeRedactedSessionTargets,
  type AgentRuntimeSessionTargetListRequest,
} from '../../../../lib/bridge';

const repoRoot = path.resolve(__dirname, '../../../..');

describe('F77 Agent Runtime native redacted session target lister bridge', () => {
  it('returns a blocked non-Tauri fallback without exposing roots as display data', async () => {
    const request: AgentRuntimeSessionTargetListRequest = {
      approved: true,
      rootPaths: ['/Users/example/.codex/sessions'],
      maxTargets: 5,
      maxDepth: 1,
    };

    const result = await listAgentRuntimeRedactedSessionTargets(request);

    expect(result).toEqual({
      status: 'blocked',
      targets: [],
      maxTargets: 5,
      maxDepth: 1,
      contentRedacted: true,
      targetNamesRedacted: true,
      blockedReasons: ['Redacted session target lister requires Tauri runtime.'],
    });
    expect(JSON.stringify(result)).not.toContain('.codex/sessions');
    expect(JSON.stringify(result)).not.toContain('session-a.json');
  });

  it('registers a Tauri permission and default capability for the native target lister', () => {
    const permissionPath = path.join(
      repoRoot,
      'src-tauri/permissions/list-agent-runtime-redacted-session-targets.json',
    );
    const capabilityPath = path.join(repoRoot, 'src-tauri/capabilities/default.json');

    const permission = JSON.parse(fs.readFileSync(permissionPath, 'utf8'));
    const capability = JSON.parse(fs.readFileSync(capabilityPath, 'utf8'));

    expect(capability.permissions).toContain('list-agent-runtime-redacted-session-targets');
    expect(JSON.stringify(permission)).toContain('list_agent_runtime_redacted_session_targets');
    expect(JSON.stringify(permission)).not.toContain('read_agent_runtime_redacted_session_envelope');
  });
});
