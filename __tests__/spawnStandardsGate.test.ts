import { beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnAgent, evaluateTerminalCommandBridge, listGlobalCliInventory } = vi.hoisted(
  () => ({
    spawnAgent: vi.fn().mockResolvedValue(4242),
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
    expect(spawnAgent.mock.calls[0]?.[0]).not.toHaveProperty('skipSystemCliInventoryCheck');
  });

  it('does not spawn when npm is not exposed', async () => {
    const { loadSystemCliExposureMap } = await import('../lib/storage/system-cli');
    vi.mocked(loadSystemCliExposureMap).mockReturnValueOnce({ npm: false });
    await expect(spawnStandardsGateRun('i18n', '/tmp/pm-root', true)).rejects.toBeInstanceOf(
      StandardsGateRunError,
    );
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('fires onSpawnStart after preflight and immediately before spawnAgent', async () => {
    const order: string[] = [];
    evaluateTerminalCommandBridge.mockImplementationOnce(async () => {
      order.push('preflight');
      return { decision: 'allowed' };
    });
    spawnAgent.mockImplementationOnce(async () => {
      order.push('spawn');
      return 4242;
    });
    await spawnStandardsGateRun('i18n', '/tmp/pm-root', true, () => order.push('onSpawnStart'));
    // The early-exit capture window must open only around the real spawn — after
    // all async preflight, just before the PID-return race — so dispatch exits
    // during preflight are never staged (PR #15 review).
    expect(order).toEqual(['preflight', 'onSpawnStart', 'spawn']);
  });

  it('never opens the spawn window when a policy layer blocks the gate', async () => {
    const { loadSystemCliExposureMap } = await import('../lib/storage/system-cli');
    vi.mocked(loadSystemCliExposureMap).mockReturnValueOnce({ npm: false });
    const onSpawnStart = vi.fn();
    await expect(
      spawnStandardsGateRun('i18n', '/tmp/pm-root', true, onSpawnStart),
    ).rejects.toBeInstanceOf(StandardsGateRunError);
    expect(onSpawnStart).not.toHaveBeenCalled();
    expect(spawnAgent).not.toHaveBeenCalled();
  });
});
