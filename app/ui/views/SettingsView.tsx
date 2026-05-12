'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { KeyRound, Keyboard, Monitor, Server } from 'lucide-react';

export function SettingsView() {
  const [hotkeyEnabled, setHotkeyEnabled] = useState(false);
  const [trayEnabled, setTrayEnabled] = useState(false);

  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }, []);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">Settings</h1>
        <p className="mt-1 text-xs text-stone-400">Adapters and system preferences.</p>
      </div>

      {/* Keys shortcut */}
      <Link
        href="/keys"
        className="flex items-center gap-3 border border-stone-200/18 bg-[#071d1a]/72 px-4 py-3 transition-colors hover:border-stone-200/30 hover:bg-white/5"
      >
        <KeyRound size={15} className="text-amber-100" />
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">API Keys &amp; Tokens</p>
          <p className="mt-0.5 text-[11px] text-stone-400">Manage Anthropic, OpenAI, GitHub tokens and more.</p>
        </div>
        <span className="ml-auto text-stone-500">→</span>
      </Link>

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
                className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  hotkeyEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
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
