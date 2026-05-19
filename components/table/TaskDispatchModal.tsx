'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  augmentArgsWithMcp,
  killProcess,
  mcpInjectionFlag,
  onAgentExit,
  onAgentStdout,
  readFile,
  spawnAgent,
  spawnTerminal,
} from '../../lib/bridge';
import {
  DEFAULT_AGENT_WORKFLOWS,
  buildAgentWorkflowPrompt,
  getAgentWorkflowById,
} from '../../lib/agent-workflows';
import {
  createRuntimeAdapterFromConfig,
  getAdapterExecutionKind,
} from '../../lib/adapters/registry';
import { listLlmProviders, type LlmProviderId } from '../../lib/keys/llmProviders';
import { collectEnabledMcpServers } from '../../lib/storage/plugins';
import { useI18n } from '../../lib/i18n';
import type { Translations } from '../../lib/i18n/types';
import {
  AnyAdapterConfig,
  EngineerRole,
  ExecutionResult,
  Feature,
  FeaturePhase,
  FeaturePromptConfig,
  IDEId,
} from '../../lib/types';

// ── Prompt helpers ────────────────────────────────────────────────────────────

type DispatchT = Translations['dispatch'];

interface PromptTemplate {
  label: string;
  build: (feature: Feature, specContent?: string) => string;
}

function pathOrUnspecified(path: string | undefined, d: DispatchT): string {
  return path ?? d.promptUnspecified;
}

function buildFeatureContext(feature: Feature, d: DispatchT, specContent?: string): string {
  const paths = [
    `README: ${pathOrUnspecified(feature.readmePath, d)}`,
    `${d.promptFeatureSpecPath} ${pathOrUnspecified(feature.paths.spec, d)}`,
    `${d.promptTddSpecPath} ${pathOrUnspecified(feature.paths.tdd, d)}`,
    `${d.promptImplPath} ${pathOrUnspecified(feature.paths.implementation, d)}`,
    `${d.promptUnitTestPath} ${pathOrUnspecified(feature.paths.unitIntegrationTest, d)}`,
    `${d.promptE2eTestPath} ${pathOrUnspecified(feature.paths.e2eAcceptanceTestScriptFolder ?? feature.paths.test, d)}`,
    `${d.promptDevLogsPath} ${pathOrUnspecified(feature.paths.developmentLogSummaryFolder, d)}`,
  ].join('\n');

  return [
    `[${feature.id}] ${feature.name}`,
    `${d.promptStatus} ${feature.status} (${feature.progress}%)`,
    `Category: ${feature.category}`,
    feature.phase ? `Phase: ${feature.phase}` : null,
    feature.notes ? `${d.promptNotes} ${feature.notes}` : null,
    '',
    'Known project artifacts and paths:',
    paths,
    specContent ? `\n${d.promptSpecHeader}\n${specContent.slice(0, 1800)}` : null,
  ].filter(Boolean).join('\n');
}

function buildStructuredPrompt(
  feature: Feature,
  d: DispatchT,
  title: string,
  objective: string,
  steps: string[],
  deliverables: string[],
  verification: string[],
  specContent?: string,
): string {
  return [
    buildFeatureContext(feature, d, specContent),
    '',
    `Assignment: ${title}`,
    '',
    `Objective:\n${objective}`,
    '',
    'How to proceed:',
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    'Deliverables:',
    ...deliverables.map((item) => `- ${item}`),
    '',
    'Verification and handoff:',
    ...verification.map((item) => `- ${item}`),
    '',
    'Important constraints:',
    '- Treat existing code/docs as the source of truth. Do not overwrite unrelated work.',
    '- If this is a new feature, create the smallest coherent implementation slice first.',
    '- If this is continuation work, inspect current files and git status before changing behavior.',
    '- Do not claim completion unless the relevant checks ran or you explicitly report why they could not run.',
  ].join('\n');
}

