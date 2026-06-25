import { describe, expect, it } from 'vitest';

import {
  readAgentRuntimeRedactedSessionContent,
  type AgentRuntimeSessionBoundaryRequest,
} from '../../../../lib/bridge';
import defaultCapability from '../../../../src-tauri/capabilities/default.json';
import redactedReaderPermission from '../../../../src-tauri/permissions/read-agent-runtime-redacted-session-content.json';

describe('F70 agent runtime redacted session content reader bridge', () => {
  it('returns a blocked redacted response outside Tauri', async () => {
    const request: AgentRuntimeSessionBoundaryRequest = {
      approved: true,
      rootPaths: ['/Users/example/.codex/sessions'],
      targetPath: '/Users/example/.codex/sessions/session-a.json',
      maxBytes: 4096,
    };

    const result = await readAgentRuntimeRedactedSessionContent(request);
    const displayText = JSON.stringify(result);

    expect(result.status).toBe('blocked');
    expect(result.blockedReasons).toEqual(['Redacted session content reader requires Tauri runtime.']);
    expect(result.contentRedacted).toBe(true);
    expect(result.targetNameRedacted).toBe(true);
    expect(result.structure).toBeNull();
    expect(displayText).not.toContain('session-a.json');
  });

  it('registers the redacted reader command permission in the default capability', () => {
    expect(defaultCapability.permissions).toContain('read-agent-runtime-redacted-session-content');
    expect(redactedReaderPermission.permission[0].commands.allow).toContain(
      'read_agent_runtime_redacted_session_content',
    );
  });
});
