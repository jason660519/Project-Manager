import { describe, expect, it } from 'vitest';

import { buildAgentRuntimeSnapshot } from '../../../../lib/bridge';

describe('F58 agent runtime snapshot bridge', () => {
  it('returns an empty metadata-only snapshot outside Tauri', async () => {
    const snapshot = await buildAgentRuntimeSnapshot('/tmp/project-manager');

    expect(snapshot).toEqual({
      existingPaths: [],
      availableCommands: [],
    });
  });
});
