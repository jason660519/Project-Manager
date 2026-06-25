import { describe, expect, it } from 'vitest';

import {
  readAgentRuntimeSessionBoundary,
  type AgentRuntimeSessionBoundaryRequest,
} from '../../../../lib/bridge';
import defaultCapability from '../../../../src-tauri/capabilities/default.json';
import readerBoundaryPermission from '../../../../src-tauri/permissions/read-agent-runtime-session-boundary.json';

describe('F69 agent runtime session reader boundary bridge', () => {
  it('returns a blocked metadata-only response outside Tauri', async () => {
    const request: AgentRuntimeSessionBoundaryRequest = {
      approved: true,
      rootPaths: ['/Users/example/.codex/sessions'],
      targetPath: '/Users/example/.codex/sessions/session-a.json',
      maxBytes: 4096,
    };

    const result = await readAgentRuntimeSessionBoundary(request);
    const displayText = JSON.stringify(result);

    expect(result.status).toBe('blocked');
    expect(result.blockedReasons).toEqual(['Session reader boundary requires Tauri runtime.']);
    expect(result.contentRedacted).toBe(true);
    expect(result.targetNameRedacted).toBe(true);
    expect(displayText).not.toContain('session-a.json');
  });

  it('registers the Tauri command permission in the default capability', () => {
    expect(defaultCapability.permissions).toContain('read-agent-runtime-session-boundary');
    expect(readerBoundaryPermission.permission[0].commands.allow).toContain(
      'read_agent_runtime_session_boundary',
    );
  });
});