function makePromptTemplates(d: DispatchT): PromptTemplate[] {
  return [
    {
      label: d.templateFromScratch,
      build: (f, spec) =>
        buildStructuredPrompt(
          f,
          d,
          'Feature implementation or continuation',
          'Implement the next useful slice of this feature. If no implementation exists, start from the documented spec and create the core path. If implementation already exists, continue from the current status, fill gaps, and preserve existing behavior.',
          [
            'Read README, Feature Spec, TDD Spec, DevLogs, and the implementation path if they exist.',
            'Identify the current state: new build, partial implementation, failing behavior, missing tests, or documentation-only work.',
            'Plan a small implementation sequence tied to the acceptance criteria and existing app patterns.',
            'Make scoped code changes in the implementation path and nearby shared modules only when needed.',
            'Update or create tests that prove the new behavior and protect continuation work from regressions.',
            'Update DevLogs with what changed, what was verified, and what remains.',
          ],
          [
            'Working implementation for the selected feature slice.',
            'Relevant tests or a clear reason tests are not applicable yet.',
            'DevLogs entry with files changed, decisions, verification commands, and next steps.',
          ],
          [
            'Run the narrowest useful checks first, then `npm run typecheck`.',
            'Run `npm run build` when shared UI, routing, schema, or build-sensitive code changed.',
            'Report exact commands and results in the final handoff.',
          ],
          spec,
        ),
    },
    {
      label: d.templateFeatureSpec,
      build: (f, spec) =>
        buildStructuredPrompt(
          f,
          d,
          'Feature Spec authoring or repair',
          'Create or revise the Feature Spec so another engineer can implement this feature without guessing product intent, scope, affected files, acceptance criteria, or known risks.',
          [
            'Read README, existing Feature Spec, DevLogs, and current implementation before writing.',
            'If implementation already exists, reconcile the spec with actual behavior instead of inventing a separate plan.',
            'Document problem, goals, non-goals, user/operator workflow, affected files, data/state changes, edge cases, and acceptance criteria.',
            'Call out open questions and blocked assumptions explicitly.',
            'Keep the spec actionable for new development and continuation work.',
          ],
          [
            `Updated Feature Spec at ${pathOrUnspecified(f.paths.spec, d)}.`,
            'Acceptance criteria that can be mapped directly to TDD, unit, integration, and E2E tests.',
            'Risk/open-question section if scope or current implementation is ambiguous.',
          ],
          [
            'Check the spec against README and current code paths for contradictions.',
            'Run docs checks if Markdown governance files changed.',
            'Report whether the feature is ready for implementation or still blocked.',
          ],
          spec,
        ),
    },
    {
      label: d.templateTddSpec,
      build: (f, spec) =>
        buildStructuredPrompt(
          f,
          d,
          'TDD Spec authoring or repair',
          'Turn the Feature Spec into a concrete test plan that guides implementation and continuation work. Tests should describe observable behavior, regression risk, and the minimum checks needed before marking progress.',
          [
            'Read Feature Spec, README, DevLogs, and current tests before adding a new plan.',
            'Map each acceptance criterion to unit, integration, E2E, or manual verification.',
            'Separate happy path, edge cases, failure states, and regression coverage.',
            'Name likely test files and commands based on the repo conventions already in use.',
            'If implementation is partial, mark which tests should fail today and which verify existing behavior.',
          ],
          [
            `Updated TDD Spec at ${pathOrUnspecified(f.paths.tdd, d)}.`,
            'Traceable test matrix: criterion -> test level -> file/command -> expected result.',
            'Clear next implementation step for the assigned engineer.',
          ],
          [
            'Run `npm run typecheck` if TypeScript test scaffolding changed.',
            'Run the smallest available test command if test files were added.',
            'Report unimplemented tests separately from passing tests.',
          ],
          spec,
        ),
    },
    {
      label: d.templateUnitTest,
      build: (f, spec) =>
        buildStructuredPrompt(
          f,
          d,
          'Unit test implementation',
          'Add focused unit tests for the feature logic or UI behavior, then make the smallest production changes needed for those tests to pass.',
          [
            'Inspect Feature Spec, TDD Spec, existing tests, and the implementation path.',
            'Find the smallest pure logic, hook, component behavior, or helper boundary that should be protected.',
            'Write tests that fail for the missing or risky behavior before broad refactors.',
            'Avoid brittle snapshot-only coverage; assert meaningful states, outputs, labels, permissions, or edge cases.',
            'If production code must change, keep it scoped and aligned with existing patterns.',
          ],
          [
            `Unit tests under ${pathOrUnspecified(f.paths.unitIntegrationTest ?? f.paths.test, d)} or the nearest existing test folder.`,
            'Minimal production fix only when required by the test plan.',
            'Updated DevLogs if files or behavior changed.',
          ],
          [
            'Run the specific unit test command if available.',
            'Run `npm run typecheck`.',
            'If tests cannot run, report the exact blocker and what was still statically checked.',
          ],
          spec,
        ),
    },
    {
      label: d.templateIntegrationTest,
      build: (f, spec) =>
        buildStructuredPrompt(
          f,
          d,
          'Integration test implementation',
          'Verify that this feature works across its real component, storage, bridge, routing, or adapter boundaries rather than only isolated units.',
          [
            'Read Feature Spec and TDD Spec to identify cross-module behavior.',
            'Inspect current implementation and any nearby mocks/test utilities before adding new test infrastructure.',
            'Choose integration boundaries that match the actual risk: UI + state, bridge wrapper + caller, schema + migration, or adapter + prompt builder.',
            'Create tests that prove data flows through the boundary and failure/degraded states are visible.',
            'Patch implementation only where the integration test reveals a real gap.',
          ],
          [
            `Integration coverage under ${pathOrUnspecified(f.paths.unitIntegrationTest ?? f.paths.test, d)} or the repo-standard integration test location.`,
            'Documented boundary covered and why it matters.',
            'DevLogs note with test command and result.',
          ],
          [
            'Run the targeted integration test command when available.',
            'Run `npm run typecheck`.',
            'Run `npm run build` if routing, static export, or app shell behavior changed.',
          ],
          spec,
        ),
    },
    {
      label: d.templateE2eTest,
      build: (f, spec) =>
        buildStructuredPrompt(
          f,
          d,
          'E2E acceptance test implementation',
          'Add or repair end-to-end coverage for the user-visible workflow of this feature, including the state a real operator needs to trust before using it.',
          [
            'Read Feature Spec, TDD Spec, README, and current implementation to identify the primary user journey.',
            'Use the existing E2E framework and selectors; add stable selectors only when the UI currently has no durable target.',
            'Cover the core happy path plus one high-risk blocked/error/degraded state when applicable.',
            'Keep E2E data setup explicit and avoid relying on hidden global state.',
            'If the feature is not implemented enough for E2E, document the missing prerequisite and add the closest useful lower-level test instead.',
          ],
          [
            `E2E script or acceptance notes under ${pathOrUnspecified(f.paths.e2eAcceptanceTestScriptFolder ?? f.paths.test, d)}.`,
            'Clear reproduction steps and expected visible states.',
            'Any necessary implementation/testability fixes, kept scoped.',
          ],
          [
            'Run the targeted E2E command if the local app/test environment is available.',
            'Run `npm run typecheck` after code changes.',
            'Include screenshot or visible-state evidence when browser verification is part of the work.',
          ],
          spec,
        ),
    },
    {
      label: d.templateDevLogs,
      build: (f, spec) =>
        buildStructuredPrompt(
          f,
          d,
          'DevLogs update and continuation handoff',
          'Bring the feature development log up to date so the next engineer can continue without reconstructing context from git history or chat.',
          [
            'Read README, Feature Spec, TDD Spec, current DevLogs, implementation files, and recent git diff/status.',
            'Summarize what is done, what is partially done, what is blocked, and what changed in this session.',
            'Record important implementation decisions and why they were made.',
            'List verification commands, results, and any checks that could not run.',
            'End with concrete next steps ordered by priority.',
          ],
          [
            `Updated DevLogs at ${pathOrUnspecified(f.paths.developmentLogSummaryFolder, d)} or the feature-local dev-log.md.`,
            'A continuation-ready status section with files changed, verification, risks, and next steps.',
            'No inflated progress claims without matching evidence.',
          ],
          [
            'Run docs checks if documentation governance applies.',
            'Run `npm run typecheck` if any code was touched while preparing the log.',
            'Report whether this was documentation-only or included code/test changes.',
          ],
          spec,
        ),
    },
    {
      label: d.templateContinueCicd,
      build: (f, spec) =>
        buildStructuredPrompt(
          f,
          d,
          'Continue CI/CD',
          'Continue or repair the CI/CD work for this feature or project. Determine whether the next step is pipeline setup, failing CI repair, test/build gate improvement, deployment automation, or a clear handoff for blocked infrastructure work.',
          [
            'Read README, Feature Spec, TDD Spec, DevLogs, implementation files, and existing CI/CD configuration before editing.',
            'Inspect current git status, recent DevLogs, package scripts, workflow files, deployment scripts, and any known failed commands.',
            'Identify the exact pipeline stage being continued: install, lint/typecheck, unit/integration/E2E tests, build, packaging, deployment, release, or rollback/ops verification.',
            'Make scoped workflow, script, config, or test-command changes that match the repo conventions already in use.',
            'Avoid broad toolchain upgrades, secret changes, or deployment target changes unless they are required and documented.',
            'Update DevLogs with the CI/CD stage, files changed, commands run, failures found, and the next unblocked action.',
          ],
          [
            'CI/CD config, script, test gate, or deployment handoff changes scoped to the current feature/project.',
            'Concrete diagnosis if the pipeline is blocked by credentials, remote permissions, unavailable services, or missing infrastructure.',
            'DevLogs entry with local checks, expected remote CI checks, remaining risks, and next steps.',
          ],
          [
            'Run the local equivalent of every CI step you changed, starting with the narrowest command.',
            'Run `npm run typecheck` and `npm run build` when TypeScript, UI, schema, routing, or bundling can be affected.',
            'If remote CI/CD cannot be executed locally, state exactly what was validated locally and what remains remote-only.',
            'Report required secrets or permissions by name only; never print or invent secret values.',
          ],
          spec,
        ),
    },
    {
      label: d.templateDebug,
      build: (f, spec) =>
        buildStructuredPrompt(
          f,
          d,
          'Debug and fix',
          'Investigate the feature as it currently exists, identify the smallest defensible fix, and leave evidence that the regression or bug is resolved.',
          [
            'Read DevLogs and current implementation before assuming the bug source.',
            'Reproduce or narrow the failure using the smallest available command, UI path, or test.',
            'Trace the cause across state, data, adapter, routing, and UI boundaries as needed.',
            'Patch the root cause with minimal collateral changes.',
            'Add or update a regression test where practical.',
          ],
          [
            'Root-cause summary with affected files.',
            'Scoped fix and regression coverage or a clear reason coverage was not possible.',
            'Updated DevLogs with reproduction, fix, and verification.',
          ],
          [
            'Run the reproducing check after the fix.',
            'Run `npm run typecheck`.',
            'Run `npm run build` if the fix touches shared app behavior.',
          ],
          spec,
        ),
    },
    {
      label: d.templateCodeReview,
      build: (f, spec) =>
        buildStructuredPrompt(
          f,
          d,
          'Code review and readiness audit',
          'Review this feature for correctness, regression risk, missing tests, inconsistent docs, and readiness for another engineer to continue or ship.',
          [
            'Read Feature Spec, TDD Spec, DevLogs, implementation, and current diff.',
            'Check whether implementation matches acceptance criteria and current product behavior.',
            'Prioritize findings by severity with file/line references where possible.',
            'Identify missing tests, stale docs, hidden assumptions, and unsafe fallback behavior.',
            'Patch only small obvious defects if the assignment expects implementation; otherwise provide review findings first.',
          ],
          [
            'Ordered review findings with severity and evidence.',
            'Short summary of what is ready, what is risky, and what should happen next.',
            'Optional small fixes plus verification if you make changes.',
          ],
          [
            'Run `npm run typecheck` for review confidence when feasible.',
            'Run targeted tests/build only when the reviewed surface requires it.',
            'Clearly distinguish confirmed issues from assumptions.',
          ],
          spec,
        ),
    },
  ];
}

