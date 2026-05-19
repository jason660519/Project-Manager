import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendChatMessage } from '../lib/chat/chatAgent';
import type { ChatContext } from '../lib/chat/types';
import { spawnAgent } from '../lib/bridge';
import { createRuntimeAdapterFromConfig } from '../lib/adapters/registry';

// Mock global fetch so AI chat API fallback doesn't throw in tests
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ content: 'Hello from the AI assistant!' }),
});
vi.stubGlobal('fetch', mockFetch);

vi.mock('../lib/bridge', () => ({
  onAgentExit: vi.fn().mockResolvedValue(vi.fn()),
  onAgentStdout: vi.fn().mockResolvedValue(vi.fn()),
  spawnAgent: vi.fn().mockResolvedValue(0),
}));

vi.mock('../lib/adapters/registry', () => ({
  createRuntimeAdapterFromConfig: vi.fn().mockReturnValue({
    execute: vi.fn().mockResolvedValue({
      success: true,
      command: 'codex',
      args: ['exec', '--cwd', '/tmp/project-manager', 'prompt'],
    }),
  }),
  getAdapterExecutionKind: vi.fn((adapter) => adapter?.type === 'agent' ? 'agent-cli' : adapter?.type),
}));

const context: ChatContext = {
  currentView: 'dashboard',
  selectedProject: {
    id: 'pm',
    configPath: '/tmp/config.json',
    config: {
      schemaVersion: 5,
      id: 'pm',
      project: { name: 'Project Manager', root: '/tmp/project-manager', defaultIDE: 'Cursor' },
      features: [
        { id: 'F14', name: 'Sidebar Chatbot', category: 'Frontend', status: 'in_progress', progress: 20, paths: { implementation: 'components/chat' } },
      ],
      adapters: { ides: [], agents: [] },
    },
  },
  adapters: [
    { id: 'codex', name: 'Codex', type: 'agent', command: 'codex', argsTemplate: ['exec', '--cwd', '{root}', '{prompt}'] },
  ],
  activeRunCount: 1,
  recentRuns: [],
};

describe('sendChatMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes /go logs without spawning an agent', async () => {
    const navigate = vi.fn();
    const result = await sendChatMessage({ content: '/go logs', history: [], context, navigate });
    expect(navigate).toHaveBeenCalledWith('/logs');
    expect(spawnAgent).not.toHaveBeenCalled();
    expect(result.content).toMatch(/logs/i);
  });

  it('summarizes project status locally', async () => {
    const result = await sendChatMessage({ content: '/status', history: [], context });
    expect(result.content).toContain('Project: Project Manager');
    expect(result.content).toContain('Active runs: 1');
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('returns help locally', async () => {
    const result = await sendChatMessage({ content: '/help', history: [], context });
    expect(result.content).toContain('/status');
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('dispatches general questions through selected project adapter', async () => {
    const result = await sendChatMessage({ content: 'What should I work on?', history: [], context });
    expect(createRuntimeAdapterFromConfig).toHaveBeenCalledWith(context.adapters[0]);
    expect(spawnAgent).toHaveBeenCalledWith({
      command: 'codex',
      args: ['exec', '--cwd', '/tmp/project-manager', 'prompt'],
      workingDir: '/tmp/project-manager',
    });
    expect(result.content).toMatch(/configured project agent/i);
  });

  it('falls back to AI chat API when no agent adapter is configured', async () => {
    const result = await sendChatMessage({
      content: 'question',
      history: [],
      context: { ...context, adapters: [] },
    });
    expect(result.error).toBeFalsy();
    expect(mockFetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }));
    expect(result.content).toContain('Hello from the AI assistant');
  });

  it('returns error when AI chat API call fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await sendChatMessage({
      content: 'question',
      history: [],
      context: { ...context, adapters: [] },
    });
    expect(result.error).toBe(true);
    expect(result.content).toMatch(/could not reach/i);
  });

  it('falls back to AI chat API when no project is selected', async () => {
    const result = await sendChatMessage({
      content: 'what is agile?',
      history: [],
      context: { currentView: 'chat', adapters: [], activeRunCount: 0, recentRuns: [] },
    });
    expect(result.error).toBeFalsy();
    expect(mockFetch).toHaveBeenCalled();
    expect(result.content).toContain('Hello from the AI assistant');
  });
});
