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
import type {
  IntegrationRuntimeCommand,
  IntegrationRuntimeMetadata,
} from '../../../../../lib/integrations/registry';
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
import type {
  ChannelConfig,
  ChannelWebhookMode,
  CommandAction,
  CommandMapping,
} from '../../../../../lib/types/channels';
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
import { ChannelEditForm } from './ChannelEditForm';
import { CommandMappingEditForm } from './CommandMappingEditForm';

function MetaRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-[11px]">
      <span className="uppercase tracking-[0.1em] text-stone-500">{label}</span>
      <span className="break-all font-mono text-stone-300">{value}</span>
    </div>
  );
}

function runtimeMeta(value: unknown): IntegrationRuntimeMetadata | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return value as IntegrationRuntimeMetadata;
}

function resolveRuntimePath(rootPath: string, path: string): string {
  if (!path) return '';
  if (path.startsWith('/') || /^https?:\/\//.test(path)) return path;
  return `${rootPath.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function formatRuntimeCommand(command: IntegrationRuntimeCommand): string {
  return [command.command, ...command.args].join(' ');
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
  runtimeRootPath?: string;
  onRunRuntimeCommand?: (command: IntegrationRuntimeCommand) => Promise<void> | void;
  onSkillUninstall?: (absPath: string) => void;
  onSkillInstallUrl?: (url: string) => void;
  skillsInstallUrl?: string;
  onSkillsInstallUrlChange?: (url: string) => void;
  skillsDir?: string;
  onChannelStartPoll?: (ch: ChannelConfig) => void;
  onChannelStopPoll?: (channelId: string) => void;
  onChannelClearLog?: (channelId: string) => void;
  onChannelUpdate?: (
    channelId: string,
    patch: { label: string; enabled: boolean; webhookMode: ChannelWebhookMode; credentials: Record<string, string> },
    secrets: Record<string, string>,
  ) => void;
  onChannelDelete?: (channelId: string) => void;
  /** Validate a Telegram bot token; throws on rejection. */
  onTestTelegramToken?: (botToken: string) => Promise<{ username?: string }>;
  /** Update a command mapping (trigger/description/action/enabled). */
  onCommandMappingUpdate?: (
    mappingId: string,
    patch: { trigger: string; description: string; action: CommandAction; enabled: boolean },
  ) => void;
  /** Delete a non-default command mapping. */
  onCommandMappingDelete?: (mappingId: string) => void;
  /** Triggers of every other mapping (for uniqueness validation). */
  otherCommandTriggers?: (currentMappingId: string) => string[];
  /** True when the mapping id is one of the seeded defaults. */
  isDefaultCommandMapping?: (mappingId: string) => boolean;
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
  runtimeRootPath = '/Volumes/KLEVV-4T-1/Project-Manager',
  onRunRuntimeCommand,
  onSkillUninstall,
  onSkillInstallUrl,
  skillsInstallUrl = '',
  onSkillsInstallUrlChange,
  skillsDir,
  onChannelStartPoll,
  onChannelStopPoll,
  onChannelClearLog,
  onChannelUpdate,
  onChannelDelete,
  onTestTelegramToken,
  onCommandMappingUpdate,
  onCommandMappingDelete,
  otherCommandTriggers,
  isDefaultCommandMapping,
  onManualSaved,
}: IntegrationsDetailSheetProps) {
  const { t } = useI18n();
  const [notes, setNotes] = useState('');
  const [lv, setLv] = useState('');
  const [showConfig, setShowConfig] = useState(true);
  const [runtimeAction, setRuntimeAction] = useState<{
    runningId: string | null;
    message: string;
    status: 'idle' | 'success' | 'error';
  }>({ runningId: null, message: '', status: 'idle' });

  useEffect(() => {
    if (!row) return;
    setNotes(row.notes);
    setLv(row.lv != null ? String(row.lv) : '');
    setShowConfig(true);
    setRuntimeAction({ runningId: null, message: '', status: 'idle' });
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
  const runtime = runtimeMeta(row.payload.runtime);
  const channel = row.payload.channel as ChannelConfig | undefined;
  const mapping = row.payload.mapping as CommandMapping | undefined;
  const skillPath = (row.payload.skill as { absPath?: string } | undefined)?.absPath ?? row.sourceId;
  const filePath = (row.payload.file as { absPath?: string } | undefined)?.absPath;
  const instancePayload = row.sourceKind === 'connected-instance' ? row.payload : null;

  const runRuntimeCommand = async (command: IntegrationRuntimeCommand) => {
    if (!onRunRuntimeCommand) return;
    setRuntimeAction({ runningId: command.id, message: '', status: 'idle' });
    try {
      await onRunRuntimeCommand(command);
      setRuntimeAction({
        runningId: null,
        message: `Opened terminal for: ${formatRuntimeCommand(command)}`,
        status: 'success',
      });
    } catch (error) {
      setRuntimeAction({
        runningId: null,
        message: error instanceof Error ? error.message : 'Runtime command failed',
        status: 'error',
      });
    }
  };

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
              {runtime && (
                <div className="space-y-3 border border-stone-200/12 bg-white/[0.025] p-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">
                      Runtime Operations
                    </p>
                    <p className="mt-1 text-[11px] text-stone-400">
                      Project-scoped sidecar state and lifecycle commands. Commands open in a terminal so logs and prompts stay visible.
                    </p>
                  </div>

                  <div className="grid gap-2">
                    {runtime.dashboardUrl && (
                      <MetaRow label="dashboard" value={runtime.dashboardUrl} />
                    )}
                    {runtime.sourcePath && (
                      <MetaRow label="source" value={runtime.sourcePath} />
                    )}
                    {runtime.statePath && (
                      <MetaRow label="state" value={runtime.statePath} />
                    )}
                    {runtime.logPath && (
                      <MetaRow label="log" value={runtime.logPath} />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {runtime.dashboardUrl && (
                      <button
                        type="button"
                        onClick={() => window.open(runtime.dashboardUrl, '_blank', 'noopener,noreferrer')}
                        className="flex items-center gap-1 border border-emerald-400/30 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-950/30"
                      >
                        <ExternalLink size={12} /> Open dashboard
                      </button>
                    )}
                    {onOpenPath && runtime.docsPath && (
                      <button
                        type="button"
                        onClick={() => onOpenPath(resolveRuntimePath(runtimeRootPath, runtime.docsPath!))}
                        className="flex items-center gap-1 border border-stone-200/20 px-2 py-1 text-xs text-stone-300 hover:bg-white/5"
                      >
                        <FileText size={12} /> Open runbook
                      </button>
                    )}
                    {onOpenPath && runtime.logPath && (
                      <button
                        type="button"
                        onClick={() => onOpenPath(resolveRuntimePath(runtimeRootPath, runtime.logPath!))}
                        className="flex items-center gap-1 border border-stone-200/20 px-2 py-1 text-xs text-stone-300 hover:bg-white/5"
                      >
                        <FileText size={12} /> Open log
                      </button>
                    )}
                    {onOpenPath && runtime.statePath && (
                      <button
                        type="button"
                        onClick={() => onOpenPath(resolveRuntimePath(runtimeRootPath, runtime.statePath!))}
                        className="flex items-center gap-1 border border-stone-200/20 px-2 py-1 text-xs text-stone-300 hover:bg-white/5"
                      >
                        <FolderOpen size={12} /> Open state
                      </button>
                    )}
                  </div>

                  {runtime.commands && runtime.commands.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-stone-500">
                        Lifecycle commands
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {runtime.commands.map((command) => (
                          <button
                            key={command.id}
                            type="button"
                            onClick={() => void runRuntimeCommand(command)}
                            disabled={!onRunRuntimeCommand || runtimeAction.runningId === command.id}
                            title={`${command.description} (${formatRuntimeCommand(command)})`}
                            className="flex items-center gap-1 border border-stone-200/20 px-2 py-1 text-xs text-stone-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {command.id.includes('start') ? <Play size={12} /> : <RotateCw size={12} />}
                            {runtimeAction.runningId === command.id ? 'Opening...' : command.label}
                          </button>
                        ))}
                      </div>
                      {runtimeAction.message && (
                        <p
                          className={`text-[11px] ${
                            runtimeAction.status === 'error' ? 'text-red-300' : 'text-emerald-300'
                          }`}
                        >
                          {runtimeAction.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
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
            <section className="border-t border-stone-200/12 pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
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
                  {onChannelClearLog && (
                    <button
                      type="button"
                      onClick={() => onChannelClearLog(channel.id)}
                      className="border border-stone-200/20 px-2 py-1 text-xs text-stone-300"
                    >
                      Clear log
                    </button>
                  )}
                  {onChannelDelete && (
                    <button
                      type="button"
                      onClick={() => onChannelDelete(channel.id)}
                      className="border border-red-500/30 px-2 py-1 text-xs text-red-400"
                    >
                      <Trash2 size={12} className="inline" /> Delete
                    </button>
                  )}
                </div>
              </div>

              {onChannelUpdate && (
                <ChannelEditForm
                  channel={channel}
                  onSave={(patch, secrets) => onChannelUpdate(channel.id, patch, secrets)}
                  onTestTelegramToken={onTestTelegramToken}
                />
              )}
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

          {row.sourceKind === 'command-mapping' && mapping && (
            <section className="border-t border-stone-200/12 pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-stone-400">
                  command · <span className="font-mono">{mapping.action}</span>
                </p>
                {onCommandMappingDelete && isDefaultCommandMapping && !isDefaultCommandMapping(mapping.id) && (
                  <button
                    type="button"
                    onClick={() => onCommandMappingDelete(mapping.id)}
                    className="border border-red-500/30 px-2 py-1 text-xs text-red-400"
                  >
                    <Trash2 size={12} className="inline" /> Delete
                  </button>
                )}
              </div>

              {onCommandMappingUpdate && (
                <CommandMappingEditForm
                  mapping={mapping}
                  isDefault={isDefaultCommandMapping ? isDefaultCommandMapping(mapping.id) : false}
                  otherTriggers={otherCommandTriggers ? otherCommandTriggers(mapping.id) : []}
                  onSave={(patch) => onCommandMappingUpdate(mapping.id, patch)}
                />
              )}

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

          {instancePayload && (
            <section className="border-t border-stone-200/12 pt-4 space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">
                Instance Metadata
              </p>
              <MetaRow label="kind" value={stringMeta(instancePayload.instanceKind)} />
              <MetaRow label="owner" value={stringMeta(instancePayload.owner)} />
              <MetaRow label="access" value={stringMeta(instancePayload.accessType)} />
              <MetaRow label="risk" value={stringMeta(instancePayload.risk)} />
              <MetaRow label="source" value={stringMeta(instancePayload.discoverySource)} />
              <MetaRow label="services" value={arrayMeta(instancePayload.services)} />
              <MetaRow label="capabilities" value={arrayMeta(instancePayload.capabilities)} />
              <p className="text-[11px] text-stone-500">
                {stringMeta(instancePayload.credentialBoundary)}
              </p>
            </section>
          )}

        </div>
      </aside>
    </>
  );
}

function stringMeta(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function arrayMeta(value: unknown): string {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').join(', ') : '';
}
