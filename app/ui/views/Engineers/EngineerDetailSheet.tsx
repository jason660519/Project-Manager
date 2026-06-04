'use client';

/**
 * Right-side slide-in sheet for editing a single engineer role.
 *
 * Wraps the original master-detail edit form so the new table+sheet layout
 * can keep the full edit surface (model config, test playground, working
 * scope, capabilities) without inlining a long form inside the table view.
 *
 * Mirrors the pattern established by `KeysProviderDetailSheet`:
 *   - fixed overlay + ml-auto panel
 *   - parent owns the open/close lifecycle (`role` is null when closed)
 *   - sheet calls `onSave` / `onDelete` and the parent persists
 */

import React, { useEffect, useState } from 'react';
import {
  Bot,
  Camera,
  Eye,
  FolderLock,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';

import { callAnthropic, captureScreenshot } from '../../../../lib/bridge';
import { sheetForKind } from '../../../../lib/capabilities/registry';
import { listLlmProviders, type LlmProviderId } from '../../../../lib/keys/llmProviders';
import { hasProviderKey, loadProviderKey } from '../../../../lib/keys/loadProviderKey';
import { loadProviderOrder, type ProviderOrderEntry } from '../../../../lib/keys/providerOrder';
import { callSingleProvider } from '../../../../lib/scanner/runProjectScan';
import {
  listPassedCandidates,
  loadCapabilityCatalog,
  type CapabilityCatalog,
} from '../../../../lib/storage/capabilities';
import { listExposedSystemCliCommands } from '../../../../lib/storage/system-cli';
import type {
  AnyAdapterConfig,
  CapabilityKind,
  EngineerRole,
  ModelFallbackEntry,
  RoleCapability,
  WorkingScope,
} from '../../../../lib/types';
import { AgentArchitecturePanel } from './AgentArchitecturePanel';
import { partitionEngineerCommands, slugColor, slugify } from './shared';

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  slug: string;
  skills: string;
  skillRefs: string;
  systemPrompt: string;
  defaultAgentId: string;
  notes: string;
  primaryProviderId: string;
  primaryModelId: string;
  fallbacks: ModelFallbackEntry[];
  fallbackInput: string;
  testProviderId: string;
  testModel: string;
  testPrompt: string;
  scopePaths: string[];
  scopeMode: 'soft' | 'strict';
  scopeInput: string;
  capabilities: RoleCapability[];
  commands: string[];
}

function roleToForm(role: EngineerRole): FormState {
  return {
    name: role.name,
    slug: role.slug,
    skills: role.skills.join('\n'),
    skillRefs: (role.skillRefs ?? []).join('\n'),
    systemPrompt: role.systemPrompt,
    defaultAgentId: role.defaultAgentId ?? '',
    notes: role.notes ?? '',
    primaryProviderId: role.primaryModel?.providerId ?? '',
    primaryModelId: role.primaryModel?.modelId ?? '',
    fallbacks: role.modelFallbacks ?? [],
    fallbackInput: '',
    testProviderId: role.testProviderId ?? '',
    testModel: role.testModel ?? '',
    testPrompt: role.testPrompt ?? '',
    scopePaths: role.workingScope?.allowedPaths ?? [],
    scopeMode: role.workingScope?.mode ?? 'soft',
    scopeInput: '',
    capabilities: role.capabilities ?? [],
    commands: role.commands ?? [],
  };
}

