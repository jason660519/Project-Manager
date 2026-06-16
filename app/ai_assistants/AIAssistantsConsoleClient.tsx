'use client';

import {
  Activity,
  BadgeCheck,
  Bot,
  Brain,
  CheckCircle2,
  Database,
  FileClock,
  FileText,
  GitBranch,
  History,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  TriangleAlert,
  Users2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheetTabs, type SheetTabItem } from '../../components/sheets/BottomSheetTabs';
import { WorkstationFrame } from '../../components/layout/WorkstationFrame';
import type { ChatContext } from '../../lib/chat/types';
import {
  appendAuditEvent,
  loadAIAssistantsConsoleState,
  saveAIAssistantsConsoleState,
  updateAssistant,
  updateAssistantInstance,
  updatePermission,
  updateProfileSource,
  updateSkill,
  updateTerminalBoundaries,
  updateTerminalBlockSuggestions,
} from '../../lib/ai-assistants/repository';
import { mergeBoundaryRules } from '../../lib/ai-assistants/terminalBoundaries';
import { saveTerminalBoundariesSidecar } from '../../lib/ai-assistants/terminalBoundariesSidecar';
import {
  loadTerminalBlockSuggestions,
  saveTerminalBlockSuggestions,
  updateTerminalBlockSuggestionStatus,
} from '../../lib/ai-assistants/terminalBlockSuggestions';
import type { TerminalBlockSuggestion } from '../../lib/ai-assistants/types';
import { validateAssistantInstance } from '../../lib/ai-assistants/validation';
import { createDefaultConsoleState } from '../../lib/ai-assistants/defaults';
import type {
  AIAssistantConfig,
  AIAssistantSheetId,
  AIAssistantsConsoleState,
  AssistantConnectionStatus,
  AssistantDailyLog,
  AssistantDreamJob,
  AssistantInstanceConfig,
  AssistantPermissionRule,
  AssistantProfileSource,
  AssistantSkillConfig,
  DailyLogCategory,
  DailyLogSeverity,
  PermissionState,
  TerminalCommandRule,
  TerminalOperationalBoundaries,
} from '../../lib/ai-assistants/types';
import {
  listAgentWorkflowRuns,
  type AgentWorkflowNodeRun,
  type AgentWorkflowRun,
} from '../../lib/agent-workflows';
import {
  autoRequestEligibleProjectWorkflowDrafts,
  buildProjectWorkflowGraphView,
  createProjectWorkflowRun,
  DEFAULT_PROJECT_WORKFLOW_EXECUTOR_REGISTRY,
  getProjectWorkflowTemplateById,
  listProjectWorkflowRuns,
  requestProjectWorkflowDraftRun,
  saveProjectWorkflowExecutionRequests,
  saveProjectWorkflowRun,
  setProjectWorkflowExecutionMode,
  startProjectWorkflowNode,
  type ProjectWorkflowGraphView,
  type ProjectWorkflowRun,
} from '../../lib/project-workflows';
import { getProjectManagerRoot } from '../../lib/bridge';
import {
  loadWorkflowExecutionRecordRows,
  loadWorkflowExecutionRequestRows,
} from '../../lib/integrations/load-project-inventory';
import { buildExecutorRegistryFromCommandMappings } from '../../lib/integrations/mappers/channels';
import type { IntegrationRow } from '../../lib/integrations/types';
import { loadChannelCatalog } from '../../lib/storage/channels';
import { ChatPageClient } from '../chat/ChatPageClient';

interface AIAssistantsConsoleClientProps {
  initialChatContext?: ChatContext;
  activeSheet?: AIAssistantSheetId | 'instances';
  engineersPanel?: React.ReactNode;
  projectRoot?: string;
  initialWorkflowRuns?: AgentWorkflowRun[];
  initialProjectWorkflowRuns?: ProjectWorkflowRun[];
}

const SHEET_TABS: ReadonlyArray<SheetTabItem<AIAssistantSheetId>> = [
  { key: 'chat', label: 'Chat', icon: <Bot size={14} /> },
  { key: 'engineers', label: 'Engineers', icon: <Users2 size={14} /> },
  { key: 'overview', label: 'Overview', icon: <Activity size={14} /> },
  { key: 'profile', label: 'Profile', icon: <FileText size={14} /> },
  { key: 'skills', label: 'Skills', icon: <SlidersHorizontal size={14} /> },
  { key: 'workflow-runs', label: 'Workflow Runs', icon: <GitBranch size={14} /> },
  { key: 'daily-logs', label: 'Daily Logs', icon: <FileClock size={14} /> },
  { key: 'dreaming', label: 'Dreaming', icon: <Brain size={14} /> },
  { key: 'permissions', label: 'Permissions', icon: <ShieldCheck size={14} /> },
  { key: 'audit', label: 'Audit', icon: <History size={14} /> },
];

const AI_ASSISTANTS_SHEET_ORDER_STORAGE_KEY = 'projectManager.aiAssistants.sheetOrder';

const LOG_CATEGORIES: Array<DailyLogCategory | 'all'> = [
  'all',
  'chat',
  'tool_call',
  'gateway',
  'websocket',
  'heartbeat',
  'skill',
  'dream_job',
  'security',
  'error',
];

const LOG_SEVERITIES: Array<DailyLogSeverity | 'all'> = ['all', 'info', 'warning', 'error'];

function sheetHref(sheet: AIAssistantSheetId): string {
  return sheet === 'chat' ? '/ai_assistants' : `/ai_assistants/${sheet}`;
}

function riskClass(risk: string): string {
  if (risk === 'high') return 'border-red-400/30 bg-red-950/25 text-red-100';
  if (risk === 'medium') return 'border-amber-300/25 bg-amber-950/20 text-amber-100';
  return 'border-emerald-300/20 bg-emerald-950/20 text-emerald-100';
}

function statusClass(status: string): string {
  if (['connected', 'ready', 'granted', 'completed', 'succeeded', 'produced'].includes(status)) {
    return 'border-emerald-300/25 bg-emerald-950/25 text-emerald-100';
  }
  if (['degraded', 'guarded', 'warning', 'paused', 'queued', 'untested'].includes(status)) {
    return 'border-amber-300/25 bg-amber-950/20 text-amber-100';
  }
  if (['offline', 'missing', 'blocked', 'failed', 'error'].includes(status)) {
    return 'border-red-400/30 bg-red-950/25 text-red-100';
  }
  return 'border-stone-200/15 bg-stone-900/70 text-stone-200';
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className={clsx('inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold', statusClass(tone))}>
      {children}
    </span>
  );
}

function Metric({ label, value, detail }: { label: string; value: React.ReactNode; detail: string }) {
  return (
    <div className="border-b border-stone-200/10 px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <div className="mt-1 text-lg font-semibold text-stone-100">{value}</div>
      <p className="mt-1 text-[11px] leading-relaxed text-stone-400">{detail}</p>
    </div>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">{label}</span>
      <div className="mt-1">{children}</div>
      {helper && <span className="mt-1 block text-[10px] leading-relaxed text-stone-500">{helper}</span>}
    </label>
  );
}

const inputClass =
  'w-full rounded border border-stone-200/15 bg-stone-950/70 px-3 py-2 text-[12px] text-stone-100 outline-none placeholder:text-stone-600 focus:border-amber-200/40';

const selectClass =
  'w-full rounded border border-stone-200/15 bg-stone-950/70 px-3 py-2 text-[12px] text-stone-100 outline-none focus:border-amber-200/40';

const EMPTY_WORKFLOW_RUNS: AgentWorkflowRun[] = [];
const EMPTY_PROJECT_WORKFLOW_RUNS: ProjectWorkflowRun[] = [];
const PERSISTED_SAMPLE_PROJECT_MANAGER_ROOT = '/Users/Project-Manager';

interface WorkflowRunDeepLink {
  workItemId?: string;
  workflowRunId?: string;
  nodeId?: string;
}

function trimRoot(projectRoot?: string): string {
  return projectRoot?.trim().replace(/\/+$/, '') ?? '';
}

function queryParam(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)?.trim();
  return value ? value : undefined;
}

function readWorkflowRunDeepLink(): WorkflowRunDeepLink {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    workItemId: queryParam(params, 'workItemId') ?? queryParam(params, 'featureId'),
    workflowRunId: queryParam(params, 'workflowRunId') ?? queryParam(params, 'runId'),
    nodeId: queryParam(params, 'nodeId'),
  };
}

function selectProjectWorkflowRunFromDeepLink(
  runs: ProjectWorkflowRun[],
  deepLink: WorkflowRunDeepLink,
): ProjectWorkflowRun | undefined {
  if (deepLink.workflowRunId) {
    const byRunId = runs.find((run) => run.id === deepLink.workflowRunId);
    if (byRunId) return byRunId;
  }
  if (deepLink.workItemId) {
    return runs.find((run) => run.workItemId.toLowerCase() === deepLink.workItemId?.toLowerCase());
  }
  return undefined;
}

function needsProjectManagerRootResolution(projectRoot?: string): boolean {
  const root = trimRoot(projectRoot);
  return root === '.' ||
    root === PERSISTED_SAMPLE_PROJECT_MANAGER_ROOT ||
    root.startsWith(`${PERSISTED_SAMPLE_PROJECT_MANAGER_ROOT}/`);
}

function rewriteProjectManagerSampleRoot(projectRoot: string, detectedRoot: string): string {
  const root = trimRoot(projectRoot);
  const detected = trimRoot(detectedRoot);
  if (!detected) return root;
  if (root === '.') return detected;
  if (root === PERSISTED_SAMPLE_PROJECT_MANAGER_ROOT) return detected;
  if (root.startsWith(`${PERSISTED_SAMPLE_PROJECT_MANAGER_ROOT}/`)) {
    return `${detected}${root.slice(PERSISTED_SAMPLE_PROJECT_MANAGER_ROOT.length)}`;
  }
  return root;
}

