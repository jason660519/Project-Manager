import { describe, expect, it, vi } from 'vitest';
import {
  safeUnlisten,
  type AgentExitPayload,
  type AgentStdioPayload,
} from '../lib/bridge';

// Capture the callback the bridge registers with Tauri so we can replay a raw
// event payload and assert the bridge forwards `spawnToken` (ADR-014).
const listeners = new Map<string, (e: { payload: unknown }) => void>();
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (event: string, cb: (e: { payload: unknown }) => void) => {
    listeners.set(event, cb);
    return () => listeners.delete(event);
  }),
}));

describe('agent event payload contract (spawnToken)', () => {
  it('forwards spawnToken on agent-stdout / agent-stderr', async () => {
    const { onAgentStdout, onAgentStderr } = await import('../lib/bridge');
    const stdout: AgentStdioPayload[] = [];
    const stderr: AgentStdioPayload[] = [];
    await onAgentStdout((p) => stdout.push(p));
    await onAgentStderr((p) => stderr.push(p));

    listeners.get('agent-stdout')?.({ payload: { pid: 111, spawnToken: 7, line: 'hi' } });
    listeners.get('agent-stderr')?.({ payload: { pid: 111, spawnToken: 7, line: 'oops' } });

    expect(stdout[0]).toEqual({ pid: 111, spawnToken: 7, line: 'hi' });
    expect(stderr[0]).toEqual({ pid: 111, spawnToken: 7, line: 'oops' });
  });

  it('forwards spawnToken on agent-exit', async () => {
    const { onAgentExit } = await import('../lib/bridge');
    const exits: AgentExitPayload[] = [];
    await onAgentExit((p) => exits.push(p));

    listeners.get('agent-exit')?.({ payload: { pid: 111, spawnToken: 7, code: 0 } });

    expect(exits[0]).toEqual({ pid: 111, spawnToken: 7, code: 0 });
  });
});

describe('safeUnlisten', () => {
  it('no-ops when unlisten is undefined', () => {
    expect(() => safeUnlisten(undefined)).not.toThrow();
  });

  it('calls the provided unlisten once', () => {
    const unlisten = vi.fn();
    safeUnlisten(unlisten);
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('swallows double-unlisten errors from Tauri event registry', () => {
    const unlisten = vi.fn(() => {
      throw new TypeError("undefined is not an object (evaluating 'listeners[eventId].handlerId')");
    });
    expect(() => safeUnlisten(unlisten)).not.toThrow();
    expect(() => safeUnlisten(unlisten)).not.toThrow();
  });
});
