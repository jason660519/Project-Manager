'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  Boxes,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  FolderOpen,
  GitBranch,
  Layers3,
  Loader2,
  Package,
  PanelsTopLeft,
  Play,
  Route,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { openPath } from '../../../lib/bridge';
import { buildGovernedAppsMetric } from '../../../lib/companyStandards/governedProjectsMetric';
import {
  STANDARDS_GATES_REGISTRY,
  resolveGateIcon,
  type GateRunAllProgress,
  type GateRunPhase,
  type StandardsGateDefinition,
  type StandardsGateId,
} from '../../../lib/companyStandards/standardsGates';

export type { GateRunAllProgress, GateRunPhase };
import { useI18n } from '../../../lib/i18n';
import type { ProjectEntry } from '../../../lib/types';

const PROJECT_ROOT = '/Users/Project-Manager';
const STANDARDS_ROOT = '/Users/Company-AI-App-Standards';
const CONTRACT_DOC =
  `${PROJECT_ROOT}/docs/integrations/company-standards-plugin-contract.md`;
const COMPANY_UI_DOC = `${STANDARDS_ROOT}/docs/ui-design-system.md`;
const COMPANY_MULTI_APP_DOC = `${STANDARDS_ROOT}/docs/multi-app-integration.md`;
const BASELINE_DOC = `${STANDARDS_ROOT}/docs/patterns/table-governance.md`;
const PROFILE_DOC = `${STANDARDS_ROOT}/docs/patterns/project-manager-table-profile.md`;
const PM_DESIGN_DOC = `${PROJECT_ROOT}/DESIGN.md`;
const PM_SHARED_STYLE_DOC =
  `${PROJECT_ROOT}/docs/design/shared-ai-desktop-style.md`;

type Tone = 'emerald' | 'cyan' | 'amber' | 'blue' | 'stone';

interface Metric {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}

interface StandardLayer {
  title: string;
  owner: string;
  purpose: string;
  examples: string[];
  icon: LucideIcon;
  tone: Tone;
}

interface AppProfile {
  mark: string;
  name: string;
  role: string;
  shared: string;
  override: string;
  status: 'wired' | 'profile-needed' | 'reference';
}

interface PackageLane {
  label: string;
  stage: 'now' | 'next' | 'later';
  detail: string;
  icon: LucideIcon;
}

interface ResourceLink {
  label: string;
  detail: string;
  path: string;
  icon: LucideIcon;
}

const TONE_STYLES: Record<Tone, { border: string; bg: string; text: string; icon: string }> = {
  emerald: {
    border: 'border-emerald-300/25',
    bg: 'bg-emerald-950/30',
    text: 'text-emerald-200',
    icon: 'text-emerald-300',
  },
  cyan: {
    border: 'border-cyan-300/25',
    bg: 'bg-cyan-950/25',
    text: 'text-cyan-200',
    icon: 'text-cyan-300',
  },
  amber: {
    border: 'border-amber-200/25',
    bg: 'bg-amber-950/25',
    text: 'text-amber-100',
    icon: 'text-amber-200',
  },
  blue: {
    border: 'border-blue-300/25',
    bg: 'bg-blue-950/25',
    text: 'text-blue-200',
    icon: 'text-blue-300',
  },
  stone: {
    border: 'border-stone-200/15',
    bg: 'bg-white/[0.045]',
    text: 'text-stone-200',
    icon: 'text-stone-300',
  },
};

const STATIC_METRICS: Metric[] = [
  {
    label: 'Baseline',
    value: 'v0.2',
    detail: 'Company AI app rules',
    tone: 'emerald',
  },
  {
    label: 'PM Profile',
    value: 'Active',
    detail: 'Repo-local override layer',
    tone: 'amber',
  },
  {
    label: 'Runtime',
    value: 'Optional',
    detail: 'Docs fallback when provider is offline',
    tone: 'blue',
  },
];

