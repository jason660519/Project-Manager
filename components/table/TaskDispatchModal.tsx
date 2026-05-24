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
import {
  checkCommandAvailability,
  type CommandAvailability,
} from '../../lib/adapters/availability';
import { listLlmProviders } from '../../lib/keys/llmProviders';
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
  HarnessTaskRole,
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


function adapterToIDE(adapter: AnyAdapterConfig): IDEId | undefined {
  if (adapter.type !== 'ide') return undefined;
  if (IDE_IDS.includes(adapter.id as IDEId)) return adapter.id as IDEId;
  return IDE_IDS.find((id) => id === adapter.name);
}

type TargetPreflightStatus = 'checking' | 'available' | 'missing' | 'blocked' | 'unknown';

interface TargetPreflight {
  status: TargetPreflightStatus;
  label: string;
  description: string;
  commandLabel: string;
  managementLabel: string;
  canRun: boolean;
}

function describeTargetPreflight(
  adapter: AnyAdapterConfig | undefined,
  availability: CommandAvailability | undefined,
  d: DispatchT,
): TargetPreflight | null {
  if (!adapter) return null;

  const targetKind = getAdapterExecutionKind(adapter);
  const commandLabel = [adapter.command, ...('argsTemplate' in adapter ? adapter.argsTemplate : [])]
    .filter(Boolean)
    .join(' ');
  const managementLabel =
    targetKind === 'agent-cli'
      ? d.targetManagedByPm
      : targetKind === 'ide'
        ? d.targetManagedExternalIde
        : d.targetManagedExternalApp;

  if (!availability) {
    return {
      status: 'checking',
      label: d.targetStatusChecking,
      description: d.targetStatusCheckingHint,
      commandLabel,
      managementLabel,
      canRun: false,
    };
  }

  if (availability.status === 'missing') {
    return {
      status: 'missing',
      label: d.targetStatusMissing,
      description: d.targetStatusMissingHint.replace('{command}', adapter.command),
      commandLabel,
      managementLabel,
      canRun: false,
    };
  }

  if (availability.status === 'blocked') {
    return {
      status: 'blocked',
      label: d.targetStatusBlocked,
      description: d.targetStatusBlockedHint.replace('{command}', adapter.command),
      commandLabel,
      managementLabel,
      canRun: false,
    };
  }

  if (availability.status === 'unknown' || targetKind === 'agent-app') {
    return {
      status: 'unknown',
      label: targetKind === 'agent-app' ? d.targetStatusManual : d.targetStatusUnknown,
      description: targetKind === 'agent-app'
        ? d.targetStatusManualHint
        : d.targetStatusUnknownHint,
      commandLabel,
      managementLabel,
      canRun: true,
    };
  }

  return {
    status: 'available',
    label: d.targetStatusAvailable,
    description: d.targetStatusAvailableHint,
    commandLabel,
    managementLabel,
    canRun: true,
  };
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
    | 'assignedTo' | 'assignedAt' | 'harnessAssignments'
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

type Phase = 'idle' | 'pending' | 'running' | 'done' | 'error';

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
  const [selectedTaskRole, setSelectedTaskRole] = useState<HarnessTaskRole>('worker');
  const [selectedRoleId, setSelectedRoleId] = useState(() => (
    feature.harnessAssignments?.worker?.engineerRoleId
    ?? feature.assignedRoleId
    ?? ''
  ));
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [selectedAdapterId, setSelectedAdapterId] = useState(initialAdapterId);
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
  const [commandLoading, setCommandLoading] = useState(false);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [killConfirmPid, setKillConfirmPid] = useState<number | null>(null);
  const [adapterWarning, setAdapterWarning] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [mcpInjection, setMcpInjection] = useState<{ count: number; flag: string } | null>(null);
  const [commandAvailability, setCommandAvailability] = useState<Record<string, CommandAvailability>>({});

  const logEndRef = useRef<HTMLDivElement>(null);
  const unlistenRefs = useRef<Array<() => void>>([]);
  const activePidRef = useRef<number | null>(null);

  // Check availability of all adapters on mount.
  useEffect(() => {
    let cancelled = false;
    const checkAll = async () => {
      const result: Record<string, CommandAvailability> = {};
      for (const adapter of adapters) {
        result[adapter.id] = await checkCommandAvailability(adapter.command);
      }
      if (!cancelled) setCommandAvailability(result);
    };
    checkAll();
    return () => { cancelled = true; };
  }, [adapters]);

  // Adapter fallback warning
  useEffect(() => {
    const savedId = feature.promptConfig?.agentId;
    if (savedId && !adapters.some((a) => a.id === savedId) && adapters.length > 0) {
      setAdapterWarning(d.adapterWarningHint.replace('{id}', savedId).replace('{fallback}', adapters[0].name));
    } else {
      setAdapterWarning(null);
    }
  }, [adapters, feature.promptConfig?.agentId]);

  const selectedAdapter = adapters.find((a) => a.id === selectedAdapterId);
  const selectedTargetKind = getAdapterExecutionKind(selectedAdapter);
  const isIDE = selectedTargetKind === 'ide';
  const isAgentCli = selectedTargetKind === 'agent-cli';
  const isAgentApp = selectedTargetKind === 'agent-app';
  const selectedPreflight = describeTargetPreflight(
    selectedAdapter,
    selectedAdapter ? commandAvailability[selectedAdapter.id] : undefined,
    d,
  );
  const isSelectedTargetBlocked = selectedPreflight?.canRun === false;
  const selectedRole = engineerRoles.find((r) => r.id === selectedRoleId) ?? null;
  const selectedWorkflow = selectedWorkflowId ? getAgentWorkflowById(selectedWorkflowId) ?? null : null;
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

  useEffect(() => {
    const nextRoleId = (() => {
      if (selectedTaskRole === 'planner') return feature.harnessAssignments?.planner?.engineerRoleId ?? '';
      if (selectedTaskRole === 'evaluator') return feature.harnessAssignments?.evaluator?.engineerRoleId ?? '';
      return feature.harnessAssignments?.worker?.engineerRoleId ?? feature.assignedRoleId ?? '';
    })();
    setSelectedRoleId(nextRoleId);
  }, [feature, selectedTaskRole]);

  const buildAssignmentPatch = (): DispatchFeatureUpdate => {
    const adapter = adapters.find((a) => a.id === selectedAdapterId);
    const role = engineerRoles.find((r) => r.id === selectedRoleId);
    const lastDispatchModel = role?.primaryModel
      ? `${role.primaryModel.providerId}/${role.primaryModel.modelId}`
      : undefined;
    const promptConfig: FeaturePromptConfig = {
      body: prompt.trim() || undefined,
      agentId: selectedAdapterId || undefined,
      autoLoop: autoLoop || undefined,
      stopCondition: autoLoop && stopCondition.trim() ? stopCondition.trim() : undefined,
      maxIterations: autoLoop ? maxIterations : undefined,
      lastDispatchModel,
    };
    const adapterLabel = adapter?.name ?? selectedAdapterId;
    const roleLabel = role ? ` (${role.name})` : '';
    const assignedTo = `${adapterLabel}${roleLabel}`;
    const now = new Date().toISOString();
    const ide = adapter ? adapterToIDE(adapter) : undefined;

    const nextAssignments = { ...(feature.harnessAssignments ?? {}) };
    const nextRoleAssignment = {
      ...(selectedTaskRole === 'planner'
        ? feature.harnessAssignments?.planner
        : selectedTaskRole === 'evaluator'
          ? feature.harnessAssignments?.evaluator
          : feature.harnessAssignments?.worker),
      engineerRoleId: selectedRoleId || undefined,
      assignedIDE: ide,
      assignedTo: assignedTo || undefined,
      assignedAt: now,
      adapterId: selectedAdapterId || undefined,
      lastDispatchModel,
    };
    if (selectedTaskRole === 'planner') nextAssignments.planner = nextRoleAssignment;
    if (selectedTaskRole === 'worker') nextAssignments.worker = nextRoleAssignment;
    if (selectedTaskRole === 'evaluator') nextAssignments.evaluator = nextRoleAssignment;

    const patch: DispatchFeatureUpdate = {
      phase: selectedPhase,
      promptConfig,
      harnessAssignments: nextAssignments,
    };
    if (selectedTaskRole === 'worker') {
      patch.assignedRoleId = selectedRoleId || undefined;
      patch.assignedTo = assignedTo || undefined;
      patch.assignedAt = now;
      if (ide) patch.assignedIDE = ide;
    }
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
      setMcpLoading(false);
      setMcpError(null);
      return;
    }
    const flag = mcpInjectionFlag(selectedAdapter.command);
    if (!flag) {
      setMcpInjection(null);
      setMcpLoading(false);
      setMcpError(null);
      return;
    }
    let cancelled = false;
    setMcpLoading(true);
    setMcpError(null);
    try {
      const servers = collectEnabledMcpServers(projectRoot);
      if (!cancelled) {
        const count = Object.keys(servers).length;
        setMcpInjection(count > 0 ? { count, flag } : null);
        setMcpLoading(false);
      }
    } catch (err) {
      if (!cancelled) {
        setMcpError(`Failed to load MCP servers: ${err instanceof Error ? err.message : String(err)}`);
        setMcpInjection(null);
        setMcpLoading(false);
      }
    }
    return () => { cancelled = true; };
  }, [selectedAdapter, selectedTargetKind, projectRoot]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
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
    if (!isIDE && selectedRole?.primaryModel) {
      const providerLabel = llmProviders.find((p) => p.id === selectedRole.primaryModel!.providerId)?.label ?? selectedRole.primaryModel.providerId;
      effectivePrompt =
        `[${d.modelPromptTitle}]\n` +
        `${d.modelProviderLabel}: ${providerLabel}\n` +
        `${d.modelIdLabel}: ${selectedRole.primaryModel.modelId}\n\n---\n\n${effectivePrompt}`;
    }
    if (selectedRole) {
      const parts: string[] = [];
      if (selectedRole.systemPrompt) {
        parts.push(`[${d.engineerLabel}: ${selectedRole.name}]\n${selectedRole.systemPrompt}`);
      }
      if (selectedRole.referenceFiles.length > 0) {
        parts.push(`${d.refsPrefix}\n${selectedRole.referenceFiles.map((f) => `- ${f}`).join('\n')}`);
      }
      if (selectedRole.workingScope && selectedRole.workingScope.allowedPaths.length > 0) {
        parts.push(
          `[Working Scope]\nOnly modify files within these paths:\n${selectedRole.workingScope.allowedPaths.map((p) => `- ${p}`).join('\n')}\nDo not create or edit files outside these directories.`,
        );
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
    if (!adapter) {
      setDispatchError(d.dispatchNoAdapter);
      return;
    }

    setPhase('pending');
    setLogs([]);
    setDispatchError(null);
    setCommandLoading(true);

    {
      const assignmentPatch = buildAssignmentPatch();
      onFeatureUpdate?.(
        feature.id,
        selectedTaskRole === 'worker'
          ? { ...assignmentPatch, status: 'in_progress' }
          : assignmentPatch,
      );
    }

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
        if (selectedTaskRole === 'worker') {
          onFeatureUpdate?.(feature.id, { assignedTo: undefined, assignedAt: undefined });
        }
        if (succeeded && selectedTaskRole === 'worker') {
          const role = engineerRoles.find((r) => r.id === selectedRoleId);
          if (role?.primaryModel) {
            setLogs((prev) => [...prev, `── executed by: ${role.primaryModel!.providerId}/${role.primaryModel!.modelId} ──`]);
          }
          onFeatureUpdate?.(feature.id, { progress: Math.min(feature.progress + 20, 100) });
        }
      });
      unlistenRefs.current.push(unStdout, unExit);

      const pid = await spawnAgent({ command, args, workingDir: projectRoot });
      setActivePid(pid);
      activePidRef.current = pid;
      setPhase('running');
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
      setDispatchError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommandLoading(false);
    }
  };

  const handleOpenExternalTarget = async () => {
    const adapter = adapters.find((a) => a.id === selectedAdapterId);
    if (!adapter) return;

    try {
      const { command, args } = await buildCommand(adapter);
      const pid = await spawnAgent({ command, args, workingDir: projectRoot });
      {
        const assignmentPatch = buildAssignmentPatch();
        onFeatureUpdate?.(
          feature.id,
          selectedTaskRole === 'worker'
            ? { ...assignmentPatch, status: 'in_progress' }
            : assignmentPatch,
        );
      }
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
      {
        const assignmentPatch = buildAssignmentPatch();
        onFeatureUpdate?.(
          feature.id,
          selectedTaskRole === 'worker'
            ? { ...assignmentPatch, status: 'in_progress' }
            : assignmentPatch,
        );
      }
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

  const handleRequestKill = (pid: number) => {
    setKillConfirmPid(pid);
  };

  const handleConfirmKill = async () => {
    if (killConfirmPid == null) return;
    await killProcess(killConfirmPid);
    setActivePid(null);
    activePidRef.current = null;
    setKillConfirmPid(null);
  };

  const handleCancelKill = () => {
    setKillConfirmPid(null);
  };

  const isPending = phase === 'pending';
  const isRunning = phase === 'running';
  const isAssignedBlocked =
    selectedTaskRole === 'worker' &&
    phase === 'idle' &&
    !!feature.assignedTo &&
    feature.status === 'in_progress' &&
    !overrideConfirmed;

  // Target file display for IDE adapters
  const ideTargetFile =
    feature.paths.implementation ?? feature.paths.tdd ?? feature.paths.spec ?? '.';

  // Working scope out-of-bounds check for strict mode
  const scopeWarning: string | null = (() => {
    if (!selectedRole?.workingScope || selectedRole.workingScope.mode !== 'strict') return null;
    const { allowedPaths } = selectedRole.workingScope;
    if (allowedPaths.length === 0) return null;
    const implPath = feature.paths.implementation ?? feature.paths.tdd ?? feature.paths.spec ?? '';
    const readmePath = feature.readmePath ?? '';
    const pathsToCheck = [implPath, readmePath].filter(Boolean);
    const inScope = pathsToCheck.length === 0 || pathsToCheck.some((fp) =>
      allowedPaths.some((allowed) => fp.startsWith(allowed))
    );
    return inScope ? null : `Outside working scope: ${allowedPaths.join(', ')}`;
  })();

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
          {phase === 'idle' && adapters.length === 0 && (
            <div className="flex flex-col items-center justify-center border border-stone-200/12 bg-[rgb(var(--pm-input))]/50 px-4 py-8 text-center">
              <p className="text-sm font-medium text-stone-200">{d.noAvailableAdapters}</p>
              <p className="mt-1 text-xs text-stone-500">{d.noAvailableAdaptersHint}</p>
            </div>
          )}

          {adapterWarning && (
            <div className="flex items-start gap-3 border border-amber-400/30 bg-amber-500/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-200">{adapterWarning}</p>
              </div>
            </div>
          )}

          {dispatchError && phase === 'idle' && (
            <div className="border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-xs font-medium text-red-200">{dispatchError}</p>
            </div>
          )}

          {selectedTaskRole === 'worker' && phase === 'idle' && feature.assignedTo && feature.status === 'in_progress' && !overrideConfirmed && (
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

        {phase === 'idle' && adapters.length > 0 && (
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

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-200">
                  {d.taskRoleLabel}
                </label>
                <select
                  value={selectedTaskRole}
                  onChange={(e) => setSelectedTaskRole(e.target.value as HarnessTaskRole)}
                  className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                >
                  <option value="planner">{d.taskRolePlanner}</option>
                  <option value="worker">{d.taskRoleWorker}</option>
                  <option value="evaluator">{d.taskRoleEvaluator}</option>
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
                    <div className="mt-1.5 space-y-1.5">
                      <div className="border border-stone-200/12 bg-[rgb(var(--pm-rail))]/60 px-3 py-2 text-[11px] text-stone-400">
                        <span className="text-stone-300">{d.systemPromptPrefix}</span>
                        {selectedRole.systemPrompt.slice(0, 80)}…
                        {selectedRole.referenceFiles.length > 0 && (
                          <span className="ml-2 text-stone-500">
                            {d.refsPrefix}{selectedRole.referenceFiles.join(', ')}
                          </span>
                        )}
                        {selectedRole.workingScope && selectedRole.workingScope.allowedPaths.length > 0 && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className={[
                              'border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]',
                              selectedRole.workingScope.mode === 'strict'
                                ? 'border-orange-300/35 text-orange-300/80'
                                : 'border-emerald-300/25 text-emerald-300/70',
                            ].join(' ')}>
                              scope·{selectedRole.workingScope.mode}
                            </span>
                            {selectedRole.workingScope.allowedPaths.map((p) => (
                              <span key={p} className="font-mono text-[10px] text-stone-500">{p}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      {scopeWarning && (
                        <div className="flex items-start gap-2 border border-orange-400/35 bg-orange-950/40 px-3 py-2 text-[11px] text-orange-200/90">
                          <span className="mt-0.5 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-orange-400/80">
                            scope
                          </span>
                          <span>{scopeWarning}. Dispatching will inject scope constraints, but this feature may be outside the engineer&apos;s configured area.</span>
                        </div>
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

              {/* Model + execution target preview (read-only, configured on the Engineers page) */}
              <div className="space-y-1.5">
                {selectedRole?.primaryModel ? (
                  <div className="border border-stone-200/12 bg-[rgb(var(--pm-input))]/50 px-3 py-2 text-[11px] text-stone-400">
                    <span className="text-stone-300">Model: </span>
                    {llmProviders.find((p) => p.id === selectedRole.primaryModel!.providerId)?.label ?? selectedRole.primaryModel.providerId}
                    {' / '}
                    <span className="font-mono">{selectedRole.primaryModel.modelId}</span>
                    {selectedRole.modelFallbacks && selectedRole.modelFallbacks.length > 0 && (
                      <span className="ml-2 text-stone-500" title={selectedRole.modelFallbacks.map((f) => `${f.providerId}/${f.modelId}`).join(' → ')}>
                        +{selectedRole.modelFallbacks.length} fallback{selectedRole.modelFallbacks.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                ) : selectedRoleId ? (
                  <p className="text-[11px] text-amber-400/70">
                    No primary model configured on this engineer — set one in the Engineers page.
                  </p>
                ) : null}

                {selectedAdapter && (
                  <div className="border border-stone-200/12 bg-[rgb(var(--pm-input))]/50 px-3 py-2 text-[11px] text-stone-400">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-stone-500">
                      {d.runtimeLabel}
                    </p>
                    <span className="text-stone-300">Target: </span>
                    {selectedAdapter.name}
                    {selectedPreflight && (
                      <span className={[
                        'ml-2',
                        selectedPreflight.status === 'available'
                          ? 'text-emerald-400/80'
                          : selectedPreflight.status === 'missing' || selectedPreflight.status === 'blocked'
                            ? 'text-red-400/80'
                            : 'text-amber-400/80',
                      ].join(' ')}>
                        {selectedPreflight.status === 'available' ? '✓' : '⚠'} {selectedPreflight.label} — {selectedPreflight.description}
                      </span>
                    )}
                    {selectedPreflight?.managementLabel && (
                      <p className="mt-1 text-[10px] text-stone-500">{selectedPreflight.managementLabel}</p>
                    )}
                  </div>
                )}

                {mcpLoading && (
                  <div className="flex items-center gap-2 text-[11px] text-stone-400">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-stone-400 border-t-transparent" />
                    {d.mcpLoading}
                  </div>
                )}
                {mcpError && (
                  <div className="border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200">
                    {mcpError}
                  </div>
                )}
                {!mcpLoading && !mcpError && mcpInjection && (
                  <p className="text-[11px] text-emerald-300/80">
                    {d.mcpInjected
                      .replace('{count}', String(mcpInjection.count))
                      .replace('{flag}', mcpInjection.flag)}
                  </p>
                )}
                {!mcpLoading && !mcpError && !mcpInjection && selectedTargetKind === 'agent-cli' && (
                  <p className="text-[11px] text-stone-500">{d.mcpEmpty}</p>
                )}
                {isAgentApp && (
                  <p className="text-[11px] text-amber-200/80">{d.appTargetHint}</p>
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
                      disabled={specLoading}
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

          {/* Kill confirmation dialog */}
          {killConfirmPid != null && (
            <div className="border border-red-500/40 bg-red-950/30 px-4 py-3">
              <p className="mb-2 text-sm font-semibold text-red-200">
                {d.killConfirmTitle}
              </p>
              <p className="mb-3 text-xs text-stone-400">
                {d.killConfirmBody.replace('{pid}', String(killConfirmPid)).replace('{feature}', feature.name)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmKill}
                  className="border border-red-500/50 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-950/60"
                >
                  {d.killConfirm}
                </button>
                <button
                  onClick={handleCancelKill}
                  className="border border-stone-200/25 px-3 py-1.5 text-xs font-medium text-stone-300 hover:bg-white/5"
                >
                  {d.killCancel}
                </button>
              </div>
            </div>
          )}

          {phase !== 'idle' && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-stone-200">
                  {isPending ? d.commandPreparing : isRunning ? d.liveOutput : d.executionLog}
                </label>
                {activePid != null && (
                  <span className="text-xs text-stone-400">PID {activePid}</span>
                )}
              </div>
              {/* Pending covers command construction, MCP augmentation, and spawn before a PID exists. */}
              {isPending && (
                <div className="mb-2 flex items-center gap-2 text-xs text-stone-400">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-stone-400 border-t-transparent" />
                  {d.commandPreparing}
                </div>
              )}

              {!isPending && (
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
              )}

              {/* Post-run error banner */}
              {phase === 'error' && dispatchError && (
                <div className="mt-2 border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {dispatchError}
                </div>
              )}
              {/* Fallback hint: shown after a failed run if the engineer has a fallback chain */}
              {phase === 'error' && selectedRole?.modelFallbacks && selectedRole.modelFallbacks.length > 0 && (
                <div className="mt-2 border border-amber-400/25 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-200/80">
                  <p>Primary model: <span className="font-mono">{selectedRole.primaryModel?.providerId}/{selectedRole.primaryModel?.modelId}</span></p>
                  <p className="mt-0.5">Available fallbacks: {selectedRole.modelFallbacks.map((f) => `${f.providerId}/${f.modelId}`).join(' · ')}</p>
                  <p className="mt-0.5 text-stone-500">→ Update this engineer&apos;s primary model in the Engineers page to retry with a different one.</p>
                </div>
              )}
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
          {isRunning && activePid != null && killConfirmPid == null && (
            <button
              onClick={() => handleRequestKill(activePid)}
              className="border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/40"
            >
              Kill
            </button>
          )}
          {phase === 'idle' && isAgentCli && (
            <button
              onClick={handleOpenInTerminal}
              disabled={specLoading || isAssignedBlocked || isSelectedTargetBlocked}
              className="border border-stone-200/25 px-4 py-2 text-sm font-medium text-stone-200 hover:bg-white/5 disabled:opacity-50"
            >
              {d.openTerminalBtn}
            </button>
          )}
          {phase === 'idle' && adapters.length > 0 && (
            <button
              onClick={isAgentCli ? handleExecute : handleOpenExternalTarget}
              disabled={specLoading || isAssignedBlocked || isSelectedTargetBlocked}
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
