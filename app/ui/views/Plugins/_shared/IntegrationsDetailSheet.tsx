'use client';

import { useEffect, useState } from 'react';
import {
  ExternalLink,
  FileText,
  FolderOpen,
  Play,
  Plus,
  Power,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react';
import type { IntegrationRow } from '../../../../../lib/integrations/types';
import { saveManualFields } from '../../../../../lib/integrations/manual-metadata';
import {
  isCliPlugin,
  isEditorPlugin,
  isMcpPlugin,
  isProviderPlugin,
} from '../../../../../lib/integrations/mappers/plugins';
import type {
  AnyPlugin,
  CliPlugin,
  EditorPlugin,
  McpPlugin,
  PluginCatalog,
  ProviderPlugin,
} from '../../../../../lib/types/plugins';
import type { ChannelConfig } from '../../../../../lib/types/channels';
import { updatePlugin } from '../../../../../lib/storage/plugins';
import { useI18n } from '../../../../../lib/i18n';
import { StatusBadge } from './status-badge';
import {
  CliConfigForm,
  EditorConfigForm,
  McpConfigForm,
  ProviderConfigForm,
  inputCls,
} from './plugin-config-forms';

function MetaRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-[11px]">
      <span className="uppercase tracking-[0.1em] text-stone-500">{label}</span>
      <span className="break-all font-mono text-stone-300">{value}</span>
    </div>
  );
}

export interface IntegrationsDetailSheetProps {
  row: IntegrationRow | null;
  onClose: () => void;
  catalog: PluginCatalog;
  apiKeys: Record<string, string>;
  providers: ProviderPlugin[];
  onCatalogChange: (c: PluginCatalog) => void;
  onApiKeyChange: (id: string, key: string) => void;
  onInstallMarketplace?: (marketplaceId: string) => void;
  onUninstallPlugin?: (id: string) => void;
  onTogglePluginEnabled?: (id: string) => void;
  mcpStart?: (plugin: McpPlugin) => void;
  mcpStop?: (id: string) => void;
  mcpRestart?: (plugin: McpPlugin) => void;
  mcpViewLogs?: (id: string) => void;
  onOpenPath?: (path: string) => void;
  onSkillUninstall?: (absPath: string) => void;
  onSkillInstallUrl?: (url: string) => void;
  skillsInstallUrl?: string;
  onSkillsInstallUrlChange?: (url: string) => void;
  skillsDir?: string;
  onChannelStartPoll?: (ch: ChannelConfig) => void;
  onChannelStopPoll?: (channelId: string) => void;
  onManualSaved?: () => void;
}

