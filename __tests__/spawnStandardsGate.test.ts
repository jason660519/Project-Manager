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
    expect(spawnAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'npm',
        args: ['run', 'i18n:check'],
        workingDir: '/tmp/pm-root',
      }),
    );
    expect(spawnAgent.mock.calls[0]?.[0]).not.toHaveProperty('skipSystemCliInventoryCheck');
  });

  it('forwards onSpawnStart to spawnAgent.onBeforeNativeSpawn, after preflight', async () => {
    const order: string[] = [];
    evaluateTerminalCommandBridge.mockImplementationOnce(async () => {
      order.push('preflight');
      return { decision: 'allowed' };
    });
    // spawnAgent fires onBeforeNativeSpawn after its own bridge policy preflight,
    // immediately before the native spawn — emulate that ordering.
    spawnAgent.mockImplementationOnce(async (opts: { onBeforeNativeSpawn?: () => void }) => {
      opts.onBeforeNativeSpawn?.();
      order.push('spawn');
      return { pid: 4242, spawnToken: 7 };
    });
    await spawnStandardsGateRun('i18n', '/tmp/pm-root', true, () => order.push('onSpawnStart'));
    // The gate staging window opens only around the native spawn — after all
    // async preflight — so foreign exits during preflight aren't staged (PR #16).
    expect(order).toEqual(['preflight', 'onSpawnStart', 'spawn']);
  });

  it('never opens the staging window when a policy layer blocks the gate', async () => {
    const { loadSystemCliExposureMap } = await import('../lib/storage/system-cli');
    vi.mocked(loadSystemCliExposureMap).mockReturnValueOnce({ npm: false });
    const onSpawnStart = vi.fn();
    await expect(
      spawnStandardsGateRun('i18n', '/tmp/pm-root', true, onSpawnStart),
    ).rejects.toBeInstanceOf(StandardsGateRunError);
    expect(onSpawnStart).not.toHaveBeenCalled();
    expect(spawnAgent).not.toHaveBeenCalled();
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
