import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ChannelCatalog } from '../lib/types/channels';
import type { ProjectEntry } from '../lib/types';

const listProjects = vi.fn<() => Promise<ProjectEntry[]>>();

vi.mock('../lib/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/storage')>();
  return {
    ...actual,
    getProjectsRepository: () => ({
      listProjects,
    }),
  };
});

const { resolveTelegramCommandReply } = await import('../lib/channels/telegram-router');

const catalog: ChannelCatalog = {
  channels: [],
  commandMappings: [
    {
      id: 'run',
      trigger: '/run',
      action: 'run_feature',
      description: 'Request a guarded feature run',
      enabled: true,
    },
  ],
};

function projectFixture(): ProjectEntry {
  return {
    id: 'project-manager',
    configPath: '/Users/Project-Manager/.project-manager/config.json',
    config: {
      schemaVersion: 8,
      id: 'project-manager',
      project: {
        name: 'Project Manager',
        root: '/Users/Project-Manager',
        defaultIDE: 'Cursor',
      },
      features: [
        {
          id: 'F46',
          name: 'PM Mobile Voice Remote Control',
          category: 'Mobile/Remote Control',
          status: 'in_progress',
          progress: 10,
          paths: {
            implementation: 'docs/architecture/ADR-015-mobile-voice-remote-control.md',
          },
        },
      ],
      adapters: {
        ides: [],
        agents: [
          {
            id: 'codex',
            name: 'Codex',
            type: 'agent',
            command: 'codex',
            argsTemplate: ['--prompt', '{prompt}'],
          },
        ],
      },
    },
  };
}

describe('Telegram router mobile remote control behavior', () => {
  beforeEach(() => {
    listProjects.mockReset();
  });

  test('turns /run into a guarded request instead of a dispatched process', async () => {
    listProjects.mockResolvedValueOnce([projectFixture()]);

    const reply = await resolveTelegramCommandReply('/run F46', catalog);

    expect(reply).toContain('Guarded run request prepared for [F46]');
    expect(reply).toContain('Project: Project Manager');
    expect(reply).toContain('Agent: Codex');
    expect(reply).toContain('Command: codex');
    expect(reply).toContain('Open Project Manager Desktop to review and approve the run.');
    expect(reply).not.toContain('Dispatched');
    expect(reply).not.toContain('PID');
  });

  test('keeps dangerous shell-like requests blocked before project lookup', async () => {
    const reply = await resolveTelegramCommandReply('/run delete my project folder', catalog);

    expect(reply).toContain('Blocked:');
    expect(listProjects).not.toHaveBeenCalled();
  });
});
