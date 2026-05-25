'use client';

import { useMemo } from 'react';
import { getAdapterExecutionKind } from '../../lib/adapters/registry';
import { DEFAULT_AGENT_WORKFLOWS } from '../../lib/agent-workflows/definitions';
import { checkCommandExistsTauri, mcpInjectionFlag, supportsMcpInjection } from '../../lib/bridge';
import { listLlmProviders } from '../../lib/keys/llmProviders';
import { collectEnabledMcpServers } from '../../lib/storage/plugins';
import { useI18n, type Translations } from '../../lib/i18n';
import type {
  AnyAdapterConfig,
  EngineerRole,
  Feature,
  FeaturePhase,
  HarnessTaskRole,
  IDEId,
} from '../../lib/types';

// ── Public types ───────────────────────────────────────────────────────────

export interface RoleConfigState {
  selectedRoleId: string;
  selectedAdapterId: string;
  prompt: string;
  selectedWorkflowId: string;
  autoLoop: boolean;
  stopCondition: string;
  maxIterations: number;
}

interface RoleConfigPanelProps {
  role: HarnessTaskRole;
  feature: Feature;
  adapters: AnyAdapterConfig[];
  engineerRoles: EngineerRole[];
  projectRoot: string;
  defaultIDE?: IDEId;
  selectedPhase: FeaturePhase;
  state: RoleConfigState;
  onStateChange: (patch: Partial<RoleConfigState>) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export const IDE_IDS: readonly IDEId[] = ['Cursor', 'VSCode', 'Trae', 'Antigravity', 'Kiro'];

export function adapterToIDE(adapter: AnyAdapterConfig): IDEId | undefined {
  const kind = getAdapterExecutionKind(adapter);
  if (kind !== 'ide') return undefined;
  if (IDE_IDS.includes(adapter.id as IDEId)) return adapter.id as IDEId;
  return undefined;
}

export function resolvePath(projectRoot: string, rel: string | undefined): string | undefined {
  if (!rel) return undefined;
  if (rel.startsWith('/')) return rel;
  return `${projectRoot.replace(/\/$/, '')}/${rel}`;
}

export function initialRoleConfigState(
  role: HarnessTaskRole,
  feature: Feature,
  adapters: AnyAdapterConfig[],
  engineerRoles: EngineerRole[],
  defaultIDE?: IDEId,
): RoleConfigState {
  const assignment = feature.harnessAssignments?.[role];
  const savedAdapterId = assignment?.adapterId;
  const savedRoleId = assignment?.engineerRoleId;

  let selectedAdapterId = '';
  if (savedAdapterId && adapters.some((a) => a.id === savedAdapterId)) {
    selectedAdapterId = savedAdapterId;
  } else if (role === 'worker' && feature.promptConfig?.agentId) {
    selectedAdapterId = feature.promptConfig.agentId;
  } else if (defaultIDE && adapters.some((a) => a.id === defaultIDE)) {
    selectedAdapterId = defaultIDE;
  }

  let selectedRoleId = '';
  if (savedRoleId && engineerRoles.some((r) => r.id === savedRoleId)) {
    selectedRoleId = savedRoleId;
  } else if (role === 'worker' && feature.assignedRoleId) {
    selectedRoleId = feature.assignedRoleId;
  }

  const prompt = feature.promptConfig?.body ?? '';
  const selectedWorkflowId = '';
  const autoLoop = feature.promptConfig?.autoLoop ?? false;
  const stopCondition = feature.promptConfig?.stopCondition ?? '';
  const maxIterations = feature.promptConfig?.maxIterations ?? 3;

  return {
    selectedRoleId,
    selectedAdapterId,
    prompt,
    selectedWorkflowId,
    autoLoop,
    stopCondition,
    maxIterations,
  };
}

// ── Prompt template builder ────────────────────────────────────────────────

type QuickTemplateId =
  | 'from-scratch'
  | 'feature-spec'
  | 'tdd-spec'
  | 'unit-test'
  | 'integration-test'
  | 'e2e-test'
  | 'dev-logs'
  | 'continue-cicd'
  | 'debug'
  | 'code-review';

type DispatchCopy = Translations['dispatch'];

const ROLE_PROMPT_PROFILES: Record<HarnessTaskRole, {
  label: string;
  mission: string;
  boundaries: string[];
  handoff: string[];
}> = {
  planner: {
    label: 'Planner (P)',
    mission: 'Clarify scope, read the source documents, identify risks, and produce an implementation-ready plan before code changes are made.',
    boundaries: [
      'Prefer analysis, task breakdown, file mapping, acceptance criteria, and risk notes.',
      'Do not make code changes unless the prompt explicitly asks for implementation.',
      'Call out missing requirements or unsafe assumptions as blockers.',
    ],
    handoff: [
      'A short plan with ordered steps.',
      'Files likely to change and files that must be read first.',
      'Acceptance criteria and verification commands for the Worker and Evaluator.',
    ],
  },
  worker: {
    label: 'Worker (W)',
    mission: 'Implement the requested change in the smallest coherent scope and keep the repository in a verifiable state.',
    boundaries: [
      'Read the referenced docs and existing code before editing.',
      'Modify only files required for this feature or defect.',
      'Preserve unrelated user changes and avoid broad refactors.',
    ],
    handoff: [
      'Summary of changed files and user-visible behavior.',
      'Verification commands run, with pass/fail results.',
      'Remaining risks, blockers, or follow-up tasks.',
    ],
  },
  evaluator: {
    label: 'Evaluator (E)',
    mission: 'Review implementation quality, validate behavior against acceptance criteria, and report defects with concrete evidence.',
    boundaries: [
      'Prioritize bugs, regressions, missing tests, unclear requirements, and release risk.',
      'Run or specify focused verification; do not rely on visual inspection alone.',
      'Only change code for narrow, clearly necessary fixes.',
    ],
    handoff: [
      'Findings ordered by severity with file and line references where possible.',
      'Verification evidence and any commands that could not be run.',
      'Clear pass/block recommendation for the human owner.',
    ],
  },
};

function cleanLabel(label: string): string {
  return label.replace(/[:：]\s*$/, '');
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

function numberedList(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function buildReferences(
  d: DispatchCopy,
  refs: Array<{ label: string; value: string }>,
): string {
  return refs
    .map((ref) => `- ${cleanLabel(ref.label)}: ${ref.value}`)
    .join('\n');
}

export function buildTemplatePrompt(
  templateId: QuickTemplateId,
  role: HarnessTaskRole,
  feature: Feature,
  projectRoot: string,
  selectedPhase: FeaturePhase,
  d: DispatchCopy,
): string {
  const u = d.promptUnspecified;
  const featureFolder = resolvePath(projectRoot, feature.paths.featureFolder) ?? u;
  const readme = resolvePath(projectRoot, feature.readmePath) ?? u;
  const spec = resolvePath(projectRoot, feature.paths.spec) ?? u;
  const tdd = resolvePath(projectRoot, feature.paths.tdd) ?? u;
  const debugRetro = resolvePath(projectRoot, feature.paths.debugRetro) ?? u;
  const testScenarios = resolvePath(projectRoot, feature.paths.testScenarios) ?? u;
  const unit = resolvePath(projectRoot, feature.paths.unitIntegrationTest) ?? u;
  const e2e = resolvePath(projectRoot, feature.paths.e2eAcceptanceTestScriptFolder) ?? u;
  const devLogs = resolvePath(projectRoot, feature.paths.developmentLogSummaryFolder) ?? u;
  const impl = resolvePath(projectRoot, feature.paths.implementation) ?? u;
  const test = resolvePath(projectRoot, feature.paths.test) ?? u;
  const notes = feature.notes ?? '';
  const roleProfile = ROLE_PROMPT_PROFILES[role];

  const commonReferences = buildReferences(d, [
    { label: 'Feature Folder', value: featureFolder },
    { label: 'README', value: readme },
    { label: d.promptFeatureSpecPath, value: spec },
    { label: d.promptTddSpecPath, value: tdd },
    { label: 'Debug Retro', value: debugRetro },
    { label: 'Test Scenarios', value: testScenarios },
    { label: d.promptImplPath, value: impl },
    { label: d.promptTestPath, value: test },
    { label: d.promptDevLogsPath, value: devLogs },
  ]);

  const referenceStep = (label: string, value: string, fallback: string): string => {
    const sentenceLabel = `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
    if (value === u) {
      return `${sentenceLabel} is not configured. ${fallback} Mention the missing ${label} in the handoff.`;
    }
    return `Read the ${label} first: ${value}`;
  };

  const templateGuidance: Record<QuickTemplateId, {
    objective: string;
    steps: string[];
    success: string[];
  }> = {
    'from-scratch': {
      objective: 'Start from the available feature context and turn it into a clear, executable path.',
      steps: [
        'Read the feature folder, notes, specification, and nearby implementation before deciding scope.',
        'Identify the smallest useful slice that can be completed and verified now.',
        'If requirements are missing, state the gap and choose a conservative assumption before proceeding.',
      ],
      success: [
        'The next human or AI Engineer can see the exact scope, decisions, and verification path.',
        'No unrelated files or project metadata are changed accidentally.',
      ],
    },
    'feature-spec': {
      objective: 'Use the feature specification as the primary source of truth when it is configured; otherwise make the missing artifact visible and work from the best available context.',
      steps: [
        referenceStep('feature spec', spec, 'Use the README, notes, config row, implementation path, and nearby tests as fallback context.'),
        'Compare the requested behavior against the current implementation and existing tests.',
        'Implement or plan only the behavior that is supported by the spec; flag contradictions instead of guessing.',
      ],
      success: [
        'Implemented behavior or plan maps directly back to the configured feature spec or documented fallback context.',
        'Any deviations from the spec are explicitly documented with the reason.',
      ],
    },
    'tdd-spec': {
      objective: 'Drive the task from the TDD specification and acceptance criteria when they are configured.',
      steps: [
        referenceStep('TDD spec', tdd, 'Use existing tests, README, notes, and the feature row to infer the acceptance criteria conservatively.'),
        referenceStep('test scenarios', testScenarios, 'If no scenario map exists, derive scenarios from recent debug retros, dev logs, screenshots, and user-reported reproduction steps.'),
        'Translate each relevant test case into implementation or verification work.',
        'Update or add focused tests before calling the task done.',
      ],
      success: [
        'The TDD spec or documented fallback acceptance criteria have matching implementation and test evidence.',
        'Failures are reported with the failing test name, command, and likely cause.',
      ],
    },
    'unit-test': {
      objective: 'Create or repair focused unit tests for the implementation area.',
      steps: [
        referenceStep('implementation path', impl, 'Find the likely implementation via the feature row, located section, or repository search before editing.'),
        referenceStep('unit test path', unit, 'Search for nearby unit tests and name the chosen test file before changing it.'),
        'Cover important branches, edge cases, and regression risks without over-mocking behavior.',
      ],
      success: [
        'Unit tests describe the expected behavior clearly.',
        'The focused test command and typecheck result are included in the handoff.',
      ],
    },
    'integration-test': {
      objective: 'Validate how the touched modules work together across their real boundaries.',
      steps: [
        referenceStep('implementation path', impl, 'Find the likely implementation via the feature row, located section, or repository search before editing.'),
        referenceStep('integration test path', unit, 'Search for the closest integration test surface and explain why it is the right boundary.'),
        'Exercise the real data shape, adapter boundary, or UI workflow involved in this feature.',
      ],
      success: [
        'Integration coverage proves the contract between modules, not only isolated helpers.',
        'Any mocked boundary is named and justified.',
      ],
    },
    'e2e-test': {
      objective: 'Validate the user-facing workflow from entry point to expected result.',
      steps: [
        referenceStep('test scenarios', testScenarios, 'Use README, debug retro, feature spec, and dev logs to reconstruct the most important user path.'),
        referenceStep('E2E test folder or script', e2e, 'Identify the route and user workflow manually from the feature row, README, notes, or implementation path.'),
        'Identify the route, user actions, expected state changes, and failure visibility.',
        'Add or update the smallest E2E coverage that proves the workflow still works.',
      ],
      success: [
        'The E2E scenario is clear enough for a human to reproduce.',
        'The verification result names the browser route and command used.',
      ],
    },
    'dev-logs': {
      objective: 'Continue from the latest development history without losing prior decisions.',
      steps: [
        referenceStep('development log', devLogs, 'Use README, notes, recent git diff, and existing tests to reconstruct current state.'),
        'Extract the last completed work, known blockers, and intended next step.',
        'Continue from that state instead of restarting the task from a blank slate.',
      ],
      success: [
        'The handoff explains what was reused from prior work.',
        'New work appends a concise update to the relevant development log when appropriate.',
      ],
    },
    'continue-cicd': {
      objective: 'Continue CI/CD, verification, release, or deployment automation work.',
      steps: [
        referenceStep('implementation or pipeline-related path', impl, 'Search package scripts, workflow files, docs, and test configuration for the relevant pipeline surface.'),
        referenceStep('test or verification entry point', test, 'Use package scripts and existing verification docs to find the correct command.'),
        'Preserve existing gates and make failures visible rather than bypassing checks.',
        'Document commands, environment assumptions, and any blocked external dependency.',
      ],
      success: [
        'The pipeline or verification path is repeatable by the next engineer.',
        'Any remaining CI/CD blocker includes exact command output or reproduction steps.',
      ],
    },
    debug: {
      objective: 'Diagnose and fix a failing test, runtime issue, or unexpected behavior.',
      steps: [
        'Reproduce the failure first and capture the exact command, route, or user action.',
        referenceStep('debug retro', debugRetro, 'Create or update debug-retro.md after reproducing the issue and proving the fix.'),
        referenceStep('likely implementation path', impl, 'Locate the relevant code through error output, route names, feature row metadata, or repository search.'),
        referenceStep('relevant test path', test, 'Search for the closest regression test and state if no focused test exists yet.'),
        'Make the smallest fix that addresses the root cause, then rerun the focused verification.',
        'Update the test scenario map when the debug path reveals a real user workflow or boundary case.',
      ],
      success: [
        'The root cause is named in plain language.',
        'The fix includes regression coverage, debug-retro updates, scenario-map updates, or a clear reason why coverage was not added.',
      ],
    },
    'code-review': {
      objective: 'Review the implementation for correctness, maintainability, and release risk.',
      steps: [
        referenceStep('implementation path', impl, 'Find the implementation through the feature row, route, category, notes, or repository search before reviewing.'),
        'Compare the implementation against the feature spec, TDD spec, and current project conventions.',
        'Prioritize concrete defects over style preferences; include file and line references where possible.',
      ],
      success: [
        'Findings are ordered by severity and are actionable.',
        'If no issues are found, the handoff still lists test gaps or residual risk.',
      ],
    },
  };

  const guidance = templateGuidance[templateId];

  return [
    `# Task Dispatch: ${feature.id} - ${feature.name}`,
    '',
    '## Assignment',
    `- Role: ${roleProfile.label}`,
    `- Mission: ${roleProfile.mission}`,
    `- Project root: ${projectRoot}`,
    `- Selected phase: ${selectedPhase}`,
    `- ${d.promptStatus} ${feature.status}`,
    notes ? `- ${d.promptNotes} ${notes}` : null,
    '',
    '## Source References',
    commonReferences,
    '',
    '## Objective',
    guidance.objective,
    '',
    '## Role Boundaries',
    bulletList(roleProfile.boundaries),
    '',
    '## Required Steps',
    numberedList(guidance.steps),
    '',
    '## Definition of Done',
    bulletList(guidance.success),
    '',
    '## Handoff Requirements',
    bulletList(roleProfile.handoff),
  ].filter((part): part is string => part !== null).join('\n');
}

// ── Component ──────────────────────────────────────────────────────────────

export function RoleConfigPanel({
  role,
  feature,
  adapters,
  engineerRoles,
  projectRoot,
  selectedPhase,
  state,
  onStateChange,
}: RoleConfigPanelProps) {
  const { t } = useI18n();
  const d = t.dispatch;
  const llmProviders = useMemo(() => listLlmProviders(), []);

  const selectedRole = engineerRoles.find((r) => r.id === state.selectedRoleId);
  const selectedAdapter = adapters.find((a) => a.id === state.selectedAdapterId);
  const targetKind = getAdapterExecutionKind(selectedAdapter);

  // Group adapters by target kind.
  const ideAdapters = adapters.filter((a) => getAdapterExecutionKind(a) === 'ide');
  const cliAdapters = adapters.filter((a) => getAdapterExecutionKind(a) === 'agent-cli');
  const appAdapters = adapters.filter((a) => getAdapterExecutionKind(a) === 'agent-app');

  // MCP injection info for agent-cli targets.
  const mcpServers = useMemo(() => collectEnabledMcpServers(projectRoot), [projectRoot]);
  const mcpCount = Object.keys(mcpServers).length;
  const mcpFlag = selectedAdapter ? mcpInjectionFlag(selectedAdapter.command ?? '') : null;
  const showMcp = targetKind === 'agent-cli' && mcpCount > 0 && mcpFlag;

  // Template buttons.
  const templates: Array<{ id: QuickTemplateId; label: string }> = [
    { id: 'from-scratch', label: d.templateFromScratch },
    { id: 'feature-spec', label: d.templateFeatureSpec },
    { id: 'tdd-spec', label: d.templateTddSpec },
    { id: 'unit-test', label: d.templateUnitTest },
    { id: 'integration-test', label: d.templateIntegrationTest },
    { id: 'e2e-test', label: d.templateE2eTest },
    { id: 'dev-logs', label: d.templateDevLogs },
    { id: 'continue-cicd', label: d.templateContinueCicd },
    { id: 'debug', label: d.templateDebug },
    { id: 'code-review', label: d.templateCodeReview },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Engineer role */}
      <div>
        <label className="mb-1 block text-sm font-medium text-stone-200">{d.engineerLabel}</label>
        <select
          value={state.selectedRoleId}
          onChange={(e) => onStateChange({ selectedRoleId: e.target.value })}
          className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
        >
          <option value="">{d.noRole}</option>
          {engineerRoles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        {selectedRole?.systemPrompt && (
          <p className="mt-1 truncate text-[11px] text-stone-400" title={selectedRole.systemPrompt}>
            {d.systemPromptPrefix}{selectedRole.systemPrompt}
          </p>
        )}
      </div>

      {/* Model preview */}
      {selectedRole?.primaryModel && (
        <div className="flex items-center gap-3 rounded border border-stone-200/12 bg-white/[0.02] px-3 py-2 text-xs">
          <span className="text-stone-400">{d.modelPromptTitle}:</span>
          <span className="text-stone-200">
            {llmProviders.find((p) => p.id === selectedRole.primaryModel!.providerId)?.label ?? selectedRole.primaryModel.providerId}
            {' / '}
            {selectedRole.primaryModel.modelId}
          </span>
        </div>
      )}

      {/* Execution target (adapter) */}
      <div>
        <label className="mb-1 block text-sm font-medium text-stone-200">{d.runtimeLabel}</label>
        <select
          value={state.selectedAdapterId}
          onChange={(e) => onStateChange({ selectedAdapterId: e.target.value })}
          className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
        >
          <option value="">{d.dispatchNoAdapter}</option>
          {ideAdapters.length > 0 && (
            <optgroup label={d.targetGroupIde}>
              {ideAdapters.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </optgroup>
          )}
          {cliAdapters.length > 0 && (
            <optgroup label={d.targetGroupCli}>
              {cliAdapters.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </optgroup>
          )}
          {appAdapters.length > 0 && (
            <optgroup label={d.targetGroupApp}>
              {appAdapters.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </optgroup>
          )}
        </select>

        {/* Target hints */}
        {selectedAdapter && targetKind === 'agent-cli' && (
          <p className="mt-1 text-[11px] text-emerald-300/80">{d.targetManagedByPm}</p>
        )}
        {selectedAdapter && targetKind === 'ide' && (
          <p className="mt-1 text-[11px] text-stone-400">{d.targetManagedExternalIde}</p>
        )}
        {selectedAdapter && targetKind === 'agent-app' && (
          <p className="mt-1 text-[11px] text-stone-400">{d.targetManagedExternalApp}</p>
        )}
      </div>

      {/* MCP injection preview */}
      {showMcp && (
        <div className="rounded border border-emerald-300/15 bg-emerald-950/20 px-3 py-2 text-[11px] text-emerald-200/80">
          {d.mcpInjected.replace('{count}', String(mcpCount)).replace('{flag}', mcpFlag)}
        </div>
      )}

      {/* Workflow */}
      <div>
        <label className="mb-1 block text-sm font-medium text-stone-200">{d.workflowLabel}</label>
        <select
          value={state.selectedWorkflowId}
          onChange={(e) => onStateChange({ selectedWorkflowId: e.target.value })}
          className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
        >
          <option value="">{d.noWorkflow}</option>
          {DEFAULT_AGENT_WORKFLOWS.map((w) => (
            <option key={w.id} value={w.id}>{w.name} — {w.summary}</option>
          ))}
        </select>
      </div>

      {/* Quick template buttons */}
      <div>
        <label className="mb-1 block text-sm font-medium text-stone-200">{d.templatesLabel}</label>
        <div className="flex flex-wrap gap-1">
          {templates.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => onStateChange({ prompt: buildTemplatePrompt(tmpl.id, role, feature, projectRoot, selectedPhase, d) })}
              className="rounded border border-stone-200/15 bg-white/[0.03] px-2 py-1 text-[11px] text-stone-300 hover:bg-white/[0.08] hover:text-stone-100"
            >
              {tmpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt textarea */}
      <div>
        <label className="mb-1 block text-sm font-medium text-stone-200">{d.promptLabel}</label>
        <textarea
          value={state.prompt}
          onChange={(e) => onStateChange({ prompt: e.target.value })}
          rows={6}
          className="w-full resize-y border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 font-mono text-xs text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
          placeholder={`${role.charAt(0).toUpperCase() + role.slice(1)} prompt...`}
        />
      </div>

      {/* Scope warning */}
      {selectedRole?.workingScope && selectedRole.workingScope.allowedPaths.length > 0 && (
        <div className="rounded border border-amber-400/20 bg-amber-950/20 px-3 py-2">
          <p className="text-[11px] font-medium text-amber-200">Working Scope Restriction</p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-amber-100/70">
            {selectedRole.workingScope.allowedPaths.map((p) => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Advanced: auto-retry loop */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-stone-300 hover:text-stone-100">
          {d.advancedTitle}
        </summary>
        <div className="mt-3 flex flex-col gap-3 pl-1">
          <label className="flex items-center gap-2 text-xs text-stone-200">
            <input
              type="checkbox"
              checked={state.autoLoop}
              onChange={(e) => onStateChange({ autoLoop: e.target.checked })}
              className="h-4 w-4 rounded border-stone-300 bg-stone-800 text-emerald-400 focus:ring-emerald-400/30"
            />
            {d.autoRetryLabel}
          </label>
          {state.autoLoop && (
            <>
              <div>
                <label className="mb-1 block text-[11px] text-stone-400">{d.stopConditionLabel}</label>
                <input
                  type="text"
                  value={state.stopCondition}
                  onChange={(e) => onStateChange({ stopCondition: e.target.value })}
                  className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-1.5 text-xs text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-stone-400">{d.maxIterationsLabel}</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={state.maxIterations}
                  onChange={(e) => onStateChange({ maxIterations: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
                  className="w-24 border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-1.5 text-xs text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                />
              </div>
            </>
          )}
        </div>
      </details>
    </div>
  );
}
