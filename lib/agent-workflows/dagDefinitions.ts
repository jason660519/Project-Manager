import type {
  AgentWorkflowDagDefinition,
  AgentWorkflowEdgeDefinition,
  AgentWorkflowNodeDefinition,
  AgentWorkflowValidationError,
  AgentWorkflowValidationResult,
} from './dagTypes';

const LOCAL_XMUX_RUNTIME = {
  provider: 'xmux',
  isolation: 'host-process',
  workingDirectoryMode: 'project-root',
} as const;

const CUBE_READY_RUNTIME = {
  provider: 'cube-sandbox',
  isolation: 'microvm',
  workingDirectoryMode: 'ephemeral-copy',
  pauseOnExit: true,
} as const;

const DEFAULT_RETRY = {
  maxAttempts: 2,
  retryOn: ['runtime-error', 'tool-unavailable'],
} as const;

const ISOLATED_SESSION = {
  isolation: 'per-node-agent',
  restore: 'resume-from-checkpoint',
  allowCrossNodeTranscriptRead: false,
} as const;

function node(
  input: Omit<AgentWorkflowNodeDefinition, 'model' | 'session' | 'retry'> &
    Partial<Pick<AgentWorkflowNodeDefinition, 'model' | 'session' | 'retry'>>,
): AgentWorkflowNodeDefinition {
  return {
    model: { mode: 'inherit-engineer-role' },
    session: ISOLATED_SESSION,
    retry: DEFAULT_RETRY,
    ...input,
  };
}

export const SOFTWARE_DEV_PARALLEL_WORKFLOW: AgentWorkflowDagDefinition = {
  id: 'software-dev-parallel',
  title: 'Software Development Parallel DAG',
  version: 1,
  kind: 'software-development',
  summary: 'Plan, implement in parallel, review, test, and summarize a software change.',
  trigger: 'Project Dashboard Development dispatch',
  defaultRuntime: LOCAL_XMUX_RUNTIME,
  nodes: [
    node({
      id: 'planner',
      title: 'Planner',
      role: 'planner',
      summary: 'Read the feature context and produce the implementation plan and branch split.',
      runtime: LOCAL_XMUX_RUNTIME,
      tools: {
        refs: [
          { sourceKind: 'memory', sourceId: 'project-instructions', required: true },
          { sourceKind: 'skill', sourceId: 'plan-review', reason: 'Planning discipline for engineering changes.' },
        ],
      },
      outputContract: [
        { artifactId: 'implementation-plan', description: 'Scoped plan, dependencies, and verification matrix.', required: true },
      ],
    }),
    node({
      id: 'implement-a',
      title: 'Implement A',
      role: 'implementer',
      summary: 'Implement the first independent work package from the plan.',
      dependsOn: ['planner'],
      parallelGroup: 'implementation',
      runtime: LOCAL_XMUX_RUNTIME,
      tools: {
        refs: [
          { sourceKind: 'adapter', sourceId: 'xmux', required: true },
          { sourceKind: 'mcp', sourceId: 'context7', reason: 'Fetch current library docs only when needed.' },
        ],
      },
      outputContract: [
        { artifactId: 'implementation-a-diff', description: 'Code changes and focused verification evidence for work package A.', required: true },
      ],
    }),
    node({
      id: 'implement-b',
      title: 'Implement B',
      role: 'implementer',
      summary: 'Implement the second independent work package from the plan.',
      dependsOn: ['planner'],
      parallelGroup: 'implementation',
      runtime: LOCAL_XMUX_RUNTIME,
      tools: {
        refs: [
          { sourceKind: 'adapter', sourceId: 'xmux', required: true },
          { sourceKind: 'command', sourceId: 'npm-test-focused', reason: 'Run focused regression checks for this package.' },
        ],
      },
      outputContract: [
        { artifactId: 'implementation-b-diff', description: 'Code changes and focused verification evidence for work package B.', required: true },
      ],
    }),
    node({
      id: 'review-a',
      title: 'Review A',
      role: 'reviewer',
      summary: 'Review implementation outputs for bugs, regressions, and missing tests.',
      dependsOn: ['implement-a', 'implement-b'],
      parallelGroup: 'review',
      runtime: LOCAL_XMUX_RUNTIME,
      tools: {
        refs: [
          { sourceKind: 'skill', sourceId: 'pre-landing-review', required: true },
          { sourceKind: 'memory', sourceId: 'project-standards', required: true },
        ],
      },
      outputContract: [
        { artifactId: 'review-findings', description: 'Severity-ordered findings and required fixes.', required: true },
      ],
    }),
    node({
      id: 'review-b',
      title: 'Architecture Review',
      role: 'reviewer',
      summary: 'Review architecture, session isolation, and runtime boundary implications.',
      dependsOn: ['implement-a', 'implement-b'],
      parallelGroup: 'review',
      runtime: LOCAL_XMUX_RUNTIME,
      tools: {
        refs: [
          { sourceKind: 'memory', sourceId: 'architecture-adrs', required: true },
          { sourceKind: 'skill', sourceId: 'plan-review' },
        ],
      },
      outputContract: [
        { artifactId: 'architecture-review', description: 'Boundary risks, ADR conflicts, and open decisions.', required: true },
      ],
    }),
    node({
      id: 'unit-test',
      title: 'Unit Tests',
      role: 'tester',
      summary: 'Run focused unit and integration checks for changed workflow modules.',
      dependsOn: ['review-a', 'review-b'],
      parallelGroup: 'verification',
      runtime: LOCAL_XMUX_RUNTIME,
      tools: {
        refs: [
          { sourceKind: 'command', sourceId: 'vitest-focused', required: true },
        ],
      },
      outputContract: [
        { artifactId: 'unit-test-results', description: 'Focused test command and result.', required: true },
      ],
    }),
    node({
      id: 'e2e-test',
      title: 'E2E/Manual Gate',
      role: 'evaluator',
      summary: 'Evaluate user-facing workflow readiness and define manual checks.',
      dependsOn: ['review-a', 'review-b'],
      parallelGroup: 'verification',
      runtime: LOCAL_XMUX_RUNTIME,
      tools: {
        refs: [
          { sourceKind: 'capability-candidate', sourceId: 'browser:in-app', reason: 'Future browser verification candidate.' },
        ],
      },
      outputContract: [
        { artifactId: 'manual-test-plan', description: 'Manual dashboard and dispatch verification scenarios.', required: true },
      ],
    }),
    node({
      id: 'summarizer',
      title: 'Summarizer',
      role: 'summarizer',
      summary: 'Merge declared artifacts into a concise handoff without reading private worker transcripts.',
      dependsOn: ['unit-test', 'e2e-test'],
      runtime: LOCAL_XMUX_RUNTIME,
      tools: {
        refs: [
          { sourceKind: 'memory', sourceId: 'feature-dev-log', required: true },
        ],
      },
      outputContract: [
        { artifactId: 'handoff-summary', description: 'What changed, verification results, remaining risks, and next steps.', required: true },
      ],
    }),
  ],
  edges: [
    { from: 'planner', to: 'implement-a', label: 'planned package A' },
    { from: 'planner', to: 'implement-b', label: 'planned package B' },
    { from: 'implement-a', to: 'review-a' },
    { from: 'implement-b', to: 'review-a' },
    { from: 'implement-a', to: 'review-b' },
    { from: 'implement-b', to: 'review-b' },
    { from: 'review-a', to: 'unit-test' },
    { from: 'review-b', to: 'unit-test' },
    { from: 'review-a', to: 'e2e-test' },
    { from: 'review-b', to: 'e2e-test' },
    { from: 'unit-test', to: 'summarizer' },
    { from: 'e2e-test', to: 'summarizer' },
  ],
};

