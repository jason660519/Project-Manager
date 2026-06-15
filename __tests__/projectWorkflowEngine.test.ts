import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  approveProjectWorkflowRun,
  completeProjectWorkflowNode,
  createProjectWorkflowRun,
  getProjectWorkflowTemplateById,
  listProjectWorkflowTemplates,
  renderProjectWorkflowDecisionPackage,
  startProjectWorkflowNode,
  validateProjectWorkflowTemplate,
} from '../lib/project-workflows/projectWorkflowEngine';
import {
  listProjectWorkflowRuns,
  parseProjectWorkflowRun,
  projectWorkflowRunPath,
  projectWorkflowRunsDirectory,
  saveProjectWorkflowRun,
  serializeProjectWorkflowRun,
} from '../lib/project-workflows/projectWorkflowRunStore';

const projectRoot = path.resolve(__dirname, '..');

describe('F52 feature metadata', () => {
  it('registers F52 dashboard artifacts before implementation work starts', () => {
    const config = JSON.parse(readFileSync(path.join(projectRoot, '.project-manager/config.json'), 'utf8'));
    const feature = config.features.find((entry: { id: string }) => entry.id === 'F52');

    expect(feature).toMatchObject({
      id: 'F52',
      name: 'Project Workflow Loop Engine',
      category: 'PM Orchestration',
      phase: 'development',
      status: 'in_progress',
    });
    expect(feature.progress).toBeGreaterThanOrEqual(25);
    expect(feature.progress).toBeLessThan(100);
    expect(feature.notes).toContain('cross-discipline PM workflow loop engine');
    expect(feature.notes).toContain('Software Engineering Loop is the first template');
    expect(feature.paths).toMatchObject({
      spec: '.project-manager/features/F52/feature-spec.md',
      tdd: '.project-manager/features/F52/tdd-spec.md',
      test: '__tests__/projectWorkflowEngine.test.ts',
      testScenarios: '.project-manager/features/F52/test-scenarios.md',
    });
  });

  it('has the required F52 feature artifacts', () => {
    for (const relativePath of [
      '.project-manager/features/F52/README.md',
      '.project-manager/features/F52/feature-spec.md',
      '.project-manager/features/F52/tdd-spec.md',
      '.project-manager/features/F52/test-scenarios.md',
      '.project-manager/features/F52/dev-log.md',
    ]) {
      const absolutePath = path.join(projectRoot, relativePath);
      expect(existsSync(absolutePath), relativePath).toBe(true);
      expect(readFileSync(absolutePath, 'utf8').trim().length, relativePath).toBeGreaterThan(80);
    }
  });
});

describe('Project Workflow Loop Engine templates', () => {
  it('ships a software engineering loop as a generic project workflow template', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop');

    expect(template).toBeDefined();
    expect(template?.kind).toBe('project-workflow-loop');
    expect(template?.discipline).toBe('software');
    expect(template?.isExampleTemplate).toBe(true);
    expect(template?.summary).toContain('first built-in template');
    expect(template?.summary).toContain('not the engine boundary');
    expect(template?.nodes.map((node) => node.id)).toEqual([
      'intake',
      'analysis',
      'implementation',
      'verification',
      'quality-gate',
      'human-approval',
      'pr-preparation',
      'report',
    ]);
    expect(template?.stopPolicy).toMatchObject({
      maxNodeAttempts: 2,
      scopeLock: 'Declared work package, required outputs, and approval policy only.',
    });
    expect(validateProjectWorkflowTemplate(template!)).toEqual({ valid: true, errors: [] });
  });

  it('keeps the public template catalog domain-neutral', () => {
    const templates = listProjectWorkflowTemplates();
    const softwareLoop = templates.find((template) => template.id === 'software-engineering-loop');

    expect(softwareLoop).toBeDefined();
    expect(JSON.stringify(softwareLoop)).toContain('"actorKind":"ai_agent"');
    expect(JSON.stringify(softwareLoop)).toContain('"actorKind":"human"');
    expect(JSON.stringify(softwareLoop)).toContain('"handoffContract"');
    expect(JSON.stringify(softwareLoop)).toContain('"scorecards"');
    expect(JSON.stringify(softwareLoop)).not.toContain('AgentWorkflowDag');
  });

  it('ships a construction quality loop to prove software is not the engine boundary', () => {
    const template = getProjectWorkflowTemplateById('construction-quality-loop');

    expect(template).toBeDefined();
    expect(template?.kind).toBe('project-workflow-loop');
    expect(template?.discipline).toBe('construction');
    expect(template?.isExampleTemplate).toBe(false);
    expect(template?.nodes.map((node) => node.discipline)).toEqual([
      'construction',
      'construction',
      'qa',
      'procurement',
      'project_management',
      'operations',
    ]);
    expect(template?.nodes.map((node) => node.actorKind)).toContain('vendor');
    expect(template?.nodes.map((node) => node.actorKind)).toContain('review_queue');
    expect(JSON.stringify(template)).not.toMatch(/\bPR\b|\brepo\b|coding agent|worktree/i);
    expect(validateProjectWorkflowTemplate(template!)).toEqual({ valid: true, errors: [] });
  });
});

