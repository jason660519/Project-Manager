import { beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnAgent, evaluateTerminalCommandBridge, listGlobalCliInventory } = vi.hoisted(
  () => ({
    spawnAgent: vi.fn().mockResolvedValue({ pid: 4242, spawnToken: 1 }),
    evaluateTerminalCommandBridge: vi.fn().mockResolvedValue({ decision: 'allowed' }),
    listGlobalCliInventory: vi.fn().mockResolvedValue([{ command: 'npm', path: '/usr/bin/npm' }]),
  }),
);

vi.mock('../lib/bridge', () => ({
  spawnAgent,
  evaluateTerminalCommandBridge,
  listGlobalCliInventory,
}));

vi.mock('../lib/ai-assistants/repository', () => ({
  loadAIAssistantsConsoleState: vi.fn(() => ({
    selectedAssistantId: 'pm-assistant',
    assistants: [
      {
        id: 'pm-assistant',
        permissions: [{ scope: 'tool:run_command', state: 'granted' }],
        terminalBoundaries: undefined,
      },
    ],
  })),
}));

vi.mock('../lib/storage/system-cli', () => ({
  loadSystemCliExposureMap: vi.fn(() => ({ npm: true })),
}));

import { spawnStandardsGateRun, StandardsGateRunError } from '../lib/companyStandards/spawnStandardsGate';

describe('spawnStandardsGateRun', () => {
  beforeEach(() => {
    spawnAgent.mockClear();
    evaluateTerminalCommandBridge.mockClear();
    listGlobalCliInventory.mockClear();
  });

  it('spawns npm run when policy layers pass', async () => {
    await spawnStandardsGateRun('i18n', '/tmp/pm-root', true);
    expect(spawnAgent).toHaveBeenCalledWith({
      command: 'npm',
      args: ['run', 'i18n:check'],
      workingDir: '/tmp/pm-root',
    });
    // The early-exit window machinery is gone — no onBeforeNativeSpawn hook.
    expect(spawnAgent.mock.calls[0]?.[0]).not.toHaveProperty('onBeforeNativeSpawn');
    expect(spawnAgent.mock.calls[0]?.[0]).not.toHaveProperty('skipSystemCliInventoryCheck');
  });

  it('returns the Rust-issued spawnToken alongside the pid', async () => {
    spawnAgent.mockResolvedValueOnce({ pid: 4242, spawnToken: 99 });
    const result = await spawnStandardsGateRun('i18n', '/tmp/pm-root', true);
    expect(result.spawnToken).toBe(99);
    expect(result.pid).toBe(4242);
  });

  it('does not spawn when npm is not exposed', async () => {
    const { loadSystemCliExposureMap } = await import('../lib/storage/system-cli');
    vi.mocked(loadSystemCliExposureMap).mockReturnValueOnce({ npm: false });
    await expect(spawnStandardsGateRun('i18n', '/tmp/pm-root', true)).rejects.toBeInstanceOf(
      StandardsGateRunError,
    );
    expect(spawnAgent).not.toHaveBeenCalled();
  });
});
