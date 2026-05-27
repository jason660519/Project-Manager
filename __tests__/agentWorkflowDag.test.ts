import { describe, expect, it } from 'vitest';
import {
  agentSessionDirectorySegments,
  agentSessionStoreKey,
  buildAgentSessionScope,
  getAgentWorkflowDagById,
  listAgentWorkflowDags,
  validateAgentWorkflowDag,
} from '../lib/agent-workflows';
import type { AgentWorkflowDagDefinition } from '../lib/agent-workflows';

describe('agent workflow DAG catalog (F35)', () => {
  it('contains the built-in Software Development and Deep Research workflows', () => {
    expect(listAgentWorkflowDags().map((workflow) => workflow.id)).toEqual([
      'software-dev-parallel',
      'deep-research-parallel',
    ]);
  });

  it('models the Software Development fan-out and merge roles', () => {
    const workflow = getAgentWorkflowDagById('software-dev-parallel');
    expect(workflow).toBeDefined();
    expect(workflow?.version).toBe(1);

    const roles = new Set(workflow!.nodes.map((node) => node.role));
    expect(roles.has('planner')).toBe(true);
    expect(roles.has('implementer')).toBe(true);
    expect(roles.has('reviewer')).toBe(true);
    expect(roles.has('tester')).toBe(true);
    expect(roles.has('evaluator')).toBe(true);
    expect(roles.has('summarizer')).toBe(true);
    expect(workflow!.nodes.find((node) => node.id === 'summarizer')?.dependsOn).toEqual([
      'unit-test',
      'e2e-test',
    ]);
  });

  it('models the Deep Research search, writing, and report branches', () => {
    const workflow = getAgentWorkflowDagById('deep-research-parallel');
    expect(workflow).toBeDefined();

    const roles = new Set(workflow!.nodes.map((node) => node.role));
    expect(roles.has('researcher')).toBe(true);
    expect(roles.has('writer')).toBe(true);
    expect(roles.has('summarizer')).toBe(true);
    expect(workflow!.nodes.find((node) => node.id === 'report')?.dependsOn).toEqual([
      'write-topic-a',
      'write-topic-b',
      'write-topic-c',
    ]);
  });

  it('keeps tool refs declarative and secret-free in built-in templates', () => {
    const serialized = JSON.stringify(listAgentWorkflowDags());
    expect(serialized).not.toMatch(/api[_-]?key|ssh[_-]?key|secret|token/i);

    const refs = listAgentWorkflowDags().flatMap((workflow) =>
      workflow.nodes.flatMap((node) => node.tools.refs),
    );
    expect(refs.some((ref) => ref.sourceKind === 'capability-candidate')).toBe(true);
    expect(refs.some((ref) => ref.sourceKind === 'skill')).toBe(true);
    expect(refs.some((ref) => ref.sourceKind === 'memory')).toBe(true);
    expect(refs.some((ref) => ref.sourceKind === 'mcp')).toBe(true);
    expect(refs.some((ref) => ref.sourceKind === 'command')).toBe(true);
    expect(refs.some((ref) => ref.sourceKind === 'adapter')).toBe(true);
  });
});

describe('agent workflow DAG validation', () => {
  it('accepts the built-in DAG templates', () => {
    for (const workflow of listAgentWorkflowDags()) {
      expect(validateAgentWorkflowDag(workflow)).toEqual({ valid: true, errors: [] });
    }
  });

  it('rejects duplicate node IDs', () => {
    const workflow = cloneWorkflow('software-dev-parallel');
    workflow.nodes = [workflow.nodes[0], { ...workflow.nodes[0] }];
    const result = validateAgentWorkflowDag(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('duplicate_node_id');
  });

  it('rejects dangling edges', () => {
    const workflow = cloneWorkflow('software-dev-parallel');
    workflow.edges = [{ from: 'planner', to: 'missing-node' }];
    const result = validateAgentWorkflowDag(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('dangling_edge');
  });

  it('rejects dangling dependencies', () => {
    const workflow = cloneWorkflow('software-dev-parallel');
    workflow.nodes[0] = { ...workflow.nodes[0], dependsOn: ['missing-node'] };
    const result = validateAgentWorkflowDag(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('dangling_dependency');
  });

  it('rejects cycles', () => {
    const workflow = cloneWorkflow('software-dev-parallel');
    workflow.edges = [
      { from: 'planner', to: 'implement-a' },
      { from: 'implement-a', to: 'planner' },
    ];
    const result = validateAgentWorkflowDag(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('cycle_detected');
  });
});

describe('agent session scope isolation', () => {
  it('builds deterministic, path-safe session keys', () => {
    const scope = buildAgentSessionScope({
      projectId: '@project-manager/app',
      workflowId: 'software-dev-parallel',
      workflowRunId: 'run:2026/05/28',
      nodeId: 'review/a',
      agentId: 'Claude Code #1',
    });

    const key = agentSessionStoreKey(scope);
    expect(key).toBe(agentSessionStoreKey(scope));
    expect(key).toMatch(/^[a-zA-Z0-9._-]+(__[a-zA-Z0-9._-]+)+$/);
  });

  it('changes keys by workflow run, node, and agent', () => {
    const base = {
      projectId: 'project-manager',
      workflowId: 'software-dev-parallel',
      workflowRunId: 'run-a',
      nodeId: 'review-a',
      agentId: 'reviewer-1',
    };

    const baseKey = agentSessionStoreKey(base);
    expect(agentSessionStoreKey({ ...base, workflowRunId: 'run-b' })).not.toBe(baseKey);
    expect(agentSessionStoreKey({ ...base, nodeId: 'review-b' })).not.toBe(baseKey);
    expect(agentSessionStoreKey({ ...base, agentId: 'reviewer-2' })).not.toBe(baseKey);
  });

  it('provides directory segments for future file-backed stores', () => {
    expect(agentSessionDirectorySegments({
      projectId: '@project-manager/app',
      workflowId: 'deep-research-parallel',
      workflowRunId: 'run/1',
      nodeId: 'search topic a',
      agentId: 'agent:researcher',
    })).toEqual([
      'project-manager_app',
      'deep-research-parallel',
      'run_1',
      'search_topic_a',
      'agent_researcher',
    ]);
  });
});

function cloneWorkflow(id: string): AgentWorkflowDagDefinition {
  return structuredClone(getAgentWorkflowDagById(id)!);
}