const STANDARD_LAYERS: StandardLayer[] = [
  {
    title: 'Foundations',
    owner: 'Company baseline',
    purpose: 'Tokens, typography, spacing, accessibility, iconography, and shell rules shared across apps.',
    examples: ['color tokens', 'type scale', 'desktop shell', 'status semantics'],
    icon: Layers3,
    tone: 'emerald',
  },
  {
    title: 'Components',
    owner: 'Company baseline first',
    purpose: 'Reusable UI contracts before code extraction: buttons, badges, panels, forms, tables, modals.',
    examples: ['table contract', 'resource links', 'modal risk copy', 'empty states'],
    icon: PanelsTopLeft,
    tone: 'cyan',
  },
  {
    title: 'Patterns',
    owner: 'Cross-app UX',
    purpose: 'Repeatable workflows for AI apps, plugin contracts, evidence review, secrets, and guarded execution.',
    examples: ['agent execution', 'plugin contracts', 'secrets UX', 'evidence-first review'],
    icon: Route,
    tone: 'blue',
  },
  {
    title: 'App Profiles',
    owner: 'Each app repo',
    purpose: 'Product-specific personality and exceptions without weakening the company baseline.',
    examples: ['Project Manager dashboard density', 'SayDo voice pipeline', 'Realestate evidence flow'],
    icon: Boxes,
    tone: 'amber',
  },
  {
    title: 'Governance',
    owner: 'Executable standards',
    purpose: 'Checks, reports, ADRs, templates, and version gates that keep rules from becoming advice-only docs.',
    examples: ['i18n:check', 'standards:check', 'docs:check', 'P0/P1/P2'],
    icon: ShieldCheck,
    tone: 'stone',
  },
];

const APP_PROFILES: AppProfile[] = [
  {
    mark: 'PM',
    name: 'Project Manager',
    role: 'AI engineering operations dashboard',
    shared: 'Company shell, dense operational panels, explicit risk/status states.',
    override: 'Table-first workflow, guarded agent dispatch, project/process docs visible near execution.',
    status: 'wired',
  },
  {
    mark: 'SD',
    name: 'SayDo',
    role: 'Local-first voice-to-action assistant',
    shared: 'Same calm desktop language, secrets UX, provider/key visibility.',
    override: 'Recording pipeline, privacy-preserving local state, realtime interruption-first conversation.',
    status: 'profile-needed',
  },
  {
    mark: 'RE',
    name: 'Realestate Management',
    role: 'Evidence-first property operations app',
    shared: 'Shared AI desktop shell and visible degraded/fallback state.',
    override: 'Document source evidence, confidence gates, human confirmation before canonical save.',
    status: 'profile-needed',
  },
  {
    mark: 'CS',
    name: 'Company Standards',
    role: 'Reference, compliance, template, and provider app',
    shared: 'Dogfoods every baseline rule it publishes.',
    override: 'Reference pages use full-width content, sticky TOC, scan summaries, and release-phase labels.',
    status: 'reference',
  },
];

const PACKAGE_LANES: PackageLane[] = [
  {
    label: '@company-ai/standards-manifest',
    stage: 'now',
    detail: 'Machine-readable index of foundations, components, patterns, app profiles, checks, and resource paths.',
    icon: FileText,
  },
  {
    label: '@company-ai/tokens',
    stage: 'next',
    detail: 'Shared CSS variables or Tailwind preset after token names settle across Project Manager and SayDo.',
    icon: Sparkles,
  },
  {
    label: '@company-ai/standards-checks',
    stage: 'next',
    detail:
      'Reusable checker package behind standards:check, standards:doctor, standards:report, UI i18n, and hardcoded-copy gates.',
    icon: ScanSearch,
  },
  {
    label: '@company-ai/ui-primitives',
    stage: 'later',
    detail: 'Extract only after two or more apps converge on the same framework-level component contracts.',
    icon: Package,
  },
];

