import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createProjectWorkflowRun,
  getProjectWorkflowTemplateById,
} from '../lib/project-workflows/projectWorkflowEngine';
import { buildProjectWorkflowGraphView } from '../lib/project-workflows/projectWorkflowGraphView';

const projectRoot = path.resolve(__dirname, '..');

describe('F53 feature metadata', () => {
  it('registers F53 dashboard artifacts after graph execution console completion', () => {
    const config = JSON.parse(readFileSync(path.join(projectRoot, '.project-manager/config.json'), 'utf8'));
    const feature = config.features.find((entry: { id: string }) => entry.id === 'F53');

    expect(feature).toMatchObject({
      id: 'F53',
      name: 'Workflow Graph Execution Console',
      category: 'PM Orchestration',
      phase: 'development',
      status: 'done',
    });
    expect(feature.progress).toBe(100);
    expect(feature.notes).toContain('graph canvas');
    expect(feature.metadata.scope).toContain('Workflow Runs tab');
    expect(feature.metadata.plannedTestScope).toContain('unit: Project Workflow graph projection');
    expect(feature.paths).toMatchObject({
      spec: '.project-manager/features/F53/feature-spec.md',
      tdd: '.project-manager/features/F53/tdd-spec.md',
      test: '__tests__/projectWorkflowGraphView.test.ts',
      testScenarios: '.project-manager/features/F53/test-scenarios.md',
    });
  });

  it('has the required F53 feature artifacts', () => {
    for (const relativePath of [
      '.project-manager/features/F53/README.md',
      '.project-manager/features/F53/feature-spec.md',
      '.project-manager/features/F53/tdd-spec.md',
      '.project-manager/features/F53/test-scenarios.md',
      '.project-manager/features/F53/implementation-plan.md',
      '.project-manager/features/F53/dev-log.md',
    ]) {
      const absolutePath = path.join(projectRoot, relativePath);
      expect(existsSync(absolutePath), relativePath).toBe(true);
      expect(readFileSync(absolutePath, 'utf8').trim().length, relativePath).toBeGreaterThan(80);
    }
  });
});

describe('Project Workflow graph projection', () => {
  it('projects a software workflow run into graph nodes, edges, and metrics', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F53',
      createdBy: 'PM Lead',
      now: '2026-06-16T00:00:00.000Z',
    });

    const view = buildProjectWorkflowGraphView(template, run);

    expect(view.run.id).toBe(run.id);
    expect(view.run.title).toBe('Software Engineering Loop');
    expect(view.metrics).toMatchObject({
      nodes: 8,
      readyNodes: 1,
      blockedNodes: 0,
      approvalGates: 1,
    });
    expect(view.nodes.map((node) => node.nodeId)).toEqual([
      'intake',
      'analysis',
      'implementation',
      'verification',
      'quality-gate',
      'human-approval',
      'pr-preparation',
      'report',
    ]);
    expect(view.edges).toEqual([
      { id: 'intake->analysis', source: 'intake', target: 'analysis', label: 'handoff' },
      { id: 'analysis->implementation', source: 'analysis', target: 'implementation', label: 'handoff' },
      { id: 'implementation->verification', source: 'implementation', target: 'verification', label: 'handoff' },
      { id: 'verification->quality-gate', source: 'verification', target: 'quality-gate', label: 'handoff' },
      { id: 'quality-gate->human-approval', source: 'quality-gate', target: 'human-approval', label: 'handoff' },
      { id: 'human-approval->pr-preparation', source: 'human-approval', target: 'pr-preparation', label: 'handoff' },
      { id: 'pr-preparation->report', source: 'pr-preparation', target: 'report', label: 'handoff' },
    ]);
    expect(view.nodes.find((node) => node.nodeId === 'analysis')).toMatchObject({
      title: 'Analysis',
      actorKind: 'ai_agent',
      systemPromptLabel: 'Software PM workflow analyst',
      taskPromptLabel: 'Analyze the work item and produce bounded implementation packages.',
      tools: ['project files', 'feature docs', 'workflow memory'],
      memoryFiles: ['.project-manager/features/F53/'],
      inputArtifacts: ['intake-brief'],
      outputArtifact: 'analysis-plan',
    });
  });

  it('builds an inspector for a selected node with prompts, tools, memory, evidence, and gates', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F53',
      now: '2026-06-16T00:00:00.000Z',
    });

    const view = buildProjectWorkflowGraphView(template, run, { selectedNodeId: 'pr-preparation' });

    expect(view.selectedNode?.nodeId).toBe('pr-preparation');
    expect(view.inspector).toMatchObject({
      nodeId: 'pr-preparation',
      title: 'PR Preparation',
      actorKind: 'ai_agent',
      status: 'queued',
      highRiskAction: true,
      outputArtifact: 'pr-prep-package',
      systemPromptLabel: 'Software PM workflow agent',
      reviewFirstActionLabel: 'Prepare manual start package',
      approvalGate: {
        title: 'Human PR Preparation Approval',
        approverRole: 'Human lead',
      },
    });
    expect(view.inspector?.evidenceRequirements).toEqual([
      {
        evidenceId: 'pr-readiness',
        kind: 'document',
        required: true,
        description: 'PR body and verification summary.',
      },
    ]);
    expect(view.inspector?.scorecards).toEqual([
      {
        scorecardId: 'required-handoff',
        description: 'Required structured handoff artifact is present.',
        required: true,
        status: 'missing',
      },
    ]);
    expect(view.safetyNotice).toContain('No actor or command is executed');
  });
});
