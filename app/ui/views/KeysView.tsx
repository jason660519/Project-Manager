'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Github,
  KeyRound,
  Loader2,
  LogIn,
  Play,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  PROVIDERS,
  providersByCategory,
  type ProviderSpec,
} from '../../../lib/keys/registry';
import { loadProviderSecret, saveProviderSecret } from '../../../lib/keys/keychain';
import { listLlmProviders } from '../../../lib/keys/llmProviders';
import { hasProviderKey, loadProviderKey } from '../../../lib/keys/loadProviderKey';
import {
  ALL_LLM_PROVIDERS,
  bulkEnableConfiguredProviders,
  loadProviderOrder,
  saveProviderOrder,
  type LlmProviderId,
  type ProviderOrderEntry,
} from '../../../lib/keys/providerOrder';
import { callSingleProvider } from '../../../lib/scanner/runProjectScan';
import { EnvImportModal } from './_components/EnvImportModal';
import { OAuthDeviceModal } from './_components/OAuthDeviceModal';

const PROVIDER_LABEL = Object.fromEntries(
  listLlmProviders().map((spec) => [spec.id, spec.label]),
) as Record<LlmProviderId, string>;

const EMPTY_KEY_STATUS = Object.fromEntries(
  ALL_LLM_PROVIDERS.map((id) => [id, false]),
) as Record<LlmProviderId, boolean>;

