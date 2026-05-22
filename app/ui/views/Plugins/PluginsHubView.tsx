'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText, RotateCw } from 'lucide-react';
import type { IntegrationRow, IntegrationSheet } from '../../../../lib/integrations/types';
import { mergeAllManual } from '../../../../lib/integrations/manual-metadata';
import { mapInstalledPlugins, mapMarketplaceRow } from '../../../../lib/integrations/mappers/plugins';
import { mapSkillRow } from '../../../../lib/integrations/mappers/skills';
import { mapChannelRow, mapCommandMappingRow } from '../../../../lib/integrations/mappers/channels';
import { mapSystemCliRow } from '../../../../lib/integrations/mappers/system-cli';
import { loadMemoryRows, loadSlashCommandRows } from '../../../../lib/integrations/load-project-inventory';
import { MARKETPLACE, buildFromMarketplace } from '../../../../lib/integrations/marketplace-catalog';
import type { PluginCatalog, McpPlugin } from '../../../../lib/types/plugins';
import type { ChannelCatalog, ChannelConfig, ChannelPlatform } from '../../../../lib/types/channels';
import {
  addPlugin,
  loadAllApiKeys,
  loadPluginCatalog,
  removePlugin,
  savePluginCatalog,
  selectProviders,
  setProviderApiKey,
  togglePluginEnabled,
} from '../../../../lib/storage/plugins';
import {
  getAiCliPresetAllowlist,
  loadSystemCliExposureMap,
  setSystemCliExposed,
  setSystemCliExposureMany,
} from '../../../../lib/storage/system-cli';
import {
  getChannelSecret,
  loadChannelCatalog,
  saveChannelCatalog,
} from '../../../../lib/storage/channels';
import {
  type McpRunStatus,
  type UnlistenFn,
  mcpKill,
  mcpSpawn,
  mcpStatusAll,
  onMcpStatus,
  openPath,
  readFile,
  listGlobalCliInventory,
  skillInstallFromUrl,
  skillList,
  skillUninstall,
  telegramStartPoll,
  telegramStatusAll,
  telegramStopPoll,
  onTelegramStatus,
} from '../../../../lib/bridge';
import { checkCommandExists } from '../../../../lib/adapters/availability';
import { getSkillsDir } from '../../../../lib/storage/settings';
import { parseCategorySlug, parseFrontmatter } from '../../../../lib/skills/utils';
import { useI18n } from '../../../../lib/i18n';
import PluginGuidePanel from '../../../../components/PluginGuidePanel';
import {
  IntegrationsTable,
  DEFAULT_VISIBILITY,
  type ColumnVisibility,
} from './_shared/IntegrationsTable';
import { IntegrationsDetailSheet } from './_shared/IntegrationsDetailSheet';
import { McpLogsViewer } from './_shared/McpLogsViewer';

const EMPTY_CATALOG: PluginCatalog = { schemaVersion: 2, plugins: [] };