describe('Project Workflow Loop Engine run state', () => {
  it('creates a review-first run without executing actors or commands', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F52',
      createdBy: 'PM Lead',
      now: '2026-06-15T05:30:00.000Z',
    });

    expect(run.status).toBe('queued');
    expect(run.executionStarted).toBe(false);
    expect(run.events).toEqual([
      expect.objectContaining({
        type: 'run_created',
        summary: 'Workflow run created; no actor or command executed.',
      }),
    ]);
    expect(run.nodeRuns.filter((node) => node.status === 'ready').map((node) => node.nodeId)).toEqual(['intake']);
    expect(run.nodeRuns.find((node) => node.nodeId === 'analysis')?.status).toBe('queued');
    expect(run.nextAction).toBe('Human lead reviews ready nodes and starts execution explicitly.');
  });

  it('records structured handoff artifacts and evidence before unblocking downstream nodes', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const initial = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F52',
      now: '2026-06-15T05:30:00.000Z',
    });

    const afterIntake = completeProjectWorkflowNode(initial, 'intake', {
      completedAt: '2026-06-15T05:35:00.000Z',
      handoff: {
        artifactId: 'intake-brief',
        summary: 'F52 requires a generic PM loop engine with a software template.',
        fields: {
          scope: 'Core model and state machine only',
          decisionNeeded: 'Approve first template boundaries',
        },
      },
      evidence: [
        {
          evidenceId: 'feature-spec',
          kind: 'document',
          summary: 'F52 feature spec exists and defines the cross-discipline engine.',
          uri: '.project-manager/features/F52/feature-spec.md',
        },
      ],
      scorecardResults: [
        {
          scorecardId: 'required-handoff',
          status: 'passed',
          summary: 'Required intake brief produced.',
        },
      ],
    });

    expect(afterIntake.handoffArtifacts).toEqual([
      expect.objectContaining({
        artifactId: 'intake-brief',
        nodeId: 'intake',
        summary: 'F52 requires a generic PM loop engine with a software template.',
      }),
    ]);
    expect(afterIntake.evidenceLedger).toEqual([
      expect.objectContaining({
        evidenceId: 'feature-spec',
        nodeId: 'intake',
        kind: 'document',
      }),
    ]);
    expect(afterIntake.nodeRuns.find((node) => node.nodeId === 'intake')?.status).toBe('succeeded');
    expect(afterIntake.nodeRuns.find((node) => node.nodeId === 'analysis')?.status).toBe('ready');
    expect(afterIntake.events.map((event) => event.type)).toEqual([
      'run_created',
      'node_completed',
      'node_ready',
    ]);
  });

  it('blocks progress when required evidence or scorecards are missing', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const initial = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F52',
      now: '2026-06-15T05:30:00.000Z',
    });

    const blocked = completeProjectWorkflowNode(initial, 'intake', {
      completedAt: '2026-06-15T05:35:00.000Z',
      handoff: {
        artifactId: 'intake-brief',
        summary: 'Brief exists without evidence.',
        fields: {},
      },
      evidence: [],
      scorecardResults: [],
    });

    expect(blocked.status).toBe('blocked');
    expect(blocked.nodeRuns.find((node) => node.nodeId === 'intake')?.status).toBe('blocked');
    expect(blocked.nodeRuns.find((node) => node.nodeId === 'analysis')?.status).toBe('queued');
    expect(blocked.blockedReason).toContain('Missing required evidence');
  });

  it('requires human approval before high-risk PR preparation', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F52',
      now: '2026-06-15T05:30:00.000Z',
    });

    const result = approveProjectWorkflowRun(run, {
      approvedBy: 'PM Lead',
      approvedAt: '2026-06-15T05:40:00.000Z',
      gateId: 'human-pr-approval',
    });

    expect(result.status).toBe('blocked');
    expect(result.reason).toContain('approval gate is not ready');
    expect(result.run.status).toBe('blocked');
    expect(result.run.approvals).toEqual([]);
  });

  it('renders a human-reviewable loop decision package', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F52',
      now: '2026-06-15T05:30:00.000Z',
    });

    const rendered = renderProjectWorkflowDecisionPackage(template, run);

    expect(rendered).toContain('# Project Workflow Loop Decision Package');
    expect(rendered).toContain('Template: Software Engineering Loop');
    expect(rendered).toContain('Persistent memory: handoff artifacts and evidence ledger');
    expect(rendered).toContain('Stop policy');
    expect(rendered).toContain('Human approval gates');
    expect(rendered).toContain('No actor or command is executed by this package.');
  });

  it('records successful human approval once upstream evidence gates are complete', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const initial = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F52',
      now: '2026-06-15T05:30:00.000Z',
    });
    const readyForApproval = completeNodesForGate(template, initial, [
      'intake',
      'analysis',
      'implementation',
      'verification',
      'quality-gate',
      'human-approval',
    ]);

    const result = approveProjectWorkflowRun(readyForApproval, {
      approvedBy: 'PM Lead',
      approvedAt: '2026-06-15T06:10:00.000Z',
      gateId: 'human-pr-approval',
    });

    expect(result.status).toBe('approved');
    expect(result.run.approvals).toEqual([
      {
        gateId: 'human-pr-approval',
        approvedBy: 'PM Lead',
        approvedAt: '2026-06-15T06:10:00.000Z',
      },
    ]);
    expect(result.run.events.at(-1)).toMatchObject({
      type: 'approval_recorded',
      nodeId: 'pr-preparation',
      summary: 'Human PR Preparation Approval approved by PM Lead.',
    });
    expect(result.run.nodeRuns.find((node) => node.nodeId === 'pr-preparation')?.status).toBe('ready');
  });

  it('blocks a node instead of overbaking past its attempt budget', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const initial = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F52',
      now: '2026-06-15T05:30:00.000Z',
    });

    const firstAttempt = startProjectWorkflowNode(template, initial, 'intake', '2026-06-15T05:31:00.000Z');
    const secondAttempt = startProjectWorkflowNode(template, firstAttempt, 'intake', '2026-06-15T05:32:00.000Z');
    const blocked = startProjectWorkflowNode(template, secondAttempt, 'intake', '2026-06-15T05:33:00.000Z');

    expect(blocked.status).toBe('blocked');
    expect(blocked.nodeRuns.find((node) => node.nodeId === 'intake')).toMatchObject({
      attempts: 2,
      status: 'blocked',
      blockedReason: 'Stop policy reached max attempts for node intake.',
    });
    expect(blocked.events.at(-1)).toMatchObject({
      type: 'stop_policy_blocked',
      nodeId: 'intake',
    });
  });
});