function buildDefaultPrompt(feature: Feature, d: DispatchT, specContent?: string): string {
  let text = `[${feature.id}] ${feature.name}\n`;
  text += `${d.promptStatus} ${feature.status} (${feature.progress}%)\n`;
  text += `${d.promptImplPath} ${feature.paths.implementation ?? d.promptUnspecified}\n`;
  if (feature.notes) text += `${d.promptNotes} ${feature.notes}\n`;
  if (specContent) text += `\n${d.promptSpecHeader}\n${specContent.slice(0, 1500)}`;
  return text;
}

function resolvePath(filePath: string, projectRoot: string): string {
  if (filePath.startsWith('/')) return filePath;
  return `${projectRoot.replace(/\/$/, '')}/${filePath}`;
}

const IDE_IDS: IDEId[] = ['Cursor', 'VSCode', 'Trae', 'Antigravity'];

const PHASE_OPTIONS: Array<{ value: FeaturePhase; phaseKey: keyof Translations['phases'] }> = [
  { value: 'development', phaseKey: 'development' },
  { value: 'e2e_testing', phaseKey: 'e2eTesting' },
  { value: 'deployment', phaseKey: 'deployment' },
  { value: 'operations', phaseKey: 'operations' },
];

function inferProviderFromAdapter(adapter: AnyAdapterConfig | undefined): LlmProviderId | undefined {
  if (!adapter || adapter.type !== 'agent') return undefined;
  const marker = `${adapter.id} ${adapter.name} ${adapter.command}`.toLowerCase();
  if (marker.includes('claude') || marker.includes('anthropic')) return 'anthropic';
  if (marker.includes('codex') || marker.includes('openai')) return 'openai';
  if (marker.includes('gemini') || marker.includes('google')) return 'gemini';
  if (marker.includes('deepseek')) return 'deepseek';
  if (marker.includes('grok') || marker.includes('xai')) return 'grok';
  if (marker.includes('qwen')) return 'qwen';
  if (marker.includes('openrouter')) return 'openrouter';
  return undefined;
}

