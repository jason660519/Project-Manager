'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Download,
  Keyboard,
  Monitor,
  RotateCcw,
  Save,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';

import { getSecretsStorageBackend } from '../../../lib/bridge';
import { useI18n } from '../../../lib/i18n';
import { formatSecretsStorageLabel } from '../../../lib/keys/secretsStorageLabel';
import { WorkstationFrame } from '../../../components/layout/WorkstationFrame';
import { BottomSheetTabs, type SheetTabItem } from '../../../components/sheets/BottomSheetTabs';
import { useInAppPrompt } from '../../../components/ui/InAppDialog';
import {
  exportAiCliPresetAllowlistJson,
  getAiCliPresetAllowlist,
  importAiCliPresetAllowlistJson,
  resetAiCliPresetAllowlist,
  setAiCliPresetAllowlist,
} from '../../../lib/storage/system-cli';
import { KeyboardShortcutsView } from './KeyboardShortcutsView';

type SettingsSheetKey = 'system-tray' | 'runtime-bridge' | 'system-cli' | 'shortcuts';

const SETTINGS_SHEET_ORDER_STORAGE_KEY = 'projectManager.settings.sheetOrder';

interface SettingsRow {
  label: ReactNode;
  description?: ReactNode;
  value: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
}

function SettingsStatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'success' | 'warning' | 'neutral';
}) {
  const toneClass = {
    success: 'border-emerald-300/25 bg-emerald-500/15 text-emerald-300',
    warning: 'border-amber-200/25 bg-amber-100/10 text-amber-100/85',
    neutral: 'border-stone-300/20 bg-stone-500/15 text-stone-300',
  }[tone];

  return (
    <span className={`inline-flex items-center border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${toneClass}`}>
      {children}
    </span>
  );
}

