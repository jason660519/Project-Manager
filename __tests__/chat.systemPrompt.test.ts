// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAIAssistantsConsoleState } from '../lib/ai-assistants/repository';
import type { ChatContext } from '../lib/chat/types';
import {
  buildProjectContext,
  composeSystemPrompt,
  resolveAssistantPersona,
} from '../lib/chat/chatAgent';

// Bridge is imported transitively by chatAgent; stub it so no Tauri APIs load.
vi.mock('../lib/bridge', () => ({
  callLlmRouted: vi.fn(),
  isTauriRuntime: vi.fn().mockReturnValue(false),
  killProcess: vi.fn(),
  onAgentExit: vi.fn().mockResolvedValue(vi.fn()),
  onAgentStdout: vi.fn().mockResolvedValue(vi.fn()),
  safeUnlisten: vi.fn(),
  spawnAgent: vi.fn(),
}));

vi.mock('../lib/ai-assistants/repository', () => ({
  loadAIAssistantsConsoleState: vi.fn(),
}));

const DEFAULT_PERSONA_MARK = '小龍蝦';

function setPersona(...sources: Array<{ kind: string; content: string }>): void {
  vi.mocked(loadAIAssistantsConsoleState).mockReturnValue({
    selectedAssistantId: 'a1',
    assistants: [{ id: 'a1', profileSources: sources }],
  } as unknown as ReturnType<typeof loadAIAssistantsConsoleState>);
}

function makeContext(overrides: Partial<ChatContext> = {}): ChatContext {
  return {
    currentView: 'chat' as ChatContext['currentView'],
    adapters: [],
    activeRunCount: 0,
    features: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  setPersona({ kind: 'identity', content: '我是測試身分 Tester' });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('composeSystemPrompt', () => {
  it('injects persona from the selected assistant profile', () => {
    const prompt = composeSystemPrompt(makeContext());
    expect(prompt).toContain('我是測試身分 Tester');
    expect(prompt).not.toContain(DEFAULT_PERSONA_MARK);
  });

  it('joins identity + soul + user profile sources in order', () => {
    setPersona(
      { kind: 'user', content: 'USER_PREF' },
      { kind: 'identity', content: 'IDENTITY_TEXT' },
      { kind: 'soul', content: 'SOUL_TONE' },
      { kind: 'tools', content: 'TOOLS_SHOULD_BE_IGNORED' },
    );
    const prompt = composeSystemPrompt(makeContext());
    // Injection order is identity → soul → user, regardless of array order.
    expect(prompt.indexOf('IDENTITY_TEXT')).toBeLessThan(prompt.indexOf('SOUL_TONE'));
    expect(prompt.indexOf('SOUL_TONE')).toBeLessThan(prompt.indexOf('USER_PREF'));
    // Non-persona kinds (tools) are excluded.
    expect(prompt).not.toContain('TOOLS_SHOULD_BE_IGNORED');
  });

  it('includes the dynamic project-context layer', () => {
    const prompt = composeSystemPrompt(makeContext());
    expect(prompt).toContain('**專案資訊：**');
  });

  it('APPENDS the override as highest-priority — it does not replace persona/context', () => {
    const prompt = composeSystemPrompt(makeContext(), '只用英文回答');
    expect(prompt).toContain('我是測試身分 Tester'); // persona survives
    expect(prompt).toContain('**專案資訊：**'); // context survives
    expect(prompt).toContain('只用英文回答'); // override present
    expect(prompt).toContain('使用者附加指示'); // marked as highest priority
    // Override is the last layer.
    expect(prompt.indexOf('只用英文回答')).toBeGreaterThan(prompt.indexOf('**專案資訊：**'));
  });

  it('omits the override block when the textarea is empty/whitespace', () => {
    const prompt = composeSystemPrompt(makeContext(), '   ');
    expect(prompt).not.toContain('使用者附加指示');
    expect(prompt).toContain('我是測試身分 Tester');
  });

  it('falls back to the default persona when no profile content is configured', () => {
    setPersona({ kind: 'identity', content: '   ' }, { kind: 'soul', content: '' });
    const prompt = composeSystemPrompt(makeContext());
    expect(prompt).toContain(DEFAULT_PERSONA_MARK);
  });

  it('truncates ONLY the context layer, never persona or override', () => {
    const bigFeatures = Array.from({ length: 4000 }, (_, i) => ({
      id: `F${i}`,
      name: `feature-${i}`,
      status: 'in-progress',
      phase: 'build',
      progress: 0,
      category: 'core',
    }));
    const prompt = composeSystemPrompt(
      makeContext({ features: bigFeatures as unknown as ChatContext['features'] }),
      'OVERRIDE_MUST_SURVIVE',
    );
    expect(buildProjectContext(makeContext({ features: bigFeatures as unknown as ChatContext['features'] })).length)
      .toBeLessThanOrEqual(5500);
    expect(prompt).toContain('我是測試身分 Tester'); // persona intact
    expect(prompt).toContain('OVERRIDE_MUST_SURVIVE'); // override intact
    expect(prompt).toContain('使用者附加指示');
  });
});

describe('resolveAssistantPersona', () => {
  it('returns the default persona on the server (no window)', () => {
    vi.stubGlobal('window', undefined);
    expect(resolveAssistantPersona()).toContain(DEFAULT_PERSONA_MARK);
  });

  it('returns the default persona when loading console state throws', () => {
    vi.mocked(loadAIAssistantsConsoleState).mockImplementation(() => {
      throw new Error('corrupt state');
    });
    expect(resolveAssistantPersona()).toContain(DEFAULT_PERSONA_MARK);
  });
});
