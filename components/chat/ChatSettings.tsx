'use client';

import { Settings2, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { listLlmProviders } from '../../lib/keys/llmProviders';
import {
  loadProviderMetadata,
  resolveModelList,
  subscribeProviderMetadataChanges,
} from '../../lib/keys/providerMetadata';
import { readAiSdksStore } from '../../lib/aiSdks/store';
import { listCandidateModels, type CandidateModel } from '../../lib/aiSdks/candidates';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ChatSettingsData {
  provider: string;
  model: string;
  systemPrompt: string;
}

interface ChatSettingsProps {
  current: ChatSettingsData;
  onChange: (settings: ChatSettingsData) => void;
  /** Project root for reading the AI SDKs candidate models (Tauri); omit in browser dev. */
  projectRoot?: string;
  variant?: 'icon' | 'pill';
  placement?: 'bottom' | 'top';
  attachmentCount?: number;
  attachmentPanel?: React.ReactNode;
  quickActionsPanel?: React.ReactNode;
}

// ────────────────────────────────────────────────────────────────────────────
// Storage
// ────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pm-chat-settings';

export function loadChatSettings(): ChatSettingsData {
  if (typeof window === 'undefined') return { provider: 'auto', model: '', systemPrompt: '' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ChatSettingsData>;
      return {
        provider: typeof parsed.provider === 'string' && parsed.provider ? parsed.provider : 'auto',
        model: typeof parsed.model === 'string' ? parsed.model : '',
        systemPrompt: typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt : '',
      };
    }
  } catch { /* ignore */ }
  return { provider: 'auto', model: '', systemPrompt: '' };
}

