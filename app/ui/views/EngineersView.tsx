'use client';

import { useEffect, useState } from 'react';
import { Loader2, Play, Plus, RefreshCw, Sparkles, Trash2, Users2, Workflow, X } from 'lucide-react';
import { DEFAULT_AGENT_WORKFLOWS } from '../../../lib/agent-workflows';
import { DEFAULT_ENGINEER_ROLES } from '../../../lib/defaults/engineerRoles';
import { listLlmProviders, type LlmProviderId } from '../../../lib/keys/llmProviders';
import { hasProviderKey, loadProviderKey } from '../../../lib/keys/loadProviderKey';
import { loadProviderOrder, type ProviderOrderEntry } from '../../../lib/keys/providerOrder';
import { callSingleProvider } from '../../../lib/scanner/runProjectScan';
import type { AnyAdapterConfig, EngineerRole } from '../../../lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return typeof crypto !== 'undefined'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const SLUG_COLORS: Record<string, string> = {
  frontend:  'border-cyan-300/35 text-cyan-300/80',
  backend:   'border-emerald-300/35 text-emerald-300/80',
  fullstack: 'border-violet-300/35 text-violet-300/80',
  qa:        'border-amber-300/35 text-amber-300/80',
  devops:    'border-orange-300/35 text-orange-300/80',
  devex:     'border-sky-300/35 text-sky-300/80',
};

function slugColor(slug: string): string {
  return SLUG_COLORS[slug] ?? 'border-stone-300/35 text-stone-300/80';
}

const MODE_COLORS: Record<string, string> = {
  'plan-only': 'border-sky-300/30 text-sky-200/80',
  'review-only': 'border-amber-300/30 text-amber-200/80',
  'guarded-execution': 'border-emerald-300/30 text-emerald-200/80',
  'ship-readiness': 'border-blue-300/30 text-blue-200/80',
  learning: 'border-stone-300/30 text-stone-200/75',
};

function modeColor(mode: string): string {
  return MODE_COLORS[mode] ?? 'border-stone-300/30 text-stone-200/75';
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  slug: string;
  skills: string;
  systemPrompt: string;
  defaultAgentId: string;
  notes: string;
  testProviderId: string;
  testModel: string;
  testPrompt: string;
}

function roleToForm(role: EngineerRole): FormState {
  return {
    name: role.name,
    slug: role.slug,
    skills: role.skills.join('\n'),
    systemPrompt: role.systemPrompt,
    defaultAgentId: role.defaultAgentId ?? '',
    notes: role.notes ?? '',
    testProviderId: role.testProviderId ?? '',
    testModel: role.testModel ?? '',
    testPrompt: role.testPrompt ?? '',
  };
}

function formToRole(id: string, form: FormState, existing: EngineerRole): EngineerRole {
  return {
    id,
    name: form.name || 'Unnamed Role',
    slug: form.slug || slugify(form.name) || 'role',
    skills: form.skills.split('\n').map((s) => s.trim()).filter(Boolean),
    commands: existing.commands,
    systemPrompt: form.systemPrompt,
    referenceFiles: existing.referenceFiles,
    defaultAgentId: form.defaultAgentId || undefined,
    notes: form.notes || undefined,
    testProviderId: form.testProviderId || undefined,
    testModel: form.testModel || undefined,
    testPrompt: form.testPrompt || undefined,
  };
}

// Build a sensible default test prompt from the current form values. The user
// can override by typing into the textarea; empty falls back to this output.
function buildDefaultTestPrompt(form: FormState): string {
  const skills = form.skills.split('\n').map((s) => s.trim()).filter(Boolean);
  const systemPrompt = form.systemPrompt.trim();
  const lines: (string | null)[] = [
    `You are a ${form.name || 'engineer'}.`,
    skills.length > 0 ? `Your skills: ${skills.join(', ')}.` : null,
    systemPrompt ? `Operating context: ${systemPrompt}` : null,
    '',
    'Reply briefly to confirm:',
    '1. Your role in one sentence.',
    '2. Three things you would check first when given a new task.',
    '3. One question you would ask the human before starting.',
  ];
  return lines.filter((l): l is string => l !== null).join('\n');
}

