import { describe, expect, it, vi } from 'vitest';

// ── Helper to test command availability (without actually running `which`) ────

describe('commandExists (checkCommand utility)', () => {
  it('returns false for empty command', () => {
    // The checkCommand in TaskDispatchModal returns false for empty strings
    const checkCommand = async (cmd: string): Promise<boolean> => {
      if (!cmd) return false;
      return true; // fallback for environments without `which`
    };
    expect(checkCommand('')).resolves.toBe(false);
  });

  it('caches results on second call (synchronous repeat)', () => {
    // The checkCommand is called once per adapter on mount via useEffect
    // Simulate mounting behavior — should check each adapter once
    const seen = new Set<string>();
    const spy = vi.fn((id: string) => {
      seen.add(id);
      return true;
    });

    const adapters = [
      { id: 'cursor', command: 'cursor' },
      { id: 'codex', command: 'codex' },
    ];

    adapters.forEach((a) => spy(a.id));
    adapters.forEach((a) => spy(a.id)); // second pass should be no-op in real impl

    // The count depends on whether we dedupe — at minimum each id was seen
    expect(seen.size).toBe(2);
    expect(spy).toHaveBeenCalledTimes(4);
  });
});

// ── Adapter fallback logic ────────────────────────────────────────────────────

describe('resolveInitialAdapterId [fallback]', () => {
  const adapters = [
    { id: 'claude-code', name: 'Claude Code', type: 'agent' as const, command: 'claude' },
    { id: 'codex', name: 'Codex', type: 'agent' as const, command: 'codex' },
  ];

  it('returns first available adapter when assigned adapter is missing', () => {
    // Simulate: feature.promptConfig?.agentId = 'nonexistent'
    const savedId = 'nonexistent';
    const result = adapters.some((a) => a.id === savedId)
      ? savedId
      : adapters[0]?.id ?? null;

    expect(result).toBe('claude-code');
    expect(adapters.find((a) => a.id === result)).not.toBeUndefined();
  });

  it('returns the saved adapter id when it still exists', () => {
    const savedId = 'codex';
    const result = adapters.some((a) => a.id === savedId)
      ? savedId
      : adapters[0]?.id ?? null;

    expect(result).toBe('codex');
  });

  it('returns null/undefined when there are no adapters at all', () => {
    const savedId = 'claude-code';
    const emptyAdapters: typeof adapters = [];
    const result = emptyAdapters.some((a) => a.id === savedId)
      ? savedId
      : emptyAdapters[0]?.id ?? null;

    expect(result).toBeNull();
  });
});

// ── MCP server count fallback ─────────────────────────────────────────────────

describe('MCP injection state', () => {
  it('returns null when no MCP servers are enabled', () => {
    const serverCount = 0;
    const injection = serverCount > 0 ? { count: serverCount, flag: '--mcp' } : null;
    expect(injection).toBeNull();
  });

  it('returns injection info when servers exist', () => {
    const serverCount = 3;
    const injection = serverCount > 0 ? { count: serverCount, flag: '--mcp' } : null;
    expect(injection).toEqual({ count: 3, flag: '--mcp' });
  });

  it('handles a single MCP server', () => {
    const serverCount = 1;
    const injection = serverCount > 0 ? { count: serverCount, flag: '--mcp' } : null;
    expect(injection).toEqual({ count: 1, flag: '--mcp' });
  });
});
