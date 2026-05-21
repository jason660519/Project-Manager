'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, Eye, EyeOff, Github, LogIn, Sparkles, Upload, Loader2, Check } from 'lucide-react';
import { PROVIDERS, providersByCategory, type ProviderSpec } from '../../../../lib/keys/registry';
import { loadProviderSecret, saveProviderSecret } from '../../../../lib/keys/keychain';
import { EnvImportModal } from '../_components/EnvImportModal';
import { OAuthDeviceModal } from '../_components/OAuthDeviceModal';
import { ALL_LLM_PROVIDERS, loadProviderOrder, saveProviderOrder, type LlmProviderId, type ProviderOrderEntry } from '../../../../lib/keys/providerOrder';
import { hasProviderKey } from '../../../../lib/keys/loadProviderKey';

function ProviderRow({
  provider,
  isTauri,
  onOpenOAuth,
  reloadToken,
}: {
  provider: ProviderSpec;
  isTauri: boolean;
  onOpenOAuth: (p: ProviderSpec) => void;
  reloadToken: number;
}) {
  const [value, setValue] = useState('');
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

  // Simulate dynamic model discovery for the UI
  const availableModels = (provider as any).availableModels || [];

  return (
    <div className="border-b border-stone-200/10 px-4 py-4 last:border-b-0">
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="text-sm text-stone-100">{provider.label}</span>
        {isConfigured ? (
          <span className="border border-emerald-200/30 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-300/90 shadow-[0_0_8px_rgba(52,211,153,0.15)]">
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
      </div>

      <div className="flex gap-2 mb-2">
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
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button
          onClick={() => void handleSave()}
          disabled={saving || !isDirty}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
            !isDirty && isConfigured
              ? 'bg-emerald-700/70 text-emerald-100 disabled:opacity-100'
              : 'bg-stone-100 text-[rgb(var(--pm-panel))] hover:bg-amber-100 disabled:opacity-40'
          }`}
        >
          {saving ? (
            <><Loader2 size={13} className="animate-spin" /> Saving…</>
          ) : !isDirty && isConfigured ? (
            <><Check size={13} /> Saved</>
          ) : (
            'Save'
          )}
        </button>
        {isConfigured && (
          <button
            onClick={() => void handleClear()}
            disabled={saving}
            className="px-3 py-2 text-sm text-stone-500 hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {isConfigured && availableModels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {availableModels.map((m: string) => (
            <span key={m} className="px-2 py-0.5 rounded-full bg-stone-800 border border-stone-700 text-[10px] text-stone-400 font-mono">
              {m}
            </span>
          ))}
        </div>
      )}

      {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

export function ApiConfigSheet({ isTauri }: { isTauri: boolean }) {
  const [showImport, setShowImport] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<ProviderSpec | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const aiProviders = providersByCategory('ai');
  const integrationProviders = providersByCategory('integration');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-400">
          Manage your API keys. Keys are validated and securely stored.
        </p>
        <button
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-1.5 border border-stone-200/22 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-stone-200 hover:bg-stone-200/8 transition-colors"
        >
          <Upload size={12} /> Import from .env
        </button>
      </div>

      <section className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72 shadow-xl backdrop-blur-sm">
        <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3 bg-white/[0.02]">
          <Sparkles size={15} className="text-emerald-400" />
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">AI Providers</h2>
        </div>
        <div>
          {aiProviders.map((p) => (
            <ProviderRow
              key={p.id}
              provider={p}
              isTauri={isTauri}
              onOpenOAuth={setOauthProvider}
              reloadToken={reloadToken}
            />
          ))}
        </div>
      </section>

      <section className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72 shadow-xl backdrop-blur-sm">
        <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3 bg-white/[0.02]">
          <Github size={15} className="text-stone-300" />
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">Integrations</h2>
        </div>
        <div>
          {integrationProviders.map((p) => (
            <ProviderRow
              key={p.id}
              provider={p}
              isTauri={isTauri}
              onOpenOAuth={setOauthProvider}
              reloadToken={reloadToken}
            />
          ))}
        </div>
      </section>

      {showImport && (
        <EnvImportModal onClose={() => setShowImport(false)} onImported={() => setReloadToken(n => n + 1)} />
      )}
      {oauthProvider && (
        <OAuthDeviceModal
          provider={oauthProvider}
          onClose={() => setOauthProvider(null)}
          onAuthorized={() => {
            setOauthProvider(null);
            setReloadToken(n => n + 1);
          }}
        />
      )}
    </div>
  );
}
