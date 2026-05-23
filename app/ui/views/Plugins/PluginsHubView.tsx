'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, FileText, MessageCircle, RotateCw, Snowflake, X } from 'lucide-react';
import type { IntegrationRow, IntegrationSheet } from '../../../../lib/integrations/types';
import { mergeAllManual } from '../../../../lib/integrations/manual-metadata';
import { mapInstalledPlugins, mapMarketplaceRow } from '../../../../lib/integrations/mappers/plugins';
import { mapSkillRow } from '../../../../lib/integrations/mappers/skills';
import { mapChannelRow, mapCommandMappingRow } from '../../../../lib/integrations/mappers/channels';
import { mapSystemCliRow } from '../../../../lib/integrations/mappers/system-cli';
import { loadMemoryRows, loadSlashCommandRows } from '../../../../lib/integrations/load-project-inventory';
import { MARKETPLACE, buildFromMarketplace } from '../../../../lib/integrations/marketplace-catalog';
import type { PluginCatalog, McpPlugin } from '../../../../lib/types/plugins';
import type {
  ChannelCatalog,
  ChannelConfig,
  ChannelPlatform,
  ChannelWebhookMode,
  CommandAction,
  CommandMapping,
} from '../../../../lib/types/channels';
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
  ACTIVITY_CAP_PER_CHANNEL,
  DEFAULT_COMMAND_MAPPINGS,
  type ChannelActivityEntry,
  appendChannelActivity,
  clearChannelActivity,
  deleteChannelSecrets,
  getChannelSecret,
  loadAllChannelActivity,
  loadChannelCatalog,
  saveChannelCatalog,
  setChannelSecret,
} from '../../../../lib/storage/channels';
import { PLATFORM_CREDS } from './_shared/channel-platform';
import { COMMAND_ACTION_OPTIONS } from './_shared/CommandMappingEditForm';
import { routeTelegramCommand } from '../../../../lib/channels/telegram-router';
import {
  type McpRunStatus,
  type UnlistenFn,
  mcpKill,
  mcpSpawn,
  mcpStatusAll,
  onMcpStatus,
  onTelegramMessage,
  openPath,
  readFile,
  listGlobalCliInventory,
  skillInstallFromUrl,
  skillList,
  skillUninstall,
  telegramGetMe,
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
import { ConnectSheet } from './ConnectSheet';

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

const DEFAULT_COMMAND_MAPPING_IDS = new Set(DEFAULT_COMMAND_MAPPINGS.map((m) => m.id));

function newMappingId(): string {
  return typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

type PluginsFilter = 'all' | 'installed' | 'marketplace';
type PluginsRowDensity = 'compact' | 'comfortable';

export interface PluginsHubViewProps {
  projectRoot?: string;
  /** Sheet driven by the URL (`/integrations-hub/<sheet>`). Defaults to `plugins`. */
  initialSheet?: IntegrationSheet;
}

export function PluginsHubView({ projectRoot = '', initialSheet }: PluginsHubViewProps) {
  const { t } = useI18n();
  const router = useRouter();
  const activeSheet: IntegrationSheet = initialSheet ?? 'plugins';
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
  const [recentMessages, setRecentMessages] = useState<ChannelActivityEntry[]>([]);
  const [showChannelGuide, setShowChannelGuide] = useState(false);
  const [addCommandOpen, setAddCommandOpen] = useState(false);
  const channelCatalogRef = useRef<ChannelCatalog>({ channels: [], commandMappings: [] });
  const [skillsDir, setSkillsDir] = useState('');
  const [skillRows, setSkillRows] = useState<IntegrationRow[]>([]);
  const [memoryRows, setMemoryRows] = useState<IntegrationRow[]>([]);
  const [commandRows, setCommandRows] = useState<IntegrationRow[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [commandsLoading, setCommandsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [commandsError, setCommandsError] = useState<string | null>(null);
  const [systemCliExposure, setSystemCliExposure] = useState<Record<string, boolean>>({});
  const [systemCommandStatus, setSystemCommandStatus] = useState<Record<string, boolean>>({});
  const [logsForId, setLogsForId] = useState<string | null>(null);
  const [skillsInstallUrl, setSkillsInstallUrl] = useState('');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [frozenDataColCount, setFrozenDataColCount] = useState(0);
  const [rowDensity, setRowDensity] = useState<PluginsRowDensity>('comfortable');

  const refreshManual = () => setManualVersion((v) => v + 1);

  // Reset per-sheet state when the URL sheet changes — dynamic-segment
  // navigation keeps the component mounted, so selection/filters persist
  // across tabs unless we explicitly clear them here.
  useEffect(() => {
    setSelectedRow(null);
    setCategoryFilter('all');
  }, [activeSheet]);

  useEffect(() => {
    const c = loadPluginCatalog();
    setCatalog(c);
    void loadAllApiKeys(selectProviders(c)).then(setApiKeys);
    void getSkillsDir().then(setSkillsDir);
    const chCatalog = loadChannelCatalog();
    setChannelCatalog(chCatalog);
    setRecentMessages(
      loadAllChannelActivity(chCatalog.channels.map((c) => c.id)).slice(0, ACTIVITY_CAP_PER_CHANNEL),
    );
    setSystemCliExposure(loadSystemCliExposureMap());
  }, []);

  const loadSkills = useCallback(async () => {
    setSkillsLoading(true);
    setSkillsError(null);
    if (!skillsDir) {
      setSkillRows([]);
      setSkillsLoading(false);
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
    } catch (error) {
      setSkillRows([]);
      setSkillsError(error instanceof Error ? error.message : 'Unknown skills load error');
    } finally {
      setSkillsLoading(false);
    }
  }, [skillsDir]);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  const loadMemory = useCallback(async () => {
    setMemoryLoading(true);
    setMemoryError(null);
    try {
      const rows = await loadMemoryRows(projectRoot);
      setMemoryRows(rows);
    } catch (error) {
      setMemoryRows([]);
      setMemoryError(error instanceof Error ? error.message : 'Unknown memory load error');
    } finally {
      setMemoryLoading(false);
    }
  }, [projectRoot]);

  const loadCommands = useCallback(async () => {
    setCommandsLoading(true);
    setCommandsError(null);
    try {
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
    } catch (error) {
      setCommandRows([]);
      setCommandsError(error instanceof Error ? error.message : 'Unknown commands load error');
    } finally {
      setCommandsLoading(false);
    }
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

  useEffect(() => {
    channelCatalogRef.current = channelCatalog;
  }, [channelCatalog]);

  useEffect(() => {
    let stop: UnlistenFn | undefined;
    onTelegramMessage((msg) => {
      const entry: ChannelActivityEntry = {
        channelId: msg.channelId,
        updateId: msg.updateId,
        chatId: msg.chatId,
        fromUsername: msg.fromUsername,
        fromName: msg.fromName,
        text: msg.text,
        timestamp: msg.timestamp,
      };
      appendChannelActivity(msg.channelId, entry);
      setRecentMessages((prev) => [entry, ...prev].slice(0, ACTIVITY_CAP_PER_CHANNEL));
      void routeTelegramCommand(msg, channelCatalogRef.current);
    })
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

  const handleChannelUpdate = useCallback(
    (
      channelId: string,
      patch: { label: string; enabled: boolean; webhookMode: ChannelWebhookMode; credentials: Record<string, string> },
      secrets: Record<string, string>,
    ) => {
      const target = channelCatalogRef.current.channels.find((c) => c.id === channelId);
      if (!target) return;
      for (const field of PLATFORM_CREDS[target.platform]) {
        if (field.secret) {
          setChannelSecret(channelId, field.key, secrets[field.key] ?? '');
        }
      }
      const nextCatalog: ChannelCatalog = {
        ...channelCatalogRef.current,
        channels: channelCatalogRef.current.channels.map((c) =>
          c.id === channelId ? { ...c, ...patch } : c,
        ),
      };
      setChannelCatalog(nextCatalog);
      saveChannelCatalog(nextCatalog);
      const updated = nextCatalog.channels.find((c) => c.id === channelId);
      if (updated) {
        setSelectedRow(mapChannelRow(updated, pollStatuses, Boolean(getChannelSecret(channelId, 'botToken'))));
      }
      refreshManual();
    },
    [pollStatuses],
  );

  const handleChannelDelete = useCallback(
    (channelId: string) => {
      const target = channelCatalogRef.current.channels.find((c) => c.id === channelId);
      if (!target) return;
      if (typeof window !== 'undefined' && !window.confirm(`Delete channel "${target.label}"?`)) return;
      deleteChannelSecrets(
        channelId,
        PLATFORM_CREDS[target.platform].filter((f) => f.secret).map((f) => f.key),
      );
      clearChannelActivity(channelId);
      const nextCatalog: ChannelCatalog = {
        ...channelCatalogRef.current,
        channels: channelCatalogRef.current.channels.filter((c) => c.id !== channelId),
      };
      setChannelCatalog(nextCatalog);
      saveChannelCatalog(nextCatalog);
      setRecentMessages((prev) => prev.filter((e) => e.channelId !== channelId));
      setSelectedRow(null);
      refreshManual();
    },
    [],
  );

  const handleChannelClearLog = useCallback((channelId: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Clear this channel\'s activity log?')) return;
    clearChannelActivity(channelId);
    setRecentMessages((prev) => prev.filter((e) => e.channelId !== channelId));
  }, []);

  const handleCommandMappingUpdate = useCallback(
    (
      mappingId: string,
      patch: { trigger: string; description: string; action: CommandAction; enabled: boolean },
    ) => {
      const current = channelCatalogRef.current;
      const target = current.commandMappings.find((m) => m.id === mappingId);
      if (!target) return;
      const nextMapping: CommandMapping = {
        ...target,
        trigger: patch.trigger,
        description: patch.description,
        action: DEFAULT_COMMAND_MAPPING_IDS.has(mappingId) ? target.action : patch.action,
        enabled: patch.enabled,
      };
      const nextCatalog: ChannelCatalog = {
        ...current,
        commandMappings: current.commandMappings.map((m) => (m.id === mappingId ? nextMapping : m)),
      };
      setChannelCatalog(nextCatalog);
      saveChannelCatalog(nextCatalog);
      setSelectedRow(mapCommandMappingRow(nextMapping));
      refreshManual();
    },
    [],
  );

  const handleCommandMappingDelete = useCallback(
    (mappingId: string) => {
      if (DEFAULT_COMMAND_MAPPING_IDS.has(mappingId)) return;
      const current = channelCatalogRef.current;
      const target = current.commandMappings.find((m) => m.id === mappingId);
      if (!target) return;
      if (typeof window !== 'undefined' && !window.confirm(`Delete command "${target.trigger}"?`)) return;
      const nextCatalog: ChannelCatalog = {
        ...current,
        commandMappings: current.commandMappings.filter((m) => m.id !== mappingId),
      };
      setChannelCatalog(nextCatalog);
      saveChannelCatalog(nextCatalog);
      setSelectedRow(null);
      refreshManual();
    },
    [],
  );

  const handleCommandMappingAdd = useCallback(
    (input: { trigger: string; description: string; action: CommandAction; enabled: boolean }) => {
      const mapping: CommandMapping = {
        id: newMappingId(),
        trigger: input.trigger,
        description: input.description,
        action: input.action,
        enabled: input.enabled,
      };
      const current = channelCatalogRef.current;
      const nextCatalog: ChannelCatalog = {
        ...current,
        commandMappings: [...current.commandMappings, mapping],
      };
      setChannelCatalog(nextCatalog);
      saveChannelCatalog(nextCatalog);
      setSelectedRow(mapCommandMappingRow(mapping));
      setAddCommandOpen(false);
      refreshManual();
    },
    [],
  );

  const otherCommandTriggers = useCallback(
    (currentMappingId: string) =>
      channelCatalogRef.current.commandMappings
        .filter((m) => m.id !== currentMappingId)
        .map((m) => m.trigger),
    [],
  );

  const isDefaultCommandMapping = useCallback(
    (mappingId: string) => DEFAULT_COMMAND_MAPPING_IDS.has(mappingId),
    [],
  );

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

  const sheets: { id: IntegrationSheet; label: string; count: number | null }[] = [
    { id: 'plugins', label: t.integrations.sheetPlugins, count: pluginRows.length },
    { id: 'skills', label: t.integrations.sheetSkills, count: skillsRowsMerged.length },
    { id: 'channels', label: t.integrations.sheetChannels, count: channelRows.length },
    { id: 'memory', label: t.integrations.sheetMemory, count: memoryRowsMerged.length },
    { id: 'commands', label: t.integrations.sheetCommands, count: commandRowsMerged.length },
    { id: 'connect', label: 'Connect', count: null },
  ];

  const activeSheetLoading =
    activeSheet === 'skills'
      ? skillsLoading
      : activeSheet === 'memory'
        ? memoryLoading
        : activeSheet === 'commands'
          ? commandsLoading
          : false;

  const activeSheetError =
    activeSheet === 'skills'
      ? skillsError
      : activeSheet === 'memory'
        ? memoryError
        : activeSheet === 'commands'
          ? commandsError
          : null;

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] min-h-0 max-w-[1400px] flex-col gap-3 overflow-hidden">
      <div className="shrink-0 flex flex-col gap-3 border-b border-stone-200/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
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

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        {!projectRoot && activeSheet === 'memory' && (
          <p className="border border-amber-400/25 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
            {t.integrations.selectProjectHint}
          </p>
        )}

        {activeSheet !== 'connect' && <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-stone-200/10 pb-2">
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
            <button
              type="button"
              onClick={() => setAddCommandOpen(true)}
              className="border border-emerald-400/30 bg-emerald-950/15 px-2 py-1.5 text-xs text-emerald-300 hover:bg-emerald-950/35"
            >
              + Add command
            </button>
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
          <div className="ml-2 flex items-center gap-1 border-l border-stone-200/15 pl-2">
            <Snowflake size={12} className="text-cyan-300" />
            <label className="text-[10px] text-stone-400">Freeze cols</label>
            <input
              type="number"
              min={0}
              max={4}
              value={frozenDataColCount}
              onChange={(e) => setFrozenDataColCount(Math.max(0, Math.min(4, Number(e.target.value) || 0)))}
              className="h-7 w-12 rounded border border-stone-200/18 bg-[rgb(var(--pm-panel))] px-1 text-center text-xs text-stone-100"
            />
          </div>
          <select
            value={rowDensity}
            onChange={(e) => setRowDensity(e.target.value as PluginsRowDensity)}
            className="border border-stone-200/18 bg-[rgb(var(--pm-panel))] px-2 py-2 text-xs text-stone-200"
            title="Row density"
          >
            <option value="compact">Compact Rows</option>
            <option value="comfortable">Comfortable Rows</option>
          </select>
        </div>}

        {activeSheet === 'commands' && (
          <div className="border border-cyan-400/20 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-100/90">
            {t.integrations.commandsInventorySummary
              .replace('{detected}', String(systemCliRows.length))
              .replace('{exposed}', String(exposedSystemCliCount))
              .replace('{whitelisted}', String(exposedSystemCliConfigured))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {activeSheet === 'connect' ? (
            <ConnectSheet />
          ) : (
          <div className="space-y-4">
            <IntegrationsTable
              rows={activeRows}
              selectedRowKey={selectedRow?.rowKey ?? null}
              onRowClick={setSelectedRow}
              globalFilter={search}
              columnVisibility={columnVisibility}
              isLoading={activeSheetLoading}
              errorMessage={activeSheetError}
              frozenDataColCount={frozenDataColCount}
              rowDensity={rowDensity}
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

            {activeSheet === 'channels' && (
              <ChannelsActivityAndGuide
                channels={channelCatalog.channels}
                messages={recentMessages}
                guideOpen={showChannelGuide}
                onToggleGuide={() => setShowChannelGuide((v) => !v)}
              />
            )}
          </div>
          )}
        </div>

        <div className="shrink-0 flex items-end gap-0 overflow-x-auto border-t border-stone-200/15 bg-[rgb(var(--pm-rail))]/70">
          {sheets.map((s) => {
            const isActive = activeSheet === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedRow(null);
                  setCategoryFilter('all');
                  router.push(`/integrations-hub/${s.id}`);
                }}
                className={`relative flex items-center gap-1.5 border-r border-stone-200/15 px-4 py-2.5 text-xs font-medium uppercase tracking-[0.08em] ${
                  isActive
                    ? 'bg-emerald-600/85 text-white shadow-sm'
                    : 'text-stone-300/85 hover:bg-white/5 hover:text-stone-100'
                }`}
              >
                <span>{s.label}</span>
                {s.count !== null && (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${isActive ? 'bg-white/25' : 'bg-stone-200/15'}`}>
                    {s.count}
                  </span>
                )}
                {isActive && <span className="absolute left-0 right-0 top-0 h-0.5 bg-white/60" />}
              </button>
            );
          })}
          <div className="min-w-[20px] flex-1" />
        </div>
      </div>

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
        onChannelClearLog={handleChannelClearLog}
        onChannelUpdate={handleChannelUpdate}
        onChannelDelete={handleChannelDelete}
        onTestTelegramToken={async (token) => telegramGetMe(token)}
        onCommandMappingUpdate={handleCommandMappingUpdate}
        onCommandMappingDelete={handleCommandMappingDelete}
        otherCommandTriggers={otherCommandTriggers}
        isDefaultCommandMapping={isDefaultCommandMapping}
        onManualSaved={refreshManual}
      />

      {logsForId && <McpLogsViewer pluginId={logsForId} onClose={() => setLogsForId(null)} />}
      <PluginGuidePanel isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {addCommandOpen && (
        <AddCommandMappingDialog
          existingTriggers={channelCatalog.commandMappings.map((m) => m.trigger)}
          onAdd={handleCommandMappingAdd}
          onClose={() => setAddCommandOpen(false)}
        />
      )}
    </div>
  );
}

function AddCommandMappingDialog({
  existingTriggers,
  onAdd,
  onClose,
}: {
  existingTriggers: string[];
  onAdd: (input: { trigger: string; description: string; action: CommandAction; enabled: boolean }) => void;
  onClose: () => void;
}) {
  const [trigger, setTrigger] = useState('/');
  const [description, setDescription] = useState('');
  const [action, setAction] = useState<CommandAction>('custom');
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const t = trigger.trim();
    if (!t.startsWith('/')) {
      setError('Trigger must start with /');
      return;
    }
    if (t.length < 2) {
      setError('Trigger needs at least one character after the slash');
      return;
    }
    if (/\s/.test(t)) {
      setError('Trigger cannot contain whitespace');
      return;
    }
    const conflict = existingTriggers.some((other) => other.trim().toLowerCase() === t.toLowerCase());
    if (conflict) {
      setError(`Trigger "${t}" is already in use`);
      return;
    }
    setError(null);
    onAdd({ trigger: t, description: description.trim(), action, enabled });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md border border-stone-200/15 bg-[rgb(var(--pm-panel))] shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200/10 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-100">New command mapping</h3>
            <p className="mt-0.5 text-xs text-stone-400">
              Triggers are matched against inbound messages across every enabled channel.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-stone-500 hover:text-stone-300">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-300">Trigger</label>
            <input
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="/example"
              autoFocus
              className="border border-stone-200/18 bg-stone-900/60 px-3 py-2 font-mono text-sm text-stone-100 placeholder-stone-500 outline-none focus:ring-2 focus:ring-emerald-300/25"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-300">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Shown in /help replies"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="border border-stone-200/18 bg-stone-900/60 px-3 py-2 text-sm text-stone-100 placeholder-stone-500 outline-none focus:ring-2 focus:ring-emerald-300/25"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-300">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as CommandAction)}
              className="border border-stone-200/18 bg-stone-900/60 px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/25"
            >
              {COMMAND_ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.description}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-stone-300">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enabled now
          </label>
          {error && (
            <p className="border border-red-500/30 bg-red-950/30 px-2 py-1 text-[11px] text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-stone-200/10 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-stone-300 hover:text-stone-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="bg-stone-100 px-4 py-1.5 text-sm font-medium text-[rgb(var(--pm-panel))] hover:bg-amber-100"
          >
            Add mapping
          </button>
        </div>
      </div>
    </div>
  );
}

function ChannelsActivityAndGuide({
  channels,
  messages,
  guideOpen,
  onToggleGuide,
}: {
  channels: ChannelConfig[];
  messages: ChannelActivityEntry[];
  guideOpen: boolean;
  onToggleGuide: () => void;
}) {
  const labelFor = (channelId: string) =>
    channels.find((c) => c.id === channelId)?.label ?? channelId.slice(0, 6);

  return (
    <div className="space-y-4">
      <section className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72">
        <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3">
          <MessageCircle size={15} className="text-stone-400" />
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">Recent Activity</h2>
          <span className="ml-1 font-mono text-xs text-stone-500">{messages.length}</span>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="px-4 py-5 text-xs text-stone-500">
              No inbound messages yet. Start polling on a Telegram channel above and send a message
              (e.g. <span className="font-mono">/help</span>) from your phone.
            </p>
          ) : (
            <div className="divide-y divide-stone-200/8 font-mono text-[11px]">
              {messages.map((m) => (
                <div key={`${m.channelId}-${m.updateId ?? m.timestamp}`} className="px-4 py-2">
                  <div className="flex items-center gap-2 text-stone-500">
                    <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
                    <span>·</span>
                    <span className="text-sky-300/80">{labelFor(m.channelId)}</span>
                    <span>·</span>
                    <span className="text-stone-400">
                      {m.fromUsername ? `@${m.fromUsername}` : m.fromName ?? `chat ${m.chatId}`}
                    </span>
                  </div>
                  <p className="mt-0.5 break-all text-stone-200">{m.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72">
        <button
          type="button"
          onClick={onToggleGuide}
          className="flex w-full items-center gap-3 border-b border-stone-200/12 px-4 py-3 text-left"
        >
          <MessageCircle size={15} className="text-stone-400" />
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100 flex-1">Getting Started</h2>
          <span className="text-[10px] uppercase tracking-[0.12em] text-stone-500">
            {guideOpen ? 'Hide' : 'Show'}
          </span>
        </button>
        {guideOpen && (
          <div className="space-y-4 p-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300">
                Recommended: Telegram (no relay server needed)
              </p>
              <ol className="space-y-1 text-[11px] leading-5 text-stone-400">
                <li>1. Message <span className="font-mono text-stone-200">@BotFather</span> on Telegram → <span className="font-mono text-stone-200">/newbot</span></li>
                <li>2. Copy the Bot Token into a new Telegram channel above</li>
                <li>3. Set Mode to <span className="font-mono text-stone-200">polling</span> — Project Manager will fetch messages automatically</li>
                <li>4. Send <span className="font-mono text-stone-200">/help</span> from Telegram to verify the connection</li>
              </ol>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                WhatsApp / LINE / WeChat (relay server required)
              </p>
              <ol className="space-y-1 text-[11px] leading-5 text-stone-400">
                <li>1. Deploy a Cloudflare Worker to receive platform webhooks</li>
                <li>2. Worker forwards messages to Project Manager via WebSocket / SSE</li>
                <li>3. Enter the platform credentials and your relay URL above</li>
              </ol>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
