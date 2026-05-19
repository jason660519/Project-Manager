'use client';

import { useEffect, useState } from 'react';
import { Monitor, Server } from 'lucide-react';

import { getSecretsStorageBackend } from '../../../lib/bridge';
import { formatSecretsStorageLabel } from '../../../lib/keys/secretsStorageLabel';
import { KeyboardShortcutsView } from './KeyboardShortcutsView';

export function SettingsView() {
  const [trayEnabled, setTrayEnabled] = useState(false);
  const [isTauri, setIsTauri] = useState(false);
  const [secretsBackend, setSecretsBackend] = useState('localStorage');

  useEffect(() => {
    const tauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    setIsTauri(tauri);
    if (!tauri) {
      setSecretsBackend('localStorage');
      return;
    }
    getSecretsStorageBackend()
      .then(setSecretsBackend)
      .catch(() => setSecretsBackend('keychain'));
  }, []);

  const secretStorageLabel = formatSecretsStorageLabel(secretsBackend, isTauri);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">Settings</h1>
        <p className="mt-1 text-xs text-stone-400">Adapters and system preferences.</p>
      </div>

      <section className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72">
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

      <section className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72">
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
            { label: 'Secret Storage', value: secretStorageLabel, accent: isTauri },
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

      <KeyboardShortcutsView />
    </div>
  );
}
