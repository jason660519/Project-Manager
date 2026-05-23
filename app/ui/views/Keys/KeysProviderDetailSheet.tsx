'use client';

/**
 * Right-side slide sheet for editing a single provider's API key.
 *
 * Used by the Keys table — clicking a row opens this sheet with the full
 * input form, validation history, and full model list. Mirrors the pattern
 * established by `LlmArenaDetailSheet` (fixed-overlay + ml-auto panel) but
 * specialised for the credential-management flow.
 *
 * The sheet owns the network calls — its parent (the table) only needs to
 * know "user closed" and "metadata changed, please refresh" via callbacks.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  RefreshCw,
  ShieldQuestion,
  Trash2,
  X,
} from 'lucide-react';

import { loadProviderSecret } from '../../../../lib/keys/keychain';
import {
  formatRelativeTime,
  loadProviderMetadata,
  type ProviderMetadata,
} from '../../../../lib/keys/providerMetadata';
import { listLlmProviders } from '../../../../lib/keys/llmProviders';
import type { ProviderSpec } from '../../../../lib/keys/registry';
import {
  clearProviderKey,
  getProviderApiContract,
  revalidateStoredKey,
  saveAndValidateKey,
} from '../../../../lib/keys/validation';

interface KeysProviderDetailSheetProps {
  provider: ProviderSpec | null;
  onClose: () => void;
  /** Called whenever a save/validate/clear succeeds so the table can refresh. */
  onChanged: () => void;
  /**
   * Optional: open the parent's OAuth device-flow modal. Shown as a secondary
   * action when `provider.oauthConfig` is set (currently GitHub only).
   */
  onOpenOAuth?: (provider: ProviderSpec) => void;
}

type Phase = 'idle' | 'saving' | 'revalidating' | 'clearing';

/** Exhaustiveness guard — fail loud if a new ProviderMetadata.status lands without UI coverage. */
function assertNever(value: never): never {
  throw new Error(`Unhandled ProviderMetadata.status: ${String(value)}`);
}

function StatusBadge({ meta, hasKey }: { meta: ProviderMetadata | null; hasKey: boolean }) {
  if (!hasKey) {
    return (
      <span className="inline-flex items-center gap-1.5 border border-stone-200/18 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-stone-500">
        <ShieldQuestion size={11} /> Not set
      </span>
    );
  }
  if (!meta) {
    return (
      <span className="inline-flex items-center gap-1.5 border border-amber-200/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-300/90">
        <ShieldQuestion size={11} /> Configured · not validated
      </span>
    );
  }
  switch (meta.status) {
    case 'ok':
      return (
        <span className="inline-flex items-center gap-1.5 border border-emerald-200/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-300/90 shadow-[0_0_8px_rgba(52,211,153,0.15)]">
          <CheckCircle2 size={11} /> Verified
        </span>
      );
    case 'fail':
      return (
        <span className="inline-flex items-center gap-1.5 border border-rose-300/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-rose-300">
          <AlertTriangle size={11} /> Failed
        </span>
      );
    default:
      return assertNever(meta.status);
  }
}

