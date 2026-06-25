import { describe, expect, it } from 'vitest';

import {
  readAgentRuntimeRedactedSessionEnvelope,
  type AgentRuntimeSessionBoundaryRequest,
} from '../../../../lib/bridge';
import defaultCapability from '../../../../src-tauri/capabilities/default.json';
import envelopePermission from '../../../../src-tauri/permissions/read-agent-runtime-redacted-session-envelope.json';

describe('F71 agent runtime redacted session envelope parser bridge', () => {
  it('returns a blocked redacted response outside Tauri', async () => {
    const request: AgentRuntimeSessionBoundaryRequest = {
      approved: true,
      rootPaths: ['/Users/example/.codex/sessions'],
      targetPath: '/Users/example/.codex/sessions/session-a.json',
      maxBytes: 4096,
    };

    const result = await readAgentRuntimeRedactedSessionEnvelope(request);
    const displayText = JSON.stringify(result);

    expect(result.status).toBe('blocked');
    expect(result.blockedReasons).toEqual(['Redacted session envelope parser requires Tauri runtime.']);
    expect(result.contentRedacted).toBe(true);
    expect(result.targetNameRedacted).toBe(true);
    expect(result.envelope).toBeNull();
    expect(displayText).not.toContain('session-a.json');
  });

  it('registers the envelope parser command permission in the default capability', () => {
    expect(defaultCapability.permissions).toContain('read-agent-runtime-redacted-session-envelope');
    expect(envelopePermission.permission[0].commands.allow).toContain(
      'read_agent_runtime_redacted_session_envelope',
    );
  });
});
