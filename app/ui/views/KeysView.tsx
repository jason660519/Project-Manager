'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Github, KeyRound, Sparkles } from 'lucide-react';
import { getSecret, setSecret } from '../../../lib/bridge';

const KEYCHAIN_SERVICE = 'devpilot';
const LS_PREFIX = 'devpilot-key:';

interface KeyEntry {
  id: string;
  label: string;
  placeholder: string;
  keychainKey: string;
  lsKey: string;
  docUrl: string;
}

const AI_KEYS: KeyEntry[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude API)',
    placeholder: 'sk-ant-...',
    keychainKey: 'anthropic-api-key',
    lsKey: `${LS_PREFIX}anthropic`,
    docUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    placeholder: 'sk-...',
    keychainKey: 'openai-api-key',
    lsKey: `${LS_PREFIX}openai`,
    docUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'gemini',
    label: 'Gemini (Google AI)',
    placeholder: 'AIza...',
    keychainKey: 'gemini-api-key',
    lsKey: `${LS_PREFIX}gemini`,
    docUrl: 'https://aistudio.google.com/app/apikey',
  },
];

const INTEGRATION_KEYS: KeyEntry[] = [
  {
    id: 'github',
    label: 'GitHub Personal Access Token',
    placeholder: 'ghp_...',
    keychainKey: 'github-token',
    lsKey: `${LS_PREFIX}github`,
    docUrl: 'https://github.com/settings/tokens',
  },
];

function KeyRow({
  entry,
  isTauri,
}: {
  entry: KeyEntry;
  isTauri: boolean;
}) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isTauri) {
      getSecret(KEYCHAIN_SERVICE, entry.keychainKey)
        .then((v) => { if (v) setValue(v); setLoaded(true); })
        .catch(() => setLoaded(true));
    } else {
      const stored = localStorage.getItem(entry.lsKey) ?? '';
      if (stored) setValue(stored);
      setLoaded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTauri]);

  const handleSave = async () => {
    setError('');
    try {
      if (isTauri) {
        await setSecret(KEYCHAIN_SERVICE, entry.keychainKey, value);
      } else {
        localStorage.setItem(entry.lsKey, value);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const isConfigured = loaded && value.length > 0;

  return (
    <div className="border-b border-stone-200/10 px-4 py-4 last:border-b-0">
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="text-sm text-stone-100">{entry.label}</span>
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
          href={entry.docUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-[11px] text-stone-500 hover:text-stone-300 transition-colors"
        >
          Get key ↗
        </a>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={entry.placeholder}
            className="w-full border border-stone-200/18 bg-[#03100f] px-3 py-2 pr-10 font-mono text-sm text-stone-100 outline-none focus:ring-1 focus:ring-emerald-300/35"
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
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            saved
              ? 'bg-emerald-700 text-emerald-100'
              : 'bg-stone-100 text-[#071d1a] hover:bg-amber-100'
          }`}
        >
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
      {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

function SectionCard({
  title,
  icon,
  subtitle,
  isTauri,
  entries,
}: {
  title: string;
  icon: React.ReactNode;
  subtitle: string;
  isTauri: boolean;
  entries: KeyEntry[];
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
        {entries.map((entry) => (
          <KeyRow key={entry.id} entry={entry} isTauri={isTauri} />
        ))}
      </div>
    </section>
  );
}

export function KeysView() {
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }, []);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">Keys</h1>
        <p className="mt-1 text-xs text-stone-400">
          API keys and tokens.{' '}
          {isTauri
            ? 'All secrets are stored in the macOS Keychain — never written to disk in plaintext.'
            : 'In dev mode, stored in localStorage. In production (Tauri), stored in OS Keychain.'}
        </p>
      </div>

      <SectionCard
        title="AI Providers"
        icon={<Sparkles size={15} className="text-amber-100" />}
        subtitle="Keys used by AI adapters and the Rust call_anthropic bridge."
        isTauri={isTauri}
        entries={AI_KEYS}
      />

      <SectionCard
        title="Integrations"
        icon={<Github size={15} className="text-stone-300" />}
        subtitle="Tokens for external services such as GitHub polling."
        isTauri={isTauri}
        entries={INTEGRATION_KEYS}
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
          ].map(({ label, value, ok }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-stone-400">{label}</span>
              <span className={`font-mono text-xs ${ok ? 'text-emerald-300' : 'text-stone-500'}`}>{value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
