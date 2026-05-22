'use client';

import { useEffect, useState } from 'react';
import { Monitor, Server } from 'lucide-react';

import { getSecretsStorageBackend } from '../../../lib/bridge';
import { useI18n } from '../../../lib/i18n';
import { formatSecretsStorageLabel } from '../../../lib/keys/secretsStorageLabel';
import {
  exportAiCliPresetAllowlistJson,
  getAiCliPresetAllowlist,
  importAiCliPresetAllowlistJson,
  resetAiCliPresetAllowlist,
  setAiCliPresetAllowlist,
} from '../../../lib/storage/system-cli';
import { KeyboardShortcutsView } from './KeyboardShortcutsView';

export function SettingsView() {
  const { t } = useI18n();
  const [trayEnabled, setTrayEnabled] = useState(false);
  const [isTauri, setIsTauri] = useState(false);
  const [secretsBackend, setSecretsBackend] = useState('localStorage');
  const [aiCliPresetDraft, setAiCliPresetDraft] = useState('');

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

  useEffect(() => {
    const current = getAiCliPresetAllowlist();
    setAiCliPresetDraft(current.join('\n'));
  }, []);

  const secretStorageLabel = formatSecretsStorageLabel(secretsBackend, isTauri);

  const handleSaveAiCliPreset = () => {
    const next = aiCliPresetDraft
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    setAiCliPresetAllowlist(next);
    setAiCliPresetDraft(getAiCliPresetAllowlist().join('\n'));
  };

  const handleResetAiCliPreset = () => {
    const defaults = resetAiCliPresetAllowlist();
    setAiCliPresetDraft(defaults.join('\n'));
  };

  const handleExportAiCliPreset = async () => {
    const json = exportAiCliPresetAllowlistJson(true);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(json);
        if (typeof window !== 'undefined') window.alert(t.settingsView.presetCopied);
        return;
      } catch {
        // Fall back to prompt below.
      }
    }
    if (typeof window !== 'undefined') window.prompt(t.settingsView.copyPresetPrompt, json);
  };

  const handleImportAiCliPreset = () => {
    if (typeof window === 'undefined') return;
    const input = window.prompt(t.settingsView.importPresetPrompt, '[]');
    if (!input) return;
    try {
      const imported = importAiCliPresetAllowlistJson(input);
      setAiCliPresetDraft(imported.join('\n'));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t.settingsView.importPresetInvalid);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">
          {t.settingsView.title}
        </h1>
        <p className="mt-1 text-xs text-stone-400">{t.settingsView.subtitle}</p>
      </div>

      <section className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72">
        <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3">
          <Monitor size={15} className="text-stone-300" />
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
            {t.settingsView.systemTrayTitle}
          </h2>
          <span className="ml-auto border border-amber-200/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-100/80">
            P2
          </span>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-stone-400">
            {t.settingsView.systemTrayHint}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-200">{t.settingsView.enableOnLaunch}</span>
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
            <p className="text-[11px] text-amber-100/60">{t.settingsView.requiresTauri}</p>
          )}
        </div>
      </section>

      <section className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72">
        <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3">
          <Server size={15} className="text-stone-300" />
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
            {t.settingsView.runtimeBridgeTitle}
          </h2>
        </div>
        <div className="space-y-2 p-4">
          {[
            {
              label: t.settingsView.runtimeModeLabel,
              value: isTauri ? t.settingsView.runtimeModeTauri : t.settingsView.runtimeModeBrowser,
              accent: isTauri,
            },
            { label: t.settingsView.runtimeAiRouteLabel, value: t.settingsView.runtimeAiRouteValue, accent: true },
            { label: t.settingsView.runtimeSecretStorageLabel, value: secretStorageLabel, accent: isTauri },
            {
              label: t.settingsView.runtimeProcessSpawnLabel,
              value: isTauri ? t.settingsView.runtimeProcessSpawnActive : t.settingsView.runtimeProcessSpawnDisabled,
              accent: isTauri,
            },
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

      <section className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72">
        <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3">
          <Server size={15} className="text-stone-300" />
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
            {t.settingsView.systemCliPresetTitle}
          </h2>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-stone-400">
            {t.settingsView.systemCliPresetHint}
          </p>
          <textarea
            rows={10}
            value={aiCliPresetDraft}
            onChange={(e) => setAiCliPresetDraft(e.target.value)}
            className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 font-mono text-xs text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
            spellCheck={false}
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-500">
              {t.settingsView.systemCliPresetEntries.replace(
                '{count}',
                String(aiCliPresetDraft.split('\n').map((line) => line.trim()).filter(Boolean).length),
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleExportAiCliPreset()}
                className="border border-cyan-400/30 bg-cyan-950/20 px-3 py-1.5 text-xs text-cyan-200"
              >
                {t.settingsView.exportJson}
              </button>
              <button
                type="button"
                onClick={handleImportAiCliPreset}
                className="border border-cyan-400/30 bg-cyan-950/20 px-3 py-1.5 text-xs text-cyan-200"
              >
                {t.settingsView.importJson}
              </button>
              <button
                type="button"
                onClick={handleResetAiCliPreset}
                className="border border-stone-300/30 bg-stone-900/20 px-3 py-1.5 text-xs text-stone-300"
              >
                {t.settingsView.resetRecommended}
              </button>
              <button
                type="button"
                onClick={handleSaveAiCliPreset}
                className="border border-emerald-400/30 bg-emerald-950/20 px-3 py-1.5 text-xs text-emerald-300"
              >
                {t.settingsView.savePreset}
              </button>
            </div>
          </div>
        </div>
      </section>

      <KeyboardShortcutsView />
    </div>
  );
}
