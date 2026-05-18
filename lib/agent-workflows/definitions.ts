import type { Feature } from '../types';

export type AgentWorkflowMode =
  | 'plan-only'
  | 'review-only'
  | 'guarded-execution'
  | 'ship-readiness'
  | 'learning';

export interface AgentWorkflowDefinition {
  id: string;
  name: string;
  shortName: string;
  role: string;
  mode: AgentWorkflowMode;
  summary: string;
  whenToUse: string;
  allowedActions: string[];
  requiredChecks: string[];
  outputContract: string[];
  promptInstructions: string[];
  recommendedRoleSlugs: string[];
}

export const DEFAULT_AGENT_WORKFLOWS: AgentWorkflowDefinition[] = [
  {
    id: 'product-review',
    name: 'Product Review',
    shortName: 'Product',
    role: 'Product Strategist',
    mode: 'plan-only',
    summary: 'Challenge the problem framing, scope, user value, and MVP wedge before code.',
    whenToUse: 'Use before implementation when the request is still a product decision.',
    allowedActions: ['read context', 'ask blocking questions', 'write or revise a plan'],
    requiredChecks: ['Confirm target user and success signal', 'Identify what is intentionally out of scope'],
    outputContract: ['Problem framing', 'Scope recommendation', 'Risks', 'Open decisions'],
    promptInstructions: [
      'Push on whether the requested feature is the right product move.',
      'Separate must-ship behavior from nice-to-have expansion.',
      'Do not implement code in this workflow.',
    ],
    recommendedRoleSlugs: ['devex', 'fullstack'],
  },
  {
    id: 'engineering-plan-review',
    name: 'Engineering Plan Review',
    shortName: 'Eng Plan',
    role: 'Staff Engineer',
    mode: 'review-only',
    summary: 'Review architecture, data flow, failure modes, and test strategy before edits.',
    whenToUse: 'Use when a plan exists and needs engineering rigor before implementation.',
    allowedActions: ['read code and docs', 'map data flow', 'produce test plan', 'flag blockers'],
    requiredChecks: ['npm run typecheck', 'npm run build'],
    outputContract: ['Architecture assessment', 'Failure modes', 'Test matrix', 'Blockers'],
    promptInstructions: [
      'Trace the relevant data flow before recommending changes.',
      'Call out assumptions that would affect implementation safety.',
      'Do not edit files unless the operator explicitly switches to execution.',
    ],
    recommendedRoleSlugs: ['backend', 'fullstack', 'devops'],
  },
  {
    id: 'design-review',
    name: 'Design Review',
    shortName: 'Design',
    role: 'Designer Who Codes',
    mode: 'review-only',
    summary: 'Audit UI density, state visibility, accessibility, and design-system fit.',
    whenToUse: 'Use before or after UI work that changes visible app behavior.',
    allowedActions: ['read UI code', 'inspect screenshots', 'propose UI fixes'],
    requiredChecks: ['npm run typecheck', 'Visual pass at desktop and narrow widths'],
    outputContract: ['UX risks', 'Design-system drift', 'Accessibility gaps', 'Recommended fixes'],
    promptInstructions: [
      'Evaluate the UI as a dense local-first operations console, not a marketing page.',
      'Make fallback, blocked, loading, empty, and error states explicit.',
      'Do not introduce decorative layouts or one-off color systems.',
    ],
    recommendedRoleSlugs: ['frontend', 'fullstack'],
  },
  {
    id: 'code-review',
    name: 'Code Review',
    shortName: 'Code',
    role: 'Staff Engineer',
    mode: 'review-only',
    summary: 'Find bugs, regressions, missing tests, and unsafe behavior before landing.',
    whenToUse: 'Use when a branch or feature has code changes ready for review.',
    allowedActions: ['inspect diff', 'read affected files', 'report findings', 'suggest tests'],
    requiredChecks: ['npm run typecheck', 'npm run test'],
    outputContract: ['Findings by severity', 'Missing tests', 'Open questions', 'Residual risk'],
    promptInstructions: [
      'Lead with concrete findings and file references.',
      'Prioritize behavioral regressions, security boundaries, and user-visible failures.',
      'Avoid broad refactors unless they are required to fix a specific issue.',
    ],
    recommendedRoleSlugs: ['frontend', 'backend', 'fullstack'],
  },
  {
    id: 'qa-browser-test',
    name: 'QA Browser Test',
    shortName: 'QA',
    role: 'QA Lead',
    mode: 'guarded-execution',
    summary: 'Exercise the feature in a real browser and turn failures into regression coverage.',
    whenToUse: 'Use after implementation when the workflow must be verified end to end.',
    allowedActions: ['run local app', 'use browser automation', 'capture logs', 'add focused tests'],
    requiredChecks: ['npm run test', 'Browser console has no new errors'],
    outputContract: ['Tested flows', 'Bugs found', 'Fixes or repro steps', 'Regression coverage'],
    promptInstructions: [
      'Test the user workflow, not just component internals.',
      'Record exact reproduction steps for each failure.',
      'If fixing code, keep fixes narrow and re-run the failing flow.',
    ],
    recommendedRoleSlugs: ['qa', 'frontend', 'fullstack'],
  },
  {
    id: 'security-review',
    name: 'Security Review',
    shortName: 'Security',
    role: 'Security Reviewer',
    mode: 'review-only',
    summary: 'Audit command execution, secret boundaries, provider calls, and trust assumptions.',
    whenToUse: 'Use before expanding local execution, key storage, or external integrations.',
    allowedActions: ['read code and docs', 'model threats', 'report verified risks'],
    requiredChecks: ['npm audit --omit=dev', 'Review command allowlist and secret path'],
    outputContract: ['Threat model', 'Verified findings', 'False-positive notes', 'Mitigations'],
    promptInstructions: [
      'Focus on concrete exploit paths and trust-boundary mistakes.',
      'Check that browser, renderer, Rust bridge, and provider boundaries are explicit.',
      'Do not report speculative issues without a realistic scenario.',
    ],
    recommendedRoleSlugs: ['backend', 'devops', 'fullstack'],
  },
  {
    id: 'ship-readiness',
    name: 'Ship Readiness',
    shortName: 'Ship',
    role: 'Release Engineer',
    mode: 'ship-readiness',
    summary: 'Confirm checks, docs, risks, and release state before push or PR.',
    whenToUse: 'Use when implementation is complete and the operator wants a release gate.',
    allowedActions: ['inspect git status', 'run verification', 'prepare PR summary'],
    requiredChecks: ['npm run typecheck', 'npm run build', 'npm run docs:check', 'npm run standards:check'],
    outputContract: ['Verification result', 'Changed files', 'Known risks', 'PR or handoff summary'],
    promptInstructions: [
      'Do not claim readiness if checks failed, were skipped, or only ran in dry-run mode.',
      'Separate user changes from changes made in the current task.',
      'Preserve logs and explain any blocked release step.',
    ],
    recommendedRoleSlugs: ['devops', 'fullstack'],
  },
  {
    id: 'docs-sync',
    name: 'Docs Sync',
    shortName: 'Docs',
    role: 'Technical Writer',
    mode: 'guarded-execution',
    summary: 'Update docs after behavior changes while preserving repo governance.',
    whenToUse: 'Use after implementation changes product behavior, architecture, or commands.',
    allowedActions: ['read changed code', 'update docs', 'run docs governance checks'],
    requiredChecks: ['npm run docs:check', 'npm run standards:check'],
    outputContract: ['Docs updated', 'Stale docs found', 'Governance check result', 'Follow-ups'],
    promptInstructions: [
      'Keep English filenames and repo-local documentation folder rules.',
      'Update source-of-truth docs before secondary summaries.',
      'Archive instead of deleting historically useful documents.',
    ],
    recommendedRoleSlugs: ['devex', 'fullstack'],
  },
  {
    id: 'retro-learnings',
    name: 'Retro / Learnings',
    shortName: 'Retro',
    role: 'Engineering Manager',
    mode: 'learning',
    summary: 'Extract process lessons, recurring failures, and next improvements from a work session.',
    whenToUse: 'Use after a sprint, failed attempt, or meaningful shipped feature.',
    allowedActions: ['read logs', 'summarize outcomes', 'propose process improvements'],
    requiredChecks: ['Review failed and skipped verification steps'],
    outputContract: ['What changed', 'What slowed down', 'Prevention rules', 'Next priorities'],
    promptInstructions: [
      'Be specific about causes and evidence.',
      'Turn repeated failures into concrete process guardrails.',
      'Do not store hidden global memory; surface learnings where the operator can review them.',
    ],
    recommendedRoleSlugs: ['devex', 'fullstack'],
  },
];