function adapterToIDE(adapter: AnyAdapterConfig): IDEId | undefined {
  if (adapter.type !== 'ide') return undefined;
  if (IDE_IDS.includes(adapter.id as IDEId)) return adapter.id as IDEId;
  return IDE_IDS.find((id) => id === adapter.name);
}

function resolveInitialAdapterId(
  feature: Feature,
  adapters: AnyAdapterConfig[],
  engineerRoles: EngineerRole[],
  defaultIDE?: IDEId,
): string {
  const savedAgent = feature.promptConfig?.agentId;
  if (savedAgent && adapters.some((a) => a.id === savedAgent)) return savedAgent;

  if (feature.assignedRoleId) {
    const role = engineerRoles.find((r) => r.id === feature.assignedRoleId);
    if (role?.defaultAgentId && adapters.some((a) => a.id === role.defaultAgentId)) {
      return role.defaultAgentId;
    }
  }

  const ide = feature.assignedIDE ?? defaultIDE;
  if (ide) {
    const ideAdapter = adapters.find(
      (a) => adapterToIDE(a) === ide || a.id === ide,
    );
    if (ideAdapter) return ideAdapter.id;
  }

  return adapters[0]?.id ?? '';
}

// ── Component ─────────────────────────────────────────────────────────────────

type DispatchFeatureUpdate = Partial<
  Pick<
    Feature,
    | 'status' | 'progress' | 'assignedRoleId' | 'assignedIDE' | 'phase' | 'promptConfig'
    | 'assignedTo' | 'assignedAt'
  >
>;

interface TaskDispatchModalProps {
  feature: Feature;
  adapters: AnyAdapterConfig[];
  projectRoot: string;
  engineerRoles?: EngineerRole[];
  /** Project default IDE when the feature has no per-row override. */
  defaultIDE?: IDEId;
  onClose: () => void;
  onExecuted: (result: ExecutionResult) => void;
  onRunStart?: (
    pid: number,
    featureId: string,
    featureName: string,
    command: string,
    args: string[],
  ) => void;
  onRunLog?: (pid: number, line: string) => void;
  onRunEnd?: (pid: number, exitCode: number) => void;
  onFeatureUpdate?: (featureId: string, update: DispatchFeatureUpdate) => void;
}

type Phase = 'idle' | 'running' | 'done' | 'error';