export function saveChatSettings(settings: ChatSettingsData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

const ALL_PROVIDERS = listLlmProviders();

export function ChatSettings({
  current,
  onChange,
  projectRoot,
  variant = 'icon',
  placement = 'bottom',
  attachmentCount = 0,
  attachmentPanel,
  quickActionsPanel,
}: ChatSettingsProps) {
  const modelListId = useId();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState(current.provider);
  const [model, setModel] = useState(current.model);
  const [systemPrompt, setSystemPrompt] = useState(current.systemPrompt);
  const [metadataVersion, setMetadataVersion] = useState(0);
  const [candidates, setCandidates] = useState<CandidateModel[]>([]);

  // Load the AI SDKs candidate models when the panel opens (re-reads on each open
  // so freshly-ticked candidates appear). Best-effort: failures leave it empty.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const store = await readAiSdksStore(projectRoot);
        if (!cancelled) setCandidates(listCandidateModels(store));
      } catch {
        if (!cancelled) setCandidates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectRoot]);

  const pickCandidate = (id: string) => {
    const candidate = candidates.find((c) => c.id === id);
    if (!candidate) return;
    setProvider(candidate.providerId);
    setModel(candidate.model);
  };

  // Sync local state when current changes externally
  useEffect(() => {
    setProvider(current.provider);
    setModel(current.model);
    setSystemPrompt(current.systemPrompt);
  }, [current]);

  useEffect(() => {
    return subscribeProviderMetadataChanges(() => {
      setMetadataVersion((version) => version + 1);
    });
  }, []);

  const providerOptions = useMemo(() => {
    return ALL_PROVIDERS.map((providerSpec) => {
      const resolved = resolveModelList(providerSpec.id, providerSpec.availableModels);
      return {
        ...providerSpec,
        models: resolved.models,
        modelSource: resolved.isDynamic ? 'validated' : 'static',
        metadata: loadProviderMetadata(providerSpec.id),
      };
    });
  }, [metadataVersion]);

  const currentSpec = providerOptions.find((p) => p.id === provider);
  const models = currentSpec?.models ?? [];
  const providerChanged = provider !== current.provider;
  const modelChanged = model !== current.model;
  const promptChanged = systemPrompt !== current.systemPrompt;
  const dirty = providerChanged || modelChanged || promptChanged;
  const activeProviderLabel =
    provider === 'auto'
      ? 'Auto'
      : currentSpec
        ? currentSpec.label
        : provider;
  const activeRouteSummary =
    provider === 'auto'
      ? 'Auto route'
      : `${activeProviderLabel}${model ? ` · ${model}` : ''}`;
  const panelPositionClass = placement === 'top' ? 'bottom-8 right-0' : 'right-0 top-8';
  const modelHelper = currentSpec
    ? currentSpec.modelSource === 'validated'
      ? `${models.length} model suggestions from the curated catalogue and latest model refresh. You can still type another model ID.`
      : currentSpec.metadata?.status === 'fail'
        ? `Validation failed: ${currentSpec.metadata.errorReason ?? 'unknown error'}. Static suggestions are shown; manual model IDs are allowed.`
        : 'Static model suggestions are shown until this provider is validated. You can type any model ID.'
    : '';

  // Reset model when provider changes (and the current model isn't valid for the new provider)
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    if (newProvider === 'auto') {
      setModel('');
      return;
    }
    const spec = providerOptions.find((p) => p.id === newProvider);
    if (spec && !spec.models.includes(model)) {
      setModel(spec.defaultModel && spec.models.includes(spec.defaultModel) ? spec.defaultModel : spec.models[0] || '');
    }
  };

  const handleApply = () => {
    const settings: ChatSettingsData =
      provider === 'auto'
        ? { provider: 'auto', model: '', systemPrompt }
        : { provider, model: model.trim(), systemPrompt };
    saveChatSettings(settings);
    onChange(settings);
    setOpen(false);
  };

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={variant === 'pill' ? 'Provider / Model settings' : 'Chat settings'}
        className={
          variant === 'pill'
            ? 'flex h-7 items-center gap-1.5 rounded border border-stone-200/15 px-2 text-[10px] text-stone-300 transition-colors hover:border-amber-200/25 hover:text-amber-100'
            : `flex items-center gap-1 rounded px-1.5 py-1 text-[10px] transition-colors ${
                provider !== 'auto'
                  ? 'text-amber-300/80 hover:text-amber-200'
                  : 'text-stone-500 hover:text-stone-300'
              }`
        }
        title="Provider / model settings"
      >
        <Settings2 size={12} />
        {variant === 'pill' ? (
          <span className="max-w-[180px] truncate">Provider / Model</span>
        ) : provider !== 'auto' && (
          <span className="hidden max-w-[120px] truncate sm:inline">
            {activeRouteSummary}
          </span>
        )}
        {attachmentCount > 0 && (
          <span className="ml-0.5 rounded-full border border-amber-200/25 bg-amber-500/15 px-1 text-[9px] leading-4 text-amber-100">
            {attachmentCount}
          </span>
        )}
      </button>

      {/* Settings panel */}
      {open && (
        <>
          {/* Backdrop to close on click outside */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            data-testid="chat-settings-panel"
            className={`absolute ${panelPositionClass} z-40 max-h-[min(640px,calc(100vh-96px))] w-72 overflow-y-auto rounded-lg border border-stone-200/20 bg-editor-bg p-3 shadow-xl`}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                Chat Settings
              </h3>
              <button type="button" onClick={() => setOpen(false)} className="text-stone-500 hover:text-stone-300">
                <X size={12} />
              </button>
            </div>

            {attachmentPanel && (
              <div className="mb-3 rounded border border-stone-200/10 bg-white/[0.02] p-2">
                <div className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                  <Settings2 size={11} className="text-amber-200/70" />
                  File upload
                </div>
                {attachmentPanel}
              </div>
            )}

            {quickActionsPanel && (
              <div className="mb-3 rounded border border-stone-200/10 bg-white/[0.02] p-2">
                <div className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                  <Settings2 size={11} className="text-amber-200/70" />
                  Quick actions
                </div>
                {quickActionsPanel}
              </div>
            )}

            {/* Candidate models — curated shortlist marked in the AI SDKs view */}
            {candidates.length > 0 && (
              <>
                <label className="mb-1 block text-[9px] uppercase tracking-[0.1em] text-emerald-300/70">
                  Candidate models
                </label>
                <select
                  aria-label="Candidate models"
                  value={candidates.find((c) => c.providerId === provider && c.model === model)?.id ?? ''}
                  onChange={(e) => pickCandidate(e.target.value)}
                  className="mb-1 w-full rounded border border-emerald-200/25 bg-stone-900 px-2 py-1 text-[11px] text-emerald-100 outline-none focus:border-emerald-200/50"
                >
                  <option value="">Pick a candidate…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.providerLabel} · {c.model}
                    </option>
                  ))}
                </select>
                <p className="mb-3 text-[10px] leading-relaxed text-stone-500">
                  Marked in AI SDKs. Selecting one fills Provider + Model below; press Apply to use it.
                </p>
              </>
            )}

            {/* Provider */}
            <label htmlFor={`${modelListId}-provider`} className="mb-1 block text-[9px] uppercase tracking-[0.1em] text-stone-500">Provider</label>
            <select
              id={`${modelListId}-provider`}
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="mb-2 w-full rounded border border-stone-200/15 bg-stone-900 px-2 py-1 text-[11px] text-stone-200 outline-none focus:border-amber-200/40"
            >
              <option value="auto">Auto (fallback chain)</option>
              {providerOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>

            {/* Model */}
            {provider !== 'auto' && (
              <>
                <label htmlFor={`${modelListId}-model`} className="mb-1 mt-2 block text-[9px] uppercase tracking-[0.1em] text-stone-500">Model ID</label>
                <input
                  id={`${modelListId}-model`}
                  list={modelListId}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={currentSpec?.defaultModel ?? 'Enter model ID'}
                  className="mb-1 w-full rounded border border-stone-200/15 bg-stone-900 px-2 py-1 text-[11px] text-stone-200 outline-none placeholder:text-stone-600 focus:border-amber-200/40"
                />
                <datalist id={modelListId}>
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </datalist>
                <p className="mb-2 text-[10px] leading-relaxed text-stone-500">
                  {modelHelper}
                </p>
              </>
            )}

            {/* System prompt */}
            <label className="mb-1 mt-2 block text-[9px] uppercase tracking-[0.1em] text-stone-500">
              System Prompt
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Default: Project Manager AI assistant..."
              rows={3}
              className="mb-3 w-full resize-none rounded border border-stone-200/15 bg-stone-900 px-2 py-1 text-[10px] text-stone-300 outline-none placeholder:text-stone-600 focus:border-amber-200/40"
            />

            {/* Apply */}
            <button
              type="button"
              onClick={handleApply}
              className={`w-full rounded py-1.5 text-[10px] font-medium transition-colors ${
                dirty
                  ? 'bg-amber-500/15 text-amber-100 hover:bg-amber-500/25'
                  : 'bg-stone-800/50 text-stone-500 cursor-default'
              }`}
            >
              {dirty ? 'Apply' : 'No changes'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
