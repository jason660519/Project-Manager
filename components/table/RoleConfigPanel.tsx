'use client';

import { useMemo } from 'react';
import { getAdapterExecutionKind } from '../../lib/adapters/registry';
import { DEFAULT_AGENT_WORKFLOWS } from '../../lib/agent-workflows/definitions';
import { checkCommandExistsTauri, mcpInjectionFlag, supportsMcpInjection } from '../../lib/bridge';
import { listLlmProviders } from '../../lib/keys/llmProviders';
import { collectEnabledMcpServers } from '../../lib/storage/plugins';
import { useI18n } from '../../lib/i18n';
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

function buildTemplatePrompt(
  templateId: string,
  feature: Feature,
  projectRoot: string,
  d: ReturnType<typeof useI18n>['t']['dispatch'],
): string {
  const u = d.promptUnspecified;
  const spec = resolvePath(projectRoot, feature.paths.spec) ?? u;
  const tdd = resolvePath(projectRoot, feature.paths.tdd) ?? u;
  const unit = resolvePath(projectRoot, feature.paths.unitIntegrationTest) ?? u;
  const e2e = resolvePath(projectRoot, feature.paths.e2eAcceptanceTestScriptFolder) ?? u;
  const devLogs = resolvePath(projectRoot, feature.paths.developmentLogSummaryFolder) ?? u;
  const impl = resolvePath(projectRoot, feature.paths.implementation) ?? u;
  const test = resolvePath(projectRoot, feature.paths.test) ?? u;
  const notes = feature.notes ?? '';

  const header = `[${feature.id}] ${feature.name}\n${d.promptStatus} ${feature.status}\n`;

  switch (templateId) {
    case 'from-scratch':
      return `${header}${notes ? `${d.promptNotes} ${notes}\n` : ''}`;
    case 'feature-spec':
      return `${header}${d.promptSpecHeader}\n${d.promptFeatureSpecPath} ${spec}\n\nPlease read the feature spec and implement accordingly.`;
    case 'tdd-spec':
      return `${header}${d.promptTddSpecPath} ${tdd}\n\nFollow the TDD spec to implement and verify.`;
    case 'unit-test':
      return `${header}${d.promptUnitTestPath} ${unit}\n${d.promptImplPath} ${impl}\n\nWrite or update unit tests.`;
    case 'integration-test':
      return `${header}${d.promptIntegrationTestPath} ${unit}\n${d.promptImplPath} ${impl}\n\nWrite or update integration tests.`;
    case 'e2e-test':
      return `${header}${d.promptE2eTestPath} ${e2e}\n\nWrite or update E2E acceptance tests.`;
    case 'dev-logs':
      return `${header}${d.promptDevLogsPath} ${devLogs}\n\nReview dev logs and continue from last session.`;
    case 'continue-cicd':
      return `${header}${d.promptImplPath} ${impl}\n${d.promptTestPath} ${test}\n\nContinue CI/CD pipeline work.`;
    case 'debug':
      return `${header}${d.promptImplPath} ${impl}\n${d.promptTestPath} ${test}\n\nDebug failing tests or runtime issues.`;
    case 'code-review':
      return `${header}${d.promptImplPath} ${impl}\n\nReview the implementation for correctness, performance, and security.`;
    default:
      return '';
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export function RoleConfigPanel({
  role,
  feature,
  adapters,
  engineerRoles,
  projectRoot,
  selectedPhase: _selectedPhase,
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
  const templates = [
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
              onClick={() => onStateChange({ prompt: buildTemplatePrompt(tmpl.id, feature, projectRoot, d) })}
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
