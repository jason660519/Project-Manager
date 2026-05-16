'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, KeyRound, Keyboard, Monitor, Server } from 'lucide-react';

import { skillList, skillMoveFiles } from '../../../lib/bridge';
import { getSkillsDir, setSkillsDir } from '../../../lib/storage/settings';

export function SettingsView() {
  const [hotkeyEnabled, setHotkeyEnabled] = useState(false);
  const [trayEnabled, setTrayEnabled] = useState(false);

  const [isTauri, setIsTauri] = useState(false);

  // Skills directory — current value, edit-buffer, and pending-confirmation modal state.
  const [skillsDirCurrent, setSkillsDirCurrent] = useState('');
  const [skillsDirInput, setSkillsDirInput] = useState('');
  const [skillsDirSaving, setSkillsDirSaving] = useState(false);
  const [skillsDirError, setSkillsDirError] = useState<string | null>(null);
  const [pendingDir, setPendingDir] = useState<string | null>(null);

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }, []);

  useEffect(() => {
    void (async () => {
      const dir = await getSkillsDir();
      setSkillsDirCurrent(dir);
      setSkillsDirInput(dir);
    })();
  }, []);

  const handleSaveSkillsDir = async () => {
    const newDir = skillsDirInput.trim();
    if (!newDir || newDir === skillsDirCurrent) return;
    setSkillsDirSaving(true);
    setSkillsDirError(null);
    try {
      const existing = await skillList(skillsDirCurrent);
      if (existing.length > 0) {
        // Defer the actual save until the user picks a sync strategy in the modal.
        setPendingDir(newDir);
      } else {
        setSkillsDir(newDir);
        setSkillsDirCurrent(newDir);
      }
    } catch (e) {
      setSkillsDirError(String(e));
    } finally {
      setSkillsDirSaving(false);
    }
  };

  const handleJustChange = () => {
    if (!pendingDir) return;
    setSkillsDir(pendingDir);
    setSkillsDirCurrent(pendingDir);
    setPendingDir(null);
  };

  const handleMoveAndChange = async () => {
    if (!pendingDir) return;
    setSkillsDirSaving(true);
    try {
      const existing = await skillList(skillsDirCurrent);
      await skillMoveFiles(existing.map((s) => s.absPath), pendingDir);
      setSkillsDir(pendingDir);
      setSkillsDirCurrent(pendingDir);
      setPendingDir(null);
    } catch (e) {
      setSkillsDirError(String(e));
    } finally {
      setSkillsDirSaving(false);
    }
  };

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

      {/* Skills Directory */}
      <section className="border border-stone-200/18 bg-[#071d1a]/72">
        <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3">
          <BookOpen size={15} className="text-stone-300" />
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
            Skills Directory
          </h2>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-stone-400">
            Where PM scans for installed skills (markdown packages). Default is{' '}
            <span className="font-mono">~/.claude/skills</span>. PM observes this directory — files
            added or removed externally show up after a Rescan in Plugins → Skills.
          </p>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-stone-500">
              Path
            </label>
            <div className="flex gap-2">
              <input
                value={skillsDirInput}
                onChange={(e) => setSkillsDirInput(e.target.value)}
                placeholder="/Users/.../skills"
                className="flex-1 border border-stone-200/20 bg-[#03100f] px-3 py-2 font-mono text-xs text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
              />
              <button
                onClick={handleSaveSkillsDir}
                disabled={
                  skillsDirSaving ||
                  !skillsDirInput.trim() ||
                  skillsDirInput.trim() === skillsDirCurrent
                }
                className="bg-stone-100 px-3 py-2 text-xs font-medium text-[#071d1a] hover:bg-amber-100 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
          {skillsDirError && <p className="text-xs text-red-400">{skillsDirError}</p>}
        </div>
      </section>

      {/* Skills directory change-confirmation modal */}
      {pendingDir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md border border-stone-200/18 bg-[#071d1a] shadow-2xl">
            <div className="border-b border-stone-200/12 px-6 py-4">
              <h3 className="text-base font-bold text-stone-50">Change skills directory?</h3>
            </div>
            <div className="space-y-3 px-6 py-4 text-xs text-stone-300">
              <p>Existing skills at:</p>
              <p className="break-all bg-[#03100f] p-2 font-mono text-[11px] text-stone-400">
                {skillsDirCurrent}
              </p>
              <p>will not be moved automatically. After changing:</p>
              <ul className="list-disc space-y-1 pl-5 text-stone-400">
                <li>Files at the old path remain on disk</li>
                <li>PM will no longer track them</li>
                <li>
                  PM will scan the new path and pick up any{' '}
                  <span className="font-mono">.md</span> files found there
                </li>
              </ul>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-stone-200/12 px-6 py-4">
              <button
                onClick={() => setPendingDir(null)}
                className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-100"
              >
                Cancel
              </button>
              <button
                onClick={handleJustChange}
                className="border border-stone-200/25 px-3 py-1.5 text-xs text-stone-200 hover:bg-white/5"
              >
                Just change path
              </button>
              <button
                onClick={handleMoveAndChange}
                disabled={skillsDirSaving}
                className="bg-stone-100 px-3 py-1.5 text-xs font-medium text-[#071d1a] hover:bg-amber-100 disabled:opacity-50"
              >
                Move existing skills
              </button>
            </div>
          </div>
        </div>
      )}

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
