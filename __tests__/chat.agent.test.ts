import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendChatMessage } from '../lib/chat/chatAgent';
import type { ChatContext } from '../lib/chat/types';
import { callLlmRouted, isTauriRuntime, killProcess, spawnAgent } from '../lib/bridge';
import { createRuntimeAdapterFromConfig } from '../lib/adapters/registry';

// Mock global fetch so AI chat API fallback doesn't throw in tests
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ content: 'Hello from the AI assistant!' }),
});
vi.stubGlobal('fetch', mockFetch);

vi.mock('../lib/bridge', () => ({
  callLlmRouted: vi.fn().mockResolvedValue({
    content: 'Hello from native stored-key chat!',
    inputTokens: 1,
    outputTokens: 2,
    provider: 'openai',
    model: 'gpt-4o',
    routeDecision: {
      routeDecisionId: 'route-test',
      modelAlias: 'pm-code',
      strategy: 'deterministic-fallback-v1',
      selectedProvider: 'openai',
      selectedModel: 'gpt-4o',
      degraded: false,
      attempts: [],
    },
  }),
  isTauriRuntime: vi.fn().mockReturnValue(false),
  killProcess: vi.fn().mockResolvedValue(undefined),
  onAgentExit: vi.fn().mockResolvedValue(vi.fn()),
  onAgentStdout: vi.fn().mockResolvedValue(vi.fn()),
  safeUnlisten: vi.fn((fn: (() => void) | undefined) => {
    fn?.();
  }),
  spawnAgent: vi.fn().mockResolvedValue({ pid: 0, spawnToken: 0 }),
}));

vi.mock('../lib/adapters/registry', () => ({
  createRuntimeAdapterFromConfig: vi.fn().mockReturnValue({
    execute: vi.fn().mockResolvedValue({
      success: true,
      command: 'codex',
      args: ['exec', '--cwd', '/tmp/project-manager', 'prompt'],
    }),
  }),
  getAdapterExecutionKind: vi.fn((adapter) => (adapter?.type === 'agent' ? 'agent-cli' : adapter?.type)),
}));

const context: ChatContext = {
  currentView: 'dashboard',
  selectedProject: {
    id: 'pm',
    configPath: '/tmp/config.json',
    config: {
      schemaVersion: 6,
      id: 'pm',
      project: { name: 'Project Manager', root: '/tmp/project-manager', defaultIDE: 'Cursor' },
      features: [
        {
          id: 'F14',
          name: 'Sidebar Chatbot',
          category: 'Frontend',
          status: 'in_progress',
          progress: 20,
          phase: 'development',
          paths: { implementation: 'components/chat' },
        },
      ],
      adapters: { ides: [], agents: [] },
    },
  },
  adapters: [
    {
      id: 'codex',
      name: 'Codex',
      type: 'agent',
      command: 'codex',
      argsTemplate: ['exec', '--cwd', '{root}', '{prompt}'],
    },
  ],
  activeRunCount: 1,
  recentRuns: [],
  features: [
    {
      id: 'F14',
      name: 'Sidebar Chatbot',
      category: 'Frontend',
      status: 'in_progress',
      progress: 20,
      phase: 'development',
      paths: { implementation: 'components/chat' },
    },
  ],
  dashboardProjects: ['Project Manager'],
};