const RESOURCES: ResourceLink[] = [
  {
    label: 'Standards Repo',
    detail: 'Company source of truth, templates, scripts, and baseline docs.',
    path: STANDARDS_ROOT,
    icon: FolderOpen,
  },
  {
    label: 'Company UI Baseline',
    detail: 'Current shared design rules and token table.',
    path: COMPANY_UI_DOC,
    icon: FileText,
  },
  {
    label: 'Multi-App Integration',
    detail: 'Plugin contracts, runtime isolation, and cross-app reliability rules.',
    path: COMPANY_MULTI_APP_DOC,
    icon: FileText,
  },
  {
    label: 'PM Plugin Contract',
    detail: 'How Project Manager consumes standards profiles and checks.',
    path: CONTRACT_DOC,
    icon: FileText,
  },
  {
    label: 'Table Governance',
    detail: 'Company table baseline for dense operational data.',
    path: BASELINE_DOC,
    icon: FileText,
  },
  {
    label: 'PM Table Profile',
    detail: 'Project Manager-specific table behavior and implementation references.',
    path: PROFILE_DOC,
    icon: FileText,
  },
  {
    label: 'PM Design Guide',
    detail: 'Repo-local product personality, shell, layout, and UX rules.',
    path: PM_DESIGN_DOC,
    icon: FileText,
  },
  {
    label: 'Shared AI Desktop Style',
    detail: 'Current family-level visual language that should move upstream over time.',
    path: PM_SHARED_STYLE_DOC,
    icon: FileText,
  },
];

function stageLabel(stage: PackageLane['stage']) {
  if (stage === 'now') return 'Now';
  if (stage === 'next') return 'Next';
  return 'Later';
}

function stageClass(stage: PackageLane['stage']) {
  if (stage === 'now') return 'border-emerald-300/25 bg-emerald-950/35 text-emerald-200';
  if (stage === 'next') return 'border-cyan-300/25 bg-cyan-950/25 text-cyan-200';
  return 'border-stone-200/15 bg-white/[0.04] text-stone-300';
}

function profileStatusLabel(status: AppProfile['status']) {
  if (status === 'wired') return 'Wired';
  if (status === 'reference') return 'Reference';
  return 'Needs profile';
}

function profileStatusClass(status: AppProfile['status']) {
  if (status === 'wired') return 'border-emerald-300/25 bg-emerald-950/35 text-emerald-200';
  if (status === 'reference') return 'border-blue-300/25 bg-blue-950/25 text-blue-200';
  return 'border-amber-200/25 bg-amber-950/25 text-amber-100';
}

export interface CompanyStandardsViewProps {
  /** Same scope as Project Progress Dashboard (`effectiveDashboardProjects` in MainClient). */
  dashboardScopeProjects: ProjectEntry[];
  canRunGates: boolean;
  gatePhases: Partial<Record<StandardsGateId, GateRunPhase>>;
  runAllProgress: GateRunAllProgress | null;
  gateRunMessage: string | null;
  anyGateRunning: boolean;
  onRunGate: (gateId: StandardsGateId) => void;
  onRunAllBlocking: () => void;
}

