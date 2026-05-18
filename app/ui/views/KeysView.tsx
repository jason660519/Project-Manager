'use client';

import { useEffect, useState } from 'react';
import {
  ChevronDown,
  Eye,
  EyeOff,
  Github,
  KeyRound,
  LogIn,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  PROVIDERS,
  providersByCategory,
  type ProviderSpec,
} from '../../../lib/keys/registry';
import { loadProviderSecret, saveProviderSecret } from '../../../lib/keys/keychain';
import { EnvImportModal } from './_components/EnvImportModal';
import { OAuthDeviceModal } from './_components/OAuthDeviceModal';

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
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [showMethods, setShowMethods] = useState(false);

  useEffect(() => {
    loadProviderSecret(provider)
      .then((v) => {
        setValue(v);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [provider, reloadToken]);

  const handleSave = async () => {
    setError('');
    try {
      await saveProviderSecret(provider, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleClear = async () => {
    if (!value) return;
    if (typeof window !== 'undefined' && !window.confirm(`Clear the ${provider.label} key?`)) return;
    setError('');
    try {
      await saveProviderSecret(provider, '');
      setValue('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const isConfigured = loaded && value.length > 0;
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
            className="w-full border border-stone-200/18 bg-[#03100f] px-3 py-2 pr-10 font-mono text-sm text-stone-100 outline-none focus:ring-1 focus:ring-emerald-300/35"
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
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            saved
              ? 'bg-emerald-700 text-emerald-100'
              : 'bg-stone-100 text-[#071d1a] hover:bg-amber-100'
          }`}
        >
          {saved ? 'Saved ✓' : 'Save'}
        </button>
        {isConfigured && (
          <button
            onClick={() => void handleClear()}
            title="Clear this key"
            className="px-3 py-2 text-sm text-stone-500 hover:text-red-400"
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
    <section className="border border-stone-200/18 bg-[#071d1a]/72">
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

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }, []);

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

      <SectionCard
        title="Integrations"
        icon={<Github size={15} className="text-stone-300" />}
        subtitle="Tokens for external services such as GitHub polling."
        isTauri={isTauri}
        providers={integrationProviders}
        onOpenOAuth={setOauthProvider}
        reloadToken={reloadToken}
      />

      <section className="border border-stone-200/18 bg-[#071d1a]/72">
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