export const DEEP_RESEARCH_PARALLEL_WORKFLOW: AgentWorkflowDagDefinition = {
  id: 'deep-research-parallel',
  title: 'Deep Research Parallel DAG',
  version: 1,
  kind: 'deep-research',
  summary: 'Fan out research topics, synthesize each branch, and merge a final report.',
  trigger: 'Research dispatch',
  defaultRuntime: CUBE_READY_RUNTIME,
  nodes: [
    node({
      id: 'research-plan',
      title: 'Research Planner',
      role: 'planner',
      summary: 'Define research questions, source quality criteria, and report outline.',
      runtime: LOCAL_XMUX_RUNTIME,
      tools: {
        refs: [
          { sourceKind: 'memory', sourceId: 'project-instructions', required: true },
        ],
      },
      outputContract: [
        { artifactId: 'research-brief', description: 'Research questions, source criteria, and branch topics.', required: true },
      ],
    }),
    ...['a', 'b', 'c'].map((suffix) =>
      node({
        id: `search-topic-${suffix}`,
        title: `Search Topic ${suffix.toUpperCase()}`,
        role: 'researcher',
        summary: `Collect and evaluate source material for topic ${suffix.toUpperCase()}.`,
        dependsOn: ['research-plan'],
        parallelGroup: 'search',
        runtime: CUBE_READY_RUNTIME,
        tools: {
          refs: [
            { sourceKind: 'mcp', sourceId: 'exa-search', required: true },
            { sourceKind: 'mcp', sourceId: 'context7', reason: 'Use only for library/API research branches.' },
          ],
        },
        outputContract: [
          { artifactId: `source-notes-${suffix}`, description: `Curated source notes for topic ${suffix.toUpperCase()}.`, required: true },
        ],
      }),
    ),
    ...['a', 'b', 'c'].map((suffix) =>
      node({
        id: `write-topic-${suffix}`,
        title: `Write Topic ${suffix.toUpperCase()}`,
        role: 'writer',
        summary: `Synthesize topic ${suffix.toUpperCase()} from declared source notes.`,
        dependsOn: [`search-topic-${suffix}`],
        parallelGroup: 'writing',
        runtime: CUBE_READY_RUNTIME,
        tools: {
          refs: [
            { sourceKind: 'memory', sourceId: 'research-style-guide' },
          ],
        },
        outputContract: [
          { artifactId: `draft-section-${suffix}`, description: `Draft report section for topic ${suffix.toUpperCase()}.`, required: true },
        ],
      }),
    ),
    node({
      id: 'report',
      title: 'Research Report',
      role: 'summarizer',
      summary: 'Merge topic drafts into the final report using only declared branch artifacts.',
      dependsOn: ['write-topic-a', 'write-topic-b', 'write-topic-c'],
      runtime: CUBE_READY_RUNTIME,
      tools: {
        refs: [
          { sourceKind: 'memory', sourceId: 'report-template', required: true },
        ],
      },
      outputContract: [
        { artifactId: 'research-report', description: 'Final report with source notes, conclusions, and uncertainty.', required: true },
      ],
    }),
  ],
  edges: [
    { from: 'research-plan', to: 'search-topic-a' },
    { from: 'research-plan', to: 'search-topic-b' },
    { from: 'research-plan', to: 'search-topic-c' },
    { from: 'search-topic-a', to: 'write-topic-a' },
    { from: 'search-topic-b', to: 'write-topic-b' },
    { from: 'search-topic-c', to: 'write-topic-c' },
    { from: 'write-topic-a', to: 'report' },
    { from: 'write-topic-b', to: 'report' },
    { from: 'write-topic-c', to: 'report' },
  ],
};