export function getAgentWorkflowById(id: string): AgentWorkflowDefinition | undefined {
  return DEFAULT_AGENT_WORKFLOWS.find((workflow) => workflow.id === id);
}

export function getRecommendedWorkflowsForRole(slug: string): AgentWorkflowDefinition[] {
  return DEFAULT_AGENT_WORKFLOWS.filter((workflow) =>
    workflow.recommendedRoleSlugs.includes(slug),
  );
}

export function buildAgentWorkflowPrompt(
  workflow: AgentWorkflowDefinition,
  feature: Feature,
  operatorPrompt: string,
): string {
  const featureLines = [
    `Feature: [${feature.id}] ${feature.name}`,
    `Status: ${feature.status}`,
    `Progress: ${feature.progress}%`,
    `Phase: ${feature.phase ?? 'development'}`,
    `Implementation path: ${feature.paths.implementation ?? 'not specified'}`,
    `Spec path: ${feature.paths.spec ?? feature.paths.tdd ?? 'not specified'}`,
    feature.notes ? `Notes: ${feature.notes}` : null,
  ].filter(Boolean);

  return [
    `[Agent Workflow: ${workflow.name}]`,
    `Role: ${workflow.role}`,
    `Mode: ${workflow.mode}`,
    `Workflow summary: ${workflow.summary}`,
    '',
    'Allowed actions:',
    ...workflow.allowedActions.map((action) => `- ${action}`),
    '',
    'Required checks or evidence:',
    ...workflow.requiredChecks.map((check) => `- ${check}`),
    '',
    'Output contract:',
    ...workflow.outputContract.map((item) => `- ${item}`),
    '',
    'Workflow instructions:',
    ...workflow.promptInstructions.map((instruction) => `- ${instruction}`),
    '',
    'Feature context:',
    ...featureLines.map((line) => `- ${line}`),
    '',
    'Operator request:',
    operatorPrompt,
  ].join('\n');
}