export function TaskDispatchModal({
  feature,
  adapters,
  projectRoot,
  engineerRoles = [],
  defaultIDE,
  onClose,
  onExecuted,
  onRunStart,
  onRunLog,
  onRunEnd,
  onFeatureUpdate,
}: TaskDispatchModalProps) {
  const { t } = useI18n();
  const d = t.dispatch;

  const promptTemplates = useMemo(() => makePromptTemplates(d), [d]);
  const llmProviders = useMemo(() => listLlmProviders(), []);
  const initialAdapterId = useMemo(
    () => resolveInitialAdapterId(feature, adapters, engineerRoles, defaultIDE),
    [adapters, defaultIDE, engineerRoles, feature],
  );
  const fallbackProviderId = llmProviders[0]?.id ?? 'anthropic';

  const [selectedRoleId, setSelectedRoleId] = useState(feature.assignedRoleId ?? '');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [selectedAdapterId, setSelectedAdapterId] = useState(initialAdapterId);
  const [selectedModelProviderId, setSelectedModelProviderId] = useState<LlmProviderId>(() => {
    const saved = feature.promptConfig?.modelProviderId;
    const savedProvider = llmProviders.find((provider) => provider.id === saved);
    if (savedProvider) return savedProvider.id;
    const initialAdapter = adapters.find((adapter) => adapter.id === initialAdapterId);
    return inferProviderFromAdapter(initialAdapter) ?? fallbackProviderId;
  });
  const [selectedModelId, setSelectedModelId] = useState(() => {
    const saved = feature.promptConfig?.modelId?.trim();
    if (saved) return saved;
    const provider = llmProviders.find((candidate) => candidate.id === selectedModelProviderId);
    return provider?.defaultModel ?? '';
  });
  const [selectedPhase, setSelectedPhase] = useState<FeaturePhase>(
    feature.phase ?? 'development',
  );
  const [prompt, setPrompt] = useState('');
  const [autoLoop, setAutoLoop] = useState(feature.promptConfig?.autoLoop ?? false);
  const [stopCondition, setStopCondition] = useState(feature.promptConfig?.stopCondition ?? '');
  const [maxIterations, setMaxIterations] = useState(feature.promptConfig?.maxIterations ?? 5);
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(feature.promptConfig?.autoLoop || feature.promptConfig?.stopCondition),
  );
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [activePid, setActivePid] = useState<number | null>(null);
  const [specLoading, setSpecLoading] = useState(false);
  const [mcpInjection, setMcpInjection] = useState<{ count: number; flag: string } | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const unlistenRefs = useRef<Array<() => void>>([]);
  const activePidRef = useRef<number | null>(null);

  const selectedAdapter = adapters.find((a) => a.id === selectedAdapterId);
  const selectedTargetKind = getAdapterExecutionKind(selectedAdapter);
  const isIDE = selectedTargetKind === 'ide';
  const isAgentCli = selectedTargetKind === 'agent-cli';
  const isAgentApp = selectedTargetKind === 'agent-app';
  const selectedRole = engineerRoles.find((r) => r.id === selectedRoleId) ?? null;
  const selectedWorkflow = selectedWorkflowId ? getAgentWorkflowById(selectedWorkflowId) ?? null : null;
  const selectedModelProvider =
    llmProviders.find((provider) => provider.id === selectedModelProviderId) ?? llmProviders[0];
  const selectedModelOptions = selectedModelProvider
    ? Array.from(new Set([
        selectedModelProvider.defaultModel,
        ...selectedModelProvider.availableModels,
        selectedModelId,
      ].filter(Boolean)))
    : [];
  const executionTargetGroups = [
    {
      label: d.targetGroupIde,
      adapters: adapters.filter((adapter) => getAdapterExecutionKind(adapter) === 'ide'),
    },
    {
      label: d.targetGroupCli,
      adapters: adapters.filter((adapter) => getAdapterExecutionKind(adapter) === 'agent-cli'),
    },
    {
      label: d.targetGroupApp,
      adapters: adapters.filter((adapter) => getAdapterExecutionKind(adapter) === 'agent-app'),
    },
  ].filter((group) => group.adapters.length > 0);

  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId);
    const role = engineerRoles.find((r) => r.id === roleId);
    if (role?.defaultAgentId) {
      const match = adapters.find((a) => a.id === role.defaultAgentId);
      if (match) setSelectedAdapterId(match.id);
    }
  };

  const handleModelProviderChange = (providerId: string) => {
    const provider = llmProviders.find((candidate) => candidate.id === providerId);
    if (!provider) return;
    setSelectedModelProviderId(provider.id);
    setSelectedModelId(provider.defaultModel);
  };

  const buildAssignmentPatch = (): DispatchFeatureUpdate => {
    const adapter = adapters.find((a) => a.id === selectedAdapterId);
    const promptConfig: FeaturePromptConfig = {
      body: prompt.trim() || undefined,
      agentId: selectedAdapterId || undefined,
      modelProviderId: selectedModelProviderId,
      modelId: selectedModelId || undefined,
      autoLoop: autoLoop || undefined,
      stopCondition: autoLoop && stopCondition.trim() ? stopCondition.trim() : undefined,
      maxIterations: autoLoop ? maxIterations : undefined,
    };
    const role = engineerRoles.find((r) => r.id === selectedRoleId);
    const adapterLabel = adapter?.name ?? selectedAdapterId;
    const roleLabel = role ? ` (${role.name})` : '';
    const modelLabel = selectedModelProvider && selectedModelId
      ? ` · ${selectedModelProvider.label} / ${selectedModelId}`
      : '';
    const assignedTo = `${adapterLabel}${roleLabel}${modelLabel}`;
    const patch: DispatchFeatureUpdate = {
      assignedRoleId: selectedRoleId || undefined,
      phase: selectedPhase,
      promptConfig,
      assignedTo: assignedTo || undefined,
      assignedAt: new Date().toISOString(),
    };
    const ide = adapter ? adapterToIDE(adapter) : undefined;
    if (ide) patch.assignedIDE = ide;
    return patch;
  };

  // Load saved prompt or spec content and build default prompt on mount
  useEffect(() => {
    let cancelled = false;
    const savedBody = feature.promptConfig?.body?.trim();
    if (savedBody) {
      setPrompt(savedBody);
      return;
    }

    const specPath = feature.paths.spec ?? feature.paths.tdd;

    if (!specPath) {
      setPrompt(buildDefaultPrompt(feature, d));
      return;
    }

    setSpecLoading(true);
    readFile(resolvePath(specPath, projectRoot))
      .then((content) => {
        if (!cancelled) setPrompt(buildDefaultPrompt(feature, d, content || undefined));
      })
      .catch(() => {
        if (!cancelled) setPrompt(buildDefaultPrompt(feature, d));
      })
      .finally(() => {
        if (!cancelled) setSpecLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [feature, projectRoot]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recompute MCP injection preview whenever adapter or project root changes.
  useEffect(() => {
    if (!selectedAdapter || selectedTargetKind !== 'agent-cli') {
      setMcpInjection(null);
      return;
    }
    const flag = mcpInjectionFlag(selectedAdapter.command);
    if (!flag) {
      setMcpInjection(null);
      return;
    }
    const servers = collectEnabledMcpServers(projectRoot);
    const count = Object.keys(servers).length;
    setMcpInjection(count > 0 ? { count, flag } : null);
  }, [selectedAdapter, selectedTargetKind, projectRoot]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    return () => {
      unlistenRefs.current.forEach((fn) => fn());
    };
  }, []);

  const applyTemplate = (tpl: PromptTemplate) => {
    const specPath = feature.paths.spec ?? feature.paths.tdd;
    if (specPath) {
      readFile(resolvePath(specPath, projectRoot))
        .then((content) => setPrompt(tpl.build(feature, content || undefined)))
        .catch(() => setPrompt(tpl.build(feature)));
    } else {
      setPrompt(tpl.build(feature));
    }
  };

  const buildExecutionPrompt = () => {
    let effectivePrompt = prompt;
    if (!isIDE && selectedModelProvider && selectedModelId) {
      effectivePrompt =
        `[${d.modelPromptTitle}]\n` +
        `${d.modelProviderLabel}: ${selectedModelProvider.label}\n` +
        `${d.modelIdLabel}: ${selectedModelId}\n\n---\n\n${effectivePrompt}`;
    }
    if (selectedRole) {
      const parts: string[] = [];
      if (selectedRole.systemPrompt) {
        parts.push(`[${d.engineerLabel}: ${selectedRole.name}]\n${selectedRole.systemPrompt}`);
      }
      if (selectedRole.referenceFiles.length > 0) {
        parts.push(`${d.refsPrefix}\n${selectedRole.referenceFiles.map((f) => `- ${f}`).join('\n')}`);
      }
      if (parts.length > 0) {
        effectivePrompt = `${parts.join('\n\n')}\n\n---\n\n${effectivePrompt}`;
      }
    }
    if (selectedWorkflow) {
      effectivePrompt = buildAgentWorkflowPrompt(selectedWorkflow, feature, effectivePrompt);
    }
    return effectivePrompt;
  };

  const buildCommand = async (adapter: AnyAdapterConfig): Promise<{ command: string; args: string[] }> => {
    const runtimeAdapter = createRuntimeAdapterFromConfig(adapter);
    const result = await runtimeAdapter.execute({
      feature,
      prompt: buildExecutionPrompt(),
      projectRoot,
    });
    if (!result.success || !result.command || !result.args) {
      throw new Error(result.message ?? `Unable to build command for ${adapter.name}`);
    }
    return { command: result.command, args: result.args };
  };

  const handleExecute = async () => {
    const adapter = adapters.find((a) => a.id === selectedAdapterId);
    if (!adapter) return;

    setPhase('running');
    setLogs([]);

    onFeatureUpdate?.(feature.id, { ...buildAssignmentPatch(), status: 'in_progress' });

    try {
      const { command, args: baseArgs } = await buildCommand(adapter);
      const args = await augmentArgsWithMcp(command, baseArgs, collectEnabledMcpServers(projectRoot));
      const unStdout = await onAgentStdout(({ pid: eventPid, line }) => {
        if (activePidRef.current !== null && eventPid !== activePidRef.current) return;
        setLogs((prev) => [...prev, line]);
        onRunLog?.(eventPid, line);
      });
      const unExit = await onAgentExit(({ pid: exitPid, code }) => {
        if (activePidRef.current !== null && exitPid !== activePidRef.current) return;
        const exitLine = `\n── process exited (PID ${exitPid}, code ${code}) ──`;
        setLogs((prev) => [...prev, exitLine]);
        const succeeded = code === 0;
        setPhase(succeeded ? 'done' : 'error');
        setActivePid(null);
        activePidRef.current = null;
        onRunEnd?.(exitPid, code);
        onFeatureUpdate?.(feature.id, { assignedTo: undefined, assignedAt: undefined });
        if (succeeded) {
          onFeatureUpdate?.(feature.id, { progress: Math.min(feature.progress + 20, 100) });
        }
      });
      unlistenRefs.current.push(unStdout, unExit);

      const pid = await spawnAgent({ command, args, workingDir: projectRoot });
      setActivePid(pid);
      activePidRef.current = pid;
      onRunStart?.(pid, feature.id, feature.name, command, args);

      onExecuted({
        success: true,
        message: `${adapter.name} started (PID: ${pid})`,
        command,
        args,
        dryRun: false,
        pid,
      });
    } catch (err) {
      setLogs((prev) => [...prev, `Error: ${err}`]);
      setPhase('error');
    }
  };

  const handleOpenExternalTarget = async () => {
    const adapter = adapters.find((a) => a.id === selectedAdapterId);
    if (!adapter) return;

    try {
      const { command, args } = await buildCommand(adapter);
      const pid = await spawnAgent({ command, args, workingDir: projectRoot });
      onFeatureUpdate?.(feature.id, { ...buildAssignmentPatch(), status: 'in_progress' });
      onExecuted({
        success: true,
        message: `${adapter.name} opened (PID: ${pid})`,
        command,
        args,
        dryRun: false,
        pid,
      });
      onClose();
    } catch (err) {
      setPhase('error');
      setLogs([`Failed to open target: ${err}`]);
    }
  };

  const handleOpenInTerminal = async () => {
    const adapter = adapters.find((a) => a.id === selectedAdapterId);
    if (!adapter) return;

    try {
      const { command, args: baseArgs } = await buildCommand(adapter);
      const args = await augmentArgsWithMcp(command, baseArgs, collectEnabledMcpServers(projectRoot));
      // AppleScript `do script` injects newlines as Enter mid-typing on macOS,
      // so collapse literal newlines in args into spaces before spawning.
      const flatArgs = args.map((a) => a.replace(/\r?\n/g, ' '));
      await spawnTerminal({ command, args: flatArgs, cwd: projectRoot });
      onFeatureUpdate?.(feature.id, { ...buildAssignmentPatch(), status: 'in_progress' });
      onExecuted({
        success: true,
        message: `${adapter.name} opened in new Terminal window`,
        command,
        args: flatArgs,
        dryRun: false,
      });
      onClose();
    } catch (err) {
      setPhase('error');
      setLogs([`Failed to open terminal: ${err}`]);
    }
  };

  const handleKill = async () => {
    if (activePid == null) return;
    await killProcess(activePid);
    setActivePid(null);
    activePidRef.current = null;
  };

  const isRunning = phase === 'running';
  const isAssignedBlocked =
    phase === 'idle' &&
    !!feature.assignedTo &&
    feature.status === 'in_progress' &&
    !overrideConfirmed;

  // Target file display for IDE adapters
  const ideTargetFile =
    feature.paths.implementation ?? feature.paths.tdd ?? feature.paths.spec ?? '.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-xl flex-col overflow-hidden border border-stone-200/18 bg-[rgb(var(--pm-panel))] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200/12 bg-white/[0.035] px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-stone-50">{d.title}</h3>
            <p className="text-xs text-stone-400">
              {feature.id} — {feature.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-stone-400 hover:text-stone-100"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-6">
          {phase === 'idle' && feature.assignedTo && feature.status === 'in_progress' && !overrideConfirmed && (
            <div className="flex items-start justify-between gap-3 border border-amber-400/30 bg-amber-500/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-200">
                  {d.assignedToWarning
                    .replace('{name}', feature.assignedTo)
                    .replace('{date}', feature.assignedAt
                      ? new Date(feature.assignedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
                      : '—')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOverrideConfirmed(true)}
                className="shrink-0 border border-amber-400/40 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/20"
              >
                {d.assignedToContinue}
              </button>
            </div>
          )}

        {phase === 'idle' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-200">
                  {d.phaseLabel}
                </label>
                <select
                  value={selectedPhase}
                  onChange={(e) => setSelectedPhase(e.target.value as FeaturePhase)}
                  className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                >
                  {PHASE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.value === 'e2e_testing'
                        ? `E2E — ${t.phases.e2eTesting}`
                        : `${opt.value.toUpperCase().slice(0, 3)} — ${t.phases[opt.phaseKey]}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Engineer role selector */}
              {engineerRoles.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-200">
                    {d.engineerLabel}
                  </label>
                  <select
                    value={selectedRoleId}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                  >
                    <option value="">{d.noRole}</option>
                    {engineerRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  {selectedRole && (
                    <div className="mt-1.5 border border-stone-200/12 bg-[rgb(var(--pm-rail))]/60 px-3 py-2 text-[11px] text-stone-400">
                      <span className="text-stone-300">{d.systemPromptPrefix}</span>
                      {selectedRole.systemPrompt.slice(0, 80)}…
                      {selectedRole.referenceFiles.length > 0 && (
                        <span className="ml-2 text-stone-500">
                          {d.refsPrefix}{selectedRole.referenceFiles.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Workflow selector */}
              {!isIDE && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-200">
                    {d.workflowLabel}
                  </label>
                  <select
                    value={selectedWorkflowId}
                    onChange={(e) => setSelectedWorkflowId(e.target.value)}
                    className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                  >
                    <option value="">{d.noWorkflow}</option>
                    {DEFAULT_AGENT_WORKFLOWS.map((workflow) => (
                      <option key={workflow.id} value={workflow.id}>
                        {workflow.name} · {workflow.mode}
                      </option>
                    ))}
                  </select>
                  {selectedWorkflow && (
                    <div className="mt-1.5 border border-stone-200/12 bg-[rgb(var(--pm-rail))]/60 px-3 py-2 text-[11px] text-stone-400">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="border border-amber-200/25 px-1.5 py-0.5 font-mono uppercase tracking-[0.12em] text-amber-200/80">
                          {selectedWorkflow.mode}
                        </span>
                        <span className="text-stone-300">{selectedWorkflow.role}</span>
                        <span>{selectedWorkflow.summary}</span>
                      </div>
                      <p className="mt-1 text-stone-500">
                        Required evidence: {selectedWorkflow.requiredChecks.slice(0, 2).join(' · ')}
                        {selectedWorkflow.requiredChecks.length > 2 ? ' · …' : ''}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Model selector */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-200">
                    {d.modelProviderLabel}
                  </label>
                  <select
                    value={selectedModelProviderId}
                    onChange={(e) => handleModelProviderChange(e.target.value)}
                    className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                  >
                    {llmProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-200">
                    {d.modelIdLabel}
                  </label>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                  >
                    {selectedModelOptions.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Execution target selector */}
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-200">
                  {d.runtimeLabel}
                </label>
                <select
                  value={selectedAdapterId}
                  onChange={(e) => setSelectedAdapterId(e.target.value)}
                  className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                >
                  {executionTargetGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.adapters.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {mcpInjection && (
                  <p className="mt-1.5 text-[11px] text-emerald-300/80">
                    {d.mcpInjected
                      .replace('{count}', String(mcpInjection.count))
                      .replace('{flag}', mcpInjection.flag)}
                  </p>
                )}
                {isAgentApp && (
                  <p className="mt-1.5 text-[11px] text-amber-200/80">
                    {d.appTargetHint}
                  </p>
                )}
              </div>

              {isIDE ? (
                /* IDE mode: show target file, no prompt needed */
                <div className="border border-stone-200/12 bg-[rgb(var(--pm-input))] p-3">
                  <p className="mb-1.5 text-xs font-medium text-stone-400">{d.openFileLabel}</p>
                  <p className="break-all font-mono text-xs text-stone-200">{ideTargetFile}</p>
                </div>
              ) : (
                /* Agent mode: template picker + prompt textarea */
                <>
                  <div>
                    <p className="mb-2 text-xs font-medium text-stone-400">{d.templatesLabel}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {promptTemplates.map((tpl) => (
                        <button
                          key={tpl.label}
                          onClick={() => applyTemplate(tpl)}
                          className="border border-stone-200/20 px-2.5 py-1 text-xs text-stone-300 transition-colors hover:border-emerald-200/40 hover:bg-emerald-100/10 hover:text-emerald-100"
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-stone-200">
                      {d.promptLabel}
                      {specLoading && (
                        <span className="ml-2 animate-pulse text-xs font-normal text-stone-500">
                          {d.loadingSpec}
                        </span>
                      )}
                    </label>
                    <textarea
                      rows={7}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 font-mono text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                    />
                  </div>
                </>
              )}

              {isAgentCli && (
              <div className="border border-stone-200/12">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-stone-300 hover:bg-white/5"
                >
                  {d.advancedTitle}
                  <span className="text-stone-500">{showAdvanced ? '−' : '+'}</span>
                </button>
                {showAdvanced && (
                  <div className="space-y-3 border-t border-stone-200/12 px-3 py-3 text-xs text-stone-200">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={autoLoop}
                        onChange={(e) => setAutoLoop(e.target.checked)}
                        className="accent-emerald-400"
                      />
                      {d.autoRetryLabel}
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-stone-400">
                        {d.stopConditionLabel}
                      </span>
                      <input
                        value={stopCondition}
                        onChange={(e) => setStopCondition(e.target.value)}
                        placeholder="e.g. all tests pass"
                        disabled={!autoLoop}
                        className="h-7 w-full border border-stone-200/15 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-100 disabled:opacity-50"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-stone-400">
                        {d.maxIterationsLabel}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={maxIterations}
                        onChange={(e) =>
                          setMaxIterations(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                        }
                        disabled={!autoLoop}
                        className="h-7 w-24 border border-stone-200/15 bg-[rgb(var(--pm-input))] px-2 text-xs text-stone-100 disabled:opacity-50"
                      />
                    </label>
                  </div>
                )}
              </div>
              )}
            </>
          )}

          {phase !== 'idle' && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-stone-200">
                  {isRunning ? d.liveOutput : d.executionLog}
                </label>
                {activePid != null && (
                  <span className="text-xs text-stone-400">PID {activePid}</span>
                )}
              </div>
              <div className="max-h-64 overflow-auto border border-stone-200/12 bg-[rgb(var(--pm-input))] p-3 font-mono text-xs leading-5 text-stone-200">
                {logs.length === 0 ? (
                  <span className="animate-pulse text-stone-500">{d.waitingOutput}</span>
                ) : (
                  logs.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">
                      {line}
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-stone-200/12 bg-white/[0.035] px-6 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-300 hover:bg-white/5"
          >
            {isRunning ? d.backgroundBtn : d.closeBtn}
          </button>
          {isRunning && activePid != null && (
            <button
              onClick={handleKill}
              className="border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/40"
            >
              Kill
            </button>
          )}
          {phase === 'idle' && isAgentCli && (
            <button
              onClick={handleOpenInTerminal}
              disabled={specLoading || isAssignedBlocked}
              className="border border-stone-200/25 px-4 py-2 text-sm font-medium text-stone-200 hover:bg-white/5 disabled:opacity-50"
            >
              {d.openTerminalBtn}
            </button>
          )}
          {phase === 'idle' && (
            <button
              onClick={isAgentCli ? handleExecute : handleOpenExternalTarget}
              disabled={specLoading || isAssignedBlocked}
              className="bg-stone-100 px-4 py-2 text-sm font-medium text-[rgb(var(--pm-panel))] hover:bg-amber-100 disabled:opacity-50"
            >
              {isIDE ? d.openIDEBtn : isAgentApp ? d.openAppBtn : d.runInPMBtn}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