export const DEFAULT_AGENT_WORKFLOW_DAGS: AgentWorkflowDagDefinition[] = [
  SOFTWARE_DEV_PARALLEL_WORKFLOW,
  DEEP_RESEARCH_PARALLEL_WORKFLOW,
];

export function listAgentWorkflowDags(): AgentWorkflowDagDefinition[] {
  return DEFAULT_AGENT_WORKFLOW_DAGS;
}

export function getAgentWorkflowDagById(id: string): AgentWorkflowDagDefinition | undefined {
  return DEFAULT_AGENT_WORKFLOW_DAGS.find((workflow) => workflow.id === id);
}

export function validateAgentWorkflowDag(workflow: AgentWorkflowDagDefinition): AgentWorkflowValidationResult {
  const errors: AgentWorkflowValidationError[] = [];
  if (workflow.nodes.length === 0) {
    errors.push({ code: 'empty_nodes', message: 'Workflow must contain at least one node.' });
    return { valid: false, errors };
  }

  const seen = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const n of workflow.nodes) {
    if (seen.has(n.id)) duplicateIds.add(n.id);
    seen.add(n.id);
  }
  for (const id of duplicateIds) {
    errors.push({ code: 'duplicate_node_id', message: `Duplicate node id: ${id}`, nodeId: id });
  }

  const nodeIds = new Set(workflow.nodes.map((n) => n.id));
  const adjacency = new Map<string, string[]>();
  for (const n of workflow.nodes) adjacency.set(n.id, []);

  const addArc = (from: string, to: string) => {
    const next = adjacency.get(from);
    if (next) next.push(to);
  };

  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      errors.push({
        code: 'dangling_edge',
        message: `Edge points to missing node: ${edge.from} -> ${edge.to}`,
        edge,
      });
      continue;
    }
    addArc(edge.from, edge.to);
  }

  for (const n of workflow.nodes) {
    for (const dependency of n.dependsOn ?? []) {
      if (!nodeIds.has(dependency)) {
        errors.push({
          code: 'dangling_dependency',
          message: `Node ${n.id} depends on missing node ${dependency}.`,
          nodeId: n.id,
        });
        continue;
      }
      addArc(dependency, n.id);
    }
  }

  if (hasCycle(adjacency)) {
    errors.push({ code: 'cycle_detected', message: 'Workflow graph contains a cycle.' });
  }

  return { valid: errors.length === 0, errors };
}

function hasCycle(adjacency: Map<string, string[]>): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string): boolean => {
    if (visited.has(nodeId)) return false;
    if (visiting.has(nodeId)) return true;

    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  for (const nodeId of adjacency.keys()) {
    if (visit(nodeId)) return true;
  }
  return false;
}