export function KeysProviderDetailSheet({
  provider,
  onClose,
  onChanged,
  onOpenOAuth,
}: KeysProviderDetailSheetProps) {
  const [value, setValue] = useState('');
  const [savedValue, setSavedValue] = useState('');
  const [show, setShow] = useState(false);
  const [meta, setMeta] = useState<ProviderMetadata | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'fail'; msg: string } | null>(null);

  // Re-load secret + metadata when the sheet opens / switches provider.
  // `cancelled` guards against a stale write if the user closes / switches
  // the sheet before `loadProviderSecret` resolves.
  useEffect(() => {
    if (!provider) return;
    let cancelled = false;
    setValue('');
    setSavedValue('');
    setShow(false);
    setMeta(loadProviderMetadata(provider.id));
    setFeedback(null);
    setPhase('idle');
    loadProviderSecret(provider)
      .then((v) => {
        if (cancelled) return;
        setValue(v);
        setSavedValue(v);
      })
      .catch((err) => {
        // Empty value is the fallback; row UI shows "not set" anyway. Log so
        // unexpected failures (keychain prompt denied, IPC broken) leave a
        // trail rather than vanishing silently.
        console.warn(`[KeysSheet] loadProviderSecret(${provider.id}) failed:`, err);
      });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const hasKey = savedValue.length > 0;
  const isDirty = value !== savedValue;
  const contract = provider ? getProviderApiContract(provider) : null;
  const supportsValidation = contract !== null;

  // Source-of-truth for the model list shown in the sheet: dynamic if we
  // have any from a successful validation, otherwise the static catalogue.
  const staticModels = provider
    ? listLlmProviders().find((p) => p.id === provider.id)?.availableModels ?? []
    : [];
  const dynamicModels = meta?.status === 'ok' ? meta.dynamicModels ?? [] : [];
  const modelsForDisplay = dynamicModels.length > 0 ? dynamicModels : staticModels;
  const modelsAreDynamic = dynamicModels.length > 0;

  const refresh = useCallback(() => {
    if (!provider) return;
    setMeta(loadProviderMetadata(provider.id));
    onChanged();
  }, [provider, onChanged]);

  const handleSaveAndValidate = useCallback(async () => {
    if (!provider) return;
    setFeedback(null);
    setPhase('saving');
    try {
      const result = await saveAndValidateKey(provider, value);
      if (result.ok) {
        setSavedValue(value);
        setFeedback({
          kind: 'ok',
          msg: `Validated · ${result.models.length} model${result.models.length === 1 ? '' : 's'} reachable`,
        });
      } else {
        setFeedback({
          kind: 'fail',
          msg: result.errorReason ?? 'Validation failed',
        });
      }
    } catch (e: unknown) {
      console.error(`[KeysSheet] saveAndValidateKey(${provider.id}) threw:`, e);
      setFeedback({
        kind: 'fail',
        msg: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setPhase('idle');
      refresh();
    }
  }, [provider, value, refresh]);

  const handleRevalidate = useCallback(async () => {
    if (!provider) return;
    setFeedback(null);
    setPhase('revalidating');
    try {
      const result = await revalidateStoredKey(provider);
      setFeedback(
        result.ok
          ? {
              kind: 'ok',
              msg: `Validated · ${result.models.length} model${result.models.length === 1 ? '' : 's'} reachable`,
            }
          : { kind: 'fail', msg: result.errorReason ?? 'Validation failed' },
      );
    } catch (e: unknown) {
      console.error(`[KeysSheet] revalidateStoredKey(${provider.id}) threw:`, e);
      setFeedback({
        kind: 'fail',
        msg: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setPhase('idle');
      refresh();
    }
  }, [provider, refresh]);

  const handleClear = useCallback(async () => {
    if (!provider) return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Clear the ${provider.label} key?`)
    ) {
      return;
    }
    setFeedback(null);
    setPhase('clearing');
    try {
      await clearProviderKey(provider);
      setValue('');
      setSavedValue('');
      setFeedback({ kind: 'ok', msg: 'Key cleared' });
    } catch (e: unknown) {
      console.error(`[KeysSheet] clearProviderKey(${provider.id}) threw:`, e);
      setFeedback({
        kind: 'fail',
        msg: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setPhase('idle');
      refresh();
    }
  }, [provider, refresh]);

  if (!provider) return null;

  const busy = phase !== 'idle';

  return (
    <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose}>
      <div
        className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-stone-200/18 bg-[rgb(var(--pm-panel))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200/12 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-stone-100">{provider.label}</h3>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-stone-500">
              {provider.category === 'ai' ? 'AI Provider' : 'Integration'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-200 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Status + last validated */}
        <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3 bg-white/[0.02]">
          <StatusBadge meta={meta} hasKey={hasKey} />
          {meta && (
            <span className="text-[11px] text-stone-500">
              Last validated {formatRelativeTime(meta.lastValidatedAt)}
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
        </div>

        <div className="flex-1 space-y-5 overflow-auto px-4 py-4">
          {/* Key input */}
          <section>
            <h4 className="mb-2 text-[11px] uppercase tracking-[0.14em] text-stone-400">
              API Key
            </h4>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={show ? 'text' : 'password'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={provider.placeholder}
                  className="w-full border border-stone-200/18 bg-[rgb(var(--pm-input))] px-3 py-2 pr-10 font-mono text-sm text-stone-100 outline-none focus:ring-1 focus:ring-emerald-300/50 transition-shadow"
                />
                <button
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-200 transition-colors"
                  aria-label={show ? 'Hide key' : 'Show key'}
                >
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => void handleSaveAndValidate()}
                disabled={busy || !value || !isDirty || !supportsValidation}
                className="inline-flex items-center gap-1.5 bg-stone-100 px-4 py-2 text-sm font-medium text-[rgb(var(--pm-panel))] hover:bg-amber-100 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                {phase === 'saving' ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Validating…
                  </>
                ) : (
                  'Save & Validate'
                )}
              </button>
              {hasKey && supportsValidation && (
                <button
                  onClick={() => void handleRevalidate()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 border border-stone-200/22 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-stone-200 hover:bg-stone-200/8 transition-colors disabled:opacity-40"
                >
                  {phase === 'revalidating' ? (
                    <>
                      <Loader2 size={11} className="animate-spin" /> Re-validating…
                    </>
                  ) : (
                    <>
                      <RefreshCw size={11} /> Re-validate
                    </>
                  )}
                </button>
              )}
              {hasKey && (
                <button
                  onClick={() => void handleClear()}
                  disabled={busy}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-[11px] text-stone-500 hover:text-rose-400 transition-colors disabled:opacity-40"
                >
                  {phase === 'clearing' ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Trash2 size={11} />
                  )}
                  Clear
                </button>
              )}
            </div>
            {!supportsValidation && (
              <p className="mt-2 text-[11px] text-amber-400/80">
                Validation not yet supported for this provider.
              </p>
            )}
            {provider.oauthConfig && onOpenOAuth && (
              <div className="mt-3 border-t border-stone-200/10 pt-3">
                <p className="mb-2 text-[11px] text-stone-500">
                  Or sign in instead of pasting a token:
                </p>
                <button
                  onClick={() => onOpenOAuth(provider)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 border border-stone-200/22 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-stone-200 hover:bg-stone-200/8 transition-colors disabled:opacity-40"
                >
                  <LogIn size={11} /> Connect via OAuth
                </button>
              </div>
            )}
            {feedback && (
              <p
                className={`mt-2 text-[11px] ${
                  feedback.kind === 'ok' ? 'text-emerald-400/90' : 'text-rose-400'
                }`}
              >
                {feedback.msg}
              </p>
            )}
          </section>

          {/* Models */}
          {modelsForDisplay.length > 0 && (
            <section>
              <div className="mb-2 flex items-baseline gap-2">
                <h4 className="text-[11px] uppercase tracking-[0.14em] text-stone-400">
                  Available models
                </h4>
                <span className="text-[10px] text-stone-500">
                  {modelsForDisplay.length} · {modelsAreDynamic ? 'live' : 'catalogue'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {modelsForDisplay.map((m) => (
                  <span
                    key={m}
                    className="px-2 py-0.5 rounded-full bg-stone-800 border border-stone-700 text-[10px] text-stone-300 font-mono"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