function TerminalCommandList({
  title,
  tone,
  rules,
  emptyLabel,
}: {
  title: string;
  tone: 'whitelist' | 'blacklist';
  rules: TerminalCommandRule[];
  emptyLabel: string;
}) {
  const headerClass =
    tone === 'whitelist'
      ? 'border-emerald-300/20 bg-emerald-950/20 text-emerald-100'
      : 'border-red-400/25 bg-red-950/20 text-red-100';

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded border border-stone-200/10 bg-stone-950/40">
      <div className={clsx('border-b px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em]', headerClass)}>
        {title}
      </div>
      <div className="min-h-0 flex-1 divide-y divide-stone-200/10 overflow-y-auto">
        {rules.length === 0 ? (
          <p className="px-3 py-4 text-[11px] text-stone-500">{emptyLabel}</p>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[11px] text-stone-200">{rule.pattern}</span>
                <span className="shrink-0 rounded border border-stone-200/15 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-stone-500">
                  {rule.category}
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-stone-500">{rule.description}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TerminalOperationalBoundariesPanel({
  boundaries,
  onSave,
  projectRoot,
  assistantId,
}: {
  boundaries: TerminalOperationalBoundaries;
  onSave: (boundaries: TerminalOperationalBoundaries) => void;
  projectRoot?: string;
  assistantId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [policyMode, setPolicyMode] = useState(boundaries.policyMode);
  const [whitelistDraft, setWhitelistDraft] = useState(
    boundaries.whitelist.map((rule) => rule.pattern).join('\n'),
  );
  const [blacklistDraft, setBlacklistDraft] = useState(
    boundaries.blacklist.map((rule) => rule.pattern).join('\n'),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPolicyMode(boundaries.policyMode);
    setWhitelistDraft(boundaries.whitelist.map((rule) => rule.pattern).join('\n'));
    setBlacklistDraft(boundaries.blacklist.map((rule) => rule.pattern).join('\n'));
  }, [boundaries]);

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    const whitelistPatterns = whitelistDraft.split('\n').map((line) => line.trim()).filter(Boolean);
    const blacklistPatterns = blacklistDraft.split('\n').map((line) => line.trim()).filter(Boolean);
    const next: TerminalOperationalBoundaries = {
      policyMode,
      whitelist: mergeBoundaryRules(boundaries.whitelist, whitelistPatterns, 'whitelist'),
      blacklist: mergeBoundaryRules(boundaries.blacklist, blacklistPatterns, 'blacklist'),
      updatedAt: new Date().toISOString(),
    };
    try {
      if (projectRoot) {
        await saveTerminalBoundariesSidecar(projectRoot, assistantId, next);
      }
      onSave(next);
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save terminal boundaries');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded border border-stone-200/15 bg-white/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200/10 px-4 py-3">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-200">
            Terminal Operational Boundaries
          </h2>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-stone-500">
            Whitelist and blacklist rules that constrain AI assistant shell input in the user&apos;s system terminal.
            Blacklist matches always win; unknown commands are blocked under default-deny policy.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="guarded">{boundaries.policyMode}</Badge>
          <span className="flex items-center gap-1 rounded border border-stone-200/15 px-2 py-1 text-[10px] text-stone-400">
            <Terminal size={11} />
            {boundaries.whitelist.length} allowed / {boundaries.blacklist.length} blocked
          </span>
          <button
            type="button"
            onClick={() => setEditing((prev) => !prev)}
            className="rounded border border-stone-200/15 px-2 py-1 text-[10px] font-semibold text-stone-200 hover:border-amber-200/30"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3 p-4">
          <Field label="Policy Mode" helper="default-deny blocks commands not on the whitelist.">
            <select
              className={selectClass}
              value={policyMode}
              onChange={(event) => setPolicyMode(event.target.value as TerminalOperationalBoundaries['policyMode'])}
            >
              <option value="default-deny">default-deny</option>
              <option value="default-allow">default-allow</option>
            </select>
          </Field>
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="Whitelist Patterns" helper="One command pattern per line.">
              <textarea
                className={`${inputClass} min-h-[180px] font-mono text-[11px]`}
                value={whitelistDraft}
                onChange={(event) => setWhitelistDraft(event.target.value)}
                spellCheck={false}
              />
            </Field>
            <Field label="Blacklist Patterns" helper="One command pattern per line. Blacklist always wins.">
              <textarea
                className={`${inputClass} min-h-[180px] font-mono text-[11px]`}
                value={blacklistDraft}
                onChange={(event) => setBlacklistDraft(event.target.value)}
                spellCheck={false}
              />
            </Field>
          </div>
          {saveError && (
            <p className="rounded border border-red-400/20 bg-red-950/20 px-3 py-2 text-[11px] text-red-100">{saveError}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded border border-emerald-200/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save Boundaries'}
            </button>
            {!projectRoot && !saveError && (
              <span className="self-center text-[10px] text-amber-200/80">
                Boundaries saved to console state only — select a project to persist sidecar JSON.
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 p-4 lg:grid-cols-2">
          <TerminalCommandList
            title="Whitelist"
            tone="whitelist"
            rules={boundaries.whitelist}
            emptyLabel="No whitelisted terminal commands configured."
          />
          <TerminalCommandList
            title="Blacklist"
            tone="blacklist"
            rules={boundaries.blacklist}
            emptyLabel="No blacklisted terminal commands configured."
          />
        </div>
      )}

      <div className="border-t border-stone-200/10 px-4 py-2.5 text-[10px] text-stone-500">
        Evaluation order: normalize input → match blacklist → match whitelist → apply policy mode.
        Last updated: {boundaries.updatedAt}
        {projectRoot ? ` · Sidecar: ${projectRoot}/.project-manager/assistants/${assistantId}/terminal-boundaries.json` : ''}
      </div>
    </section>
  );
}

function TerminalBlockSuggestionsPanel({
  suggestions,
  projectRoot,
  assistantId,
  onUpdateSuggestions,
  onAddToBlacklist,
  onAddToWhitelist,
}: {
  suggestions: TerminalBlockSuggestion[];
  projectRoot?: string;
  assistantId: string;
  onUpdateSuggestions: (suggestions: TerminalBlockSuggestion[]) => void;
  onAddToBlacklist: (suggestion: TerminalBlockSuggestion) => void;
  onAddToWhitelist: (suggestion: TerminalBlockSuggestion) => void;
}) {
  const pending = suggestions.filter((item) => item.status === 'pending');
  if (pending.length === 0) return null;

  return (
    <section className="rounded border border-amber-300/20 bg-amber-950/10">
      <div className="border-b border-amber-300/15 px-4 py-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-amber-100">
          Blocked Command Review Queue
        </h2>
        <p className="mt-1 text-[11px] text-stone-400">
          Recent terminal blocks awaiting operator review. Accept adds the pattern to a boundary list.
        </p>
      </div>
      <div className="divide-y divide-stone-200/10">
        {pending.slice(0, 8).map((suggestion) => (
          <div key={suggestion.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-mono text-[11px] text-stone-200">{suggestion.normalizedCommand}</p>
              <p className="mt-1 text-[10px] text-stone-500">
                {suggestion.reason}
                {suggestion.matchedRuleId ? ` · rule ${suggestion.matchedRuleId}` : ''}
                {' · '}
                {suggestion.createdAt}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onAddToBlacklist(suggestion)}
                className="rounded border border-red-400/25 bg-red-950/20 px-2 py-1 text-[10px] font-semibold text-red-100"
              >
                Add to Blacklist
              </button>
              <button
                type="button"
                onClick={() => onAddToWhitelist(suggestion)}
                className="rounded border border-emerald-300/25 bg-emerald-950/20 px-2 py-1 text-[10px] font-semibold text-emerald-100"
              >
                Add to Whitelist
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = updateTerminalBlockSuggestionStatus(suggestions, suggestion.id, 'dismissed');
                  onUpdateSuggestions(next);
                  if (projectRoot) {
                    void saveTerminalBlockSuggestions(projectRoot, assistantId, next);
                  }
                }}
                className="rounded border border-stone-200/15 px-2 py-1 text-[10px] font-semibold text-stone-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function OverviewSheet({
  assistant,
  onSaveInstance,
  onSaveTerminalBoundaries,
  onUpdateBlockSuggestions,
  projectRoot,
}: {
  assistant: AIAssistantConfig;
  onSaveInstance: (instance: AssistantInstanceConfig) => void;
  onSaveTerminalBoundaries: (boundaries: TerminalOperationalBoundaries) => void;
  onUpdateBlockSuggestions: (suggestions: TerminalBlockSuggestion[]) => void;
  projectRoot?: string;
}) {
  const enabledSkills = assistant.skills.filter((skill) => skill.enabled).length;
  const warnings = assistant.dailyLogs.filter((log) => log.severity !== 'info').length;
  const blockedPermissions = assistant.permissions.filter((permission) => permission.state === 'blocked').length;

  const addSuggestionToList = (
    suggestion: TerminalBlockSuggestion,
    listKind: 'whitelist' | 'blacklist',
  ) => {
    const pattern = suggestion.normalizedCommand;
    const nextBoundaries: TerminalOperationalBoundaries = {
      ...assistant.terminalBoundaries,
      whitelist:
        listKind === 'whitelist'
          ? mergeBoundaryRules(assistant.terminalBoundaries.whitelist, [pattern], 'whitelist')
          : assistant.terminalBoundaries.whitelist,
      blacklist:
        listKind === 'blacklist'
          ? mergeBoundaryRules(assistant.terminalBoundaries.blacklist, [pattern], 'blacklist')
          : assistant.terminalBoundaries.blacklist,
      updatedAt: new Date().toISOString(),
    };
    const nextSuggestions = updateTerminalBlockSuggestionStatus(
      assistant.terminalBlockSuggestions,
      suggestion.id,
      'accepted',
    );
    onSaveTerminalBoundaries(nextBoundaries);
    onUpdateBlockSuggestions(nextSuggestions);
    if (projectRoot) {
      void saveTerminalBoundariesSidecar(projectRoot, assistant.id, nextBoundaries);
      void saveTerminalBlockSuggestions(projectRoot, assistant.id, nextSuggestions);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="grid overflow-hidden rounded border border-stone-200/15 bg-white/[0.03] sm:grid-cols-4">
        <Metric label="Runtime" value={<Badge tone={assistant.status}>{assistant.status}</Badge>} detail={assistant.instance.runtimeMode} />
        <Metric label="Skills" value={`${enabledSkills}/${assistant.skills.length}`} detail="Enabled capability registry entries" />
        <Metric label="Warnings" value={warnings} detail="Non-info events in daily logs" />
        <Metric label="Blocked" value={blockedPermissions} detail="Permission scopes requiring review" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <TerminalOperationalBoundariesPanel
          boundaries={assistant.terminalBoundaries}
          projectRoot={projectRoot}
          assistantId={assistant.id}
          onSave={onSaveTerminalBoundaries}
        />

        <section className="rounded border border-stone-200/15 bg-white/[0.03]">
          <div className="border-b border-stone-200/10 px-4 py-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-200">Next Work</h2>
          </div>
          <div className="space-y-3 p-4 text-[12px] leading-relaxed text-stone-400">
            <p>Move command execution behind explicit permission confirmation before enabling high-risk skills.</p>
            <p>Promote gateway token writes to the Tauri secret backend; this console stores only secret references.</p>
            <p>Let Dreaming jobs produce reviewable proposals instead of mutating profile or memory directly.</p>
          </div>
        </section>
      </div>

      <TerminalBlockSuggestionsPanel
        suggestions={assistant.terminalBlockSuggestions}
        projectRoot={projectRoot}
        assistantId={assistant.id}
        onUpdateSuggestions={onUpdateBlockSuggestions}
        onAddToBlacklist={(suggestion) => addSuggestionToList(suggestion, 'blacklist')}
        onAddToWhitelist={(suggestion) => addSuggestionToList(suggestion, 'whitelist')}
      />

      <div className="rounded border border-stone-200/15 bg-white/[0.02]">
        <InstanceSheet assistant={assistant} onSave={onSaveInstance} />
      </div>
    </div>
  );
}

function InstanceSheet({
  assistant,
  onSave,
}: {
  assistant: AIAssistantConfig;
  onSave: (instance: AssistantInstanceConfig) => void;
}) {
  const [draft, setDraft] = useState(assistant.instance);
  const [tokenDraft, setTokenDraft] = useState('');
  const validation = useMemo(() => validateAssistantInstance(draft), [draft]);

  useEffect(() => {
    setDraft(assistant.instance);
  }, [assistant.instance]);

  const markTokenConfigured = () => {
    if (!tokenDraft.trim()) return;
    setDraft((prev) => ({
      ...prev,
      gatewayTokenStatus: 'configured',
      gatewayTokenSecretRef: prev.gatewayTokenSecretRef || `pm.assistant.${assistant.id}.gatewayToken`,
      validationNotes: [
        'Gateway token accepted for secret-backend write. Raw value was discarded from React state.',
        ...prev.validationNotes.filter((note) => !note.startsWith('Gateway token accepted')),
      ],
    }));
    setTokenDraft('');
  };

  const runValidation = () => {
    const result = validateAssistantInstance(draft);
    setDraft((prev) => ({
      ...prev,
      connectionStatus: result.valid ? 'degraded' : 'offline',
      lastValidatedAt: new Date().toISOString(),
      validationNotes: [...result.errors, ...result.warnings],
    }));
  };

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[1fr_340px]">
      <section className="rounded border border-stone-200/15 bg-white/[0.03]">
        <div className="flex items-center justify-between gap-3 border-b border-stone-200/10 px-4 py-3">
          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-200">Instance Configuration</h2>
            <p className="mt-1 text-[11px] text-stone-500">Gateway, realtime channel, token reference, and runtime mode.</p>
          </div>
          <Badge tone={draft.connectionStatus}>{draft.connectionStatus}</Badge>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Gateway Access" helper="Use https:// for production. localhost http:// is allowed only in development.">
            <input
              className={inputClass}
              value={draft.gatewayAccess}
              onChange={(event) => setDraft({ ...draft, gatewayAccess: event.target.value })}
            />
          </Field>
          <Field label="WebSocket URL" helper="Use wss:// for production. localhost ws:// is allowed only in development.">
            <input
              className={inputClass}
              value={draft.websocketUrl}
              onChange={(event) => setDraft({ ...draft, websocketUrl: event.target.value })}
            />
          </Field>
          <Field label="Runtime Mode">
            <select
              className={selectClass}
              value={draft.runtimeMode}
              onChange={(event) => setDraft({ ...draft, runtimeMode: event.target.value as AssistantInstanceConfig['runtimeMode'] })}
            >
              <option value="browser-dry-run">Browser dry-run</option>
              <option value="tauri-live">Tauri live</option>
              <option value="gateway">External gateway</option>
            </select>
          </Field>
          <Field label="Gateway Token Secret Ref" helper="The UI stores this reference only; raw tokens belong in the secret backend.">
            <input
              className={inputClass}
              value={draft.gatewayTokenSecretRef}
              onChange={(event) => setDraft({ ...draft, gatewayTokenSecretRef: event.target.value })}
            />
          </Field>
          <Field label="Gateway Token" helper="Pasted value is discarded after status is marked configured in this browser-mode implementation.">
            <div className="flex gap-2">
              <input
                className={inputClass}
                type="password"
                value={tokenDraft}
                placeholder={draft.gatewayTokenStatus === 'configured' ? 'Configured' : 'Paste token to stage secret write'}
                onChange={(event) => setTokenDraft(event.target.value)}
              />
              <button
                type="button"
                onClick={markTokenConfigured}
                disabled={!tokenDraft.trim()}
                className="rounded border border-amber-200/25 bg-amber-500/10 px-3 text-[11px] font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Stage
              </button>
            </div>
          </Field>
          <Field label="Permission Scope" helper="Comma-separated runtime scopes exposed to this instance.">
            <input
              className={inputClass}
              value={draft.permissionScope.join(', ')}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  permissionScope: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                })
              }
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-stone-200/10 px-4 py-3">
          <button type="button" onClick={runValidation} className="rounded border border-stone-200/15 px-3 py-1.5 text-[11px] font-semibold text-stone-200 hover:border-amber-200/30">
            Validate
          </button>
          <button type="button" onClick={() => onSave(draft)} className="rounded border border-emerald-200/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20">
            Save Instance
          </button>
          <span className="text-[11px] text-stone-500">Last validation: {draft.lastValidatedAt ?? 'not run'}</span>
        </div>
      </section>

      <aside className="rounded border border-stone-200/15 bg-white/[0.03]">
        <div className="border-b border-stone-200/10 px-4 py-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-200">Validation</h3>
        </div>
        <div className="space-y-3 p-4 text-[11px] leading-relaxed">
          {validation.errors.length === 0 && validation.warnings.length === 0 && (
            <p className="text-emerald-100">Configuration passes current validation rules.</p>
          )}
          {validation.errors.map((error) => (
            <p key={error} className="rounded border border-red-400/20 bg-red-950/20 px-3 py-2 text-red-100">{error}</p>
          ))}
          {validation.warnings.map((warning) => (
            <p key={warning} className="rounded border border-amber-300/20 bg-amber-950/20 px-3 py-2 text-amber-100">{warning}</p>
          ))}
          <div className="rounded border border-stone-200/10 bg-stone-950/50 px-3 py-2 text-stone-400">
            Token status: <span className="font-semibold text-stone-200">{draft.gatewayTokenStatus}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ProfileSheet({
  assistant,
  onSave,
}: {
  assistant: AIAssistantConfig;
  onSave: (source: AssistantProfileSource) => void;
}) {
  const [selectedKind, setSelectedKind] = useState(assistant.profileSources[0]?.kind ?? 'agents');
  const selected = assistant.profileSources.find((source) => source.kind === selectedKind) ?? assistant.profileSources[0];
  const [content, setContent] = useState(selected?.content ?? '');

  useEffect(() => {
    setContent(selected?.content ?? '');
  }, [selected?.content, selected?.kind]);

  if (!selected) return null;

  const save = () => {
    if (selected.readOnly) return;
    onSave({
      ...selected,
      content,
      version: selected.version + 1,
      contentHash: `sha256:${selected.kind}-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="grid min-h-full gap-4 p-4 lg:grid-cols-[280px_1fr]">
      <section className="rounded border border-stone-200/15 bg-white/[0.03]">
        <div className="border-b border-stone-200/10 px-4 py-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-200">Profile Sources</h2>
        </div>
        <div className="divide-y divide-stone-200/10">
          {assistant.profileSources.map((source) => (
            <button
              key={source.kind}
              type="button"
              onClick={() => setSelectedKind(source.kind)}
              className={clsx(
                'flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[12px]',
                selectedKind === source.kind ? 'bg-emerald-600/20 text-stone-100' : 'text-stone-400 hover:bg-white/[0.04] hover:text-stone-200',
              )}
            >
              <span>
                <span className="block font-semibold">{source.label}</span>
                <span className="mt-1 block truncate font-mono text-[10px] text-stone-500">{source.path}</span>
              </span>
              <Badge tone={source.readOnly ? 'blocked' : 'guarded'}>{source.readOnly ? 'read-only' : `v${source.version}`}</Badge>
            </button>
          ))}
        </div>
      </section>

      <section className="flex min-h-0 flex-col rounded border border-stone-200/15 bg-white/[0.03]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200/10 px-4 py-3">
          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-200">{selected.label}</h2>
            <p className="mt-1 font-mono text-[10px] text-stone-500">{selected.path}</p>
          </div>
          <div className="flex gap-2">
            <Badge tone={selected.liveEffect}>{selected.liveEffect}</Badge>
            <Badge tone={selected.readOnly ? 'blocked' : 'guarded'}>{selected.readOnly ? 'read-only' : 'editable'}</Badge>
          </div>
        </div>
        <textarea
          className="min-h-0 flex-1 resize-none border-0 bg-stone-950/60 p-4 font-mono text-[12px] leading-relaxed text-stone-100 outline-none"
          value={content}
          readOnly={selected.readOnly}
          onChange={(event) => setContent(event.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200/10 px-4 py-3 text-[11px] text-stone-500">
          <span>Hash: {selected.contentHash}</span>
          <button
            type="button"
            disabled={selected.readOnly || content === selected.content}
            onClick={save}
            className="rounded border border-emerald-200/20 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save Profile Source
          </button>
        </div>
      </section>
    </div>
  );
}

function SkillsSheet({
  assistant,
  onToggle,
}: {
  assistant: AIAssistantConfig;
  onToggle: (skill: AssistantSkillConfig) => void;
}) {
  return (
    <div className="p-4">
      <div className="overflow-hidden rounded border border-stone-200/15 bg-white/[0.03]">
        <table className="w-full min-w-[900px] text-left text-[12px]">
          <thead className="border-b border-stone-200/10 bg-stone-950/60 text-[10px] uppercase tracking-[0.1em] text-stone-500">
            <tr>
              <th className="px-3 py-2">Skill</th>
              <th className="px-3 py-2">Dependencies</th>
              <th className="px-3 py-2">Capability Match</th>
              <th className="px-3 py-2">Risk</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200/10">
            {assistant.skills.map((skill) => (
              <tr key={skill.id} className="text-stone-300">
                <td className="px-3 py-3">
                  <div className="font-semibold text-stone-100">{skill.name}</div>
                  <div className="mt-1 font-mono text-[10px] text-stone-500">{skill.sourcePath}</div>
                </td>
                <td className="px-3 py-3">
                  <Badge tone={skill.dependencyStatus}>{skill.dependencyStatus}</Badge>
                  <div className="mt-1 text-[10px] text-stone-500">
                    tools: {skill.requiredTools.join(', ') || '-'}; env: {skill.requiredEnv.join(', ') || '-'}
                  </div>
                </td>
                <td className="px-3 py-3"><Badge tone={skill.capabilityMatch}>{skill.capabilityMatch}</Badge></td>
                <td className="px-3 py-3"><span className={clsx('rounded border px-2 py-0.5 text-[10px] font-semibold', riskClass(skill.risk))}>{skill.risk}</span></td>
                <td className="px-3 py-3"><Badge tone={skill.enabled ? 'connected' : 'blocked'}>{skill.enabled ? 'enabled' : 'disabled'}</Badge></td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onToggle({ ...skill, enabled: !skill.enabled })}
                    className="rounded border border-stone-200/15 px-3 py-1.5 text-[11px] font-semibold text-stone-200 hover:border-amber-200/30"
                  >
                    {skill.enabled ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function workflowRunNodeCounts(run: AgentWorkflowRun): Record<AgentWorkflowNodeRun['status'], number> {
  return run.nodeRuns.reduce<Record<AgentWorkflowNodeRun['status'], number>>(
    (counts, nodeRun) => ({
      ...counts,
      [nodeRun.status]: counts[nodeRun.status] + 1,
    }),
    {
      queued: 0,
      ready: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
    },
  );
}

function WorkflowRunsSheet({
  projectRoot,
  initialWorkflowRuns = EMPTY_WORKFLOW_RUNS,
  initialProjectWorkflowRuns = EMPTY_PROJECT_WORKFLOW_RUNS,
}: {
  projectRoot?: string;
  initialWorkflowRuns?: AgentWorkflowRun[];
  initialProjectWorkflowRuns?: ProjectWorkflowRun[];
}) {
  const workflowRunDeepLink = useMemo(readWorkflowRunDeepLink, []);
  const initialSelectedProjectRun =
    selectProjectWorkflowRunFromDeepLink(initialProjectWorkflowRuns, workflowRunDeepLink) ??
    initialProjectWorkflowRuns[0] ??
    null;
  const router = useRouter();
  const [runs, setRuns] = useState<AgentWorkflowRun[]>(initialWorkflowRuns);
  const [projectRuns, setProjectRuns] = useState<ProjectWorkflowRun[]>(initialProjectWorkflowRuns);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialWorkflowRuns[0]?.id ?? null);
  const [selectedProjectRunId, setSelectedProjectRunId] = useState<string | null>(initialSelectedProjectRun?.id ?? null);
  const [selectedProjectNodeId, setSelectedProjectNodeId] = useState<string | null>(
    initialSelectedProjectRun && workflowRunDeepLink.nodeId ? workflowRunDeepLink.nodeId : null,
  );
  const [saveWorkItemId, setSaveWorkItemId] = useState(initialProjectWorkflowRuns[0]?.workItemId ?? '');
  const [savingWorkflowRun, setSavingWorkflowRun] = useState(false);
  const [saveWorkflowRunMessage, setSaveWorkflowRunMessage] = useState<string | null>(null);
  const [saveWorkflowRunError, setSaveWorkflowRunError] = useState<string | null>(null);
  const [effectiveProjectRoot, setEffectiveProjectRoot] = useState(() =>
    needsProjectManagerRootResolution(projectRoot) ? '' : trimRoot(projectRoot),
  );
  const [workflowExecutionRequestRows, setWorkflowExecutionRequestRows] = useState<IntegrationRow[]>([]);
  const [workflowExecutionRecordRows, setWorkflowExecutionRecordRows] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRuns(initialWorkflowRuns);
    setSelectedRunId((prev) => prev ?? initialWorkflowRuns[0]?.id ?? null);
  }, [initialWorkflowRuns]);

  useEffect(() => {
    setProjectRuns(initialProjectWorkflowRuns);
    const deepLinkedRun = selectProjectWorkflowRunFromDeepLink(initialProjectWorkflowRuns, workflowRunDeepLink);
    setSelectedProjectRunId((prev) => deepLinkedRun?.id ?? prev ?? initialProjectWorkflowRuns[0]?.id ?? null);
    if (deepLinkedRun && workflowRunDeepLink.nodeId) setSelectedProjectNodeId(workflowRunDeepLink.nodeId);
  }, [initialProjectWorkflowRuns]);

  useEffect(() => {
    const rawRoot = trimRoot(projectRoot);
    if (!rawRoot) {
      setEffectiveProjectRoot('');
      return;
    }
    if (!needsProjectManagerRootResolution(rawRoot)) {
      setEffectiveProjectRoot(rawRoot);
      return;
    }
    let cancelled = false;
    void getProjectManagerRoot()
      .then((detectedRoot) => {
        if (!cancelled) setEffectiveProjectRoot(rewriteProjectManagerSampleRoot(rawRoot, detectedRoot));
      })
      .catch(() => {
        if (!cancelled) setEffectiveProjectRoot(rawRoot);
      });
    return () => {
      cancelled = true;
    };
  }, [projectRoot]);

  useEffect(() => {
    if (!effectiveProjectRoot) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([listProjectWorkflowRuns(effectiveProjectRoot), listAgentWorkflowRuns(effectiveProjectRoot)])
      .then(([loadedProjectRuns, loadedRuns]) => {
        if (cancelled) return;
        const deepLinkedRun = selectProjectWorkflowRunFromDeepLink(loadedProjectRuns, workflowRunDeepLink);
        setProjectRuns(loadedProjectRuns);
        setSelectedProjectRunId((prev) => {
          if (deepLinkedRun) return deepLinkedRun.id;
          if (prev && loadedProjectRuns.some((run) => run.id === prev)) return prev;
          return loadedProjectRuns[0]?.id ?? null;
        });
        if (deepLinkedRun && workflowRunDeepLink.nodeId) setSelectedProjectNodeId(workflowRunDeepLink.nodeId);
        setRuns(loadedRuns);
        setSelectedRunId((prev) => {
          if (prev && loadedRuns.some((run) => run.id === prev)) return prev;
          return loadedRuns[0]?.id ?? null;
        });
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load WorkflowRun sidecars.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveProjectRoot]);

  useEffect(() => {
    if (!effectiveProjectRoot) {
      setWorkflowExecutionRequestRows([]);
      setWorkflowExecutionRecordRows([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      loadWorkflowExecutionRequestRows(effectiveProjectRoot),
      loadWorkflowExecutionRecordRows(effectiveProjectRoot),
    ])
      .then(([requestRows, recordRows]) => {
        if (cancelled) return;
        setWorkflowExecutionRequestRows(requestRows);
        setWorkflowExecutionRecordRows(recordRows);
      })
      .catch((executionEvidenceError: unknown) => {
        if (cancelled) return;
        setWorkflowExecutionRequestRows([]);
        setWorkflowExecutionRecordRows([]);
        setError(
          executionEvidenceError instanceof Error
            ? executionEvidenceError.message
            : 'Unable to load workflow execution evidence.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveProjectRoot]);

  const selectedProjectRun = projectRuns.find((run) => run.id === selectedProjectRunId) ?? projectRuns[0] ?? null;
  const selectedProjectTemplate = selectedProjectRun ? getProjectWorkflowTemplateById(selectedProjectRun.templateId) : undefined;
  const projectWorkflowMappedExecutorRegistry = useMemo(
    () => buildExecutorRegistryFromCommandMappings(loadChannelCatalog().commandMappings),
    [],
  );
  const projectWorkflowExecutorRegistry = useMemo(
    () => ({
      ...DEFAULT_PROJECT_WORKFLOW_EXECUTOR_REGISTRY,
      ...projectWorkflowMappedExecutorRegistry,
    }),
    [projectWorkflowMappedExecutorRegistry],
  );
  const projectGraphView = selectedProjectRun && selectedProjectTemplate
    ? buildProjectWorkflowGraphView(selectedProjectTemplate, selectedProjectRun, {
        selectedNodeId: selectedProjectNodeId ?? undefined,
        executorRegistry: projectWorkflowExecutorRegistry,
      })
    : null;

  const handleSaveProjectWorkflowRun = async () => {
    const workItemId = saveWorkItemId.trim();
    if (!effectiveProjectRoot) {
      setSaveWorkflowRunError('Select a project before saving a workflow run.');
      setSaveWorkflowRunMessage(null);
      return;
    }
    if (!workItemId) {
      setSaveWorkflowRunError('Enter a feature or work item id before saving.');
      setSaveWorkflowRunMessage(null);
      return;
    }
    const template = getProjectWorkflowTemplateById('software-engineering-loop');
    if (!template) {
      setSaveWorkflowRunError('Software Engineering Loop template is unavailable.');
      setSaveWorkflowRunMessage(null);
      return;
    }
    setSavingWorkflowRun(true);
    setSaveWorkflowRunError(null);
    setSaveWorkflowRunMessage(null);
    try {
      const run = createProjectWorkflowRun(template, {
        projectId: 'project-manager',
        workItemId,
        createdBy: 'PM Lead',
      });
      const savedPath = await saveProjectWorkflowRun(effectiveProjectRoot, run);
      const loadedProjectRuns = await listProjectWorkflowRuns(effectiveProjectRoot);
      const nextProjectRuns = loadedProjectRuns.length > 0 ? loadedProjectRuns : [run];
      setProjectRuns(nextProjectRuns);
      const matchingRun = nextProjectRuns.find((loadedRun) => loadedRun.workItemId === workItemId);
      setSelectedProjectRunId(matchingRun?.id ?? nextProjectRuns[0]?.id ?? run.id);
      setSelectedProjectNodeId(null);
      setSaveWorkflowRunMessage(`Saved workflow run: ${savedPath}`);
    } catch (saveError: unknown) {
      setSaveWorkflowRunError(saveError instanceof Error ? saveError.message : 'Unable to save workflow run.');
    } finally {
      setSavingWorkflowRun(false);
    }
  };

  const handleStartProjectWorkflowNode = async (nodeId: string) => {
    if (!effectiveProjectRoot || !selectedProjectRun || !selectedProjectTemplate) {
      setError('Select a Project Workflow run before starting a node.');
      return;
    }
    setError(null);
    try {
      const startedRun = startProjectWorkflowNode(selectedProjectTemplate, selectedProjectRun, nodeId);
      const nextRun = autoRequestEligibleProjectWorkflowDrafts(startedRun, 'Auto Run Policy');
      await persistProjectWorkflowRunUpdate(nextRun);
      setSelectedProjectNodeId(nodeId);
    } catch (startError: unknown) {
      setError(startError instanceof Error ? startError.message : 'Unable to start workflow node.');
    }
  };

  const persistProjectWorkflowRunUpdate = async (nextRun: ProjectWorkflowRun) => {
    if (!effectiveProjectRoot) throw new Error('Select a project before updating a workflow run.');
    await saveProjectWorkflowRun(effectiveProjectRoot, nextRun);
    if (Object.keys(projectWorkflowMappedExecutorRegistry).length > 0) {
      await saveProjectWorkflowExecutionRequests(effectiveProjectRoot, nextRun, undefined, projectWorkflowExecutorRegistry);
    } else {
      await saveProjectWorkflowExecutionRequests(effectiveProjectRoot, nextRun);
    }
    const loadedProjectRuns = await listProjectWorkflowRuns(effectiveProjectRoot);
    setProjectRuns(loadedProjectRuns.length > 0 ? loadedProjectRuns : [nextRun]);
    setSelectedProjectRunId(nextRun.id);
  };

  const handleChangeExecutionMode = async (mode: ProjectWorkflowRun['executionMode']) => {
    if (!selectedProjectRun) {
      setError('Select a Project Workflow run before changing execution mode.');
      return;
    }
    setError(null);
    try {
      const nextRun = setProjectWorkflowExecutionMode(selectedProjectRun, mode, 'PM Lead');
      await persistProjectWorkflowRunUpdate(nextRun);
    } catch (modeError: unknown) {
      setError(modeError instanceof Error ? modeError.message : 'Unable to update execution mode.');
    }
  };

  const handleRunExecutionDraft = async (draftId: string) => {
    if (!selectedProjectRun) {
      setError('Select a Project Workflow run before requesting a draft run.');
      return;
    }
    setError(null);
    try {
      const nextRun = requestProjectWorkflowDraftRun(selectedProjectRun, draftId, 'PM Lead');
      await persistProjectWorkflowRunUpdate(nextRun);
      const draft = nextRun.executionDrafts.find((candidate) => candidate.id === draftId);
      if (draft) setSelectedProjectNodeId(draft.nodeId);
    } catch (draftError: unknown) {
      setError(draftError instanceof Error ? draftError.message : 'Unable to request draft run.');
    }
  };

  if (projectGraphView) {
    return (
      <ProjectWorkflowRunsGraphSheet
        projectRoot={effectiveProjectRoot}
        runs={projectRuns}
        graphView={projectGraphView}
        workflowExecutionRequestRows={workflowExecutionRequestRows}
        workflowExecutionRecordRows={workflowExecutionRecordRows}
        loading={loading}
        error={error}
        saveWorkItemId={saveWorkItemId}
        savingWorkflowRun={savingWorkflowRun}
        saveWorkflowRunMessage={saveWorkflowRunMessage}
        saveWorkflowRunError={saveWorkflowRunError}
        onSaveWorkItemIdChange={setSaveWorkItemId}
        onSaveWorkflowRun={handleSaveProjectWorkflowRun}
        onStartNode={handleStartProjectWorkflowNode}
        onChangeExecutionMode={handleChangeExecutionMode}
        onRunExecutionDraft={handleRunExecutionDraft}
        onReviewExecutionRequest={(requestId) =>
          router.push(
            requestId
              ? `/integrations-hub/workflow-execution-requests?requestId=${encodeURIComponent(requestId)}`
              : '/integrations-hub/workflow-execution-requests',
          )
        }
        onOpenExecutionRecord={(recordId) =>
          router.push(`/integrations-hub/workflow-execution-records?recordId=${encodeURIComponent(recordId)}`)
        }
        onConfigureExecutor={() => router.push('/integrations-hub/commands')}
        onSelectRun={(runId) => {
          setSelectedProjectRunId(runId);
          setSelectedProjectNodeId(null);
        }}
        onSelectNode={setSelectedProjectNodeId}
      />
    );
  }

  if (projectRuns.length === 0 && runs.length === 0 && !loading) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="max-w-xl rounded border border-stone-200/15 bg-white/[0.03] p-6 text-center">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-200">
            No Project Workflow runs found yet
          </h2>
          <p className="mt-3 text-[12px] leading-relaxed text-stone-400">
            Use /workflow &lt;featureId&gt; in AI Assistant chat to prepare a review-first Project Workflow decision package,
            then save or start a manual run when the human lead approves it.
          </p>
          <div className="mt-5 text-left">
            <SaveWorkflowRunControl
              projectRoot={effectiveProjectRoot}
              workItemId={saveWorkItemId}
              saving={savingWorkflowRun}
              message={saveWorkflowRunMessage}
              error={saveWorkflowRunError}
              onWorkItemIdChange={setSaveWorkItemId}
              onSave={handleSaveProjectWorkflowRun}
            />
          </div>
          <p className="mt-3 font-mono text-[10px] text-stone-500">
            {effectiveProjectRoot ? `${effectiveProjectRoot}/.project-manager/project-workflow-runs` : 'Select a project to load Project Workflow run sidecars.'}
          </p>
        </div>
      </div>
    );
  }

  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null;
  const selectedCounts = selectedRun ? workflowRunNodeCounts(selectedRun) : null;
  const totalReadyNodes = runs.reduce((total, run) => total + workflowRunNodeCounts(run).ready, 0);
  const activeRuns = runs.filter((run) => ['queued', 'running', 'blocked'].includes(run.status)).length;
  const completedRuns = runs.filter((run) => run.status === 'completed').length;
  const blockedRuns = runs.filter((run) => run.status === 'blocked').length;

  return (
    <div className="grid min-h-full gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded border border-stone-200/15 bg-white/[0.03]">
        <div className="grid border-b border-stone-200/10 sm:grid-cols-4">
          <Metric label="Runs" value={runs.length} detail="Persisted WorkflowRun sidecars" />
          <Metric label="Active" value={activeRuns} detail="Queued, running, or blocked" />
          <Metric label="Ready Nodes" value={totalReadyNodes} detail="Nodes ready for worker launch" />
          <Metric label="Done / Blocked" value={`${completedRuns}/${blockedRuns}`} detail="Completed runs versus blocked runs" />
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-stone-200/10 px-4 py-3">
          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-200">Workflow Runs</h2>
            <p className="mt-1 text-[11px] text-stone-500">
              {projectRoot ? `${projectRoot}/.project-manager/workflow-runs` : 'Select a project to load WorkflowRun sidecars.'}
            </p>
          </div>
          <Badge tone={loading ? 'queued' : error ? 'error' : 'ready'}>
            {loading ? 'loading' : error ? 'error' : 'ready'}
          </Badge>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[920px] text-left text-[12px]">
            <thead className="sticky top-0 border-b border-stone-200/10 bg-stone-950 text-[10px] uppercase tracking-[0.1em] text-stone-500">
              <tr>
                <th className="px-3 py-2">Run</th>
                <th className="px-3 py-2">Workflow</th>
                <th className="px-3 py-2">Feature</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Nodes</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200/10">
              {runs.map((run) => {
                const counts = workflowRunNodeCounts(run);
                return (
                  <tr
                    key={run.id}
                    className={clsx(
                      'cursor-pointer text-stone-300 hover:bg-white/[0.04]',
                      selectedRun?.id === run.id && 'bg-emerald-600/15',
                    )}
                    onClick={() => setSelectedRunId(run.id)}
                  >
                    <td className="px-3 py-3">
                      <div className="font-mono text-[10px] text-stone-200">{run.id}</div>
                      <div className="mt-1 text-[10px] text-stone-500">{run.selectedBy ?? 'dispatch'}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-stone-100">{run.workflowTitle}</div>
                      <div className="mt-1 font-mono text-[10px] text-stone-500">{run.workflowId}@v{run.workflowVersion}</div>
                    </td>
                    <td className="px-3 py-3 font-mono text-[10px] text-stone-400">{run.featureId ?? '-'}</td>
                    <td className="px-3 py-3"><Badge tone={run.status}>{run.status}</Badge></td>
                    <td className="px-3 py-3 text-stone-400">
                      ready {counts.ready} / running {counts.running} / done {counts.succeeded}
                    </td>
                    <td className="px-3 py-3 font-mono text-[10px] text-stone-500">{run.updatedAt}</td>
                  </tr>
                );
              })}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-stone-500">
                    {error ?? (projectRoot ? 'No WorkflowRun sidecars found yet.' : 'No project selected for WorkflowRun loading.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col overflow-hidden rounded border border-stone-200/15 bg-white/[0.03]">
        <div className="border-b border-stone-200/10 px-4 py-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-200">Run Detail</h2>
          <p className="mt-1 font-mono text-[10px] text-stone-500">{selectedRun?.id ?? 'No run selected'}</p>
        </div>
        {selectedRun && selectedCounts ? (
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="rounded border border-stone-200/10 bg-stone-950/50 px-2 py-2">
                <div className="text-stone-500">Ready</div>
                <div className="mt-1 text-sm font-semibold text-stone-100">{selectedCounts.ready}</div>
              </div>
              <div className="rounded border border-stone-200/10 bg-stone-950/50 px-2 py-2">
                <div className="text-stone-500">Running</div>
                <div className="mt-1 text-sm font-semibold text-stone-100">{selectedCounts.running}</div>
              </div>
              <div className="rounded border border-stone-200/10 bg-stone-950/50 px-2 py-2">
                <div className="text-stone-500">Blocked</div>
                <div className="mt-1 text-sm font-semibold text-stone-100">{selectedCounts.blocked + selectedCounts.failed}</div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {selectedRun.nodeRuns.map((nodeRun) => (
                <div key={nodeRun.id} className="rounded border border-stone-200/10 bg-stone-950/45 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-semibold text-stone-100">{nodeRun.title}</div>
                      <div className="mt-1 font-mono text-[10px] text-stone-500">{nodeRun.nodeId} / {nodeRun.role}</div>
                    </div>
                    <Badge tone={nodeRun.status}>{nodeRun.status}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-[10px] text-stone-500">
                    <div>Dependencies: {nodeRun.dependencies.join(', ') || 'none'}</div>
                    <div>Attempts: {nodeRun.attempts}/{nodeRun.maxAttempts}</div>
                    <div>Runtime: {nodeRun.runtime.provider} / {nodeRun.runtime.isolation}</div>
                    <div>Session: {nodeRun.sessionScope.workflowRunId}/{nodeRun.sessionScope.nodeId}/{nodeRun.sessionScope.agentId}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {nodeRun.outputArtifacts.map((artifact) => (
                      <Badge key={artifact.artifactId} tone={artifact.status}>
                        {artifact.artifactId}: {artifact.status}
                      </Badge>
                    ))}
                  </div>
                  {nodeRun.blockedReason && (
                    <p className="mt-3 rounded border border-red-400/20 bg-red-950/20 px-2 py-1.5 text-[11px] text-red-100">
                      {nodeRun.blockedReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[12px] text-stone-500">
            WorkflowRun detail appears after Dispatch creates a sidecar.
          </div>
        )}
      </aside>
    </div>
  );
}

function ProjectWorkflowRunsGraphSheet({
  projectRoot,
  runs,
  graphView,
  workflowExecutionRequestRows,
  workflowExecutionRecordRows,
  loading,
  error,
  onSelectRun,
  onSelectNode,
  saveWorkItemId,
  savingWorkflowRun,
  saveWorkflowRunMessage,
  saveWorkflowRunError,
  onSaveWorkItemIdChange,
  onSaveWorkflowRun,
  onStartNode,
  onChangeExecutionMode,
  onRunExecutionDraft,
  onReviewExecutionRequest,
  onOpenExecutionRecord,
  onConfigureExecutor,
}: {
  projectRoot?: string;
  runs: ProjectWorkflowRun[];
  graphView: ProjectWorkflowGraphView;
  workflowExecutionRequestRows: IntegrationRow[];
  workflowExecutionRecordRows: IntegrationRow[];
  loading: boolean;
  error: string | null;
  onSelectRun: (runId: string) => void;
  onSelectNode: (nodeId: string) => void;
  saveWorkItemId: string;
  savingWorkflowRun: boolean;
  saveWorkflowRunMessage: string | null;
  saveWorkflowRunError: string | null;
  onSaveWorkItemIdChange: (value: string) => void;
  onSaveWorkflowRun: () => void;
  onStartNode: (nodeId: string) => void;
  onChangeExecutionMode: (mode: ProjectWorkflowRun['executionMode']) => void;
  onRunExecutionDraft: (draftId: string) => void;
  onReviewExecutionRequest: (requestId?: string) => void;
  onOpenExecutionRecord: (recordId: string) => void;
  onConfigureExecutor: () => void;
}) {
  const inspector = graphView.inspector;
  const canStartSelectedNode = inspector?.status === 'ready' && graphView.run.executionMode !== 'paused';
  const canRunExecutionDraft =
    inspector?.executionDraft?.status === 'manual_run_required' ||
    inspector?.executionDraft?.status === 'auto_run_allowed';
  const executionRequestRow = inspector?.executionDraft
    ? findWorkflowExecutionRequestRow(
        workflowExecutionRequestRows,
        graphView.run.id,
        inspector.executionDraft.id,
        inspector.nodeId,
      )
    : undefined;
  const executionRecordRow = inspector?.executionDraft
    ? findWorkflowExecutionRecordRow(
        workflowExecutionRecordRows,
        graphView.run.id,
        inspector.executionDraft.id,
        inspector.nodeId,
        executionRequestRow?.sourceId,
      )
    : undefined;
  return (
    <div className="grid min-h-full gap-4 p-4 xl:grid-cols-[240px_minmax(0,1fr)_340px]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded border border-stone-200/15 bg-white/[0.03]">
        <div className="border-b border-stone-200/10 px-4 py-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-200">Project Workflow Runs</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
            {projectRoot ? `${projectRoot}/.project-manager/project-workflow-runs` : 'Review-first graph runs loaded from the selected project.'}
          </p>
        </div>
        <div className="grid grid-cols-2 border-b border-stone-200/10">
          <Metric label="Runs" value={runs.length} detail="Project Workflow sidecars" />
          <Metric label="Ready" value={graphView.metrics.readyNodes} detail="Manual start required" />
          <Metric label="Blocked" value={graphView.metrics.blockedNodes} detail="Needs evidence or approval" />
          <Metric label="Gates" value={graphView.metrics.approvalGates} detail="Human approval controls" />
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div className="space-y-2">
            {runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelectRun(run.id)}
                className={clsx(
                  'w-full border px-3 py-2 text-left text-[11px] hover:border-emerald-300/30',
                  run.id === graphView.run.id
                    ? 'border-emerald-300/30 bg-emerald-950/20 text-emerald-50'
                    : 'border-stone-200/10 bg-stone-950/45 text-stone-300',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{run.workItemId}</span>
                  <Badge tone={run.status}>{run.status}</Badge>
                </div>
                <div className="mt-1 truncate font-mono text-[9px] text-stone-500">{run.templateId}@v{run.templateVersion}</div>
              </button>
            ))}
          </div>
          {error && <p className="mt-3 rounded border border-red-400/25 bg-red-950/20 px-3 py-2 text-[11px] text-red-100">{error}</p>}
          {loading && <p className="mt-3 text-[11px] text-stone-500">Loading Project Workflow sidecars...</p>}
        </div>
      </section>

      <section className="flex min-h-0 flex-col overflow-hidden rounded border border-stone-200/15 bg-white/[0.03]">
        <div className="flex items-start justify-between gap-3 border-b border-stone-200/10 px-4 py-3">
          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-200">Workflow Graph</h2>
            <p className="mt-1 text-[11px] text-stone-500">
              {graphView.run.title} · {graphView.run.workItemId}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge tone={graphView.run.status}>{graphView.run.status}</Badge>
            <div className="rounded border border-stone-200/15 bg-stone-950/60 px-2 py-1 text-right">
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-500">Execution Mode</div>
              <div className="mt-0.5 text-[11px] font-semibold text-stone-100">
                {executionModeLabel(graphView.run.executionMode)}
              </div>
            </div>
            <div className="grid grid-cols-3 overflow-hidden border border-stone-200/15 bg-stone-950/60 text-[10px] font-semibold">
              {[
                ['manual_only', 'Manual only'],
                ['auto_safe_nodes', 'Auto-run safe nodes'],
                ['paused', 'Paused'],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChangeExecutionMode(mode as ProjectWorkflowRun['executionMode'])}
                  className={clsx(
                    'border-r border-stone-200/10 px-2 py-1.5 last:border-r-0 hover:bg-white/[0.06]',
                    graphView.run.executionMode === mode
                      ? 'bg-emerald-600/20 text-emerald-50'
                      : 'text-stone-400',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <SaveWorkflowRunControl
              compact
              projectRoot={projectRoot}
              workItemId={saveWorkItemId}
              saving={savingWorkflowRun}
              message={saveWorkflowRunMessage}
              error={saveWorkflowRunError}
              onWorkItemIdChange={onSaveWorkItemIdChange}
              onSave={onSaveWorkflowRun}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:22px_22px] p-4">
          <div className="grid min-w-[820px] grid-cols-4 gap-4">
            {graphView.nodes.map((node) => (
              <button
                key={node.nodeId}
                type="button"
                onClick={() => onSelectNode(node.nodeId)}
                className={clsx(
                  'min-h-[146px] border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-200/40',
                  graphView.selectedNode?.nodeId === node.nodeId
                    ? 'border-amber-200/50 bg-amber-950/20'
                    : 'border-stone-200/12 bg-stone-950/75',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[12px] font-semibold text-stone-100">{node.title}</div>
                    <div className="mt-1 font-mono text-[9px] text-stone-500">{node.nodeId}</div>
                  </div>
                  <Badge tone={node.status}>{node.status}</Badge>
                </div>
                <div className="mt-3 space-y-1 text-[10px] leading-relaxed text-stone-400">
                  <div>actor: {node.actorKind}</div>
                  <div>system: {node.systemPromptLabel}</div>
                  <div>memory: {node.memoryFiles.join(', ')}</div>
                  <div>out: {node.outputArtifact}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 rounded border border-stone-200/10 bg-stone-950/55 px-3 py-2 text-[11px] text-stone-500">
            Dependency edges: {graphView.edges.map((edge) => `${edge.source} -> ${edge.target}`).join(' · ')}
          </div>
        </div>
        <div className="border-t border-stone-200/10 px-4 py-3 text-[11px] text-amber-100">
          {graphView.safetyNotice}
        </div>
      </section>

      <aside className="flex min-h-0 flex-col overflow-hidden rounded border border-stone-200/15 bg-white/[0.03]">
        <div className="border-b border-stone-200/10 px-4 py-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-200">Node Inspector</h2>
          <p className="mt-1 font-mono text-[10px] text-stone-500">{inspector?.nodeId ?? 'No node selected'}</p>
        </div>
        {inspector ? (
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-stone-100">{inspector.title}</h3>
                <p className="mt-1 text-[11px] text-stone-500">{inspector.summary}</p>
              </div>
              <Badge tone={inspector.status}>{inspector.status}</Badge>
            </div>
            <InspectorBlock title="Prompts">
              <InspectorLine label="System" value={inspector.systemPromptLabel} />
              <InspectorLine label="Task" value={inspector.taskPromptLabel} />
            </InspectorBlock>
            <InspectorBlock title="Tools + Memory">
              <InspectorLine label="Tools" value={inspector.tools.join(', ')} />
              <InspectorLine label="Memory" value={inspector.memoryFiles.join(', ')} />
            </InspectorBlock>
            <InspectorBlock title="Handoff">
              <InspectorLine label="Input" value={inspector.inputArtifacts.join(', ') || 'none'} />
              <InspectorLine label="Output" value={inspector.outputArtifact} />
            </InspectorBlock>
            <InspectorBlock title="Evidence">
              {inspector.evidenceRequirements.map((evidence) => (
                <InspectorLine
                  key={evidence.evidenceId}
                  label={evidence.evidenceId}
                  value={`${evidence.kind}${evidence.required ? ' · required' : ''}`}
                />
              ))}
            </InspectorBlock>
            <InspectorBlock title="Scorecards">
              {inspector.scorecards.map((scorecard) => (
                <InspectorLine key={scorecard.scorecardId} label={scorecard.scorecardId} value={scorecard.status} />
              ))}
            </InspectorBlock>
            {inspector.approvalGate && (
              <InspectorBlock title="Approval Gate">
                <InspectorLine label="Gate" value={inspector.approvalGate.title} />
                <InspectorLine label="Approver" value={inspector.approvalGate.approverRole} />
                <InspectorLine label="Reason" value={inspector.approvalGate.reason} />
              </InspectorBlock>
            )}
            <InspectorBlock title="Execution Control">
              <InspectorLine label="Mode" value={executionModeLabel(graphView.run.executionMode)} />
              <InspectorLine label="Eligibility" value={canStartSelectedNode ? 'ready to draft' : 'not ready'} />
              <button
                type="button"
                disabled={!canStartSelectedNode}
                onClick={() => onStartNode(inspector.nodeId)}
                className="mt-3 inline-flex w-full items-center justify-center gap-1 border border-emerald-300/30 bg-emerald-950/30 px-3 py-1.5 text-[11px] font-semibold text-emerald-50 hover:border-emerald-200/60 disabled:cursor-not-allowed disabled:border-stone-200/10 disabled:bg-stone-950/50 disabled:text-stone-600"
              >
                <GitBranch size={13} />
                Start node
              </button>
            </InspectorBlock>
            {inspector.executionDraft && (
              <InspectorBlock title="Execution Draft">
                <InspectorLine label="Status" value={inspector.executionDraft.status} />
                <InspectorLine label="Risk" value={inspector.executionDraft.riskLevel} />
                <InspectorLine label="Mode" value={executionModeLabel(inspector.executionDraft.runModeAtCreation)} />
                <InspectorLine label="Tools" value={inspector.executionDraft.allowedTools.join(', ')} />
                <InspectorLine label="Evidence" value={inspector.executionDraft.expectedEvidenceIds.join(', ')} />
                <InspectorLine label="Policy" value={inspector.executionDraft.integrationPolicy.policyState} />
                <InspectorLine label="Reason" value={inspector.executionDraft.eligibilityReason} />
                {inspector.executionDraft.executionResult && (
                  <InspectorLine label="Result" value={inspector.executionDraft.executionResult} />
                )}
                {inspector.executionDraft.runRequestedAt && (
                  <InspectorLine label="Requested" value={inspector.executionDraft.runRequestedAt} />
                )}
                {inspector.executionDraft.runRequestedBy && (
                  <InspectorLine label="By" value={inspector.executionDraft.runRequestedBy} />
                )}
                <button
                  type="button"
                  disabled={!canRunExecutionDraft}
                  onClick={() => onRunExecutionDraft(inspector.executionDraft!.id)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1 border border-amber-300/30 bg-amber-950/30 px-3 py-1.5 text-[11px] font-semibold text-amber-50 hover:border-amber-200/60 disabled:cursor-not-allowed disabled:border-stone-200/10 disabled:bg-stone-950/50 disabled:text-stone-600"
                >
                  <Terminal size={13} />
                  Run draft
                </button>
                {inspector.executionDraft.status === 'run_requested' && (
                  <button
                    type="button"
                    onClick={() => onReviewExecutionRequest(executionRequestRow?.sourceId)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1 border border-stone-200/15 bg-stone-950/60 px-3 py-1.5 text-[11px] font-semibold text-stone-100 hover:border-amber-200/40"
                  >
                    <FileText size={13} />
                    Review execution request
                  </button>
                )}
              </InspectorBlock>
            )}
            {(executionRequestRow || executionRecordRow) && (
              <InspectorBlock title="Execution Evidence">
                {executionRequestRow && (
                  <>
                    <InspectorLine label="Request" value={executionRequestRow.sourceId} />
                    <InspectorLine label="Review" value={workflowExecutionRequestReviewStatus(executionRequestRow)} />
                    {workflowExecutionRequestPolicyState(executionRequestRow) !==
                      workflowExecutionRequestReviewStatus(executionRequestRow) && (
                      <InspectorLine label="Policy" value={workflowExecutionRequestPolicyState(executionRequestRow)} />
                    )}
                    <InspectorLine label="Command" value={workflowExecutionRequestCommandPreview(executionRequestRow)} />
                  </>
                )}
                {executionRecordRow && (
                  <>
                    <InspectorLine label="Record" value={executionRecordRow.sourceId} />
                    <InspectorLine label="Result" value={workflowExecutionRecordStatus(executionRecordRow)} />
                    <InspectorLine label="Runner" value={workflowExecutionRecordRunnerSummary(executionRecordRow)} />
                    <button
                      type="button"
                      onClick={() => onOpenExecutionRecord(executionRecordRow.sourceId)}
                      className="mt-3 inline-flex w-full items-center justify-center gap-1 border border-stone-200/15 bg-stone-950/60 px-3 py-1.5 text-[11px] font-semibold text-stone-100 hover:border-cyan-200/40"
                    >
                      <FileText size={13} />
                      Open execution record
                    </button>
                  </>
                )}
              </InspectorBlock>
            )}
            {inspector.executorResolution && (
              <InspectorBlock title="Executor Candidate">
                <InspectorLine label="State" value={inspector.executorResolution.state} />
                <InspectorLine label="Mode" value={inspector.executorResolution.executionState} />
                <InspectorLine label="Capability" value={inspector.executorResolution.capabilityId} />
                {inspector.executorResolution.state === 'resolved' ? (
                  <>
                    <InspectorLine label="Label" value={inspector.executorResolution.label} />
                    <InspectorLine label="Sheet" value={inspector.executorResolution.integrationSheet} />
                    <InspectorLine label="Source" value={inspector.executorResolution.sourceKind} />
                    <InspectorLine label="Command" value={inspector.executorResolution.commandPreview} />
                  </>
                ) : null}
                <InspectorLine label="Notice" value={inspector.executorResolution.safetyNotice} />
                {inspector.executorResolution.state === 'unresolved' && (
                  <button
                    type="button"
                    onClick={onConfigureExecutor}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1 border border-amber-300/30 bg-amber-950/25 px-3 py-1.5 text-[11px] font-semibold text-amber-50 hover:border-amber-200/60"
                  >
                    <SlidersHorizontal size={13} />
                    Configure executor
                  </button>
                )}
              </InspectorBlock>
            )}
            <div className="mt-4 rounded border border-amber-300/25 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-100">
              {inspector.reviewFirstActionLabel}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[12px] text-stone-500">
            Select a workflow node to inspect prompts, tools, memory, handoffs, evidence, and gates.
          </div>
        )}
      </aside>
    </div>
  );
}

function SaveWorkflowRunControl({
  projectRoot,
  workItemId,
  saving,
  message,
  error,
  compact = false,
  onWorkItemIdChange,
  onSave,
}: {
  projectRoot?: string;
  workItemId: string;
  saving: boolean;
  message: string | null;
  error: string | null;
  compact?: boolean;
  onWorkItemIdChange: (value: string) => void;
  onSave: () => void;
}) {
  const disabled = saving || !projectRoot || !workItemId.trim();
  return (
    <div className={clsx('space-y-2', compact ? 'w-[280px]' : 'w-full')}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[170px] flex-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
          Feature or work item id
          <input
            value={workItemId}
            onChange={(event) => onWorkItemIdChange(event.target.value)}
            placeholder="F53"
            className="mt-1 w-full border border-stone-200/15 bg-stone-950/80 px-2 py-1.5 font-mono text-[11px] text-stone-100 outline-none focus:border-amber-200/45"
          />
        </label>
        <button
          type="button"
          onClick={onSave}
          disabled={disabled}
          className="inline-flex items-center gap-1 border border-emerald-300/30 bg-emerald-950/30 px-3 py-1.5 text-[11px] font-semibold text-emerald-50 hover:border-emerald-200/60 disabled:cursor-not-allowed disabled:border-stone-200/10 disabled:bg-stone-950/50 disabled:text-stone-600"
        >
          <GitBranch size={13} />
          {saving ? 'Saving...' : 'Save workflow run'}
        </button>
      </div>
      {message && <p className="break-words font-mono text-[10px] text-emerald-200">{message}</p>}
      {error && <p className="break-words font-mono text-[10px] text-red-200">{error}</p>}
      {!projectRoot && <p className="text-[10px] text-stone-500">Select a project before saving workflow runs.</p>}
    </div>
  );
}

function executionModeLabel(mode: ProjectWorkflowRun['executionMode']): string {
  if (mode === 'auto_safe_nodes') return 'auto-run safe nodes';
  if (mode === 'paused') return 'paused';
  return 'manual only';
}

function integrationRowPayload(row: IntegrationRow): Record<string, unknown> {
  return row.payload && typeof row.payload === 'object' ? row.payload : {};
}

function payloadString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function findWorkflowExecutionRequestRow(
  rows: IntegrationRow[],
  workflowRunId: string,
  draftId: string,
  nodeId: string,
): IntegrationRow | undefined {
  return rows.find((row) => {
    const payload = integrationRowPayload(row);
    return (
      payloadString(payload, 'workflowRunId') === workflowRunId &&
      (payloadString(payload, 'draftId') === draftId || payloadString(payload, 'nodeId') === nodeId)
    );
  });
}

function findWorkflowExecutionRecordRow(
  rows: IntegrationRow[],
  workflowRunId: string,
  draftId: string,
  nodeId: string,
  requestId?: string,
): IntegrationRow | undefined {
  return rows.find((row) => {
    const payload = integrationRowPayload(row);
    return (
      payloadString(payload, 'workflowRunId') === workflowRunId &&
      (payloadString(payload, 'draftId') === draftId ||
        payloadString(payload, 'nodeId') === nodeId ||
        (requestId ? payloadString(payload, 'requestId') === requestId : false))
    );
  });
}

function workflowExecutionRequestReviewStatus(row: IntegrationRow): string {
  const payload = integrationRowPayload(row);
  return payloadString(payload, 'reviewStatus') ?? row.category2;
}

function workflowExecutionRequestPolicyState(row: IntegrationRow): string {
  const payload = integrationRowPayload(row);
  const policyGate = payload.policyGate;
  if (policyGate && typeof policyGate === 'object') {
    const state = (policyGate as Record<string, unknown>).state;
    if (typeof state === 'string' && state.trim()) return state;
  }
  return workflowExecutionRequestReviewStatus(row);
}

function workflowExecutionRequestCommandPreview(row: IntegrationRow): string {
  const payload = integrationRowPayload(row);
  return payloadString(payload, 'commandPreview') ?? row.notes ?? 'not captured';
}

function workflowExecutionRecordStatus(row: IntegrationRow): string {
  const payload = integrationRowPayload(row);
  return payloadString(payload, 'status') ?? row.statusLabel ?? row.category2;
}

function workflowExecutionRecordRunnerSummary(row: IntegrationRow): string {
  const payload = integrationRowPayload(row);
  const runnerResult = payload.runnerResult;
  if (!runnerResult || typeof runnerResult !== 'object') return row.statusLabel || 'not captured';
  const runnerPayload = runnerResult as Record<string, unknown>;
  const state = typeof runnerPayload.state === 'string' && runnerPayload.state.trim() ? runnerPayload.state : 'unknown';
  const exitCode = typeof runnerPayload.exitCode === 'number' ? ` · exit ${runnerPayload.exitCode}` : '';
  return `${state}${exitCode}`;
}

function InspectorBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded border border-stone-200/10 bg-stone-950/45 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">{title}</div>
      <div className="mt-2 space-y-1.5">{children}</div>
    </div>
  );
}

function InspectorLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-2 text-[11px] leading-relaxed">
      <span className="text-stone-500">{label}</span>
      <span className="break-words font-mono text-stone-200">{value}</span>
    </div>
  );
}

function DailyLogsSheet({ assistant }: { assistant: AIAssistantConfig }) {
  const [category, setCategory] = useState<DailyLogCategory | 'all'>('all');
  const [severity, setSeverity] = useState<DailyLogSeverity | 'all'>('all');
  const [query, setQuery] = useState('');

  const filtered = assistant.dailyLogs.filter((log) => {
    const categoryMatch = category === 'all' || log.category === category;
    const severityMatch = severity === 'all' || log.severity === severity;
    const queryMatch = !query.trim() || log.message.toLowerCase().includes(query.toLowerCase());
    return categoryMatch && severityMatch && queryMatch;
  });

  const exportLogs = () => {
    const blob = new Blob([filtered.map((log) => JSON.stringify(log)).join('\n')], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${assistant.id}-daily-logs.jsonl`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-full flex-col p-4">
      <div className="flex flex-wrap items-end gap-3 rounded-t border border-b-0 border-stone-200/15 bg-white/[0.03] px-4 py-3">
        <Field label="Category">
          <select className={selectClass} value={category} onChange={(event) => setCategory(event.target.value as DailyLogCategory | 'all')}>
            {LOG_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Severity">
          <select className={selectClass} value={severity} onChange={(event) => setSeverity(event.target.value as DailyLogSeverity | 'all')}>
            {LOG_SEVERITIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Keyword">
          <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search log messages" />
        </Field>
        <button type="button" onClick={exportLogs} className="mb-0.5 rounded border border-stone-200/15 px-3 py-2 text-[11px] font-semibold text-stone-200 hover:border-amber-200/30">
          Export JSONL
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-b border border-stone-200/15 bg-white/[0.03]">
        <table className="w-full min-w-[860px] text-left text-[12px]">
          <thead className="sticky top-0 border-b border-stone-200/10 bg-stone-950 text-[10px] uppercase tracking-[0.1em] text-stone-500">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200/10">
            {filtered.map((log: AssistantDailyLog) => (
              <tr key={log.id}>
                <td className="px-3 py-3 font-mono text-[10px] text-stone-500">{log.timestamp}</td>
                <td className="px-3 py-3 text-stone-300">{log.category}</td>
                <td className="px-3 py-3"><Badge tone={log.severity}>{log.severity}</Badge></td>
                <td className="px-3 py-3 text-stone-300">{log.message}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-stone-500">No logs match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DreamingSheet({
  assistant,
  onUpdateJob,
}: {
  assistant: AIAssistantConfig;
  onUpdateJob: (job: AssistantDreamJob) => void;
}) {
  return (
    <div className="grid min-h-full gap-4 p-4 xl:grid-cols-[1fr_320px]">
      <section className="overflow-hidden rounded border border-stone-200/15 bg-white/[0.03]">
        <table className="w-full min-w-[760px] text-left text-[12px]">
          <thead className="border-b border-stone-200/10 bg-stone-950/60 text-[10px] uppercase tracking-[0.1em] text-stone-500">
            <tr>
              <th className="px-3 py-2">Job</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Progress</th>
              <th className="px-3 py-2">Resources</th>
              <th className="px-3 py-2">Memory Writes</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200/10">
            {assistant.dreamJobs.map((job) => (
              <tr key={job.id}>
                <td className="px-3 py-3">
                  <div className="font-semibold text-stone-100">{job.name}</div>
                  <div className="mt-1 font-mono text-[10px] text-stone-500">{job.taskType}</div>
                </td>
                <td className="px-3 py-3"><Badge tone={job.status}>{job.status}</Badge></td>
                <td className="px-3 py-3">
                  <div className="h-1.5 w-32 rounded bg-stone-800">
                    <div className="h-full rounded bg-emerald-400/70" style={{ width: `${job.progress}%` }} />
                  </div>
                  <span className="mt-1 block text-[10px] text-stone-500">{job.progress}%</span>
                </td>
                <td className="px-3 py-3 text-stone-300">{job.resourceProfile} / {job.concurrencyLimit}</td>
                <td className="px-3 py-3"><Badge tone={job.canMutateMemory ? 'blocked' : 'guarded'}>{job.canMutateMemory ? 'direct' : 'proposal only'}</Badge></td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onUpdateJob({ ...job, status: job.status === 'paused' ? 'queued' : 'paused', updatedAt: new Date().toISOString() })}
                    className="rounded border border-stone-200/15 px-3 py-1.5 text-[11px] font-semibold text-stone-200 hover:border-amber-200/30"
                  >
                    {job.status === 'paused' ? 'Queue' : 'Pause'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <aside className="rounded border border-stone-200/15 bg-white/[0.03]">
        <div className="border-b border-stone-200/10 px-4 py-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-200">Resource Policy</h2>
        </div>
        <div className="space-y-3 p-4 text-[12px] leading-relaxed text-stone-400">
          <p>Foreground chat and gateway health checks keep priority over offline Dreaming jobs.</p>
          <p>Offline tasks may read logs, sessions, and profile sources. Writes must produce reviewable proposals unless a high-risk permission is explicitly granted.</p>
          <p>Default queue concurrency is 1 to avoid competing with local agent runs.</p>
        </div>
      </aside>
    </div>
  );
}

function PermissionsSheet({
  assistant,
  onSave,
}: {
  assistant: AIAssistantConfig;
  onSave: (permission: AssistantPermissionRule) => void;
}) {
  const states: PermissionState[] = ['granted', 'guarded', 'blocked'];
  return (
    <div className="p-4">
      <div className="overflow-hidden rounded border border-stone-200/15 bg-white/[0.03]">
        <table className="w-full min-w-[860px] text-left text-[12px]">
          <thead className="border-b border-stone-200/10 bg-stone-950/60 text-[10px] uppercase tracking-[0.1em] text-stone-500">
            <tr>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Risk</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2">Confirmation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200/10">
            {assistant.permissions.map((permission) => (
              <tr key={permission.id}>
                <td className="px-3 py-3 font-mono text-[11px] text-stone-300">{permission.scope}</td>
                <td className="px-3 py-3 text-stone-400">{permission.description}</td>
                <td className="px-3 py-3"><span className={clsx('rounded border px-2 py-0.5 text-[10px] font-semibold', riskClass(permission.risk))}>{permission.risk}</span></td>
                <td className="px-3 py-3">
                  <select
                    className={selectClass}
                    value={permission.state}
                    onChange={(event) => onSave({ ...permission, state: event.target.value as PermissionState })}
                  >
                    {states.map((state) => <option key={state} value={state}>{state}</option>)}
                  </select>
                </td>
                <td className="px-3 py-3"><Badge tone={permission.requiresConfirmation ? 'guarded' : 'granted'}>{permission.requiresConfirmation ? 'required' : 'not required'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditSheet({ assistant }: { assistant: AIAssistantConfig }) {
  return (
    <div className="p-4">
      <div className="overflow-hidden rounded border border-stone-200/15 bg-white/[0.03]">
        <table className="w-full min-w-[860px] text-left text-[12px]">
          <thead className="border-b border-stone-200/10 bg-stone-950/60 text-[10px] uppercase tracking-[0.1em] text-stone-500">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Risk</th>
              <th className="px-3 py-2">Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200/10">
            {assistant.auditEvents.map((event) => (
              <tr key={event.id}>
                <td className="px-3 py-3 font-mono text-[10px] text-stone-500">{event.timestamp}</td>
                <td className="px-3 py-3 text-stone-300">{event.actor}</td>
                <td className="px-3 py-3 text-stone-300">{event.action}</td>
                <td className="px-3 py-3 font-mono text-[10px] text-stone-500">{event.target}</td>
                <td className="px-3 py-3"><span className={clsx('rounded border px-2 py-0.5 text-[10px] font-semibold', riskClass(event.risk))}>{event.risk}</span></td>
                <td className="px-3 py-3"><Badge tone={event.outcome}>{event.outcome}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Header({ assistant }: { assistant: AIAssistantConfig }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-amber-100" />
          <h1 className="text-xl font-semibold text-stone-100">AI Assistants Control Console</h1>
        </div>
        <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-stone-400">
          Manage assistant instances, profile sources, skills, daily logs, offline Dreaming jobs, permissions, and audit history.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={assistant.status}>{assistant.status}</Badge>
        <Badge tone={assistant.instance.gatewayTokenStatus}>{assistant.instance.gatewayTokenStatus}</Badge>
        <span className="rounded border border-stone-200/15 px-2.5 py-1 text-[11px] text-stone-400">{assistant.name}</span>
      </div>
    </div>
  );
}

function Toolbar({
  state,
  assistant,
  onSelectAssistant,
  onReset,
}: {
  state: AIAssistantsConsoleState;
  assistant: AIAssistantConfig;
  onSelectAssistant: (id: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/15 bg-white/[0.03] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded border border-stone-200/15 bg-stone-950/70 px-3 py-1.5 text-[12px] text-stone-100 outline-none" value={assistant.id} onChange={(event) => onSelectAssistant(event.target.value)}>
          {state.assistants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <span className="flex items-center gap-1 rounded border border-stone-200/15 px-2 py-1 text-[11px] text-stone-400"><Database size={12} /> local registry</span>
        <span className="flex items-center gap-1 rounded border border-amber-300/25 bg-amber-950/20 px-2 py-1 text-[11px] text-amber-100"><LockKeyhole size={12} /> secret refs only</span>
      </div>
      <button type="button" onClick={onReset} className="flex items-center gap-1 rounded border border-stone-200/15 px-3 py-1.5 text-[11px] font-semibold text-stone-200 hover:border-amber-200/30">
        <RefreshCw size={12} /> Reset local console data
      </button>
    </div>
  );
}

export function AIAssistantsConsoleClient({
  initialChatContext,
  activeSheet = 'chat',
  engineersPanel,
  projectRoot,
  initialWorkflowRuns,
  initialProjectWorkflowRuns,
}: AIAssistantsConsoleClientProps) {
  const router = useRouter();
  const [state, setState] = useState<AIAssistantsConsoleState>(createDefaultConsoleState);
  const [consoleHydrated, setConsoleHydrated] = useState(false);
  const selectedAssistant = state.assistants.find((assistant) => assistant.id === state.selectedAssistantId) ?? state.assistants[0];

  useEffect(() => {
    setState(loadAIAssistantsConsoleState());
    setConsoleHydrated(true);
  }, []);

  useEffect(() => {
    if (!consoleHydrated) return;
    saveAIAssistantsConsoleState(state);
  }, [state, consoleHydrated]);

  useEffect(() => {
    if (!consoleHydrated || !projectRoot || !selectedAssistant) return;
    const assistantId = selectedAssistant.id;
    let cancelled = false;
    Promise.all([
      import('../../lib/ai-assistants/terminalBoundariesSidecar').then(({ loadTerminalBoundariesSidecar }) =>
        loadTerminalBoundariesSidecar(projectRoot, assistantId),
      ),
      loadTerminalBlockSuggestions(projectRoot, assistantId),
    ])
      .then(([sidecar, blockSuggestions]) => {
        if (cancelled) return;
        setState((prev) =>
          updateAssistant(prev, assistantId, (assistant) => ({
            ...assistant,
            terminalBoundaries: sidecar ?? assistant.terminalBoundaries,
            terminalBlockSuggestions:
              blockSuggestions.length > 0 ? blockSuggestions : assistant.terminalBlockSuggestions,
          })),
        );
      })
      .catch(() => {
        // Sidecar load is optional; defaults remain in local console state.
      });
    return () => {
      cancelled = true;
    };
  }, [consoleHydrated, projectRoot, selectedAssistant?.id]);

  if (!selectedAssistant) return null;

  const updateSelected = (updater: (assistant: AIAssistantConfig) => AIAssistantConfig) => {
    setState((prev) => updateAssistant(prev, selectedAssistant.id, updater));
  };

  const onSelectSheet = (sheet: AIAssistantSheetId) => {
    router.push(sheetHref(sheet));
  };

  const onReset = () => {
    window.localStorage.removeItem('projectManager:ai-assistants-console:v1');
    setState(loadAIAssistantsConsoleState());
  };

  const tabs = SHEET_TABS.map((tab) => {
    if (tab.key === 'daily-logs') {
      return { ...tab, badge: selectedAssistant.dailyLogs.filter((log) => log.severity !== 'info').length };
    }
    if (tab.key === 'permissions') {
      return { ...tab, badge: selectedAssistant.permissions.filter((permission) => permission.state === 'blocked').length };
    }
    return tab;
  });

  const effectiveSheet: AIAssistantSheetId = activeSheet === 'instances' ? 'overview' : activeSheet;

  let content: React.ReactNode;
  if (activeSheet === 'chat') {
    content = <ChatPageClient initialChatContext={initialChatContext} embedded />;
  } else if (effectiveSheet === 'engineers') {
    content = engineersPanel ?? (
      <div className="flex h-full items-center justify-center p-6 text-[12px] text-stone-400">
        Select a project to manage AI engineer roles.
      </div>
    );
  } else if (effectiveSheet === 'overview') {
    content = (
      <OverviewSheet
        assistant={selectedAssistant}
        projectRoot={projectRoot}
        onSaveInstance={(instance) => updateSelected((assistant) => updateAssistantInstance(assistant, instance))}
        onSaveTerminalBoundaries={(boundaries) =>
          updateSelected((assistant) => updateTerminalBoundaries(assistant, boundaries))
        }
        onUpdateBlockSuggestions={(suggestions) =>
          updateSelected((assistant) => updateTerminalBlockSuggestions(assistant, suggestions))
        }
      />
    );
  } else if (effectiveSheet === 'profile') {
    content = <ProfileSheet assistant={selectedAssistant} onSave={(source) => updateSelected((assistant) => updateProfileSource(assistant, source))} />;
  } else if (effectiveSheet === 'skills') {
    content = <SkillsSheet assistant={selectedAssistant} onToggle={(skill) => updateSelected((assistant) => updateSkill(assistant, skill))} />;
  } else if (effectiveSheet === 'workflow-runs') {
    content = (
      <WorkflowRunsSheet
        projectRoot={projectRoot}
        initialWorkflowRuns={initialWorkflowRuns}
        initialProjectWorkflowRuns={initialProjectWorkflowRuns}
      />
    );
  } else if (effectiveSheet === 'daily-logs') {
    content = <DailyLogsSheet assistant={selectedAssistant} />;
  } else if (effectiveSheet === 'dreaming') {
    content = (
      <DreamingSheet
        assistant={selectedAssistant}
        onUpdateJob={(job) =>
          updateSelected((assistant) =>
            appendAuditEvent(
              {
                ...assistant,
                dreamJobs: assistant.dreamJobs.map((item) => (item.id === job.id ? job : item)),
                updatedAt: new Date().toISOString(),
              },
              {
                actor: 'user',
                action: `Updated Dreaming job ${job.name}`,
                target: job.id,
                risk: job.canMutateMemory ? 'high' : 'medium',
                outcome: 'recorded',
              },
            ),
          )
        }
      />
    );
  } else if (effectiveSheet === 'permissions') {
    content = <PermissionsSheet assistant={selectedAssistant} onSave={(permission) => updateSelected((assistant) => updatePermission(assistant, permission))} />;
  } else {
    content = <AuditSheet assistant={selectedAssistant} />;
  }

  const showAssistantChrome = effectiveSheet !== 'engineers';

  return (
    <WorkstationFrame
      reservedRem={7.5}
      header={showAssistantChrome ? <Header assistant={selectedAssistant} /> : undefined}
      toolbar={
        showAssistantChrome ? (
          <Toolbar
            state={state}
            assistant={selectedAssistant}
            onSelectAssistant={(id) => setState((prev) => ({ ...prev, selectedAssistantId: id }))}
            onReset={onReset}
          />
        ) : undefined
      }
      bottomTabs={
        <BottomSheetTabs
          tabs={tabs}
          activeKey={effectiveSheet}
          onSelect={onSelectSheet}
          reorderable
          orderStorageKey={AI_ASSISTANTS_SHEET_ORDER_STORAGE_KEY}
        />
      }
      scrollChildren={false}
      panelClassName="rounded border border-stone-200/15 bg-stone-950/30"
    >
      <div className="h-full min-h-0 overflow-hidden">
        {content}
      </div>
    </WorkstationFrame>
  );
}
