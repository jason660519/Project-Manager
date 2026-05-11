'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Key, Keyboard, Monitor, Server } from 'lucide-react';
import { getSecret, setSecret } from '../../../lib/bridge';

const KEYCHAIN_SERVICE = 'devpilot';
const KEYCHAIN_KEY = 'anthropic-api-key';
const LS_KEY = 'devpilot-api-key';

export function SettingsView() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [keychainError, setKeychainError] = useState('');
  const [hotkeyEnabled, setHotkeyEnabled] = useState(false);
  const [trayEnabled, setTrayEnabled] = useState(false);

  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  // Load API key on mount: Keychain in Tauri, localStorage in browser.
  useEffect(() => {
    if (isTauri) {
      getSecret(KEYCHAIN_SERVICE, KEYCHAIN_KEY)
        .then((val) => { if (val) setApiKey(val); })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : String(e);
          setKeychainError(`Keychain read error: ${msg}`);
        });
    } else {
      const stored = localStorage.getItem(LS_KEY) ?? '';
      if (stored) setApiKey(stored);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveKey = async () => {
    setKeychainError('');
    try {
      if (isTauri) {
        await setSecret(KEYCHAIN_SERVICE, KEYCHAIN_KEY, apiKey);
      } else {
        localStorage.setItem(LS_KEY, apiKey);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setKeychainError(`Keychain write error: ${msg}`);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">Settings</h1>
        <p className="mt-1 text-xs text-stone-400">API keys, adapters, and system preferences.</p>
      </div>

      {/* API Key */}
      <section className="border border-stone-200/18 bg-[#071d1a]/72">
        <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3">
          <Key size={15} className="text-amber-100" />
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
            Anthropic API Key
          </h2>
          {!isTauri && (
            <span className="ml-auto border border-stone-200/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-stone-400">
              dev: localStorage
            </span>
          )}
          {isTauri && (
            <span className="ml-auto border border-emerald-200/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-emerald-300/80">
              macOS Keychain
            </span>
          )}
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-stone-400">
            {isTauri
              ? 'Stored securely in macOS Keychain. The key is never exposed to the renderer process.'
              : 'In dev mode, stored in localStorage. In production (Tauri), stored in OS Keychain.'}
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 pr-10 font-mono text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
              />
              <button
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-100"
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              onClick={() => void handleSaveKey()}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                saved
                  ? 'bg-emerald-700 text-emerald-100'
                  : 'bg-stone-100 text-[#071d1a] hover:bg-amber-100'
              }`}
            >
              {saved ? 'Saved ✓' : 'Save Key'}
            </button>
          </div>
          {keychainError && (
            <p className="text-[11px] text-red-400">{keychainError}</p>
          )}
        </div>
      </section>

      {/* Global Hotkey */}
      <section className="border border-stone-200/18 bg-[#071d1a]/72">
        <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3">
          <Keyboard size={15} className="text-stone-300" />
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
            Global Hotkey
          </h2>
          <span className="ml-auto border border-amber-200/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-100/80">
            P2
          </span>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-stone-400">
            Press a global shortcut to open the Quick Dispatch overlay from any app. Requires Tauri
            plugin registration.
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="border border-stone-200/20 px-2 py-1 font-mono text-sm text-stone-200">
                ⌘K
              </span>
              <span className="text-xs text-stone-400">Quick Dispatch Overlay</span>
            </div>
            <button
              onClick={() => setHotkeyEnabled((e) => !e)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                hotkeyEnabled ? 'bg-emerald-600' : 'bg-stone-600'
              } ${!isTauri ? 'cursor-not-allowed opacity-50' : ''}`}
              disabled={!isTauri}
              title={!isTauri ? 'Requires Tauri runtime' : undefined}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  hotkeyEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          {!isTauri && (
            <p className="text-[11px] text-amber-100/60">
              Hotkey registration not available in browser dev mode.
            </p>
          )}
        </div>
      </section>

      {/* System Tray */}
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
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  trayEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          {!isTauri && (
            <p className="text-[11px] text-amber-100/60">Requires Tauri runtime.</p>
          )}
        </div>
      </section>

      {/* Runtime Bridge Info */}
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