function SettingsRowsTable({ rows }: { rows: SettingsRow[] }) {
  return (
    <div className="pm-scroll overflow-x-auto bg-transparent">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead className="sticky top-0 z-40 border-b border-stone-200/12 bg-[rgb(var(--pm-panel))]">
          <tr>
            <th className="w-[28%] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
              Setting
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
              Value
            </th>
            <th className="w-[18%] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
              State
            </th>
            <th className="w-[22%] px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-stone-200/10 hover:bg-white/[0.045]">
              <td className="px-4 py-3 align-top">
                <div className="text-sm font-medium text-stone-100">{row.label}</div>
                {row.description && (
                  <div className="mt-1 max-w-md text-xs leading-5 text-stone-400">
                    {row.description}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 align-top text-sm text-stone-300">{row.value}</td>
              <td className="px-4 py-3 align-top">{row.status ?? <span className="text-xs text-stone-500">-</span>}</td>
              <td className="px-4 py-3 align-top text-right">{row.actions ?? <span className="text-xs text-stone-500">-</span>}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-xs text-stone-500">
                No settings available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SheetHeader({
  icon,
  title,
  description,
  meta,
}: {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-stone-200/12 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-amber-200/25 text-amber-100">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-100">
            {title}
          </h2>
          <p className="mt-1 text-xs leading-5 text-stone-400">{description}</p>
        </div>
      </div>
      {meta && <div className="shrink-0">{meta}</div>}
    </div>
  );
}

function SheetPanel({ children }: { children: ReactNode }) {
  return <div className="min-h-full bg-[rgb(var(--pm-panel))]/72">{children}</div>;
}

function ActionButton({
  children,
  icon,
  onClick,
  tone = 'neutral',
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  tone?: 'primary' | 'neutral' | 'warning';
}) {
  const toneClass = {
    primary: 'border-emerald-200/25 bg-emerald-100/10 text-emerald-100 hover:bg-emerald-100/18',
    warning: 'border-amber-200/25 bg-amber-100/10 text-amber-100 hover:bg-amber-100/15',
    neutral: 'border-stone-300/20 bg-stone-900/20 text-stone-300 hover:bg-white/5',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 border px-2.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-300/35 ${toneClass}`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function SettingsView() {
  const { t } = useI18n();
  const jsonPrompt = useInAppPrompt();
  const [activeSheet, setActiveSheet] = useState<SettingsSheetKey>('system-tray');
  const [trayEnabled, setTrayEnabled] = useState(false);
  const [isTauri, setIsTauri] = useState(false);
  const [secretsBackend, setSecretsBackend] = useState('localStorage');
  const [aiCliPresetDraft, setAiCliPresetDraft] = useState('');
  const [systemCliNotice, setSystemCliNotice] = useState<string | null>(null);

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
        setSystemCliNotice(t.settingsView.presetCopied);
        return;
      } catch {
        // Fall back to the in-app copy dialog below.
      }
    }
    await jsonPrompt.open({
      title: 'Copy preset JSON',
      message: t.settingsView.copyPresetPrompt,
      defaultValue: json,
      confirmLabel: 'Close',
      multiline: true,
    });
  };

  const handleImportAiCliPreset = async () => {
    const input = await jsonPrompt.open({
      title: 'Import preset JSON',
      message: t.settingsView.importPresetPrompt,
      defaultValue: '[]',
      confirmLabel: 'Import',
      multiline: true,
    });
    if (!input) return;
    try {
      const imported = importAiCliPresetAllowlistJson(input);
      setAiCliPresetDraft(imported.join('\n'));
      setSystemCliNotice(null);
    } catch (err) {
      setSystemCliNotice(err instanceof Error ? err.message : t.settingsView.importPresetInvalid);
    }
  };

  const aiCliPresetCount = aiCliPresetDraft
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length;

  const sheetTabs = useMemo<ReadonlyArray<SheetTabItem<SettingsSheetKey>>>(
    () => [
      {
        key: 'system-tray',
        label: t.settingsView.systemTrayTitle,
        icon: <Monitor size={14} />,
        badge: isTauri ? 'Live' : 'P2',
      },
      {
        key: 'runtime-bridge',
        label: t.settingsView.runtimeBridgeTitle,
        icon: <Server size={14} />,
        badge: isTauri ? 'Live' : 'Dry',
      },
      {
        key: 'system-cli',
        label: t.settingsView.systemCliPresetTitle,
        icon: <ShieldCheck size={14} />,
        badge: aiCliPresetCount,
      },
      {
        key: 'shortcuts',
        label: t.navItems.shortcuts,
        icon: <Keyboard size={14} />,
      },
    ],
    [aiCliPresetCount, isTauri, t.navItems.shortcuts, t.settingsView.runtimeBridgeTitle, t.settingsView.systemCliPresetTitle, t.settingsView.systemTrayTitle],
  );

  const runtimeRows: SettingsRow[] = [
    {
      label: t.settingsView.runtimeModeLabel,
      description: 'Controls whether Project Manager can execute native desktop commands.',
      value: (
        <span className="font-mono text-xs text-stone-300">
          {isTauri ? t.settingsView.runtimeModeTauri : t.settingsView.runtimeModeBrowser}
        </span>
      ),
      status: (
        <SettingsStatusBadge tone={isTauri ? 'success' : 'warning'}>
          {isTauri ? 'Live' : 'Dry-run'}
        </SettingsStatusBadge>
      ),
    },
    {
      label: t.settingsView.runtimeAiRouteLabel,
      description: 'Renderer code keeps provider secrets outside the browser surface.',
      value: (
        <span className="font-mono text-xs text-stone-300">
          {isTauri ? t.settingsView.runtimeAiRouteValue : '/api/anthropic'}
        </span>
      ),
      status: <SettingsStatusBadge tone="success">Guarded</SettingsStatusBadge>,
    },
    {
      label: t.settingsView.runtimeSecretStorageLabel,
      description: 'Shows the active backend without exposing secret values.',
      value: <span className="font-mono text-xs text-stone-300">{secretStorageLabel}</span>,
      status: (
        <SettingsStatusBadge tone={isTauri ? 'success' : 'warning'}>
          {isTauri ? 'Native' : 'Browser'}
        </SettingsStatusBadge>
      ),
    },
    {
      label: t.settingsView.runtimeProcessSpawnLabel,
      description: 'Agent process launch is available only from the desktop runtime.',
      value: (
        <span className="font-mono text-xs text-stone-300">
          {isTauri
            ? t.settingsView.runtimeProcessSpawnActive
            : t.settingsView.runtimeProcessSpawnDisabled}
        </span>
      ),
      status: (
        <SettingsStatusBadge tone={isTauri ? 'success' : 'neutral'}>
          {isTauri ? 'Enabled' : 'Disabled'}
        </SettingsStatusBadge>
      ),
    },
  ];

  const systemTrayRows: SettingsRow[] = [
    {
      label: t.settingsView.enableOnLaunch,
      description: t.settingsView.systemTrayHint,
      value: (
        <span className="font-mono text-xs text-stone-300">
          {trayEnabled ? 'enabled' : 'disabled'}
        </span>
      ),
      status: (
        <SettingsStatusBadge tone={isTauri ? (trayEnabled ? 'success' : 'neutral') : 'warning'}>
          {isTauri ? (trayEnabled ? 'On' : 'Off') : 'Tauri only'}
        </SettingsStatusBadge>
      ),
      actions: (
        <div className="flex justify-end">
          <button
            type="button"
            role="switch"
            aria-checked={trayEnabled}
            aria-label={t.settingsView.enableOnLaunch}
            onClick={() => setTrayEnabled((enabled) => !enabled)}
            className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-300/35 ${
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
      ),
    },
  ];

  const systemCliRows: SettingsRow[] = [
    {
      label: t.settingsView.systemCliPresetTitle,
      description: t.settingsView.systemCliPresetHint,
      value: (
        <textarea
          rows={12}
          value={aiCliPresetDraft}
          onChange={(e) => setAiCliPresetDraft(e.target.value)}
          className="min-h-[260px] w-full resize-y border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 font-mono text-xs leading-5 text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
          spellCheck={false}
        />
      ),
      status: (
        <SettingsStatusBadge tone={aiCliPresetCount > 0 ? 'success' : 'warning'}>
          {t.settingsView.systemCliPresetEntries.replace('{count}', String(aiCliPresetCount))}
        </SettingsStatusBadge>
      ),
      actions: (
        <div className="flex flex-wrap justify-end gap-2">
          <ActionButton
            onClick={() => void handleExportAiCliPreset()}
            icon={<Download size={13} />}
          >
            {t.settingsView.exportJson}
          </ActionButton>
          <ActionButton onClick={() => void handleImportAiCliPreset()} icon={<Upload size={13} />}>
            {t.settingsView.importJson}
          </ActionButton>
          <ActionButton
            onClick={handleResetAiCliPreset}
            icon={<RotateCcw size={13} />}
            tone="warning"
          >
            {t.settingsView.resetRecommended}
          </ActionButton>
          <ActionButton onClick={handleSaveAiCliPreset} icon={<Save size={13} />} tone="primary">
            {t.settingsView.savePreset}
          </ActionButton>
        </div>
      ),
    },
  ];

  return (
    <WorkstationFrame
      className="mx-auto max-w-6xl"
      panelClassName="border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72"
      header={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">
              {t.settingsView.title}
            </h1>
            <p className="mt-1 text-xs text-stone-400">{t.settingsView.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SettingsStatusBadge tone={isTauri ? 'success' : 'warning'}>
              {isTauri ? t.settingsView.runtimeModeTauri : t.settingsView.runtimeModeBrowser}
            </SettingsStatusBadge>
            <span className="border border-stone-300/20 bg-stone-900/20 px-2 py-1 font-mono text-[10px] text-stone-300">
              {secretStorageLabel}
            </span>
          </div>
        </div>
      }
      bottomTabs={
        <BottomSheetTabs
          tabs={sheetTabs}
          activeKey={activeSheet}
          onSelect={setActiveSheet}
          reorderable
          orderStorageKey={SETTINGS_SHEET_ORDER_STORAGE_KEY}
        />
      }
    >
      {activeSheet === 'system-tray' && (
        <SheetPanel>
          <SheetHeader
            icon={<Monitor size={17} />}
            title={t.settingsView.systemTrayTitle}
            description={t.settingsView.systemTrayHint}
            meta={<SettingsStatusBadge tone="warning">P2</SettingsStatusBadge>}
          />
          <SettingsRowsTable rows={systemTrayRows} />
          {!isTauri && (
            <div className="border-t border-stone-200/10 px-4 py-3 text-[11px] text-amber-100/70">
              {t.settingsView.requiresTauri}
            </div>
          )}
        </SheetPanel>
      )}

      {activeSheet === 'runtime-bridge' && (
        <SheetPanel>
          <SheetHeader
            icon={<Server size={17} />}
            title={t.settingsView.runtimeBridgeTitle}
            description="Runtime status, AI route, secret storage, and process execution capability."
          />
          <SettingsRowsTable rows={runtimeRows} />
        </SheetPanel>
      )}

      {activeSheet === 'system-cli' && (
        <SheetPanel>
          <SheetHeader
            icon={<ShieldCheck size={17} />}
            title={t.settingsView.systemCliPresetTitle}
            description={t.settingsView.systemCliPresetHint}
            meta={
              <SettingsStatusBadge tone={aiCliPresetCount > 0 ? 'success' : 'warning'}>
                {t.settingsView.systemCliPresetEntries.replace('{count}', String(aiCliPresetCount))}
              </SettingsStatusBadge>
            }
          />
          {systemCliNotice && (
            <div className="border-b border-stone-200/10 px-4 py-2 text-[11px] text-amber-100/80">
              {systemCliNotice}
            </div>
          )}
          <SettingsRowsTable rows={systemCliRows} />
        </SheetPanel>
      )}

      {activeSheet === 'shortcuts' && (
        <SheetPanel>
          <SheetHeader
            icon={<SlidersHorizontal size={17} />}
            title={t.navItems.shortcuts}
            description="Shortcut map for navigation, dispatch, search, and runtime controls."
          />
          <KeyboardShortcutsView embedded />
        </SheetPanel>
      )}
      {jsonPrompt.dialog}
    </WorkstationFrame>
  );
}