// UI-only state for the test playground inside DetailPanel.
interface PlaygroundResult {
  content?: string;
  error?: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  model: string;
  provider: LlmProviderId;
  at: number;
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const inputCls =
  'w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35 placeholder:text-stone-600';

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">{label}</label>
        {hint && <span className="text-[10px] text-stone-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

interface DetailPanelProps {
  role: EngineerRole;
  agents: AnyAdapterConfig[];
  onSave: (updated: EngineerRole) => void;
  onDelete: () => void;
}

function DetailPanel({ role, agents, onSave, onDelete }: DetailPanelProps) {
  const [form, setForm] = useState<FormState>(() => roleToForm(role));
  const [dirty, setDirty] = useState(false);

  // ── Test playground state ───────────────────────────────────────────────────
  const [isTauri, setIsTauri] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<PlaygroundResult | null>(null);
  const [orderEntries, setOrderEntries] = useState<ProviderOrderEntry[]>([]);
  const [keyAvail, setKeyAvail] = useState<Record<string, boolean>>({});

  const providers = listLlmProviders();

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }, []);

  // Reload provider order + key availability whenever the selected role
  // changes; key edits in another view should also be reflected on focus.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const order = await loadProviderOrder();
      if (cancelled) return;
      setOrderEntries(order);
      const avail: Record<string, boolean> = {};
      await Promise.all(
        order.map(async (e) => {
          avail[e.provider] = await hasProviderKey(e.provider);
        }),
      );
      if (cancelled) return;
      setKeyAvail(avail);
    };
    void refresh();
    const onFocus = () => void refresh();
    if (typeof window !== 'undefined') window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus);
    };
  }, [role.id]);

  // Resolve provider: explicit pick on the role wins; otherwise fall back to
  // the first enabled provider in Settings order that has a saved key.
  const resolvedProviderId: LlmProviderId | null = (() => {
    if (form.testProviderId) {
      return providers.find((p) => p.id === form.testProviderId)?.id ?? null;
    }
    const first = orderEntries.find((e) => e.enabled && keyAvail[e.provider]);
    return first?.provider ?? null;
  })();
  const resolvedSpec = resolvedProviderId
    ? providers.find((p) => p.id === resolvedProviderId)
    : null;
  const resolvedModel = form.testModel || resolvedSpec?.defaultModel || '';

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setForm((prev) => {
      const next = { ...prev, [field]: val };
      if (field === 'name' && !dirty) {
        next.slug = slugify(val);
      }
      // Switching provider invalidates a model id that belongs to the
      // previous provider — clear it so the user re-picks (or falls back to
      // the new provider's default).
      if (field === 'testProviderId') {
        next.testModel = '';
      }
      return next;
    });
    setDirty(true);
  };

  const handleSlugEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, slug: e.target.value }));
    setDirty(true);
  };

  const handleSave = () => {
    onSave(formToRole(role.id, form, role));
    setDirty(false);
  };

  const handleReset = () => {
    setForm(roleToForm(role));
    setDirty(false);
  };

  const handleResetTestPrompt = () => {
    setForm((prev) => ({ ...prev, testPrompt: '' }));
    setDirty(true);
  };

  const handleRunTest = async () => {
    if (!resolvedProviderId || !resolvedSpec) return;
    setTestRunning(true);
    const start = performance.now();
    try {
      const apiKey = await loadProviderKey(resolvedProviderId);
      if (!apiKey.trim()) {
        throw new Error(`No API key saved for ${resolvedSpec.label}. Add one in the Keys page.`);
      }
      const promptToUse = form.testPrompt.trim() || buildDefaultTestPrompt(form);
      const r = await callSingleProvider(
        resolvedProviderId,
        apiKey,
        promptToUse,
        resolvedModel || undefined,
      );
      setTestResult({
        content: r.content,
        latencyMs: Math.round(performance.now() - start),
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        model: r.model,
        provider: resolvedProviderId,
        at: Date.now(),
      });
    } catch (e) {
      setTestResult({
        error: e instanceof Error ? e.message : String(e),
        latencyMs: Math.round(performance.now() - start),
        model: resolvedModel || '?',
        provider: resolvedProviderId,
        at: Date.now(),
      });
    } finally {
      setTestRunning(false);
    }
  };

  const agentAdapters = agents.filter((a) => a.type === 'agent');

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${slugColor(form.slug)}`}>
          {form.slug || '—'}
        </span>
        <span className="text-sm font-medium text-stone-200">{form.name || 'New Role'}</span>
        {dirty && (
          <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-amber-300/70">
            unsaved
          </span>
        )}
      </div>

      {/* Basic */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Role Name">
          <input value={form.name} onChange={set('name')} placeholder="Frontend Engineer" className={inputCls} />
        </FormField>
        <FormField label="Slug" hint="(used in dispatch badge)">
          <input value={form.slug} onChange={handleSlugEdit} placeholder="frontend" className={`${inputCls} font-mono`} />
        </FormField>
      </div>

      {agentAdapters.length > 0 && (
        <FormField label="Default Agent" hint="(pre-selected in dispatch)">
          <select value={form.defaultAgentId} onChange={set('defaultAgentId')} className={inputCls}>
            <option value="">— None —</option>
            {agentAdapters.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </FormField>
      )}

      {/* Skills */}
      <FormField label="Skills" hint="(one per line)">
        <textarea
          rows={4}
          value={form.skills}
          onChange={set('skills')}
          placeholder={'React\nTypeScript\nTailwind CSS'}
          className={`${inputCls} font-mono text-xs`}
        />
      </FormField>


      {/* System Prompt */}
      <FormField label="System Prompt" hint="(prepended to every AI dispatch)">
        <textarea
          rows={6}
          value={form.systemPrompt}
          onChange={set('systemPrompt')}
          placeholder="You are a senior frontend engineer specializing in..."
          className={`${inputCls} text-xs leading-5`}
        />
      </FormField>

      {/* ── AI Provider Test ──────────────────────────────────────────────── */}
      <div className="space-y-3 border border-cyan-300/15 bg-[#04201d]/55 p-3">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-cyan-300/80" />
          <span className="text-[11px] uppercase tracking-[0.14em] text-cyan-200/85">
            AI Provider Test
          </span>
          <span className="ml-auto text-[10px] text-stone-500">
            Sanity-check this role with a chosen provider/model before dispatch
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Provider (Company)">
            <select value={form.testProviderId} onChange={set('testProviderId')} className={inputCls}>
              <option value="">
                Auto — use Settings fallback order
                {resolvedSpec && !form.testProviderId ? ` (→ ${resolvedSpec.label})` : ''}
              </option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {keyAvail[p.id] === false ? ' — no key' : ''}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Model">
            <select
              value={form.testModel}
              onChange={set('testModel')}
              disabled={!resolvedSpec}
              className={`${inputCls} font-mono text-xs`}
            >
              <option value="">
                {resolvedSpec ? `Default (${resolvedSpec.defaultModel})` : 'Pick a provider first'}
              </option>
              {resolvedSpec?.availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField
          label="Test Prompt"
          hint={
            form.testPrompt.trim()
              ? '(custom — saved with the role)'
              : '(empty — placeholder shows the auto-generated default that will be sent)'
          }
        >
          <textarea
            rows={6}
            value={form.testPrompt}
            onChange={set('testPrompt')}
            placeholder={buildDefaultTestPrompt(form)}
            className={`${inputCls} text-xs leading-5`}
          />
          {form.testPrompt.trim() && (
            <button
              type="button"
              onClick={handleResetTestPrompt}
              className="mt-1 inline-flex items-center gap-1 text-[10px] text-stone-500 hover:text-cyan-200"
            >
              <RefreshCw size={10} /> Reset to auto-generated default
            </button>
          )}
        </FormField>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleRunTest()}
            disabled={
              !isTauri ||
              !resolvedProviderId ||
              !keyAvail[resolvedProviderId] ||
              testRunning
            }
            title={
              !isTauri
                ? 'Testing requires the desktop app (Rust bridge calls the provider directly).'
                : !resolvedProviderId
                  ? 'No provider available — pick one above or enable one in Settings.'
                  : !keyAvail[resolvedProviderId]
                    ? `Save an API key for ${resolvedSpec?.label ?? 'this provider'} in the Keys page first.`
                    : 'Send the prompt to the resolved provider/model.'
            }
            className="inline-flex items-center gap-1.5 border border-cyan-200/30 bg-cyan-500/15 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testRunning ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Play size={11} />
            )}
            Run Test
          </button>
          <span className="text-[10px] text-stone-500">
            {resolvedProviderId && resolvedSpec
              ? `→ ${resolvedSpec.label} · ${resolvedModel || resolvedSpec.defaultModel}`
              : 'No provider resolved'}
          </span>
          {testResult && (
            <button
              type="button"
              onClick={() => setTestResult(null)}
              className="ml-auto text-stone-500 hover:text-stone-200"
              title="Clear result"
              aria-label="Clear test result"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {testResult && (
          <div className="border border-stone-200/12 bg-[#020908] px-3 py-2 text-[11px]">
            <div className="mb-1 flex flex-wrap items-center gap-3 text-stone-500">
              <span>
                {testResult.error ? (
                  <span className="text-red-300">failed</span>
                ) : (
                  <span className="text-emerald-300">ok</span>
                )}{' '}
                · {testResult.latencyMs} ms
                {testResult.inputTokens != null && testResult.outputTokens != null && (
                  <>
                    {' '}
                    · in {testResult.inputTokens} / out {testResult.outputTokens} tokens
                  </>
                )}
                {' · '}
                <code className="font-mono">{testResult.model}</code>
                {' · '}
                <span>{testResult.provider}</span>
              </span>
            </div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-stone-200">
              {testResult.error ?? testResult.content ?? ''}
            </pre>
          </div>
        )}
      </div>

      {/* Notes */}
      <FormField label="Notes">
        <textarea
          rows={2}
          value={form.notes}
          onChange={set('notes')}
          placeholder="Optional notes about this role..."
          className={`${inputCls} text-xs`}
        />
      </FormField>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-stone-200/12 pt-3">
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 border border-stone-200/18 px-3 py-1.5 text-xs text-stone-500 hover:border-red-500/30 hover:text-red-400"
        >
          <Trash2 size={12} />
          Delete Role
        </button>
        <div className="ml-auto flex gap-2">
          {dirty && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-100"
            >
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty}
            className="bg-stone-100 px-4 py-1.5 text-xs font-medium text-[#071d1a] hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface EngineersViewProps {
  roles: EngineerRole[];
  agents: AnyAdapterConfig[];
  onRolesChange: (roles: EngineerRole[]) => void;
}

export function EngineersView({ roles, agents, onRolesChange }: EngineersViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(roles[0]?.id ?? null);

  const selectedRole = roles.find((r) => r.id === selectedId) ?? null;

  const handleAdd = () => {
    const newRole: EngineerRole = {
      id: uid(),
      name: 'New Role',
      slug: 'new-role',
      skills: [],
      commands: [],
      systemPrompt: '',
      referenceFiles: [],
    };
    onRolesChange([...roles, newRole]);
    setSelectedId(newRole.id);
  };

  const handleInitDefaults = () => {
    onRolesChange(DEFAULT_ENGINEER_ROLES);
    setSelectedId(DEFAULT_ENGINEER_ROLES[0].id);
  };

  const handleSave = (updated: EngineerRole) => {
    onRolesChange(roles.map((r) => (r.id === updated.id ? updated : r)));
  };

  const handleDelete = (id: string) => {
    const next = roles.filter((r) => r.id !== id);
    onRolesChange(next);
    if (selectedId === id) {
      setSelectedId(next[0]?.id ?? null);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">
          AI Engineers
        </h1>
        <p className="mt-1 text-xs text-stone-400">
          Configure engineer role presets and workflow playbooks for this project. Roles and
          selected workflows are injected into AI dispatches as explicit operating context.
        </p>
      </div>

      <div className="mb-4 border border-stone-200/12 bg-[#071d1a]/72 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Workflow size={13} className="text-stone-400" />
          <span className="text-[11px] uppercase tracking-[0.14em] text-stone-400">
            Workflow Catalog
          </span>
          <span className="font-mono text-[10px] text-stone-600">
            {DEFAULT_AGENT_WORKFLOWS.length}
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {DEFAULT_AGENT_WORKFLOWS.map((workflow) => (
            <div key={workflow.id} className="border border-stone-200/10 bg-[#03100f]/50 p-2">
              <div className="flex items-center gap-2">
                <span className="truncate text-xs font-medium text-stone-200">
                  {workflow.name}
                </span>
                <span className={`ml-auto shrink-0 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${modeColor(workflow.mode)}`}>
                  {workflow.mode}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-stone-500">
                {workflow.summary}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Master-detail layout — fixed viewport height so both panels scroll independently */}
      <div className="flex h-[calc(100vh-22rem)] min-h-[34rem] gap-0 border border-stone-200/18 bg-[#071d1a]/72">
        {/* Left — role list */}
        <div className="flex w-60 shrink-0 flex-col border-r border-stone-200/15">
          <div className="flex items-center gap-2 border-b border-stone-200/12 px-3 py-2.5">
            <Users2 size={13} className="text-stone-400" />
            <span className="text-[11px] uppercase tracking-[0.14em] text-stone-400">Roles</span>
            <span className="ml-1 font-mono text-[10px] text-stone-600">{roles.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {roles.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="text-xs text-stone-500">No roles yet.</p>
              </div>
            ) : (
              roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedId(role.id)}
                  className={[
                    'w-full border-b border-stone-200/8 px-3 py-2.5 text-left transition-colors',
                    role.id === selectedId
                      ? 'bg-emerald-950/60'
                      : 'hover:bg-white/5',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${slugColor(role.slug)}`}>
                      {role.slug}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-stone-200">{role.name}</p>
                  {role.skills.length > 0 && (
                    <p className="mt-0.5 truncate text-[10px] text-stone-500">
                      {role.skills.slice(0, 3).join(' · ')}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>

          {/* List footer */}
          <div className="border-t border-stone-200/12 p-3 space-y-2">
            <button
              onClick={handleAdd}
              className="flex w-full items-center gap-1.5 border border-dashed border-stone-200/18 px-3 py-1.5 text-xs text-stone-400 hover:border-emerald-300/30 hover:text-emerald-200"
            >
              <Plus size={11} />
              Add Role
            </button>
            {roles.length === 0 && (
              <button
                onClick={handleInitDefaults}
                className="flex w-full items-center justify-center gap-1.5 border border-stone-200/18 px-3 py-1.5 text-xs text-stone-300 hover:bg-white/5"
              >
                Initialize 6 Defaults
              </button>
            )}
          </div>
        </div>

        {/* Right — detail panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedRole ? (
            <DetailPanel
              key={selectedRole.id}
              role={selectedRole}
              agents={agents}
              onSave={handleSave}
              onDelete={() => handleDelete(selectedRole.id)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-stone-500">
                {roles.length === 0
                  ? 'Click "Add Role" or "Initialize 6 Defaults" to get started.'
                  : 'Select a role to edit.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