describe('Project Workflow Loop Engine persistent memory store', () => {
  it('builds stable project workflow run sidecar paths', () => {
    expect(projectWorkflowRunsDirectory('/tmp/project/')).toBe('/tmp/project/.project-manager/project-workflow-runs');
    expect(projectWorkflowRunPath('/tmp/project', 'run:2026/06/15')).toBe(
      '/tmp/project/.project-manager/project-workflow-runs/run-2026-06-15.json',
    );
  });

  it('serializes and parses workflow runs with validation', () => {
    const template = getProjectWorkflowTemplateById('construction-quality-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'site-project',
      workItemId: 'QC-12',
      now: '2026-06-15T06:30:00.000Z',
    });

    expect(parseProjectWorkflowRun(serializeProjectWorkflowRun(run))).toEqual(run);
    expect(() => parseProjectWorkflowRun('{}')).toThrow('ProjectWorkflowRun file is missing id, templateId, or nodeRuns.');
  });

  it('saves and lists workflow runs as durable evidence outside chat transcript', async () => {
    const template = getProjectWorkflowTemplateById('construction-quality-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'site-project',
      workItemId: 'QC-12',
      now: '2026-06-15T06:30:00.000Z',
    });
    const writes = new Map<string, string>();
    const adapter = {
      readFile: async (filePath: string) => writes.get(filePath) ?? '{}',
      writeFile: async (filePath: string, content: string) => {
        writes.set(filePath, content);
      },
      listProjectFiles: async (root: string) => [
        {
          name: 'run-valid.json',
          path: `${root}/run-valid.json`,
          isDir: false,
          children: [],
        },
        {
          name: 'run-corrupt.json',
          path: `${root}/run-corrupt.json`,
          isDir: false,
          children: [],
        },
      ],
    };

    const savedPath = await saveProjectWorkflowRun('/tmp/project', run, adapter);
    writes.set('/tmp/project/.project-manager/project-workflow-runs/run-valid.json', serializeProjectWorkflowRun(run));
    writes.set('/tmp/project/.project-manager/project-workflow-runs/run-corrupt.json', '{}');

    expect(savedPath).toBe(`/tmp/project/.project-manager/project-workflow-runs/${run.id}.json`);
    expect(writes.get(savedPath)).toContain('"templateId": "construction-quality-loop"');
    await expect(listProjectWorkflowRuns('/tmp/project', adapter)).resolves.toEqual([run]);
  });
});

function completeNodesForGate(
  template: NonNullable<ReturnType<typeof getProjectWorkflowTemplateById>>,
  initialRun: ReturnType<typeof createProjectWorkflowRun>,
  nodeIds: string[],
): ReturnType<typeof createProjectWorkflowRun> {
  return nodeIds.reduce((run, nodeId, index) => {
    const node = template.nodes.find((candidate) => candidate.id === nodeId)!;
    const evidence = node.evidenceRequirements[0]!;
    const scorecard = node.scorecards[0]!;
    return completeProjectWorkflowNode(run, nodeId, {
      completedAt: `2026-06-15T05:${String(35 + index).padStart(2, '0')}:00.000Z`,
      handoff: {
        artifactId: node.handoffContract.artifactId,
        summary: `${node.title} complete.`,
        fields: { summary: `${node.title} complete.` },
      },
      evidence: [
        {
          evidenceId: evidence.evidenceId,
          kind: evidence.kind,
          summary: evidence.description,
        },
      ],
      scorecardResults: [
        {
          scorecardId: scorecard.scorecardId,
          status: 'passed',
          summary: scorecard.description,
        },
      ],
    });
  }, initialRun);
}
