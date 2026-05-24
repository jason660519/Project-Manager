import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runProjectScan } from '../lib/scanner/runProjectScan';
import type { ProjectManagerConfig } from '../lib/types';

const { callAnthropicMock, callOpenAICompatibleMock } = vi.hoisted(() => ({
  callAnthropicMock: vi.fn(),
  callOpenAICompatibleMock: vi.fn(),
}));

vi.mock('../lib/bridge', () => ({
  callAnthropic: (...args: unknown[]) => callAnthropicMock(...args),
  callGemini: vi.fn(),
  callOpenAICompatible: (...args: unknown[]) => callOpenAICompatibleMock(...args),
  isModelNotFoundError: (raw: string) => /model not found/i.test(raw),
}));

vi.mock('../lib/keys/loadProviderKey', () => ({
  hasProviderKey: vi.fn(async () => true),
  loadProviderKey: vi.fn(async (provider: string) => `${provider}-key`),
}));

vi.mock('../lib/scanner/buildContextBridge', () => ({
  buildProjectContextBridge: vi.fn(async () => ({
    source: '/tmp/demo',
    projectName: 'Demo',
    directoryTree: 'app/\n  dashboard/page.tsx',
    sectionCandidates: [
      {
        id: 'route:dashboard',
        label: '/dashboard',
        kind: 'route',
        path: 'app/dashboard/page.tsx',
        evidencePaths: ['app/dashboard/page.tsx'],
      },
    ],
    inventoryPaths: ['app', 'app/dashboard', 'app/dashboard/page.tsx'],
    keyFiles: {},
    detectedIDEs: ['Cursor'],
    detectedAgents: [],
  })),
}));

function config(name: string, features: ProjectManagerConfig['features']): ProjectManagerConfig {
  return {
    schemaVersion: 7,
    id: `${name}-id`,
    project: { name, root: '/tmp/demo', defaultIDE: 'Cursor' },
    features,
    adapters: { ides: [{ id: 'cursor', name: 'Cursor', type: 'ide', command: 'cursor' }], agents: [] },
  };
}

describe('runProjectScan parallel initialization', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    window.localStorage.clear();
    callAnthropicMock.mockReset();
    callOpenAICompatibleMock.mockReset();
  });

  it('starts two providers immediately and selects the better validated quorum report', async () => {
    callAnthropicMock.mockResolvedValue({
      content: JSON.stringify(
        config('Demo', [
          {
            id: 'F01',
            name: 'API',
            category: 'Core',
            status: 'todo',
            progress: 0,
            paths: {},
          },
        ]),
      ),
      inputTokens: 1,
      outputTokens: 1,
    });
    callOpenAICompatibleMock.mockResolvedValue({
      content: JSON.stringify(
        config('Demo', [
          {
            id: 'F01',
            name: 'Dashboard Overview',
            category: 'Frontend/UI',
            locatedSection: '/dashboard',
            status: 'todo',
            progress: 0,
            paths: { implementation: 'app/dashboard/page.tsx' },
            metadata: {
              initializationConfidence: 0.9,
              evidencePaths: ['app/dashboard/page.tsx'],
            },
          },
        ]),
      ),
      inputTokens: 1,
      outputTokens: 1,
    });

    const result = await runProjectScan('/tmp/demo', {
      quorumDelayMs: 60000,
      providerTimeoutMs: 60000,
    });

    expect(callAnthropicMock).toHaveBeenCalledTimes(1);
    expect(callOpenAICompatibleMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.providerUsed).toBe('openai');
    expect(result.quorumSummary).toMatchObject({
      mode: 'fast',
      requiredReports: 2,
      validReports: 2,
      selectedProvider: 'openai',
    });
  });
});
