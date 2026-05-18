'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Monitor, Play, Server, Sparkles, X } from 'lucide-react';

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

// Derive label map from the registry so adding a provider is a one-file change.
const PROVIDER_LABEL = Object.fromEntries(
  listLlmProviders().map((spec) => [spec.id, spec.label]),
) as Record<LlmProviderId, string>;

// Same shape, all `false` — used to seed the configured-key map.
const EMPTY_KEY_STATUS = Object.fromEntries(
  ALL_LLM_PROVIDERS.map((id) => [id, false]),
) as Record<LlmProviderId, boolean>;

export function SettingsView() {
  const [trayEnabled, setTrayEnabled] = useState(false);
  const [isTauri, setIsTauri] = useState(false);

  const [providerOrder, setProviderOrderState] = useState<ProviderOrderEntry[]>([]);
  const [keyStatus, setKeyStatus] = useState<Record<LlmProviderId, boolean>>(EMPTY_KEY_STATUS);

  // Playground state. One shared prompt across providers (so the user can A/B
  // the same input), per-provider Test state, and a per-provider result panel
  // that expands inline below the row.
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
  }, []);

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

  /** Fire the shared prompt against one provider and store the result. */
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

  // One-click recovery: turn on every provider that has a stored key but is
  // currently disabled in the chain. The pre-auto-enable era + "default
  // disabled when a new provider lands" rule leaves a lot of these around.
  const configuredButDisabled = providerOrder.filter(
    (entry) => !entry.enabled && keyStatus[entry.provider],
  );
  const handleEnableAllConfigured = async () => {
    const ids = configuredButDisabled.map((entry) => entry.provider);
    await bulkEnableConfiguredProviders(ids);
    // Pull the fresh order back so the UI reflects the change immediately.
    const next = await loadProviderOrder();
    setProviderOrderState(next);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">Settings</h1>
        <p className="mt-1 text-xs text-stone-400">Adapters and system preferences.</p>
      </div>

      <section className="border border-stone-200/18 bg-[#071d1a]/72">
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

          {/* Shared test prompt — placed ABOVE the provider list so the
              read order matches the workflow: "type prompt → click Test on
              each row → compare results inline below the row". */}
          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-400">
              Test prompt — applied to every row&apos;s Test button
            </label>
            <textarea
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              rows={9}
              spellCheck={false}
              className="w-full resize-y border border-stone-200/15 bg-[#03100f] p-3 font-mono text-[11px] leading-relaxed text-stone-100 outline-none focus:ring-1 focus:ring-emerald-300/35"
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
                  className="border border-stone-200/12 bg-[#03100f]"
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
                        className="w-[14rem] shrink-0 truncate border border-stone-200/20 bg-[#03100f] px-2 py-1 font-mono text-[11px] text-stone-200 outline-none focus:ring-1 focus:ring-emerald-300/35"
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
                    <div className="border-t border-stone-200/12 bg-[#020908] px-3 py-2 text-[11px]">
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
            disabled here, so adding the key later lights them up without revisiting Settings.
          </p>
        </div>
      </section>

      <section className="border border-stone-200/18 bg-[#071d1a]/72">
        <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3">
          <Monitor size={15} className="text-stone-300" />
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
            System Tray
          </h2>
          <span className="ml-auto border border-amber-200/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-100/80">
            P2
          </span>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-stone-400">
            Show a system tray icon with active run count. Requires Tauri system tray plugin.
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-200">Enable on Launch</span>
            <button
              onClick={() => setTrayEnabled((e) => !e)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                trayEnabled ? 'bg-emerald-600' : 'bg-stone-600'
              } ${!isTauri ? 'cursor-not-allowed opacity-50' : ''}`}
              disabled={!isTauri}
            >
              <span
                className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  trayEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          {!isTauri && (
            <p className="text-[11px] text-amber-100/60">Requires Tauri runtime.</p>
          )}
        </div>
      </section>

      <section className="border border-stone-200/18 bg-[#071d1a]/72">
        <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3">
          <Server size={15} className="text-stone-300" />
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
            Runtime Bridge
          </h2>
        </div>
        <div className="space-y-2 p-4">
          {[
            { label: 'Mode', value: isTauri ? 'Tauri (Live)' : 'Browser (Dry-run)', accent: isTauri },
            { label: 'AI API Route', value: 'Rust → reqwest', accent: true },
            { label: 'Secret Storage', value: isTauri ? 'macOS Keychain' : 'localStorage', accent: isTauri },
            { label: 'Process Spawn', value: isTauri ? 'active' : 'disabled', accent: isTauri },
          ].map(({ label, value, accent }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-stone-400">{label}</span>
              <span className={`font-mono text-xs ${accent ? 'text-emerald-300' : 'text-stone-500'}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
