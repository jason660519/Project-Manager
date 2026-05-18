import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AGENT_WORKFLOWS,
  buildAgentWorkflowPrompt,
  getAgentWorkflowById,
  getRecommendedWorkflowsForRole,
} from '../lib/agent-workflows';
import type { Feature } from '../lib/types';

const feature: Feature = {
  id: 'F-001',
  name: 'Workflow Dispatch',
  category: 'AI Engineers',
  status: 'todo',
  progress: 10,
  paths: {
    spec: 'docs/product/workflow-dispatch.md',
    implementation: 'app/ui/views/EngineersView.tsx',
  },
  notes: 'Borrow process structure without vendoring external skills.',
};

describe('agent workflow catalog', () => {
  it('contains the expected gstack-inspired Project Manager workflows', () => {
    expect(DEFAULT_AGENT_WORKFLOWS.map((workflow) => workflow.id)).toEqual([
      'product-review',
      'engineering-plan-review',
      'design-review',
      'code-review',
      'qa-browser-test',
      'security-review',
      'ship-readiness',
      'docs-sync',
      'retro-learnings',
    ]);
  });

  it('builds a prompt with mode, required checks, and output contract', () => {
    const workflow = getAgentWorkflowById('ship-readiness');
    expect(workflow).toBeDefined();

    const prompt = buildAgentWorkflowPrompt(workflow!, feature, 'Check whether this can ship.');

    expect(prompt).toContain('[Agent Workflow: Ship Readiness]');
    expect(prompt).toContain('Mode: ship-readiness');
    expect(prompt).toContain('- npm run typecheck');
    expect(prompt).toContain('- Verification result');
    expect(prompt).toContain('- Feature: [F-001] Workflow Dispatch');
    expect(prompt).toContain('Check whether this can ship.');
  });

  it('maps role slugs to recommended workflows', () => {
    const frontend = getRecommendedWorkflowsForRole('frontend').map((workflow) => workflow.id);
    expect(frontend).toContain('design-review');
    expect(frontend).toContain('qa-browser-test');
    expect(frontend).not.toContain('security-review');
  });
});