export function CompanyStandardsView({
  dashboardScopeProjects,
  canRunGates,
  gatePhases,
  runAllProgress,
  gateRunMessage,
  anyGateRunning,
  onRunGate,
  onRunAllBlocking,
}: CompanyStandardsViewProps) {
  const { t } = useI18n();
  const g = t.companyStandards.gates;
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const copyHintTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyHintTimerRef.current !== null) window.clearTimeout(copyHintTimerRef.current);
    },
    [],
  );

  const handleOpen = (path: string) => {
    void openPath(path).catch(() => {});
  };

  const handleCopyCommand = useCallback(
    (command: string) => {
      void navigator.clipboard?.writeText(command).then(
        () => {
          setCopyHint(g.copied);
          if (copyHintTimerRef.current !== null) window.clearTimeout(copyHintTimerRef.current);
          copyHintTimerRef.current = window.setTimeout(() => {
            setCopyHint(null);
            copyHintTimerRef.current = null;
          }, 2000);
        },
        () => {
          setCopyHint(null);
        },
      );
    },
    [g.copied],
  );

  const blockingCount = useMemo(
    () => STANDARDS_GATES_REGISTRY.filter((gate) => gate.blocking).length,
    [],
  );

  const metrics = useMemo<Metric[]>(() => {
    const governed = buildGovernedAppsMetric(dashboardScopeProjects);
    return [
      STATIC_METRICS[0],
      {
        label: 'Governed Apps',
        value: governed.value,
        detail: governed.detail,
        tone: 'cyan',
      },
      ...STATIC_METRICS.slice(1),
    ];
  }, [dashboardScopeProjects]);

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-[1180px] flex-col gap-5 overflow-y-auto px-4 py-5 text-stone-100 sm:px-5 lg:px-6">
      <header className="border border-stone-200/12 bg-[rgb(var(--pm-panel))]/72 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 border border-emerald-300/25 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
            <ShieldCheck size={13} />
            Governance Hub
          </span>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-normal text-stone-50 sm:text-[28px]">
          Company Standards Hub
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-300">
          Shared company standards should live above app-specific design guides: common
          foundations, component contracts, patterns, governance, and executable checks belong in
          the standards repo; each app keeps only its profile, overrides, and ADR-backed
          deviations.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="border border-stone-200/12 bg-[rgb(var(--pm-panel))]/62">
        <SectionHeader
          icon={Terminal}
          eyebrow="Current project gates"
          title={g.sectionTitle}
          detail={g.sectionDetail}
          actions={
            <button
              type="button"
              disabled={!canRunGates || anyGateRunning}
              onClick={onRunAllBlocking}
              className="inline-flex items-center gap-1.5 border border-emerald-200/25 bg-emerald-100/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-100 hover:bg-emerald-100/18 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {anyGateRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {g.runAllBlocking}
            </button>
          }
        />
        {!canRunGates ? (
          <p className="border-b border-stone-200/10 px-4 pb-3 text-xs leading-5 text-amber-100/90">
            {g.desktopRequired}
          </p>
        ) : null}
        {gateRunMessage ? (
          <p className="border-b border-stone-200/10 px-4 pb-3 text-xs leading-5 text-red-200/90">
            {gateRunMessage}
          </p>
        ) : null}
        {runAllProgress?.active && runAllProgress.currentLabel ? (
          <p className="border-b border-stone-200/10 px-4 pb-3 text-xs text-stone-400">
            {g.runAllProgress
              .replace('{current}', runAllProgress.currentLabel)
              .replace('{index}', String(runAllProgress.index))
              .replace('{total}', String(runAllProgress.total))}
          </p>
        ) : null}
        {copyHint ? (
          <p className="border-b border-stone-200/10 px-4 pb-3 text-xs text-emerald-200/90">{copyHint}</p>
        ) : null}
        <div className="grid gap-3 p-4 lg:grid-cols-2">
          {STANDARDS_GATES_REGISTRY.map((gate) => (
            <StandardsGateCard
              key={gate.id}
              gate={gate}
              phase={gatePhases[gate.id] ?? 'idle'}
              canRun={canRunGates && gate.npmScript !== null}
              anyGateRunning={anyGateRunning}
              labels={g}
              onRun={() => onRunGate(gate.id)}
              onCopy={() => handleCopyCommand(gate.displayCommand)}
            />
          ))}
        </div>
        <p className="border-t border-stone-200/10 px-4 py-2 text-[10px] text-stone-500">
          {blockingCount} blocking gates · advisory gates are copy-only in v1
        </p>
      </section>

      <section className="border border-stone-200/12 bg-[rgb(var(--pm-panel))]/62">
        <SectionHeader
          icon={Layers3}
          eyebrow="Recommended information architecture"
          title="Separate Common Standards From App Profiles"
          detail="This is the target structure for multi-app governance: one company baseline, narrow package extraction, and app-local profiles for product-specific behavior."
        />
        <div className="grid gap-3 p-4 lg:grid-cols-5">
          {STANDARD_LAYERS.map((layer) => (
            <LayerCard key={layer.title} layer={layer} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="border border-stone-200/12 bg-[rgb(var(--pm-panel))]/62">
          <SectionHeader
            icon={BadgeCheck}
            eyebrow="App family profiles"
            title="What Stays Shared, What Becomes App-Specific"
            detail="Profiles should document product personality and stricter local rules without duplicating the full company standard."
          />
          <div className="divide-y divide-stone-200/10">
            {APP_PROFILES.map((profile) => (
              <ProfileRow key={profile.name} profile={profile} />
            ))}
          </div>
        </div>

        <div className="border border-stone-200/12 bg-[rgb(var(--pm-panel))]/62">
          <SectionHeader
            icon={GitBranch}
            eyebrow="Extraction order"
            title="Package Only What Has Stabilized"
            detail="Start with manifests, tokens, and checks. Shared UI code should come later, after framework-level convergence."
          />
          <div className="flex flex-col gap-3 p-4">
            {PACKAGE_LANES.map((lane) => (
              <PackageLaneCard key={lane.label} lane={lane} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="border border-stone-200/12 bg-[rgb(var(--pm-panel))]/62 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-amber-200/25 bg-amber-950/20 text-amber-100">
              <CheckCircle2 size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                Implementation stance
              </p>
              <h2 className="mt-1 text-sm font-semibold text-stone-50">
                Redesign standards before extracting components
              </h2>
              <p className="mt-2 text-xs leading-5 text-stone-400">
                Project Manager uses Next, Tailwind, and lucide. The standards app currently uses
                Vite, Mantine, and Tabler. A shared component package would be premature until the
                common contracts and token names are stable across at least two product apps.
              </p>
            </div>
          </div>
        </div>

        <div className="border border-stone-200/12 bg-[rgb(var(--pm-panel))]/62">
          <SectionHeader
            icon={FolderOpen}
            eyebrow="Canonical resources"
            title="Open Standards Sources"
            detail="These are the current source files behind the hub. Raw paths are secondary; the hub should expose the decision layer first."
          />
          <div className="grid gap-2 p-4 md:grid-cols-2">
            {RESOURCES.map((resource) => (
              <ResourceButton
                key={resource.path}
                resource={resource}
                onOpen={() => handleOpen(resource.path)}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  detail,
  actions,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  detail: string;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-stone-200/10 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon size={14} className="text-stone-400" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              {eyebrow}
            </p>
          </div>
          <h2 className="mt-1 text-sm font-semibold text-stone-50">{title}</h2>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-stone-400">{detail}</p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  const tone = TONE_STYLES[metric.tone];
  return (
    <div className={`border ${tone.border} ${tone.bg} p-3`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
        {metric.label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${tone.text}`}>{metric.value}</p>
      <p className="mt-1 text-[11px] leading-4 text-stone-400">{metric.detail}</p>
    </div>
  );
}

import type { Translations } from '../../../lib/i18n/types';

type GateCardLabels = Translations['companyStandards']['gates'];

function runPhaseLabel(phase: GateRunPhase, labels: GateCardLabels): string | null {
  if (phase === 'running') return labels.running;
  if (phase === 'pass') return labels.pass;
  if (phase === 'fail') return labels.fail;
  if (phase === 'skipped') return labels.skipped;
  if (phase === 'blocked') return labels.blocked;
  return null;
}

function runPhaseClass(phase: GateRunPhase): string {
  if (phase === 'pass') return 'border-emerald-300/35 text-emerald-200';
  if (phase === 'fail' || phase === 'blocked') return 'border-red-300/35 text-red-200';
  if (phase === 'running') return 'border-cyan-300/35 text-cyan-200';
  if (phase === 'skipped') return 'border-stone-200/20 text-stone-400';
  return '';
}

function StandardsGateCard({
  gate,
  phase,
  canRun,
  anyGateRunning,
  labels,
  onRun,
  onCopy,
}: {
  gate: StandardsGateDefinition;
  phase: GateRunPhase;
  canRun: boolean;
  anyGateRunning: boolean;
  labels: GateCardLabels;
  onRun: () => void;
  onCopy: () => void;
}) {
  const tone = TONE_STYLES[gate.statusTone];
  const Icon = resolveGateIcon(gate.iconKey);
  const resultLabel = runPhaseLabel(phase, labels);
  const runnable = gate.npmScript !== null;

  return (
    <article className={`min-w-0 border ${tone.border} ${tone.bg} p-3`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center border ${tone.border} bg-[rgb(var(--pm-input))] ${tone.icon}`}
        >
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-stone-50">{gate.label}</h3>
            <span
              className={`border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${tone.border} ${tone.text}`}
            >
              {gate.catalogStatus}
            </span>
            {resultLabel ? (
              <span
                className={`border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${runPhaseClass(phase)}`}
              >
                {resultLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            {gate.scope}
          </p>
          <code className="mt-2 block truncate border border-stone-200/12 bg-black/20 px-2 py-1 font-mono text-[11px] text-stone-200">
            {gate.displayCommand}
          </code>
          <p className="mt-2 text-xs leading-5 text-stone-400">{gate.detail}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {gate.tags.map((tag) => (
              <span
                key={tag}
                className="border border-stone-200/12 bg-[rgb(var(--pm-input))]/75 px-2 py-0.5 text-[10px] text-stone-300"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canRun || !runnable || anyGateRunning || phase === 'running'}
              title={!runnable ? labels.notRunnable : undefined}
              onClick={onRun}
              className="inline-flex items-center gap-1 border border-emerald-200/25 bg-emerald-100/10 px-2 py-1 text-[11px] font-medium text-emerald-100 hover:bg-emerald-100/18 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {phase === 'running' ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Play size={11} />
              )}
              {labels.runGate}
            </button>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1 border border-stone-200/15 bg-white/[0.04] px-2 py-1 text-[11px] text-stone-300 hover:border-stone-200/25 hover:text-stone-100"
            >
              <Copy size={11} />
              {labels.copyCommand}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function LayerCard({ layer }: { layer: StandardLayer }) {
  const tone = TONE_STYLES[layer.tone];
  return (
    <article className={`min-w-0 border ${tone.border} ${tone.bg} p-3`}>
      <div className="flex items-center justify-between gap-3">
        <layer.icon size={16} className={tone.icon} />
        <span className={`border ${tone.border} px-2 py-0.5 text-[10px] ${tone.text}`}>
          {layer.owner}
        </span>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-stone-50">{layer.title}</h3>
      <p className="mt-2 text-xs leading-5 text-stone-400">{layer.purpose}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {layer.examples.map((example) => (
          <span
            key={example}
            className="border border-stone-200/12 bg-[rgb(var(--pm-input))]/75 px-2 py-0.5 text-[10px] text-stone-300"
          >
            {example}
          </span>
        ))}
      </div>
    </article>
  );
}

function ProfileRow({ profile }: { profile: AppProfile }) {
  return (
    <article className="grid gap-3 p-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-amber-200/25 bg-[rgb(var(--pm-input))] font-mono text-[10px] font-semibold tracking-[0.12em] text-amber-100">
          {profile.mark}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-stone-50">{profile.name}</h3>
            <span
              className={`border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${profileStatusClass(profile.status)}`}
            >
              {profileStatusLabel(profile.status)}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-stone-400">{profile.role}</p>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
          Shared baseline
        </p>
        <p className="mt-1 text-xs leading-5 text-stone-300">{profile.shared}</p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
          App profile override
        </p>
        <p className="mt-1 text-xs leading-5 text-stone-300">{profile.override}</p>
      </div>
    </article>
  );
}

function PackageLaneCard({ lane }: { lane: PackageLane }) {
  return (
    <article className="border border-stone-200/12 bg-white/[0.035] p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-stone-200/14 bg-[rgb(var(--pm-input))] text-stone-300">
          <lane.icon size={15} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words font-mono text-[11px] font-semibold text-stone-100">
              {lane.label}
            </h3>
            <span
              className={`border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${stageClass(lane.stage)}`}
            >
              {stageLabel(lane.stage)}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-stone-400">{lane.detail}</p>
        </div>
      </div>
    </article>
  );
}

function ResourceButton({
  resource,
  onOpen,
}: {
  resource: ResourceLink;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-w-0 items-start gap-3 border border-stone-200/12 bg-white/[0.035] p-3 text-left transition-colors hover:border-emerald-300/35 hover:bg-emerald-950/15"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-stone-200/14 bg-[rgb(var(--pm-input))] text-stone-400 group-hover:text-emerald-200">
        <resource.icon size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-xs font-semibold text-stone-100">
          {resource.label}
          <ExternalLink size={12} className="shrink-0 text-stone-500" />
        </span>
        <span className="mt-1 block text-[11px] leading-4 text-stone-400">{resource.detail}</span>
        <span className="mt-2 block truncate font-mono text-[10px] text-stone-600">
          {resource.path}
        </span>
      </span>
    </button>
  );
}