export function IntegrationsDetailSheet({
  row,
  onClose,
  catalog,
  apiKeys,
  providers,
  onCatalogChange,
  onApiKeyChange,
  onInstallMarketplace,
  onUninstallPlugin,
  onTogglePluginEnabled,
  mcpStart,
  mcpStop,
  mcpRestart,
  mcpViewLogs,
  onOpenPath,
  onSkillUninstall,
  onSkillInstallUrl,
  skillsInstallUrl = '',
  onSkillsInstallUrlChange,
  skillsDir,
  onChannelStartPoll,
  onChannelStopPoll,
  onManualSaved,
}: IntegrationsDetailSheetProps) {
  const { t } = useI18n();
  const [notes, setNotes] = useState('');
  const [lv, setLv] = useState('');
  const [showConfig, setShowConfig] = useState(true);

  useEffect(() => {
    if (!row) return;
    setNotes(row.notes);
    setLv(row.lv != null ? String(row.lv) : '');
    setShowConfig(true);
  }, [row?.rowKey]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const saveManual = () => {
    if (!row) return;
    saveManualFields(row.rowKey, {
      notes: notes.trim() || undefined,
      lv: lv.trim() ? Number(lv) : undefined,
    });
    onManualSaved?.();
  };

  if (!row) return null;

  const plugin = row.payload.plugin as AnyPlugin | undefined;
  const channel = row.payload.channel as ChannelConfig | undefined;
  const skillPath = (row.payload.skill as { absPath?: string } | undefined)?.absPath ?? row.sourceId;
  const filePath = (row.payload.file as { absPath?: string } | undefined)?.absPath;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} aria-hidden />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-[min(520px,92vw)] flex-col border-l border-stone-200/15 shadow-2xl"
        style={{ background: 'var(--pm-sidebar)' }}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-stone-200/15 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-stone-100">{row.name}</p>
            <p className="truncate font-mono text-[10px] text-stone-500">{row.rowKey}</p>
          </div>
          <StatusBadge status={row.status} label={row.statusLabel} />
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center border border-stone-200/15 text-stone-400 hover:text-stone-100"
          >
            <X size={14} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <section className="space-y-2">
            <MetaRow label={t.integrations.colCategory1} value={row.category1} />
            <MetaRow label={t.integrations.colCategory2} value={row.category2} />
            <MetaRow label={t.integrations.colCompany} value={row.company} />
            <MetaRow label={t.integrations.colScope} value={row.scope} />
            <MetaRow label={t.integrations.colPath} value={row.installPath} />
            <MetaRow label={t.integrations.colPort} value={row.port} />
            <MetaRow label={t.integrations.colLicense} value={row.license} />
            <MetaRow label={t.integrations.colUrl} value={row.githubUrl} />
            <MetaRow label={t.integrations.colUpdated} value={row.lastUpdated} />
          </section>

          <section className="space-y-2 border-t border-stone-200/12 pt-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">
              {t.integrations.manualFields}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-stone-500">LV</label>
                <input
                  value={lv}
                  onChange={(e) => setLv(e.target.value)}
                  className={inputCls}
                  placeholder="—"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-stone-500">{t.integrations.colNotes}</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`${inputCls} text-xs`}
              />
            </div>
            <button
              type="button"
              onClick={saveManual}
              className="bg-stone-100 px-3 py-1.5 text-xs font-medium text-[rgb(var(--pm-panel))] hover:bg-amber-100"
            >
              {t.integrations.saveManual}
            </button>
          </section>

          {row.sourceKind === 'plugin-marketplace' && onInstallMarketplace && (
            <section className="border-t border-stone-200/12 pt-4">
              <button
                type="button"
                onClick={() => onInstallMarketplace(row.sourceId)}
                className="flex w-full items-center justify-center gap-2 border border-emerald-400/30 bg-emerald-950/40 py-2 text-xs text-emerald-300 hover:bg-emerald-950/60"
              >
                <Plus size={14} /> {t.plugins.install}
              </button>
            </section>
          )}

          {row.sourceKind === 'plugin-installed' && plugin && (
            <section className="border-t border-stone-200/12 pt-4 space-y-2">
              <div className="flex flex-wrap gap-2">
                {onTogglePluginEnabled && (
                  <button
                    type="button"
                    onClick={() => onTogglePluginEnabled(plugin.id)}
                    className="border border-stone-200/20 px-2 py-1 text-xs text-stone-300 hover:bg-white/5"
                  >
                    {plugin.enabled ? t.plugins.disable : t.plugins.enable}
                  </button>
                )}
                {onUninstallPlugin && (
                  <button
                    type="button"
                    onClick={() => onUninstallPlugin(plugin.id)}
                    className="border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-950/30"
                  >
                    <Trash2 size={12} className="inline mr-1" />
                    {t.plugins.uninstall}
                  </button>
                )}
                {isMcpPlugin(plugin) && mcpStart && mcpStop && mcpRestart && (
                  <>
                    <button type="button" onClick={() => mcpStart(plugin)} className="border border-stone-200/20 px-2 py-1 text-xs text-stone-300">
                      <Play size={12} className="inline" />
                    </button>
                    <button type="button" onClick={() => mcpStop(plugin.id)} className="border border-stone-200/20 px-2 py-1 text-xs text-stone-300">
                      <Power size={12} className="inline" />
                    </button>
                    <button type="button" onClick={() => mcpRestart(plugin)} className="border border-stone-200/20 px-2 py-1 text-xs text-stone-300">
                      <RotateCw size={12} className="inline" />
                    </button>
                    {mcpViewLogs && (
                      <button type="button" onClick={() => mcpViewLogs(plugin.id)} className="border border-stone-200/20 px-2 py-1 text-xs text-stone-300">
                        <FileText size={12} className="inline" />
                      </button>
                    )}
                  </>
                )}
              </div>
              {showConfig && isProviderPlugin(plugin) && (
                <ProviderConfigForm
                  entry={plugin}
                  initialApiKey={apiKeys[plugin.id] ?? ''}
                  onSave={(p, key) => {
                    onCatalogChange(updatePlugin(catalog, p.id, () => p));
                    void onApiKeyChange(p.id, key);
                  }}
                  onCancel={() => setShowConfig(false)}
                />
              )}
              {showConfig && isCliPlugin(plugin) && (
                <CliConfigForm
                  entry={plugin}
                  providers={providers}
                  onSave={(a) => {
                    onCatalogChange(updatePlugin(catalog, a.id, () => a));
                  }}
                  onCancel={() => setShowConfig(false)}
                />
              )}
              {showConfig && isEditorPlugin(plugin) && (
                <EditorConfigForm
                  entry={plugin}
                  onSave={(editor) => {
                    onCatalogChange(updatePlugin(catalog, editor.id, () => editor));
                  }}
                  onCancel={() => setShowConfig(false)}
                />
              )}
              {showConfig && isMcpPlugin(plugin) && (
                <McpConfigForm
                  entry={plugin}
                  onSave={(m) => {
                    onCatalogChange(updatePlugin(catalog, m.id, () => m));
                  }}
                  onCancel={() => setShowConfig(false)}
                />
              )}
            </section>
          )}

          {row.sheet === 'skills' && (
            <section className="border-t border-stone-200/12 pt-4 space-y-3">
              {skillsDir && (
                <p className="font-mono text-[10px] text-stone-500 break-all">{skillsDir}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {onOpenPath && (skillPath || filePath) && (
                  <button
                    type="button"
                    onClick={() => onOpenPath(skillPath || filePath!)}
                    className="flex items-center gap-1 border border-stone-200/20 px-2 py-1 text-xs text-stone-300"
                  >
                    <ExternalLink size={12} /> {t.plugins.openFile}
                  </button>
                )}
                {onOpenPath && skillsDir && (
                  <button
                    type="button"
                    onClick={() => onOpenPath(skillsDir)}
                    className="flex items-center gap-1 border border-stone-200/20 px-2 py-1 text-xs text-stone-300"
                  >
                    <FolderOpen size={12} /> {t.plugins.openFolder}
                  </button>
                )}
                {onSkillUninstall && (skillPath || filePath) && (
                  <button
                    type="button"
                    onClick={() => onSkillUninstall(skillPath || filePath!)}
                    className="border border-red-500/30 px-2 py-1 text-xs text-red-400"
                  >
                    <Trash2 size={12} className="inline" /> {t.plugins.uninstall}
                  </button>
                )}
              </div>
              {onSkillInstallUrl && onSkillsInstallUrlChange && (
                <div className="space-y-2">
                  <label className="text-[11px] text-stone-500">{t.plugins.installFromUrl}</label>
                  <div className="flex gap-2">
                    <input
                      value={skillsInstallUrl}
                      onChange={(e) => onSkillsInstallUrlChange(e.target.value)}
                      className={inputCls}
                      placeholder={t.plugins.skillUrlPlaceholder}
                    />
                    <button
                      type="button"
                      onClick={() => onSkillInstallUrl(skillsInstallUrl)}
                      className="shrink-0 bg-stone-100 px-3 py-1.5 text-xs font-medium text-[rgb(var(--pm-panel))]"
                    >
                      {t.plugins.install}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {row.sourceKind === 'channel' && channel && (
            <section className="border-t border-stone-200/12 pt-4 space-y-2">
              <p className="text-xs text-stone-400">
                {channel.platform} · {channel.webhookMode}
              </p>
              <div className="flex flex-wrap gap-2">
                {channel.platform === 'telegram' && onChannelStartPoll && (
                  <button
                    type="button"
                    onClick={() => onChannelStartPoll(channel)}
                    className="border border-emerald-400/30 px-2 py-1 text-xs text-emerald-300"
                  >
                    <Play size={12} className="inline" /> Start poll
                  </button>
                )}
                {onChannelStopPoll && (
                  <button
                    type="button"
                    onClick={() => onChannelStopPoll(channel.id)}
                    className="border border-stone-200/20 px-2 py-1 text-xs text-stone-300"
                  >
                    <Power size={12} className="inline" /> Stop
                  </button>
                )}
              </div>
              <p className="text-[11px] text-stone-500">
                {t.integrations.channelEditHint}
              </p>
            </section>
          )}

          {row.sourceKind === 'memory' && onOpenPath && (
            <section className="border-t border-stone-200/12 pt-4 space-y-2">
              <p className="text-xs text-stone-400">{row.notes}</p>
              <button
                type="button"
                onClick={() => onOpenPath(row.installPath)}
                className="flex items-center gap-1 border border-stone-200/20 px-2 py-1 text-xs text-stone-300"
              >
                <ExternalLink size={12} /> {t.plugins.openFile}
              </button>
            </section>
          )}

          {row.sourceKind === 'slash-command' && onOpenPath && (
            <section className="border-t border-stone-200/12 pt-4 space-y-2">
              <p className="font-mono text-xs text-emerald-300/90">{row.name}</p>
              <p className="text-xs text-stone-400">{row.notes}</p>
              <button
                type="button"
                onClick={() => onOpenPath(row.installPath)}
                className="flex items-center gap-1 border border-stone-200/20 px-2 py-1 text-xs text-stone-300"
              >
                <ExternalLink size={12} /> {t.integrations.openCommandFile}
              </button>
            </section>
          )}

          {row.sourceKind === 'command-mapping' && (
            <section className="border-t border-stone-200/12 pt-4 space-y-2">
              <p className="text-xs text-stone-400">{row.notes}</p>
              <p className="text-[11px] text-stone-500">{t.integrations.channelCommandMappingHint}</p>
            </section>
          )}

          {row.sourceKind === 'system-cli' && onOpenPath && (
            <section className="border-t border-stone-200/12 pt-4 space-y-2">
              <p className="text-xs text-stone-400">{t.integrations.systemCliDetectedHint}</p>
              <button
                type="button"
                onClick={() => onOpenPath(row.installPath)}
                className="flex items-center gap-1 border border-stone-200/20 px-2 py-1 text-xs text-stone-300"
              >
                <ExternalLink size={12} /> {t.integrations.systemCliRevealBinary}
              </button>
            </section>
          )}

          {row.sourceKind === 'standards-provider' && onOpenPath && (
            <section className="border-t border-stone-200/12 pt-4 space-y-2">
              <p className="text-xs text-stone-400">
                Company standards provider is optional. Project Manager keeps local docs as fallback.
              </p>
              {typeof row.payload.standardsRoot === 'string' && (
                <button
                  type="button"
                  onClick={() => onOpenPath(row.payload.standardsRoot as string)}
                  className="flex items-center gap-1 border border-stone-200/20 px-2 py-1 text-xs text-stone-300"
                >
                  <FolderOpen size={12} /> Open Standards Repo
                </button>
              )}
              {typeof row.payload.contractDoc === 'string' && (
                <button
                  type="button"
                  onClick={() => onOpenPath(row.payload.contractDoc as string)}
                  className="flex items-center gap-1 border border-stone-200/20 px-2 py-1 text-xs text-stone-300"
                >
                  <FileText size={12} /> Open PM Plugin Contract
                </button>
              )}
              {typeof row.payload.baselineDoc === 'string' && (
                <button
                  type="button"
                  onClick={() => onOpenPath(row.payload.baselineDoc as string)}
                  className="flex items-center gap-1 border border-stone-200/20 px-2 py-1 text-xs text-stone-300"
                >
                  <FileText size={12} /> Open Table Baseline
                </button>
              )}
              {typeof row.payload.profileDoc === 'string' && (
                <button
                  type="button"
                  onClick={() => onOpenPath(row.payload.profileDoc as string)}
                  className="flex items-center gap-1 border border-stone-200/20 px-2 py-1 text-xs text-stone-300"
                >
                  <FileText size={12} /> Open PM Table Profile
                </button>
              )}
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