describe('sendChatMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('routes /go logs without spawning an agent', async () => {
    const navigate = vi.fn();
    const result = await sendChatMessage({ content: '/go logs', history: [], context, navigate });
    expect(navigate).toHaveBeenCalledWith('/logs');
    expect(spawnAgent).not.toHaveBeenCalled();
    expect(result.content).toMatch(/logs/i);
  });

  it('returns enhanced Chinese-format /status without spanning an agent', async () => {
    const result = await sendChatMessage({ content: '/status', history: [], context });
    expect(result.content).toContain('Project Manager');
    expect(result.content).toContain('功能狀態分佈');
    expect(result.content).toContain('可用 Adapters');
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('returns help locally', async () => {
    const result = await sendChatMessage({ content: '/help', history: [], context });
    expect(result.content).toContain('/help');
    expect(result.content).toContain('/status');
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('returns feature details for /feature <id>', async () => {
    const result = await sendChatMessage({ content: '/feature F14', history: [], context });
    expect(result.content).toContain('F14');
    expect(result.content).toContain('Sidebar Chatbot');
    expect(result.content).toContain('in_progress');
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('returns a Project Dispatch Assistant decision package for /dispatch <id>', async () => {
    const result = await sendChatMessage({ content: '/dispatch F14', history: [], context });

    expect(result.content).toContain('Dispatch Decision Package');
    expect(result.content).toContain('F14');
    expect(result.content).toContain('Sidebar Chatbot');
    expect(result.content).toContain('Status: needs_review');
    expect(result.content).toContain('Codex');
    expect(result.content).toContain('Human lead reviews and edits the dispatch plan before execution.');
    expect(result.content).not.toContain('請從 Dashboard 或 Features 頁面使用 Dispatch 功能');
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('returns a Project Workflow Loop decision package for /workflow <id>', async () => {
    const result = await sendChatMessage({ content: '/workflow F14', history: [], context });

    expect(result.content).toContain('Project Workflow Loop Decision Package');
    expect(result.content).toContain('Template: Software Engineering Loop');
    expect(result.content).toContain('F14');
    expect(result.content).toContain('Sidebar Chatbot');
    expect(result.content).toContain('Persistent memory: handoff artifacts and evidence ledger');
    expect(result.content).toContain('No actor or command is executed by this package.');
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('returns error for non-existent feature', async () => {
    const result = await sendChatMessage({ content: '/feature F99', history: [], context });
    expect(result.content).toContain('找不到功能');
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('returns /runs summary', async () => {
    const ctxWithRuns: ChatContext = {
      ...context,
      activeRuns: [{ featureId: 'F01', featureName: 'Test Run', phase: 'development', startedAt: Date.now() }],
      recentRuns: [
        {
          pid: 1,
          featureId: 'F01',
          featureName: 'Test',
          command: 'test',
          args: [],
          startedAt: Date.now() - 60000,
          completedAt: Date.now(),
          exitCode: 0,
          success: true,
          logs: [],
        },
      ],
    };
    const result = await sendChatMessage({ content: '/runs', history: [], context: ctxWithRuns });
    expect(result.content).toContain('執行記錄');
    expect(result.content).toContain('Test');
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('returns /config summary', async () => {
    const result = await sendChatMessage({ content: '/config', history: [], context });
    expect(result.content).toContain('專案配置');
    expect(result.content).toContain('Codex');
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('returns /memory when no memory stored', async () => {
    const result = await sendChatMessage({ content: '/memory', history: [], context });
    expect(result.content).toContain('沒有任何');
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('stores assistant memory per selected project', async () => {
    const otherContext: ChatContext = {
      ...context,
      selectedProject: context.selectedProject
        ? {
            ...context.selectedProject,
            id: 'other-project',
            config: {
              ...context.selectedProject.config,
              id: 'other-project',
              project: {
                ...context.selectedProject.config.project,
                root: '/tmp/other-project',
              },
            },
          }
        : undefined,
    };

    await sendChatMessage({ content: 'search feature', history: [], context });
    await sendChatMessage({ content: 'search dashboard', history: [], context: otherContext });

    expect(JSON.parse(window.localStorage.getItem('pm-assistant-memory:pm') ?? '{}')).toMatchObject({
      lastSearch: 'feature',
    });
    expect(JSON.parse(window.localStorage.getItem('pm-assistant-memory:other-project') ?? '{}')).toMatchObject({
      lastSearch: 'dashboard',
    });
  });

  it('dispatches general questions through selected project adapter', async () => {
    const result = await sendChatMessage({ content: 'What should I work on?', history: [], context });
    expect(createRuntimeAdapterFromConfig).toHaveBeenCalledWith(context.adapters[0]);
    expect(spawnAgent).toHaveBeenCalledWith({
      command: 'codex',
      args: ['exec', '--cwd', '/tmp/project-manager', 'prompt'],
      workingDir: '/tmp/project-manager',
    });
    expect(result.content).toMatch(/Agent|發送/);
  });

  it('kills the spawned local agent process when chat is aborted', async () => {
    const controller = new AbortController();
    vi.mocked(spawnAgent).mockImplementationOnce(async () => {
      controller.abort();
      return { pid: 123, spawnToken: 7 };
    });

    await expect(sendChatMessage({
      content: 'run agent',
      history: [],
      context: { ...context, features: [] },
      abortSignal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });

    expect(killProcess).toHaveBeenCalledWith(123);
  });

  it('falls back to AI chat API when no agent adapter is configured', async () => {
    const result = await sendChatMessage({
      content: 'question',
      history: [],
      context: { ...context, adapters: [] },
    });
    expect(result.error).toBeFalsy();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }),
    );
    const payload = JSON.parse(mockFetch.mock.calls.at(-1)?.[1]?.body as string);
    expect(payload.apiKey).toBeUndefined();
    expect(result.content).toContain('Hello from the AI assistant');
  });

  it('passes only image attachments to the chat API fallback payload', async () => {
    const result = await sendChatMessage({
      content: 'Describe this screenshot',
      history: [],
      context: { ...context, selectedProject: undefined, adapters: [], features: [] },
      attachments: [
        {
          name: 'screen.png',
          type: 'image/png',
          size: 12,
          dataUrl: 'data:image/png;base64,aGVsbG8=',
        },
        {
          name: 'notes.md',
          type: 'text/markdown',
          size: 9,
          content: '# Notes',
        },
      ],
    });

    expect(result.error).toBeFalsy();
    const payload = JSON.parse(mockFetch.mock.calls.at(-1)?.[1]?.body as string);
    expect(payload.apiKey).toBeUndefined();
    expect(payload.attachments).toEqual([
      {
        name: 'screen.png',
        type: 'image/png',
        size: 12,
        dataUrl: 'data:image/png;base64,aGVsbG8=',
      },
    ]);
  });

  it('uses the Tauri stored-key chat bridge without sending keys through fetch', async () => {
    vi.mocked(isTauriRuntime).mockReturnValueOnce(true);
    const result = await sendChatMessage({
      content: 'question',
      history: [],
      context: { ...context, adapters: [] },
      chatSettings: { provider: 'openai', model: 'gpt-4o', systemPrompt: '' },
    });

    expect(result.error).toBeFalsy();
    expect(callLlmRouted).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openai',
      model: 'gpt-4o',
    }));
    expect(mockFetch).not.toHaveBeenCalledWith('/api/chat', expect.anything());
    expect(result.content).toContain('native stored-key chat');
    expect(result.routeDecision?.routeDecisionId).toBe('route-test');
  });

  it('passes image attachments through the Tauri stored-key bridge', async () => {
    vi.mocked(isTauriRuntime).mockReturnValueOnce(true);

    await sendChatMessage({
      content: 'What is in this screenshot?',
      history: [],
      context: { ...context, selectedProject: undefined, adapters: [], features: [] },
      chatSettings: { provider: 'openai', model: 'gpt-4o', systemPrompt: '' },
      attachments: [
        {
          name: 'screen.png',
          type: 'image/png',
          size: 12,
          dataUrl: 'data:image/png;base64,aGVsbG8=',
        },
      ],
    });

    expect(callLlmRouted).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openai',
      attachments: [{
        name: 'screen.png',
        type: 'image/png',
        size: 12,
        dataUrl: 'data:image/png;base64,aGVsbG8=',
      }],
    }));
  });

  it('returns Chinese error when AI chat API call fails', async () => {
    // Need two rejections: one for agent API, one for chat API
    mockFetch.mockRejectedValueOnce(new Error('Agent API error'));
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await sendChatMessage({
      content: 'question',
      history: [],
      context: { ...context, adapters: [] },
    });
    expect(result.error).toBe(true);
    expect(result.content).toMatch(/抱歉|無法/i);
  });

  it('falls back to AI chat API when no project is selected', async () => {
    const result = await sendChatMessage({
      content: 'what is agile?',
      history: [],
      context: {
        currentView: 'chat',
        adapters: [],
        activeRunCount: 0,
        recentRuns: [],
        features: [],
        dashboardProjects: [],
      },
    });
    expect(result.error).toBeFalsy();
    expect(mockFetch).toHaveBeenCalled();
    expect(result.content).toContain('Hello from the AI assistant');
  });

  it('routes Chinese "打開 dashboard"', async () => {
    const navigate = vi.fn();
    const result = await sendChatMessage({
      content: '打開 dashboard',
      history: [],
      context,
      navigate,
    });
    expect(navigate).toHaveBeenCalledWith('/project-progress-dashboard');
    expect(result.content).toContain('已打開');
  });

  it('routes Chinese "帶我去 logs"', async () => {
    const navigate = vi.fn();
    const result = await sendChatMessage({
      content: '帶我去 logs',
      history: [],
      context,
      navigate,
    });
    expect(navigate).toHaveBeenCalledWith('/logs');
  });
});
