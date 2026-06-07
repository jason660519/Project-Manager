import { describe, expect, test } from 'vitest';
import type { ProjectEntry } from '../lib/types';
import {
  formatFeatureRunRequestReply,
  prepareFeatureRunRequest,
} from '../lib/mobileRemote/runRequests';

function projectFixture(agentCount = 1): ProjectEntry {
  return {
    id: 'project-manager',
    configPath: '/repo/Project-Manager/.project-manager/config.json',
    config: {
      schemaVersion: 8,
      id: 'project-manager',
      project: {
        name: 'Project Manager',
        root: '/repo/Project-Manager',
        defaultIDE: 'Cursor',
      },
      features: [
        {
          id: 'F46',
          name: 'PM Mobile Voice Remote Control',
          category: 'Mobile/Remote Control',
          status: 'in_progress',
          progress: 10,
          paths: {},
        },
      ],
      adapters: {
        ides: [],
        agents:
          agentCount > 0
            ? [
                {
                  id: 'codex',
                  name: 'Codex',
                  type: 'agent',
                  command: 'codex',
                  argsTemplate: ['--prompt', '{prompt}'],
                },
              ]
            : [],
      },
    },
  };
}

describe('mobile remote run request previews', () => {
  test('prepares a non-executing confirmation payload for a feature run', () => {
    const result = prepareFeatureRunRequest('f46', [projectFixture()]);

    expect(result).toMatchObject({
      state: 'needs_confirmation',
      featureId: 'F46',
      projectName: 'Project Manager',
      agentName: 'Codex',
      command: 'codex',
      workingDir: '/repo/Project-Manager',
    });
  });

  test('formats guarded replies without dispatched process language', () => {
    const reply = formatFeatureRunRequestReply(prepareFeatureRunRequest('F46', [projectFixture()]));

    expect(reply).toContain('Guarded run request prepared for [F46]');
    expect(reply).toContain('Arguments template: --prompt {prompt}');
    expect(reply).toContain('Open Project Manager Desktop to review and approve the run.');
    expect(reply).not.toContain('PID');
    expect(reply).not.toContain('Dispatched');
  });

  test('reports missing feature and missing agent states', () => {
    expect(prepareFeatureRunRequest('F99', [projectFixture()])).toMatchObject({
      state: 'not_found',
    });
    expect(prepareFeatureRunRequest('F46', [projectFixture(0)])).toMatchObject({
      state: 'missing_agent',
    });
  });
});