function ProviderRow({
  provider,
  isTauri,
  onOpenOAuth,
  reloadToken,
}: {
  provider: ProviderSpec;
  isTauri: boolean;
  onOpenOAuth: (p: ProviderSpec) => void;
  /** Bumped by the parent after an import / OAuth flow so this row re-reads. */
  reloadToken: number;
}) {
  const [value, setValue] = useState('');
  // The last value we know is persisted to Keychain / localStorage. The
  // button label is derived from `value !== savedValue` (dirty) instead of a
  // 2-second flash so users never have to wonder whether the save succeeded.
  const [savedValue, setSavedValue] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [showMethods, setShowMethods] = useState(false);

  useEffect(() => {
    loadProviderSecret(provider)
      .then((v) => {
        setValue(v);
        setSavedValue(v);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [provider, reloadToken]);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await saveProviderSecret(provider, value);
      setSavedValue(value);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!savedValue) return;
    if (typeof window !== 'undefined' && !window.confirm(`Clear the ${provider.label} key?`)) return;
    setError('');
    setSaving(true);
    try {
      await saveProviderSecret(provider, '');
      setValue('');
      setSavedValue('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const isConfigured = loaded && savedValue.length > 0;
  const isDirty = value !== savedValue;
  const hasOAuth = provider.supportedMethods.includes('oauth') && !!provider.oauthConfig;

  return (
    <div className="border-b border-stone-200/10 px-4 py-4 last:border-b-0">
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="text-sm text-stone-100">{provider.label}</span>
        {isConfigured ? (
          <span className="border border-emerald-200/30 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-300/90">
            Configured
          </span>
        ) : (
          <span className="border border-stone-200/18 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-stone-500">
            Not set
          </span>
        )}
        <a
          href={provider.docUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-[11px] text-stone-500 hover:text-stone-300 transition-colors"
        >
          Get key ↗
        </a>
        {provider.supportedMethods.length > 1 && (
          <button
            onClick={() => setShowMethods((s) => !s)}
            className="text-[11px] text-stone-500 hover:text-stone-200 inline-flex items-center gap-1"
            aria-expanded={showMethods}
            aria-label="More sign-in methods"
          >
            More <ChevronDown size={11} className={showMethods ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={provider.placeholder}
            className="w-full border border-stone-200/18 bg-[rgb(var(--pm-input))] px-3 py-2 pr-10 font-mono text-sm text-stone-100 outline-none focus:ring-1 focus:ring-emerald-300/35"
          />
          <button
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-200 transition-colors"
            aria-label={show ? 'Hide key' : 'Show key'}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button
          onClick={() => void handleSave()}
          disabled={saving || !isDirty}
          title={
            !isDirty && isConfigured
              ? 'Already saved — start typing to change the value'
              : !isDirty
                ? 'Enter a key to save'
                : undefined
          }
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
            !isDirty && isConfigured
              ? 'bg-emerald-700/70 text-emerald-100 disabled:opacity-100'
              : 'bg-stone-100 text-[rgb(var(--pm-panel))] hover:bg-amber-100 disabled:opacity-40'
          }`}
        >
          {saving ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Saving…
            </>
          ) : !isDirty && isConfigured ? (
            <>
              <Check size={13} />
              Saved
            </>
          ) : (
            'Save'
          )}
        </button>
        {isConfigured && (
          <button
            onClick={() => void handleClear()}
            disabled={saving}
            title="Clear this key"
            className="px-3 py-2 text-sm text-stone-500 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
        )}
      </div>

      {showMethods && (
        <div className="mt-3 space-y-1.5 border-l border-stone-200/15 pl-3 text-[11px]">
          {hasOAuth && (
            <button
              onClick={() => onOpenOAuth(provider)}
              disabled={!isTauri}
              className="inline-flex items-center gap-1.5 text-stone-300 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              title={isTauri ? undefined : 'OAuth requires the desktop app'}
            >
              <LogIn size={11} /> Sign in with browser (OAuth Device Flow)
            </button>
          )}
          {provider.supportedMethods.includes('envImport') && (
            <p className="text-stone-500">
              Or use the <span className="text-stone-300">Import from .env</span> button above to bulk-import.
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

function SectionCard({
  title,
  icon,
  subtitle,
  isTauri,
  providers,
  onOpenOAuth,
  reloadToken,
}: {
  title: string;
  icon: React.ReactNode;
  subtitle: string;
  isTauri: boolean;
  providers: ProviderSpec[];
  onOpenOAuth: (p: ProviderSpec) => void;
  reloadToken: number;
}) {
  return (
    <section className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72">
      <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3">
        {icon}
        <div>
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">{title}</h2>
          <p className="mt-0.5 text-[11px] text-stone-400">{subtitle}</p>
        </div>
        {isTauri ? (
          <span className="ml-auto border border-emerald-200/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-300/80">
            macOS Keychain
          </span>
        ) : (
          <span className="ml-auto border border-stone-200/18 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-stone-500">
            dev: localStorage
          </span>
        )}
      </div>
      <div>
        {providers.map((p) => (
          <ProviderRow
            key={p.id}
            provider={p}
            isTauri={isTauri}
            onOpenOAuth={onOpenOAuth}
            reloadToken={reloadToken}
          />
        ))}
      </div>
    </section>
  );
}

export function KeysView() {
  const [isTauri, setIsTauri] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<ProviderSpec | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [importedFlash, setImportedFlash] = useState('');

  // Provider fallback order state
  const [providerOrder, setProviderOrderState] = useState<ProviderOrderEntry[]>([]);
  const [keyStatus, setKeyStatus] = useState<Record<LlmProviderId, boolean>>(EMPTY_KEY_STATUS);
  const [testPrompt, setTestPrompt] = useState(
    [
      'You are being evaluated for the Project Manager AI Scan pipeline (one-shot JSON extraction).',
      'Reply with ONLY this JSON, no markdown fences:',
      '{',
      '  "model_self_id": "<your model name and version, as you understand it>",',
      '  "strengths": ["<3-5 short phrases describing what you are best at>"],',
      '  "weaknesses": ["<2-3 short phrases>"],',
      '  "cost_tier": "low | medium | high",',
      '  "json_reliability": "<your honest 0-10 self-rating for strict JSON output>"',
      '}',
    ].join('\n'),
  );
  const [testingId, setTestingId] = useState<LlmProviderId | null>(null);
  interface PlaygroundResult {
    content?: string;
    error?: string;
    latencyMs: number;
    inputTokens?: number;
    outputTokens?: number;
    model: string;
    at: number;
  }
  const [results, setResults] = useState<Partial<Record<LlmProviderId, PlaygroundResult>>>({});

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const order = await loadProviderOrder();
      if (cancelled) return;
      setProviderOrderState(order);
      const availability = await Promise.all(
        ALL_LLM_PROVIDERS.map(async (p) => [p, await hasProviderKey(p)] as const),
      );
      if (cancelled) return;
      const next: Record<LlmProviderId, boolean> = { ...EMPTY_KEY_STATUS };
      for (const [p, ok] of availability) next[p] = ok;
      setKeyStatus(next);
    };
    void refresh();
    const onFocus = () => void refresh();
    if (typeof window !== 'undefined') window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus);
    };
  }, [reloadToken]);

  const commitOrder = (next: ProviderOrderEntry[]) => {
    setProviderOrderState(next);
    void saveProviderOrder(next);
  };

  const moveProvider = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= providerOrder.length) return;
    const next = [...providerOrder];
    [next[index], next[target]] = [next[target], next[index]];
    commitOrder(next);
  };

  const toggleProvider = (index: number) => {
    const next = providerOrder.map((entry, i) =>
      i === index ? { ...entry, enabled: !entry.enabled } : entry,
    );
    commitOrder(next);
  };

  const setProviderModel = (provider: LlmProviderId, model: string) => {
    const next = providerOrder.map((entry) =>
      entry.provider === provider ? { ...entry, model } : entry,
    );
    commitOrder(next);
  };

  const handleTestProvider = async (provider: LlmProviderId) => {
    const entry = providerOrder.find((e) => e.provider === provider);
    if (!entry) return;
    const model = entry.model;
    setTestingId(provider);
    const start = performance.now();
    try {
      const apiKey = await loadProviderKey(provider);
      if (!apiKey.trim()) throw new Error('No API key saved for this provider');
      const r = await callSingleProvider(provider, apiKey, testPrompt, model);
      setResults((prev) => ({
        ...prev,
        [provider]: {
          content: r.content,
          latencyMs: Math.round(performance.now() - start),
          inputTokens: r.inputTokens,
          outputTokens: r.outputTokens,
          model: r.model,
          at: Date.now(),
        },
      }));
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [provider]: {
          error: e instanceof Error ? e.message : String(e),
          latencyMs: Math.round(performance.now() - start),
          model: model ?? '?',
          at: Date.now(),
        },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const clearResult = (provider: LlmProviderId) =>
    setResults((prev) => {
      if (!(provider in prev)) return prev;
      const next = { ...prev };
      delete next[provider];
      return next;
    });

  const configuredButDisabled = providerOrder.filter(
    (entry) => !entry.enabled && keyStatus[entry.provider],
  );
  const handleEnableAllConfigured = async () => {
    const ids = configuredButDisabled.map((entry) => entry.provider);
    await bulkEnableConfiguredProviders(ids);
    const next = await loadProviderOrder();
    setProviderOrderState(next);
  };

  const aiProviders = providersByCategory('ai');
  const integrationProviders = providersByCategory('integration');

  const handleImported = (count: number) => {
    setShowImport(false);
    setReloadToken((n) => n + 1);
    setImportedFlash(`Imported ${count} key${count === 1 ? '' : 's'} into ${isTauri ? 'Keychain' : 'localStorage'}.`);
    setTimeout(() => setImportedFlash(''), 4000);
  };

  const handleOAuthAuthorized = () => {
    setOauthProvider(null);
    setReloadToken((n) => n + 1);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">Keys</h1>
          <button
            onClick={() => setShowImport(true)}
            className="ml-auto inline-flex items-center gap-1.5 border border-stone-200/22 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-stone-200 hover:bg-stone-200/8"
          >
            <Upload size={12} /> Import from .env
          </button>
        </div>
        <p className="mt-1 text-xs text-stone-400">
          API keys and tokens.{' '}
          {isTauri
            ? 'All secrets are stored in the macOS Keychain — never written to disk in plaintext.'
            : 'In dev mode, stored in localStorage. In production (Tauri), stored in OS Keychain.'}
        </p>
        {importedFlash && (
          <p className="mt-2 inline-block border border-emerald-300/35 bg-emerald-300/8 px-2 py-1 text-[11px] text-emerald-200">
            {importedFlash}
          </p>
        )}
      </div>

      <SectionCard
        title="AI Providers"
        icon={<Sparkles size={15} className="text-amber-100" />}
        subtitle="Keys used by AI adapters and the Rust call_anthropic bridge."
        isTauri={isTauri}
        providers={aiProviders}
        onOpenOAuth={setOauthProvider}
        reloadToken={reloadToken}
      />

      <section className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72">
        <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3">
          <Sparkles size={15} className="text-amber-100" />
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
            AI Provider Fallback Order
          </h2>
        </div>
        <div className="space-y-2 p-4">
          <p className="text-xs text-stone-400">
            When AI Scan / Initialize runs, providers are tried top-down. Failures fall through
            automatically. Disable a provider to skip it entirely, or reorder with the arrows.
          </p>
          {configuredButDisabled.length > 0 && (
            <div className="flex items-center justify-between border border-amber-200/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
              <span>
                {configuredButDisabled.length} provider
                {configuredButDisabled.length === 1 ? ' has' : 's have'} a saved key but
                {configuredButDisabled.length === 1 ? ' is' : ' are'} skipped by the fallback chain.
              </span>
              <button
                type="button"
                onClick={() => void handleEnableAllConfigured()}
                className="ml-3 shrink-0 border border-amber-200/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-amber-50 hover:bg-amber-500/30"
              >
                Enable all {configuredButDisabled.length}
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-400">
              Test prompt — applied to every row&apos;s Test button
            </label>
            <textarea
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              rows={9}
              spellCheck={false}
              className="w-full resize-y border border-stone-200/15 bg-[rgb(var(--pm-input))] p-3 font-mono text-[11px] leading-relaxed text-stone-100 outline-none focus:ring-1 focus:ring-emerald-300/35"
            />
            <p className="text-[10px] text-stone-500">
              Fire a row&apos;s Test button to send this prompt to that provider with the
              selected model. The response, latency, and token usage appear inline below
              the row so you can compare cost / quality side-by-side.
            </p>
          </div>

          <ul className="space-y-1.5">
            {providerOrder.map((entry, index) => {
              const configured = keyStatus[entry.provider];
              const spec = listLlmProviders().find((s) => s.id === entry.provider);
              const selectedModel = entry.model ?? spec?.defaultModel ?? '';
              const result = results[entry.provider];
              const isTestingThisRow = testingId === entry.provider;
              return (
                <li
                  key={entry.provider}
                  className="border border-stone-200/12 bg-[rgb(var(--pm-input))]"
                >
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="w-5 text-center font-mono text-[11px] text-stone-500">
                      {index + 1}
                    </span>
                    <input
                      type="checkbox"
                      checked={entry.enabled}
                      onChange={() => toggleProvider(index)}
                      className="h-3.5 w-3.5 cursor-pointer accent-emerald-400"
                      aria-label={`Enable ${PROVIDER_LABEL[entry.provider]}`}
                    />
                    <span
                      className={`min-w-[10rem] text-sm ${entry.enabled ? 'text-stone-100' : 'text-stone-500 line-through'}`}
                    >
                      {PROVIDER_LABEL[entry.provider]}
                    </span>
                    {spec && (
                      <select
                        value={selectedModel}
                        onChange={(e) => setProviderModel(entry.provider, e.target.value)}
                        title={`Model for ${PROVIDER_LABEL[entry.provider]}`}
                        aria-label={`Model for ${PROVIDER_LABEL[entry.provider]}`}
                        className="w-[14rem] shrink-0 truncate border border-stone-200/20 bg-[rgb(var(--pm-input))] px-2 py-1 font-mono text-[11px] text-stone-200 outline-none focus:ring-1 focus:ring-emerald-300/35"
                      >
                        {spec.availableModels.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    )}
                    <span
                      className={`border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] ${
                        configured
                          ? entry.enabled
                            ? 'border-emerald-200/30 text-emerald-300/90'
                            : 'border-stone-200/20 text-stone-500'
                          : 'border-stone-200/18 text-stone-500'
                      }`}
                    >
                      {configured ? 'Configured' : 'Not set'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleTestProvider(entry.provider)}
                      disabled={
                        !isTauri ||
                        !configured ||
                        isTestingThisRow ||
                        testPrompt.trim().length === 0
                      }
                      title={
                        !isTauri
                          ? 'Testing requires the desktop app (Rust bridge calls the provider directly).'
                          : !configured
                            ? 'Save an API key in Keys first.'
                            : 'Send the prompt below to this provider/model.'
                      }
                      className="inline-flex h-6 items-center gap-1 border border-cyan-200/30 bg-cyan-500/15 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isTestingThisRow ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Play size={11} />
                      )}
                      Test
                    </button>
                    <button
                      type="button"
                      onClick={() => moveProvider(index, -1)}
                      disabled={index === 0}
                      title="Move up"
                      aria-label={`Move ${PROVIDER_LABEL[entry.provider]} up`}
                      className="flex h-6 w-6 items-center justify-center text-stone-400 hover:bg-white/5 hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveProvider(index, 1)}
                      disabled={index === providerOrder.length - 1}
                      title="Move down"
                      aria-label={`Move ${PROVIDER_LABEL[entry.provider]} down`}
                      className="flex h-6 w-6 items-center justify-center text-stone-400 hover:bg-white/5 hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                  {result && (
                    <div className="border-t border-stone-200/12 bg-[rgb(var(--pm-deep))] px-3 py-2 text-[11px]">
                      <div className="mb-1 flex flex-wrap items-center gap-3 text-stone-500">
                        <span>
                          {result.error ? (
                            <span className="text-red-300">failed</span>
                          ) : (
                            <span className="text-emerald-300">ok</span>
                          )}{' '}
                          · {result.latencyMs} ms
                          {result.inputTokens != null && result.outputTokens != null && (
                            <> · in {result.inputTokens} / out {result.outputTokens} tokens</>
                          )}
                          {' · '}
                          <code className="font-mono">{result.model}</code>
                        </span>
                        <button
                          type="button"
                          onClick={() => clearResult(entry.provider)}
                          className="ml-auto text-stone-500 hover:text-stone-200"
                          title="Clear this result"
                          aria-label="Clear result"
                        >
                          <X size={11} />
                        </button>
                      </div>
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-stone-200">
                        {result.error ?? result.content ?? ''}
                      </pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-[10px] text-stone-500">
            Tip: providers without a saved API key are skipped automatically — they aren&apos;t
            disabled here, so adding the key later lights them up without revisiting this section.
          </p>
        </div>
      </section>

      <SectionCard
        title="Integrations"
        icon={<Github size={15} className="text-stone-300" />}
        subtitle="Tokens for external services such as GitHub polling."
        isTauri={isTauri}
        providers={integrationProviders}
        onOpenOAuth={setOauthProvider}
        reloadToken={reloadToken}
      />

      <section className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72">
        <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3">
          <KeyRound size={15} className="text-stone-400" />
          <div>
            <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">Storage</h2>
            <p className="mt-0.5 text-[11px] text-stone-400">How secrets are persisted.</p>
          </div>
        </div>
        <div className="space-y-2 p-4">
          {[
            { label: 'Backend', value: isTauri ? 'OS Keychain (keyring crate)' : 'localStorage', ok: isTauri },
            { label: 'Renderer access', value: 'None — proxied via Rust bridge', ok: true },
            { label: 'Disk plaintext', value: 'Never', ok: true },
            { label: 'Providers tracked', value: `${PROVIDERS.length}`, ok: true },
          ].map(({ label, value, ok }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-stone-400">{label}</span>
              <span className={`font-mono text-xs ${ok ? 'text-emerald-300' : 'text-stone-500'}`}>{value}</span>
            </div>
          ))}
        </div>
      </section>

      {showImport && (
        <EnvImportModal onClose={() => setShowImport(false)} onImported={handleImported} />
      )}
      {oauthProvider && (
        <OAuthDeviceModal
          provider={oauthProvider}
          onClose={() => setOauthProvider(null)}
          onAuthorized={handleOAuthAuthorized}
        />
      )}
    </div>
  );
}