function formToRole(id: string, form: FormState, existing: EngineerRole): EngineerRole {
  const workingScope: WorkingScope | undefined =
    form.scopePaths.length > 0
      ? { allowedPaths: form.scopePaths, mode: form.scopeMode }
      : undefined;
  return {
    id,
    name: form.name || 'Unnamed Role',
    slug: form.slug || slugify(form.name) || 'role',
    skills: form.skills.split('\n').map((s) => s.trim()).filter(Boolean),
    skillRefs: (() => {
      const refs = form.skillRefs.split('\n').map((s) => s.trim()).filter(Boolean);
      return refs.length > 0 ? refs : undefined;
    })(),
    commands: Array.from(new Set(form.commands.map((c) => c.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    ),
    systemPrompt: form.systemPrompt,
    referenceFiles: existing.referenceFiles,
    defaultAgentId: form.defaultAgentId || undefined,
    notes: form.notes || undefined,
    workingScope,
    primaryModel: form.primaryProviderId
      ? {
          providerId: form.primaryProviderId,
          modelId:
            form.primaryModelId ||
            (listLlmProviders().find((p) => p.id === form.primaryProviderId)?.defaultModel ?? ''),
        }
      : undefined,
    modelFallbacks: form.fallbacks.length > 0 ? form.fallbacks : undefined,
    testProviderId: form.testProviderId || undefined,
    testModel: form.testModel || undefined,
    testPrompt: form.testPrompt || undefined,
    capabilities: form.capabilities.length > 0 ? form.capabilities : undefined,
  };
}

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

const inputCls =
  'w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35 placeholder:text-stone-600';

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">
          {label}
        </label>
        {hint && <span className="text-[10px] text-stone-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Body ───────────────────────────────────────────────────────────────────────

interface EngineerDetailBodyProps {
  role: EngineerRole;
  agents: AnyAdapterConfig[];
  onSave: (updated: EngineerRole) => void;
  onDelete: () => void;
}

function EngineerDetailBody({ role, agents, onSave, onDelete }: EngineerDetailBodyProps) {
  const [form, setForm] = useState<FormState>(() => roleToForm(role));
  const [dirty, setDirty] = useState(false);

  const [isTauri, setIsTauri] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<PlaygroundResult | null>(null);
  const [orderEntries, setOrderEntries] = useState<ProviderOrderEntry[]>([]);
  const [keyAvail, setKeyAvail] = useState<Record<string, boolean>>({});
  const [capabilityCatalog, setCapabilityCatalog] = useState<CapabilityCatalog>({
    schemaVersion: 1,
    candidates: [],
  });
  const [exposedCommands, setExposedCommands] = useState<string[]>([]);
  const [attachScreenshot, setAttachScreenshot] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refresh = () => {
      setCapabilityCatalog(loadCapabilityCatalog());
      setExposedCommands(listExposedSystemCliCommands());
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const toggleCommand = (cmd: string) => {
    setForm((prev) => {
      const has = prev.commands.includes(cmd);
      return {
        ...prev,
        commands: has ? prev.commands.filter((c) => c !== cmd) : [...prev.commands, cmd],
      };
    });
    setDirty(true);
  };

  const providers = listLlmProviders();

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }, []);

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

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const val = e.target.value;
      setForm((prev) => {
        const next = { ...prev, [field]: val };
        if (field === 'name' && !dirty) {
          next.slug = slugify(val);
        }
        if (field === 'testProviderId') {
          next.testModel = '';
        }
        if (field === 'primaryProviderId') {
          next.primaryModelId = '';
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

  const handleAutoFill = () => {
    const already = new Set(form.fallbacks.map((fb) => fb.providerId));
    const toAdd: ModelFallbackEntry[] = providers
      .filter((p) => keyAvail[p.id] && p.id !== form.primaryProviderId && !already.has(p.id))
      .map((p) => ({ providerId: p.id, modelId: p.availableModels[0] ?? p.defaultModel }));
    if (toAdd.length === 0) return;
    setForm((prev) => ({ ...prev, fallbacks: [...prev.fallbacks, ...toAdd] }));
    setDirty(true);
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

      if (attachScreenshot && resolvedProviderId === 'anthropic') {
        const screenshot = await captureScreenshot();
        const modelId = resolvedModel || resolvedSpec.defaultModel;
        const response = await callAnthropic({
          apiKey,
          model: modelId,
          maxTokens: 2048,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshot } },
                { type: 'text', text: promptToUse },
              ] as unknown as string,
            },
          ],
        });
        setTestResult({
          content: response.content,
          latencyMs: Math.round(performance.now() - start),
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          model: modelId,
          provider: 'anthropic',
          at: Date.now(),
        });
        return;
      }

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
        <span
          className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${slugColor(form.slug)}`}
        >
          {form.slug || '—'}
        </span>
        <span className="text-sm font-medium text-stone-200">{form.name || 'New Role'}</span>
        {dirty && (
          <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-amber-300/70">
            unsaved
          </span>
        )}
      </div>

      <AgentArchitecturePanel
        form={{
          defaultAgentId: form.defaultAgentId,
          systemPrompt: form.systemPrompt,
          skills: form.skills,
          scopePaths: form.scopePaths,
          scopeMode: form.scopeMode,
          capabilities: form.capabilities,
          testPrompt: form.testPrompt,
          primaryProviderId: form.primaryProviderId,
          fallbacksCount: form.fallbacks.length,
        }}
        agents={agents}
      />

      {/* Basic */}
      <div id="engineer-section-loop" className="scroll-mt-3 grid grid-cols-2 gap-3">
        <FormField label="Role Name">
          <input
            value={form.name}
            onChange={set('name')}
            placeholder="Frontend Engineer"
            className={inputCls}
          />
        </FormField>
        <FormField label="Slug" hint="(used in dispatch badge)">
          <input
            value={form.slug}
            onChange={handleSlugEdit}
            placeholder="frontend"
            className={`${inputCls} font-mono`}
          />
        </FormField>
      </div>

      {agentAdapters.length > 0 && (
        <FormField label="Default Agent" hint="(pre-selected in dispatch)">
          <select value={form.defaultAgentId} onChange={set('defaultAgentId')} className={inputCls}>
            <option value="">— None —</option>
            {agentAdapters.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </FormField>
      )}

      {/* AI Model Configuration */}
      <div
        id="engineer-section-model"
        className="scroll-mt-3 space-y-3 border border-stone-200/15 bg-[rgb(var(--pm-card-3))]/40 p-3"
      >
        <div className="flex items-center gap-2">
          <Bot size={13} className="text-stone-400" />
          <span className="text-[11px] uppercase tracking-[0.14em] text-stone-400">
            AI Model Configuration
          </span>
          <span className="ml-auto text-[10px] text-stone-600">
            Primary + fallback chain for dispatch
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Primary Provider">
            <select
              value={form.primaryProviderId}
              onChange={set('primaryProviderId')}
              className={inputCls}
            >
              <option value="">— Use dispatch default —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Primary Model">
            <select
              value={form.primaryModelId}
              onChange={set('primaryModelId')}
              disabled={!form.primaryProviderId}
              className={`${inputCls} font-mono text-xs`}
            >
              {(() => {
                const spec = providers.find((p) => p.id === form.primaryProviderId);
                return (
                  <>
                    <option value="">
                      {spec ? `Default (${spec.defaultModel})` : 'Pick a provider first'}
                    </option>
                    {spec?.availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </>
                );
              })()}
            </select>
          </FormField>
        </div>

        {form.fallbacks.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.12em] text-stone-600">
              Fallback Chain
            </span>
            {form.fallbacks.map((fb, idx) => {
              const fbSpec = providers.find((p) => p.id === fb.providerId);
              return (
                <div key={idx} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                  <select
                    value={fb.providerId}
                    onChange={(e) => {
                      const updated = form.fallbacks.map((f, i) =>
                        i === idx ? { providerId: e.target.value, modelId: '' } : f,
                      );
                      setForm((prev) => ({ ...prev, fallbacks: updated }));
                      setDirty(true);
                    }}
                    className={`${inputCls} text-xs`}
                  >
                    <option value="">— Provider —</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={fb.modelId}
                    disabled={!fb.providerId}
                    onChange={(e) => {
                      const updated = form.fallbacks.map((f, i) =>
                        i === idx ? { ...f, modelId: e.target.value } : f,
                      );
                      setForm((prev) => ({ ...prev, fallbacks: updated }));
                      setDirty(true);
                    }}
                    className={`${inputCls} font-mono text-xs`}
                  >
                    <option value="">
                      {fbSpec ? `Default (${fbSpec.defaultModel})` : 'Pick provider first'}
                    </option>
                    {fbSpec?.availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        fallbacks: prev.fallbacks.filter((_, i) => i !== idx),
                      }));
                      setDirty(true);
                    }}
                    className="text-stone-500 hover:text-red-400"
                    aria-label="Remove fallback"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setForm((prev) => ({
                ...prev,
                fallbacks: [...prev.fallbacks, { providerId: '', modelId: '' }],
              }));
              setDirty(true);
            }}
            className="inline-flex items-center gap-1 border border-stone-200/18 px-2.5 py-1 text-[10px] text-stone-500 hover:border-stone-200/35 hover:text-stone-300"
          >
            <Plus size={10} /> Add Fallback
          </button>
          <button
            type="button"
            onClick={handleAutoFill}
            disabled={!providers.some((p) => keyAvail[p.id])}
            title={
              providers.some((p) => keyAvail[p.id])
                ? 'Add one entry per provider that has a saved API key (skips primary and already-added providers)'
                : 'No API keys saved yet — visit the Keys page first'
            }
            className="inline-flex items-center gap-1 border border-stone-200/18 px-2.5 py-1 text-[10px] text-stone-500 hover:border-sky-300/30 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles size={10} /> Auto-fill from providers
          </button>
        </div>

        <p className="text-[10px] text-stone-600">
          CLI agent dispatches use the primary model flag only. Fallbacks apply to direct AI calls.
        </p>
      </div>

      {/* Skills + System Prompt — CONTEXT injection */}
      <div id="engineer-section-context" className="scroll-mt-3 space-y-4">
      <FormField label="Skills" hint="(one per line)">
        <textarea
          rows={4}
          value={form.skills}
          onChange={set('skills')}
          placeholder={'React\nTypeScript\nTailwind CSS'}
          className={`${inputCls} font-mono text-xs`}
        />
      </FormField>

      <FormField
        label="Skill refs"
        hint="(SKILL.md paths, one per line — merged at dispatch)"
      >
        <textarea
          rows={3}
          value={form.skillRefs}
          onChange={set('skillRefs')}
          placeholder={'.agents/skills/workflow/ship/SKILL.md\n.claude/skills/investigate/SKILL.md'}
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
      </div>

      {/* Capabilities */}
      <div
        id="engineer-section-capabilities"
        className="scroll-mt-3 space-y-3 border border-violet-300/15 bg-[rgb(var(--pm-card-3))]/45 p-3"
      >
        <div className="flex items-center gap-2">
          <Eye size={13} className="text-violet-300/80" />
          <span className="text-[11px] uppercase tracking-[0.14em] text-violet-200/85">
            Capabilities
          </span>
          <span className="ml-auto text-[10px] text-stone-500">
            Assign passed candidates from the Integrations Hub
          </span>
        </div>

        {(['eyes', 'voice-tts', 'voice-stt', 'hands', 'recording'] as readonly CapabilityKind[]).map(
          (kind) => {
            const sheet = sheetForKind(kind);
            const passed = listPassedCandidates(capabilityCatalog, sheet);
            const current = form.capabilities.find((c) => c.kind === kind);
            const selectedAdapter = agents.find((a) => a.id === form.defaultAgentId);
            const adapterSupports =
              !form.defaultAgentId || (selectedAdapter?.supports ?? []).includes(kind);
            const statusLabel = !adapterSupports
              ? `Adapter does not support ${kind}`
              : passed.length === 0
                ? 'No passed candidate yet'
                : current
                  ? 'Active'
                  : 'Not assigned';
            const statusClass =
              statusLabel === 'Active'
                ? 'text-emerald-300'
                : statusLabel.startsWith('Adapter')
                  ? 'text-amber-300'
                  : 'text-stone-500';
            return (
              <div key={kind} className="grid grid-cols-[110px_1fr_auto] items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-stone-400">
                  {kind}
                </span>
                <select
                  value={current?.candidateId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    setForm((prev) => {
                      const others = prev.capabilities.filter((c) => c.kind !== kind);
                      const next = id ? [...others, { kind, candidateId: id }] : others;
                      return { ...prev, capabilities: next };
                    });
                    setDirty(true);
                  }}
                  disabled={passed.length === 0 || !adapterSupports}
                  className={`${inputCls} text-xs`}
                >
                  <option value="">— Not assigned —</option>
                  {passed.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <span className={`text-[10px] ${statusClass}`}>{statusLabel}</span>
              </div>
            );
          },
        )}
        <p className="text-[10px] text-stone-600">
          Only candidates with state <code className="font-mono">passed</code> appear here. Qualify
          new ones in the Integrations Hub VLA / TTS / STT / Hands / Tools sheets.
        </p>
      </div>

      {/* AI Provider Test */}
      <div
        id="engineer-section-test"
        className="scroll-mt-3 space-y-3 border border-cyan-300/15 bg-[rgb(var(--pm-card-3))]/55 p-3"
      >
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
          <label
            className="flex items-center gap-1.5 text-[10px] text-stone-400"
            title="F23 Eyes capability — captures the desktop screenshot and sends it as an Anthropic image content block."
          >
            <input
              type="checkbox"
              checked={attachScreenshot}
              onChange={(e) => setAttachScreenshot(e.target.checked)}
              disabled={!isTauri || resolvedProviderId !== 'anthropic'}
            />
            <Camera size={11} />
            Attach screenshot (vision)
          </label>
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
          <div className="border border-stone-200/12 bg-[rgb(var(--pm-deep))] px-3 py-2 text-[11px]">
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

      {/* Working Scope */}
      <div
        id="engineer-section-scope"
        className="scroll-mt-3 space-y-3 border border-stone-200/15 bg-[rgb(var(--pm-card-3))]/40 p-3"
      >
        <div className="flex items-center gap-2">
          <FolderLock size={13} className="text-stone-400" />
          <span className="text-[11px] uppercase tracking-[0.14em] text-stone-400">
            Working Scope
          </span>
          <span className="ml-auto text-[10px] text-stone-600">
            Restrict which paths this engineer may modify
          </span>
        </div>

        <div>
          <div className="flex gap-2">
            <input
              value={form.scopeInput}
              onChange={(e) => setForm((prev) => ({ ...prev, scopeInput: e.target.value }))}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ',') && form.scopeInput.trim()) {
                  e.preventDefault();
                  const path = form.scopeInput.trim().replace(/,+$/, '');
                  if (path && !form.scopePaths.includes(path)) {
                    setForm((prev) => ({
                      ...prev,
                      scopePaths: [...prev.scopePaths, path],
                      scopeInput: '',
                    }));
                    setDirty(true);
                  } else {
                    setForm((prev) => ({ ...prev, scopeInput: '' }));
                  }
                }
              }}
              placeholder="src/feature-x/  (Enter to add)"
              className={`${inputCls} flex-1 font-mono text-xs`}
            />
            <button
              type="button"
              onClick={() => {
                const path = form.scopeInput.trim().replace(/,+$/, '');
                if (path && !form.scopePaths.includes(path)) {
                  setForm((prev) => ({
                    ...prev,
                    scopePaths: [...prev.scopePaths, path],
                    scopeInput: '',
                  }));
                  setDirty(true);
                } else {
                  setForm((prev) => ({ ...prev, scopeInput: '' }));
                }
              }}
              className="border border-stone-200/18 px-3 py-2 text-xs text-stone-400 hover:border-emerald-300/30 hover:text-emerald-200"
            >
              Add
            </button>
          </div>
          {form.scopePaths.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {form.scopePaths.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 border border-emerald-300/25 bg-emerald-950/40 px-2 py-0.5 font-mono text-[10px] text-emerald-200/80"
                >
                  {p}
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        scopePaths: prev.scopePaths.filter((x) => x !== p),
                      }));
                      setDirty(true);
                    }}
                    className="ml-0.5 text-stone-500 hover:text-red-400"
                    aria-label={`Remove ${p}`}
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.12em] text-stone-500">Mode</span>
          {(['soft', 'strict'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setForm((prev) => ({ ...prev, scopeMode: m }));
                setDirty(true);
              }}
              className={[
                'border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
                form.scopeMode === m
                  ? m === 'strict'
                    ? 'border-orange-300/40 bg-orange-950/50 text-orange-200/90'
                    : 'border-emerald-300/35 bg-emerald-950/50 text-emerald-200/80'
                  : 'border-stone-200/15 text-stone-600 hover:border-stone-200/30 hover:text-stone-400',
              ].join(' ')}
            >
              {m}
            </button>
          ))}
          <span className="text-[10px] text-stone-600">
            {form.scopeMode === 'strict'
              ? 'Prompt injection + dispatch warning when outside scope'
              : 'Prompt injection only'}
          </span>
        </div>
      </div>

      {/* Commands Allowlist */}
      {(() => {
        const { active, stale } = partitionEngineerCommands(form.commands, exposedCommands);
        const selectedCount = active.length + stale.length;
        return (
          <div
            id="engineer-section-commands"
            className="scroll-mt-3 space-y-3 border border-stone-200/15 bg-[rgb(var(--pm-card-3))]/40 p-3"
          >
            <div className="flex items-center gap-2">
              <Terminal size={13} className="text-stone-400" />
              <span className="text-[11px] uppercase tracking-[0.14em] text-stone-400">
                Commands Allowlist
              </span>
              <span className="ml-auto text-[10px] text-stone-600">
                {selectedCount > 0 ? `${selectedCount} selected` : 'Subset of globally exposed CLIs'}
              </span>
            </div>

            {exposedCommands.length === 0 ? (
              <p className="text-[10px] text-stone-500">
                No commands are globally exposed yet. Enable them in{' '}
                <span className="text-stone-400">Plugins &gt; Commands</span> (Global CLI Inventory)
                first — this role can only allow a subset of exposed commands.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {exposedCommands.map((cmd) => {
                  const checked = active.includes(cmd);
                  return (
                    <button
                      key={cmd}
                      type="button"
                      onClick={() => toggleCommand(cmd)}
                      aria-pressed={checked}
                      className={[
                        'inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] transition-colors',
                        checked
                          ? 'border-emerald-300/35 bg-emerald-950/40 text-emerald-200/85'
                          : 'border-stone-200/15 text-stone-500 hover:border-stone-200/30 hover:text-stone-300',
                      ].join(' ')}
                    >
                      {checked && <span aria-hidden>✓</span>}
                      {cmd}
                    </button>
                  );
                })}
              </div>
            )}

            {stale.length > 0 && (
              <div className="space-y-1.5 border-t border-amber-300/15 pt-2">
                <span className="text-[10px] uppercase tracking-[0.12em] text-amber-300/70">
                  No longer in global policy
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {stale.map((cmd) => (
                    <span
                      key={cmd}
                      className="inline-flex items-center gap-1 border border-amber-300/35 bg-amber-950/30 px-2 py-0.5 font-mono text-[10px] text-amber-200/80"
                    >
                      {cmd}
                      <button
                        type="button"
                        onClick={() => toggleCommand(cmd)}
                        className="ml-0.5 text-amber-300/60 hover:text-red-400"
                        aria-label={`Remove ${cmd}`}
                      >
                        <X size={9} />
                      </button>
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-stone-600">
                  These were allowed before but are no longer exposed globally. Re-expose them in the
                  Integrations Hub, or remove them from this role.
                </p>
              </div>
            )}
          </div>
        );
      })()}

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
            className="bg-stone-100 px-4 py-1.5 text-xs font-medium text-[rgb(var(--pm-panel))] hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Slide-in shell ────────────────────────────────────────────────────────────

interface EngineerDetailSheetProps {
  role: EngineerRole | null;
  agents: AnyAdapterConfig[];
  onClose: () => void;
  onSave: (updated: EngineerRole) => void;
  onDelete: (id: string) => void;
}

export function EngineerDetailSheet({
  role,
  agents,
  onClose,
  onSave,
  onDelete,
}: EngineerDetailSheetProps) {
  if (!role) return null;
  return (
    <div className="fixed inset-0 z-40 flex bg-black/40" onClick={onClose}>
      <div
        className="ml-auto flex h-full w-[560px] max-w-full flex-col border-l border-stone-200/15 bg-[rgb(var(--pm-rail))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200/15 px-5 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-100">
            Edit Engineer Role
          </h2>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-200"
            aria-label="Close engineer detail"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <EngineerDetailBody
            key={role.id}
            role={role}
            agents={agents}
            onSave={onSave}
            onDelete={() => onDelete(role.id)}
          />
        </div>
      </div>
    </div>
  );
}