function newChannelId(): string {
  return typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

const CHANNEL_QUICK_ADD: { platform: ChannelPlatform; label: string }[] = [
  { platform: 'telegram', label: 'Telegram Bot' },
  { platform: 'whatsapp', label: 'WhatsApp' },
  { platform: 'line', label: 'LINE' },
  { platform: 'wechat', label: 'WeChat Work' },
];

type PluginsFilter = 'all' | 'installed' | 'marketplace';

export interface PluginsHubViewProps {
  projectRoot?: string;
}

export function PluginsHubView({ projectRoot = '' }: PluginsHubViewProps) {
  const { t } = useI18n();
  const [activeSheet, setActiveSheet] = useState<IntegrationSheet>('plugins');
  const [pluginsFilter, setPluginsFilter] = useState<PluginsFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(DEFAULT_VISIBILITY);
  const [selectedRow, setSelectedRow] = useState<IntegrationRow | null>(null);
  const [manualVersion, setManualVersion] = useState(0);

  const [catalog, setCatalog] = useState<PluginCatalog>(EMPTY_CATALOG);
  const [channelCatalog, setChannelCatalog] = useState<ChannelCatalog>({ channels: [], commandMappings: [] });
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [mcpStatuses, setMcpStatuses] = useState<Map<string, McpRunStatus>>(new Map());
  const [pollStatuses, setPollStatuses] = useState<Map<string, import('../../../../lib/bridge').TelegramPollStatus>>(new Map());
  const [skillsDir, setSkillsDir] = useState('');
  const [skillRows, setSkillRows] = useState<IntegrationRow[]>([]);
  const [memoryRows, setMemoryRows] = useState<IntegrationRow[]>([]);
  const [commandRows, setCommandRows] = useState<IntegrationRow[]>([]);
  const [systemCliExposure, setSystemCliExposure] = useState<Record<string, boolean>>({});
  const [systemCommandStatus, setSystemCommandStatus] = useState<Record<string, boolean>>({});
  const [logsForId, setLogsForId] = useState<string | null>(null);
  const [skillsInstallUrl, setSkillsInstallUrl] = useState('');
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const refreshManual = () => setManualVersion((v) => v + 1);

  useEffect(() => {
    const c = loadPluginCatalog();
    setCatalog(c);
    void loadAllApiKeys(selectProviders(c)).then(setApiKeys);
    void getSkillsDir().then(setSkillsDir);
    setChannelCatalog(loadChannelCatalog());
    setSystemCliExposure(loadSystemCliExposureMap());
  }, []);

  const loadSkills = useCallback(async () => {
    if (!skillsDir) {
      setSkillRows([]);
      return;
    }
    try {
      const files = await skillList(skillsDir);
      const parsed: IntegrationRow[] = [];
      await Promise.all(
        files.map(async (f) => {
          try {
            const raw = await readFile(f.absPath);
            const { name, description, version, tags } = parseFrontmatter(raw);
            const { category, slug } = parseCategorySlug(f.relPath);
            parsed.push(
              mapSkillRow(
                {
                  absPath: f.absPath,
                  relPath: f.relPath,
                  name: name || slug,
                  slug,
                  category,
                  description,
                  tags,
                  version,
                  modified: f.modified,
                },
                skillsDir,
              ),
            );
          } catch {
            const { category, slug } = parseCategorySlug(f.relPath);
            parsed.push(
              mapSkillRow(
                {
                  absPath: f.absPath,
                  relPath: f.relPath,
                  name: slug,
                  slug,
                  category,
                  description: '',
                  tags: [],
                  version: '1.0.0',
                  modified: f.modified,
                },
                skillsDir,
              ),
            );
          }
        }),
      );
      setSkillRows(parsed);
    } catch {
      setSkillRows([]);
    }
  }, [skillsDir]);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  const loadMemory = useCallback(async () => {
    const rows = await loadMemoryRows(projectRoot);
    setMemoryRows(rows);
  }, [projectRoot]);

  const loadCommands = useCallback(async () => {
    const slash = await loadSlashCommandRows(projectRoot);
    const mappings = channelCatalog.commandMappings.map(mapCommandMappingRow);
    const exposure = loadSystemCliExposureMap();
    setSystemCliExposure(exposure);
    let systemCli: IntegrationRow[] = [];
    try {
      const inventory = await listGlobalCliInventory();
      systemCli = inventory.map((entry) => mapSystemCliRow(entry, exposure[entry.command] === true));
    } catch {
      systemCli = [];
    }
    setCommandRows([...slash, ...mappings, ...systemCli]);
  }, [projectRoot, channelCatalog.commandMappings]);

  useEffect(() => {
    void loadMemory();
  }, [loadMemory]);

  useEffect(() => {
    void loadCommands();
  }, [loadCommands]);

  useEffect(() => {
    let cancelled = false;
    const scan = async () => {
      const status: Record<string, boolean> = {};
      await Promise.all(
        MARKETPLACE.map(async (mp) => {
          let command = '';
          if (mp.kind === 'cli' && mp.defaultCli?.command) command = mp.defaultCli.command;
          else if (mp.kind === 'editor' && mp.defaultEditor?.command) command = mp.defaultEditor.command;
          if (command) {
            const baseName = command.split('/').pop() || command;
            try {
              status[mp.id] = await checkCommandExists(baseName);
            } catch {
              status[mp.id] = false;
            }
          }
        }),
      );
      if (!cancelled) setSystemCommandStatus(status);
    };
    void scan();
    return () => {
      cancelled = true;
    };
  }, [catalog]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: UnlistenFn | undefined;
    mcpStatusAll()
      .then((arr) => {
        if (!cancelled) setMcpStatuses(new Map(arr.map((s) => [s.pluginId, s.status])));
      })
      .catch(() => {});
    onMcpStatus(({ pluginId, status }) => {
      setMcpStatuses((prev) => new Map(prev).set(pluginId, status));
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let stop: UnlistenFn | undefined;
    telegramStatusAll()
      .then((arr) => setPollStatuses(new Map(arr.map((s) => [s.channelId, s]))))
      .catch(() => {});
    onTelegramStatus((s) => setPollStatuses((prev) => new Map(prev).set(s.channelId, s)))
      .then((fn) => {
        stop = fn;
      })
      .catch(() => {});
    return () => stop?.();
  }, []);

  const updateCatalog = (next: PluginCatalog) => {
    setCatalog(next);
    savePluginCatalog(next);
    refreshManual();
  };

  const updateChannels = (next: ChannelCatalog) => {
    setChannelCatalog(next);
    saveChannelCatalog(next);
    refreshManual();
  };

  const installedIds = useMemo(() => new Set(catalog.plugins.map((p) => p.id)), [catalog]);

  const pluginRows = useMemo(() => {
    const ctx = { apiKeys, systemCommandStatus, mcpStatuses };
    const installed = mapInstalledPlugins(catalog, ctx);
    const marketplace = MARKETPLACE.map((mp) =>
      mapMarketplaceRow({
        id: mp.id,
        name: mp.name,
        description: mp.description,
        category: mp.category,
        kind: mp.kind,
        installed: installedIds.has(mp.id),
      }),
    );
    let rows: IntegrationRow[] = [];
    if (pluginsFilter === 'installed') rows = installed;
    else if (pluginsFilter === 'marketplace') rows = marketplace.filter((r) => r.status === 'not_installed');
    else rows = [...installed, ...marketplace.filter((r) => !installedIds.has(r.sourceId))];
    return mergeAllManual(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, apiKeys, systemCommandStatus, mcpStatuses, pluginsFilter, installedIds, manualVersion]);

  const channelRows = useMemo(() => {
    const rows = channelCatalog.channels.map((ch) =>
      mapChannelRow(ch, pollStatuses, Boolean(getChannelSecret(ch.id, 'botToken'))),
    );
    return mergeAllManual(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelCatalog, pollStatuses, manualVersion]);

  const skillsRowsMerged = useMemo(() => mergeAllManual(skillRows), [skillRows, manualVersion]);
  const memoryRowsMerged = useMemo(() => mergeAllManual(memoryRows), [memoryRows, manualVersion]);
  const commandRowsMerged = useMemo(() => mergeAllManual(commandRows), [commandRows, manualVersion]);
  const companyStandardsRows = useMemo<IntegrationRow[]>(
    () =>
      mergeAllManual([
        {
          rowKey: 'standards:company-ai-app-design-standards',
          sheet: 'company_standards',
          sourceKind: 'standards-provider',
          sourceId: 'company-ai-app-standards',
          enabled: true,
          category1: 'Governance',
          category2: 'Design Standards',
          githubUrl: '',
          company: 'Company AI',
          name: 'Company-AI-App-Design Standards',
          version: 'draft-v0.1',
          license: '',
          scope: 'project',
          port: '5174',
          installPath: '/Volumes/KLEVV-4T-1/Company-AI-App-Standards',
          status: 'connected',
          statusLabel: 'Available',
          lastUpdated: new Date().toISOString().slice(0, 10),
          notes:
            'Optional provider for standards profiles and checks. Uses local docs as fallback when provider is unavailable.',
          lv: null,
          badges: ['optional', 'plugin-contract', 'design-governance'],
          payload: {
            standardsRoot: '/Volumes/KLEVV-4T-1/Company-AI-App-Standards',
            contractDoc:
              '/Volumes/KLEVV-4T-1/Project-Manager/docs/integrations/company-standards-plugin-contract.md',
            baselineDoc:
              '/Volumes/KLEVV-4T-1/Company-AI-App-Standards/docs/patterns/table-governance.md',
            profileDoc:
              '/Volumes/KLEVV-4T-1/Company-AI-App-Standards/docs/patterns/project-manager-table-profile.md',
          },
        },
      ]),
    [manualVersion],
  );
  const systemCliRows = useMemo(
    () => commandRowsMerged.filter((row) => row.sourceKind === 'system-cli'),
    [commandRowsMerged],
  );
  const exposedSystemCliCount = useMemo(
    () => systemCliRows.filter((row) => row.enabled).length,
    [systemCliRows],
  );
  const exposedSystemCliConfigured = useMemo(
    () => Object.values(systemCliExposure).filter(Boolean).length,
    [systemCliExposure],
  );
  const applySystemCliPolicyPreset = useCallback(
    (preset: 'allow-all' | 'block-all' | 'ai-defaults') => {
      if (systemCliRows.length === 0) return;
      const updates: Record<string, boolean> = {};
      const presetAllowlist = new Set(getAiCliPresetAllowlist());
      for (const row of systemCliRows) {
        if (preset === 'allow-all') updates[row.sourceId] = true;
        else if (preset === 'block-all') updates[row.sourceId] = false;
        else updates[row.sourceId] = presetAllowlist.has(row.sourceId);
      }
      setSystemCliExposureMany(updates);
      setSystemCliExposure((prev) => ({ ...prev, ...updates }));
      void loadCommands();
    },
    [loadCommands, systemCliRows],
  );

  const activeRows = useMemo(() => {
    let rows =
      activeSheet === 'plugins'
        ? pluginRows
        : activeSheet === 'skills'
          ? skillsRowsMerged
          : activeSheet === 'channels'
            ? channelRows
            : activeSheet === 'memory'
              ? memoryRowsMerged
              : activeSheet === 'company_standards'
                ? companyStandardsRows
                : commandRowsMerged;
    if (categoryFilter !== 'all') {
      rows = rows.filter((r) => r.category1 === categoryFilter);
    }
    return rows;
  }, [
    activeSheet,
    pluginRows,
    skillsRowsMerged,
    channelRows,
    memoryRowsMerged,
    companyStandardsRows,
    commandRowsMerged,
    categoryFilter,
  ]);

  const categoryOptions = useMemo(() => {
    const set = new Set(activeRows.map((r) => r.category1));
    return ['all', ...Array.from(set).sort()];
  }, [activeRows]);

  const handleApiKeyChange = async (id: string, key: string) => {
    await setProviderApiKey(id, key);
    setApiKeys((prev) => ({ ...prev, [id]: key }));
  };

  const handleInstall = (marketplaceId: string) => {
    const mp = MARKETPLACE.find((m) => m.id === marketplaceId);
    if (!mp) return;
    const plugin = buildFromMarketplace(mp);
    if (!plugin) return;
    updateCatalog(addPlugin(catalog, plugin));
    setPluginsFilter('installed');
  };

  const mcpStart = async (plugin: McpPlugin) => {
    if (plugin.transport !== 'stdio' || !plugin.command) return;
    try {
      const result = await mcpSpawn({
        pluginId: plugin.id,
        command: plugin.command,
        args: plugin.args ?? [],
        env: plugin.env,
      });
      setMcpStatuses((prev) => new Map(prev).set(plugin.id, result.status));
    } catch (e) {
      setMcpStatuses((prev) => new Map(prev).set(plugin.id, { phase: 'errored', message: String(e) }));
    }
  };

  const handleChannelStartPoll = async (channel: import('../../../../lib/types/channels').ChannelConfig) => {
    const botToken = getChannelSecret(channel.id, 'botToken');
    if (!botToken) {
      alert('Set the Bot Token first.');
      return;
    }
    const allowedRaw = channel.credentials.allowedChatIds ?? '';
    const allowedChatIds = allowedRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);
    try {
      const status = await telegramStartPoll({ channelId: channel.id, botToken, allowedChatIds });
      setPollStatuses((prev) => new Map(prev).set(channel.id, status));
    } catch (e) {
      setPollStatuses((prev) =>
        new Map(prev).set(channel.id, {
          channelId: channel.id,
          status: { phase: 'errored', message: String(e) },
        }),
      );
    }
  };

  const sheets: { id: IntegrationSheet; label: string; count: number }[] = [
    { id: 'plugins', label: t.integrations.sheetPlugins, count: pluginRows.length },
    { id: 'skills', label: t.integrations.sheetSkills, count: skillsRowsMerged.length },
    { id: 'channels', label: t.integrations.sheetChannels, count: channelRows.length },
    { id: 'memory', label: t.integrations.sheetMemory, count: memoryRowsMerged.length },
    { id: 'commands', label: t.integrations.sheetCommands, count: commandRowsMerged.length },
    {
      id: 'company_standards',
      label: 'Company-AI-App-Design Standards',
      count: companyStandardsRows.length,
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-col gap-3 border-b border-stone-200/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">
            {t.integrations.title}
          </h1>
          <p className="mt-1 text-xs text-stone-400">{t.integrations.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() =>
            void openPath('/Volumes/KLEVV-4T-1/Project-Manager/docs/engineering/plugin-guide.md').catch(
              () => {},
            )
          }
          className="flex items-center gap-2 self-start border border-emerald-500/20 bg-emerald-950/25 px-3 py-1.5 text-xs text-emerald-400 sm:self-center"
        >
          <FileText size={13} />
          Plugin Guide
          <ExternalLink size={11} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border border-stone-200/12 bg-stone-900/40 p-1">
        {sheets.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setActiveSheet(s.id);
              setSelectedRow(null);
              setCategoryFilter('all');
            }}
            className={`px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] ${
              activeSheet === s.id
                ? 'bg-stone-800 text-emerald-400'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {s.label}
            <span className="ml-1.5 font-mono text-[10px] opacity-80">({s.count})</span>
          </button>
        ))}
      </div>

      {!projectRoot && activeSheet === 'memory' && (
        <p className="border border-amber-400/25 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
          {t.integrations.selectProjectHint}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.integrations.searchPlaceholder}
          className="min-w-[200px] flex-1 border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72 px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/25"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-stone-200/18 bg-[rgb(var(--pm-panel))] px-2 py-2 text-xs text-stone-200"
        >
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? t.integrations.filterAllCategories : c}
            </option>
          ))}
        </select>
        {activeSheet === 'plugins' && (
          <select
            value={pluginsFilter}
            onChange={(e) => setPluginsFilter(e.target.value as PluginsFilter)}
            className="border border-stone-200/18 bg-[rgb(var(--pm-panel))] px-2 py-2 text-xs text-stone-200"
          >
            <option value="all">{t.integrations.filterAllPlugins}</option>
            <option value="installed">{t.plugins.installed}</option>
            <option value="marketplace">{t.plugins.marketplace}</option>
          </select>
        )}
        {activeSheet === 'skills' && (
          <>
            <button
              type="button"
              onClick={() => void loadSkills()}
              className="flex items-center gap-1 border border-stone-200/20 px-2 py-2 text-xs text-stone-300"
            >
              <RotateCw size={12} /> {t.plugins.rescan}
            </button>
            <Link href="/settings" className="text-xs text-emerald-300/80 hover:text-emerald-200">
              {t.plugins.settings}
            </Link>
          </>
        )}
        {(activeSheet === 'memory' || activeSheet === 'commands') && (activeSheet !== 'memory' || projectRoot) && (
          <button
            type="button"
            onClick={() => {
              if (activeSheet === 'memory') void loadMemory();
              else void loadCommands();
            }}
            className="flex items-center gap-1 border border-stone-200/20 px-2 py-2 text-xs text-stone-300"
          >
            <RotateCw size={12} /> {t.plugins.rescan}
          </button>
        )}
        {activeSheet === 'commands' && projectRoot && (
          <button
            type="button"
            onClick={() => void openPath(`${projectRoot.replace(/\/+$/, '')}/.claude/commands`).catch(() => {})}
            className="border border-stone-200/20 px-2 py-2 text-xs text-stone-300"
          >
            {t.integrations.openCommandsFolder}
          </button>
        )}
        {activeSheet === 'commands' && (
          <>
            <button
              type="button"
              onClick={() => applySystemCliPolicyPreset('allow-all')}
              className="border border-emerald-400/30 bg-emerald-950/20 px-2 py-2 text-xs text-emerald-300"
            >
              {t.integrations.commandsAllowAllSystemCli}
            </button>
            <button
              type="button"
              onClick={() => applySystemCliPolicyPreset('block-all')}
              className="border border-red-400/30 bg-red-950/20 px-2 py-2 text-xs text-red-300"
            >
              {t.integrations.commandsBlockAllSystemCli}
            </button>
            <button
              type="button"
              onClick={() => applySystemCliPolicyPreset('ai-defaults')}
              className="border border-cyan-400/30 bg-cyan-950/20 px-2 py-2 text-xs text-cyan-200"
            >
              {t.integrations.commandsAiDefaultsPreset}
            </button>
          </>
        )}
        {activeSheet === 'channels' && (
          <div className="flex flex-wrap gap-1">
            {CHANNEL_QUICK_ADD.map(({ platform, label }) => (
              <button
                key={platform}
                type="button"
                onClick={() => {
                  const ch: ChannelConfig = {
                    id: newChannelId(),
                    platform,
                    label,
                    enabled: true,
                    webhookMode: platform === 'telegram' ? 'polling' : 'webhook',
                    credentials: {},
                  };
                  updateChannels({
                    ...channelCatalog,
                    channels: [...channelCatalog.channels, ch],
                  });
                  setSelectedRow(mapChannelRow(ch, pollStatuses, false));
                }}
                className="border border-stone-200/18 px-2 py-1.5 text-xs text-stone-300 hover:border-emerald-300/30"
              >
                + {label}
              </button>
            ))}
          </div>
        )}
        <label className="flex items-center gap-1 text-[10px] text-stone-500">
          <input
            type="checkbox"
            checked={columnVisibility.installPath}
            onChange={(e) =>
              setColumnVisibility((v) => ({ ...v, installPath: e.target.checked }))
            }
          />
          Path
        </label>
        <label className="flex items-center gap-1 text-[10px] text-stone-500">
          <input
            type="checkbox"
            checked={columnVisibility.notes}
            onChange={(e) => setColumnVisibility((v) => ({ ...v, notes: e.target.checked }))}
          />
          Notes
        </label>
      </div>

      {activeSheet === 'commands' && (
        <div className="border border-cyan-400/20 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-100/90">
          {t.integrations.commandsInventorySummary
            .replace('{detected}', String(systemCliRows.length))
            .replace('{exposed}', String(exposedSystemCliCount))
            .replace('{whitelisted}', String(exposedSystemCliConfigured))}
        </div>
      )}

      <IntegrationsTable
        rows={activeRows}
        selectedRowKey={selectedRow?.rowKey ?? null}
        onRowClick={setSelectedRow}
        globalFilter={search}
        columnVisibility={columnVisibility}
        onToggleEnabled={
          activeSheet === 'plugins'
            ? (row, _enabled) => {
                if (row.sourceKind === 'plugin-installed') {
                  updateCatalog(togglePluginEnabled(catalog, row.sourceId));
                }
              }
            : activeSheet === 'channels'
              ? (row, enabled) => {
                  if (row.sourceKind !== 'channel') return;
                  updateChannels({
                    ...channelCatalog,
                    channels: channelCatalog.channels.map((c) =>
                      c.id === row.sourceId ? { ...c, enabled } : c,
                    ),
                  });
                }
              : activeSheet === 'commands'
                ? (row, enabled) => {
                    if (row.sourceKind === 'command-mapping') {
                      updateChannels({
                        ...channelCatalog,
                        commandMappings: channelCatalog.commandMappings.map((m) =>
                          m.id === row.sourceId ? { ...m, enabled } : m,
                        ),
                      });
                    } else if (row.sourceKind === 'system-cli') {
                      setSystemCliExposed(row.sourceId, enabled);
                      setSystemCliExposure((prev) => ({ ...prev, [row.sourceId]: enabled }));
                    } else {
                      return;
                    }
                    void loadCommands();
                  }
                : undefined
        }
      />

      <IntegrationsDetailSheet
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        catalog={catalog}
        apiKeys={apiKeys}
        providers={selectProviders(catalog)}
        onCatalogChange={updateCatalog}
        onApiKeyChange={handleApiKeyChange}
        onInstallMarketplace={handleInstall}
        onUninstallPlugin={(id) => updateCatalog(removePlugin(catalog, id))}
        onTogglePluginEnabled={(id) => updateCatalog(togglePluginEnabled(catalog, id))}
        mcpStart={(p) => void mcpStart(p)}
        mcpStop={(id) => void mcpKill(id)}
        mcpRestart={async (p) => {
          await mcpKill(p.id);
          await new Promise((r) => setTimeout(r, 80));
          await mcpStart(p);
        }}
        mcpViewLogs={setLogsForId}
        onOpenPath={(path) => void openPath(path).catch(() => {})}
        onSkillUninstall={async (path) => {
          if (!skillsDir) return;
          if (typeof window !== 'undefined' && !window.confirm(t.plugins.deleteSkillConfirm.replace('{path}', path))) return;
          await skillUninstall(path, skillsDir);
          await loadSkills();
          setSelectedRow(null);
        }}
        onSkillInstallUrl={async (url) => {
          if (!skillsDir || !url.trim()) return;
          await skillInstallFromUrl(url.trim(), skillsDir);
          setSkillsInstallUrl('');
          await loadSkills();
        }}
        skillsInstallUrl={skillsInstallUrl}
        onSkillsInstallUrlChange={setSkillsInstallUrl}
        skillsDir={skillsDir}
        onChannelStartPoll={handleChannelStartPoll}
        onChannelStopPoll={(id) => void telegramStopPoll(id)}
        onManualSaved={refreshManual}
      />

      {logsForId && <McpLogsViewer pluginId={logsForId} onClose={() => setLogsForId(null)} />}
      <PluginGuidePanel isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}
