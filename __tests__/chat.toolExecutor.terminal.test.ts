import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createDefaultTerminalBoundaries, splitCompoundCommand } from '../lib/ai-assistants/terminalBoundaries';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execFileSync: vi.fn(() => 'ok-output'),
  };
});

import { executeToolCall, type ToolContext } from '../lib/chat/toolExecutor';

function baseContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    projectRoot: process.cwd(),
    assistantId: 'pm-assistant',
    runCommandPermission: 'granted',
    terminalBoundaries: createDefaultTerminalBoundaries(),
    ...overrides,
  };
}

describe('toolExecutor run_command terminal boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks when tool:run_command permission is blocked', async () => {
    const result = await executeToolCall(
      { id: '1', name: 'run_command', arguments: { command: 'pwd' } },
      baseContext({ runCommandPermission: 'blocked' }),
    );
    expect(result.error).toBe(true);
    expect(result.content).toContain('tool:run_command is blocked');
  });

  it('returns guarded confirmation payload when permission is guarded', async () => {
    const result = await executeToolCall(
      { id: '2', name: 'run_command', arguments: { command: 'pwd' } },
      baseContext({ runCommandPermission: 'guarded' }),
    );
    expect(result.error).toBe(true);
    expect(result.content).toContain('__GUARDED_CONFIRMATION__');
  });

  it('allows guarded execution when tool call id is confirmed', async () => {
    const result = await executeToolCall(
      { id: '2', name: 'run_command', arguments: { command: 'pwd' } },
      baseContext({ runCommandPermission: 'guarded', confirmedToolCallIds: ['2'] }),
    );
    expect(result.error).not.toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
  });

  it('blocks blacklisted commands when permission is granted', async () => {
    const result = await executeToolCall(
      { id: '3', name: 'run_command', arguments: { command: 'sudo npm install' } },
      baseContext({ runCommandPermission: 'granted' }),
    );
    expect(result.error).toBe(true);
    expect(result.content).toContain('__TERMINAL_BLOCKED__');
  });

  it('blocks unknown commands under default-deny', async () => {
    const result = await executeToolCall(
      { id: '4', name: 'run_command', arguments: { command: 'unknown-cli --help' } },
      baseContext({ runCommandPermission: 'granted' }),
    );
    expect(result.error).toBe(true);
    expect(result.content).toContain('__TERMINAL_BLOCKED__');
  });

  it('allows whitelisted pwd when permission is granted', async () => {
    const result = await executeToolCall(
      { id: '5', name: 'run_command', arguments: { command: 'pwd' } },
      baseContext({ runCommandPermission: 'granted' }),
    );
    expect(result.error).not.toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
  });

  it('blocks compound commands when any segment is blacklisted', async () => {
    const segments = splitCompoundCommand('git status --short && sudo ls');
    expect(segments).toEqual(['git status --short', 'sudo ls']);

    const result = await executeToolCall(
      { id: '6', name: 'run_command', arguments: { command: 'git status --short && sudo ls' } },
      baseContext({ runCommandPermission: 'granted' }),
    );
    expect(result.error).toBe(true);
    expect(result.content).toContain('__TERMINAL_BLOCKED__');
  });
});
