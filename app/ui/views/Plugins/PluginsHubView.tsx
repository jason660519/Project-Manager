'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  MessageCircle,
  RefreshCw,
  RotateCw,
  Snowflake,
  X,
} from 'lucide-react';
import type { IntegrationRow, IntegrationSheet } from '../../../../lib/integrations/types';
import {
  LEGACY_PLUGINS_SHEET,
  SYSTEM_INSTALLED_APPS_SHEET,
  isCapabilitySheet,
  normalizeIntegrationSheet,
} from '../../../../lib/integrations/types';
import { diffRows, type ScanOutcome, type ScanReport } from '../../../../lib/integrations/scan-diff';
import {
  INTEGRATION_INVENTORY_SHEETS,
  createIntegrationSheetActionRegistry,
  createSheetTestOutcome,
  isIntegrationInventorySheet,
  type IntegrationInventorySheet,
} from '../../../../lib/integrations/sheet-actions';
import type { IntegrationRuntimeCommand } from '../../../../lib/integrations/registry';
import { mergeAllManual } from '../../../../lib/integrations/manual-metadata';
import {
  mapInstalledPlugins,
  mapMarketplaceRow,
  type ResolvedPluginPath,
} from '../../../../lib/integrations/mappers/plugins';
import { mapSkillRow } from '../../../../lib/integrations/mappers/skills';
import { mapChannelRow, mapCommandMappingRow } from '../../../../lib/integrations/mappers/channels';
import { mapSystemCliRow } from '../../../../lib/integrations/mappers/system-cli';
import {
  buildConnectedInstanceRows,
} from '../../../../lib/integrations/mappers/connected-instances';
import { summarizeDiscoverySnapshot } from '../../../../lib/integrations/discovery/summarize';
import type { DiscoveryRunSummary } from '../../../../lib/integrations/discovery/summarize';
import {
  loadLastDiscoveryPlan,
  saveLastDiscoveryPlan,
  type DiscoveryPlan,
} from '../../../../lib/integrations/discovery';
import { probeConnectedInstanceAvailability } from '../../../../lib/integrations/probe-connected-instance';
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
  setPluginEnabled,
  togglePluginEnabled,
  togglePluginAutostart,
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
  runDiscoveryPlan,
  type ConnectedInstanceScanSnapshot,
  listGlobalCliInventory,
  resolveInstallPath,
  probeCommandVersion,
  skillInstallFromUrl,
  skillList,
  skillUninstall,
  telegramGetMe,
  telegramStartPoll,
  telegramStatusAll,
  telegramStopPoll,
  onTelegramStatus,
  spawnTerminal,
  scanMacosApplications,
  type ScanMacosApplicationsResult,
} from '../../../../lib/bridge';
import { checkCommandExists } from '../../../../lib/adapters/availability';
import { getSkillsDir } from '../../../../lib/storage/settings';
import { parseCategorySlug, parseFrontmatter } from '../../../../lib/skills/utils';
import { useI18n } from '../../../../lib/i18n';
import PluginGuidePanel from '../../../../components/PluginGuidePanel';
import { WorkstationFrame } from '../../../../components/layout/WorkstationFrame';
import {
  BottomSheetTabs,
  type SheetTabItem,
} from '../../../../components/sheets/BottomSheetTabs';
import { useInAppAlert, useInAppConfirm } from '../../../../components/ui/InAppDialog';
import {
  IntegrationsTable,
  type IntegrationRowTestResult,
} from './_shared/IntegrationsTable';
import { IntegrationsDetailSheet } from './_shared/IntegrationsDetailSheet';
import { McpLogsViewer } from './_shared/McpLogsViewer';
import { ConnectSheet } from './ConnectSheet';
import { CapabilitySheetView } from './CapabilitySheetView';
import { buildSystemInstalledAppsRows } from '../../../../lib/integrations/mappers/system-installed-apps';
import { deriveSystemAppsScanPhase, SystemAppsScanBanner } from './SystemInstalledAppsSheet';
import { ScanReportPanel } from './_shared/ScanReportPanel';
import { DiscoverPlanDialog } from './_shared/DiscoverPlanDialog';
import { DiscoveryResultPanel } from './_shared/DiscoveryResultPanel';
import { resolveProjectManagerRepoRoot } from '../../../../lib/project-manager-root';

const EMPTY_CATALOG: PluginCatalog = { schemaVersion: 2, plugins: [] };
const INTEGRATIONS_HUB_SHEET_ORDER_STORAGE_KEY = 'projectManager.integrationsHub.sheetOrder';
const CONNECTED_INSTANCE_SCAN_STORAGE_KEY = 'projectManager.integrationsHub.connectedInstanceScan';

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

type PluginsRowDensity = 'compact' | 'comfortable';

export interface PluginsHubViewProps {
  projectRoot?: string;
  /** Project Manager repository root (for sidecar paths, mirror writes, terminal cwd). */
  pmRepoRoot?: string;
  /** Sheet driven by the URL (`/integrations-hub/<sheet>`). Defaults to System Installed Apps. */
  initialSheet?: IntegrationSheet;
}

export function PluginsHubView({ projectRoot = '', pmRepoRoot, initialSheet }: PluginsHubViewProps) {
  const pmRoot = resolveProjectManagerRepoRoot(pmRepoRoot);
  const pluginGuidePath = pmRoot ? `${pmRoot.replace(/\/+$/, '')}/docs/engineering/plugin-guide.md` : '';
  const { t } = useI18n();
  const router = useRouter();
  const confirmAction = useInAppConfirm();
  const botTokenAlert = useInAppAlert();
  const activeSheet: IntegrationSheet = normalizeIntegrationSheet(initialSheet ?? SYSTEM_INSTALLED_APPS_SHEET);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<IntegrationRow | null>(null);
  const [manualVersion, setManualVersion] = useState(0);

  const [catalog, setCatalog] = useState<PluginCatalog>(EMPTY_CATALOG);
  const catalogRef = useRef<PluginCatalog>(EMPTY_CATALOG);
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
  const [resolvedInstallPaths, setResolvedInstallPaths] = useState<Record<string, ResolvedPluginPath>>({});
  const [pluginTestResults, setPluginTestResults] = useState<Record<string, IntegrationRowTestResult>>({});
  const [pluginTestingKeys, setPluginTestingKeys] = useState<ReadonlySet<string>>(new Set());
  const [checkedRowKeys, setCheckedRowKeys] = useState<ReadonlySet<string>>(new Set());
  const [logsForId, setLogsForId] = useState<string | null>(null);
  const [skillsInstallUrl, setSkillsInstallUrl] = useState('');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [frozenDataColCount, setFrozenDataColCount] = useState(0);
  const [rowDensity, setRowDensity] = useState<PluginsRowDensity>('comfortable');
  const [connectedInstanceScan, setConnectedInstanceScan] = useState<ConnectedInstanceScanSnapshot | null>(null);
  const [connectedInstanceScanRunning, setConnectedInstanceScanRunning] = useState(false);
  const [discoverDialogOpen, setDiscoverDialogOpen] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<{
    summary: DiscoveryRunSummary;
    warnings: string[];
  } | null>(null);
  const [discoveryPlanDraft, setDiscoveryPlanDraft] = useState<DiscoveryPlan>(() => loadLastDiscoveryPlan());
  const [connectedReachability, setConnectedReachability] = useState<
    Record<string, { status: 'live' | 'disconnected'; label: string }>
  >({});
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [scanRunning, setScanRunning] = useState(false);
  const [scanActionKind, setScanActionKind] = useState<'scan' | 'test'>('scan');
  const [macosAppsSnapshot, setMacosAppsSnapshot] = useState<ScanMacosApplicationsResult | null>(null);
  const [macosAppsScanning, setMacosAppsScanning] = useState(false);
  const [macosAppsScanError, setMacosAppsScanError] = useState<string | null>(null);
  const [macosAppsLastScannedAt, setMacosAppsLastScannedAt] = useState<number | null>(null);
  const refreshManual = () => setManualVersion((v) => v + 1);

  // Reset per-sheet state when the URL sheet changes — dynamic-segment
  // navigation keeps the component mounted, so selection/filters persist
  // across tabs unless we explicitly clear them here.
  useEffect(() => {
    setSelectedRow(null);
    setCategoryFilter('all');
  }, [activeSheet]);

  useEffect(() => {
    if (initialSheet === LEGACY_PLUGINS_SHEET) {
      router.replace(`/integrations-hub/${SYSTEM_INSTALLED_APPS_SHEET}`);
    }
  }, [initialSheet, router]);

  const runMacosApplicationsScan = useCallback(async (): Promise<ScanMacosApplicationsResult> => {
    setMacosAppsScanning(true);
    setMacosAppsScanError(null);
    try {
      const result = await scanMacosApplications();
      setMacosAppsSnapshot(result);
      setMacosAppsLastScannedAt(Date.now());
      if (result.warnings.some((w) => w.toLowerCase().includes('permission denied')) && result.apps.length === 0) {
        setMacosAppsScanError(result.warnings.find((w) => w.toLowerCase().includes('permission denied')) ?? null);
      } else if (result.apps.length === 0 && result.warnings.length > 0) {
        setMacosAppsScanError(result.warnings.join(' '));
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMacosAppsScanError(message);
      throw err;
    } finally {
      setMacosAppsScanning(false);
    }
  }, []);

  useEffect(() => {
    if (activeSheet !== SYSTEM_INSTALLED_APPS_SHEET) return;
    void runMacosApplicationsScan().catch(() => {});
  }, [activeSheet, runMacosApplicationsScan]);

  const macosAppsScanPhase = deriveSystemAppsScanPhase({
    scanning: macosAppsScanning,
    snapshot: macosAppsSnapshot,
    errorMessage: macosAppsScanError,
  });

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(CONNECTED_INSTANCE_SCAN_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ConnectedInstanceScanSnapshot;
      if (parsed && typeof parsed.scannedAt === 'string') {
        setConnectedInstanceScan(parsed);
      }
    } catch {
      window.localStorage.removeItem(CONNECTED_INSTANCE_SCAN_STORAGE_KEY);
    }
  }, []);

  // Pure fetch — reads skill files under `skillsDir` and returns parsed
  // IntegrationRow[]. No React state writes; callers decide what to do.
  const fetchSkillRows = useCallback(async (): Promise<IntegrationRow[]> => {
    if (!skillsDir) return [];
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
    return parsed;
  }, [skillsDir]);

  const loadSkills = useCallback(async () => {
    setSkillsLoading(true);
    setSkillsError(null);
    try {
      const parsed = await fetchSkillRows();
      setSkillRows(parsed);
    } catch (error) {
      setSkillRows([]);
      setSkillsError(error instanceof Error ? error.message : 'Unknown skills load error');
    } finally {
      setSkillsLoading(false);
    }
  }, [fetchSkillRows]);

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

  // Probe each marketplace entry's command on $PATH and resolve install paths.
  // Returns the raw mapping so callers can both update React state AND build a
  // fresh row snapshot for diffing without waiting for the next render.
  const runPluginSystemScan = useCallback(async (): Promise<{
    status: Record<string, boolean>;
    paths: Record<string, ResolvedPluginPath>;
  }> => {
    const status: Record<string, boolean> = {};
    const paths: Record<string, ResolvedPluginPath> = {};
    await Promise.all(
      MARKETPLACE.map(async (mp) => {
        let command = '';
        let appBundleName: string | undefined;
        if (mp.kind === 'cli' && mp.defaultCli?.command) command = mp.defaultCli.command;
        else if (mp.kind === 'editor' && mp.defaultEditor?.command) {
          command = mp.defaultEditor.command;
          appBundleName = mp.appBundleName;
        } else if (mp.kind === 'mcp' && mp.defaultMcp?.command) command = mp.defaultMcp.command;
        if (!command) return;
        const baseName = command.split('/').pop() || command;
        try {
          status[mp.id] = await checkCommandExists(baseName);
        } catch {
          status[mp.id] = false;
        }
        try {
          const resolved = await resolveInstallPath(command, appBundleName);
          if (resolved.commandPath || resolved.appBundlePath) {
            paths[mp.id] = resolved;
          }
        } catch {
          // Tauri may be unavailable in the web preview; skip silently.
        }
      }),
    );
    return { status, paths };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void runPluginSystemScan().then(({ status, paths }) => {
      if (cancelled) return;
      setSystemCommandStatus(status);
      setResolvedInstallPaths(paths);
    });
    return () => {
      cancelled = true;
    };
  }, [catalog, runPluginSystemScan]);

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
    catalogRef.current = catalog;
  }, [catalog]);

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
    catalogRef.current = next;
    setCatalog(next);
    savePluginCatalog(next, { repoRoot: pmRoot });
    refreshManual();
  };

  const updateChannels = (next: ChannelCatalog) => {
    setChannelCatalog(next);
    saveChannelCatalog(next);
    refreshManual();
  };

  const installedIds = useMemo(() => new Set(catalog.plugins.map((p) => p.id)), [catalog]);

  const allPluginRows = useMemo(() => {
    const ctx = { apiKeys, systemCommandStatus, mcpStatuses, resolvedInstallPaths };
    const installed = mapInstalledPlugins(catalog, ctx);
    const marketplace = MARKETPLACE.map((mp) =>
      mapMarketplaceRow(
        {
          id: mp.id,
          name: mp.name,
          description: mp.description,
          category: mp.category,
          kind: mp.kind,
          installed: installedIds.has(mp.id),
        },
        resolvedInstallPaths[mp.id],
      ),
    );
    const rows: IntegrationRow[] = [
      ...installed,
      ...marketplace.filter((r) => !installedIds.has(r.sourceId)),
    ];
    return mergeAllManual(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, apiKeys, systemCommandStatus, mcpStatuses, installedIds, manualVersion, resolvedInstallPaths]);

  const pluginSheetRows = useMemo(
    () => allPluginRows.filter((r) => r.sheet === 'plugins'),
    [allPluginRows],
  );
  const mcpRows = useMemo(
    () => allPluginRows.filter((r) => r.sheet === 'mcp'),
    [allPluginRows],
  );

  // Coding Tools sheet: subset of Plugins rows whose marketplace classification
  // is `dev` (IDEs, AI coding CLIs, code-editor surfaces). Excludes vcs/pm/
  // notify/ci CLIs (GitHub, Linear, Slack, Sentry) and MCP servers.
  const CODING_TOOL_IDS = useMemo(
    () => new Set(MARKETPLACE.filter((mp) => mp.category === 'dev').map((mp) => mp.id)),
    [],
  );
  const codingToolRows = useMemo(() => pluginSheetRows.filter((row) => CODING_TOOL_IDS.has(row.sourceId)), [
    pluginSheetRows,
    CODING_TOOL_IDS,
  ]);
  const pluginRows = useMemo(() => pluginSheetRows.filter((row) => !CODING_TOOL_IDS.has(row.sourceId)), [
    pluginSheetRows,
    CODING_TOOL_IDS,
  ]);

  const pluginMapperCtx = useMemo(
    () => ({
      apiKeys,
      systemCommandStatus,
      mcpStatuses,
      resolvedInstallPaths,
    }),
    [apiKeys, systemCommandStatus, mcpStatuses, resolvedInstallPaths],
  );

  const systemInstalledAppsRows = useMemo(
    () =>
      buildSystemInstalledAppsRows(
        pluginSheetRows,
        pluginMapperCtx,
        macosAppsSnapshot?.apps ?? [],
      ),
    [pluginSheetRows, pluginMapperCtx, macosAppsSnapshot?.apps],
  );

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
  const connectedInstanceRows = useMemo(() => {
    const rows = mergeAllManual(buildConnectedInstanceRows(connectedInstanceScan));
    return rows.map((row) => {
      const reach = connectedReachability[row.rowKey];
      if (!reach) return row;
      return { ...row, status: reach.status, statusLabel: reach.label };
    });
  }, [connectedInstanceScan, manualVersion, connectedReachability]);
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

  type SharedPluginCtx = { status: Record<string, boolean>; paths: Record<string, ResolvedPluginPath> };

  const buildPluginRowsFromCtx = useCallback(
    (ctx: SharedPluginCtx, mcpStatusMap: Map<string, McpRunStatus>): IntegrationRow[] => {
      const mapperCtx = {
        apiKeys,
        systemCommandStatus: ctx.status,
        mcpStatuses: mcpStatusMap,
        resolvedInstallPaths: ctx.paths,
      };
      const installed = mapInstalledPlugins(catalog, mapperCtx);
      const marketplace = MARKETPLACE.map((mp) =>
        mapMarketplaceRow(
          {
            id: mp.id,
            name: mp.name,
            description: mp.description,
            category: mp.category,
            kind: mp.kind,
            installed: installedIds.has(mp.id),
          },
          ctx.paths[mp.id],
        ),
      );
      const rows: IntegrationRow[] = [
        ...installed,
        ...marketplace.filter((r) => !installedIds.has(r.sourceId)),
      ];
      return mergeAllManual(rows);
    },
    [apiKeys, catalog, installedIds],
  );

  const rescanSystemInstalledApps = useCallback(
    async (sharedCtx?: SharedPluginCtx): Promise<ScanOutcome> => {
      const startedAt = Date.now();
      const prev = systemInstalledAppsRows;
      try {
        const ctx = sharedCtx ?? (await runPluginSystemScan());
        if (!sharedCtx) {
          setSystemCommandStatus(ctx.status);
          setResolvedInstallPaths(ctx.paths);
        }
        const macResult = await runMacosApplicationsScan();
        const mapperCtx = {
          systemCommandStatus: ctx.status,
          resolvedInstallPaths: ctx.paths,
        };
        const pluginRowsSnapshot = buildPluginRowsFromCtx(ctx, mcpStatuses).filter((r) => r.sheet === 'plugins');
        const next = buildSystemInstalledAppsRows(pluginRowsSnapshot, mapperCtx, macResult.apps);
        return {
          sheetId: SYSTEM_INSTALLED_APPS_SHEET,
          label: 'System Installed Apps',
          count: next.length,
          ...diffRows(prev, next),
          durationMs: Date.now() - startedAt,
          ...(macResult.warnings.length > 0 ? { skipped: macResult.warnings.join('; ') } : {}),
        };
      } catch (e) {
        return {
          sheetId: SYSTEM_INSTALLED_APPS_SHEET,
          label: 'System Installed Apps',
          count: prev.length,
          added: [],
          removed: [],
          updated: [],
          error: e instanceof Error ? e.message : String(e),
          durationMs: Date.now() - startedAt,
        };
      }
    },
    [
      systemInstalledAppsRows,
      runMacosApplicationsScan,
      runPluginSystemScan,
      buildPluginRowsFromCtx,
      mcpStatuses,
    ],
  );

  const rescanCodingTools = useCallback(
    async (sharedCtx?: SharedPluginCtx): Promise<ScanOutcome> => {
      const startedAt = Date.now();
      const prev = codingToolRows;
      try {
        const ctx = sharedCtx ?? (await runPluginSystemScan());
        if (!sharedCtx) {
          setSystemCommandStatus(ctx.status);
          setResolvedInstallPaths(ctx.paths);
        }
        const allRows = buildPluginRowsFromCtx(ctx, mcpStatuses);
        const next = allRows
          .filter((r) => r.sheet === 'plugins')
          .filter((r) => CODING_TOOL_IDS.has(r.sourceId));
        return {
          sheetId: 'coding-tools',
          label: 'Coding Tools',
          count: next.length,
          ...diffRows(prev, next),
          durationMs: Date.now() - startedAt,
        };
      } catch (e) {
        return {
          sheetId: 'coding-tools',
          label: 'Coding Tools',
          count: prev.length,
          added: [],
          removed: [],
          updated: [],
          error: e instanceof Error ? e.message : String(e),
          durationMs: Date.now() - startedAt,
        };
      }
    },
    [codingToolRows, runPluginSystemScan, buildPluginRowsFromCtx, mcpStatuses, CODING_TOOL_IDS],
  );

  const rescanMcp = useCallback(
    async (sharedCtx?: SharedPluginCtx): Promise<ScanOutcome> => {
      const startedAt = Date.now();
      const prev = mcpRows;
      try {
        const ctx = sharedCtx ?? (await runPluginSystemScan());
        const arr = await mcpStatusAll();
        const nextStatuses = new Map(arr.map((s) => [s.pluginId, s.status]));
        if (!sharedCtx) {
          setSystemCommandStatus(ctx.status);
          setResolvedInstallPaths(ctx.paths);
        }
        setMcpStatuses(nextStatuses);
        const allRows = buildPluginRowsFromCtx(ctx, nextStatuses);
        const next = allRows.filter((r) => r.sheet === 'mcp');
        return {
          sheetId: 'mcp',
          label: 'MCP',
          count: next.length,
          ...diffRows(prev, next),
          durationMs: Date.now() - startedAt,
        };
      } catch (e) {
        return {
          sheetId: 'mcp',
          label: 'MCP',
          count: prev.length,
          added: [],
          removed: [],
          updated: [],
          error: e instanceof Error ? e.message : String(e),
          durationMs: Date.now() - startedAt,
        };
      }
    },
    [mcpRows, runPluginSystemScan, buildPluginRowsFromCtx],
  );

  const rescanSkills = useCallback(async (): Promise<ScanOutcome> => {
    const startedAt = Date.now();
    const prev = skillsRowsMerged;
    if (!skillsDir) {
      return {
        sheetId: 'skills',
        label: 'Skills',
        count: prev.length,
        added: [],
        removed: [],
        updated: [],
        skipped: 'Skills directory not configured',
        durationMs: Date.now() - startedAt,
      };
    }
    try {
      const rows = await fetchSkillRows();
      setSkillRows(rows);
      setSkillsError(null);
      const next = mergeAllManual(rows);
      return {
        sheetId: 'skills',
        label: 'Skills',
        count: next.length,
        ...diffRows(prev, next),
        durationMs: Date.now() - startedAt,
      };
    } catch (e) {
      return {
        sheetId: 'skills',
        label: 'Skills',
        count: prev.length,
        added: [],
        removed: [],
        updated: [],
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - startedAt,
      };
    }
  }, [skillsRowsMerged, skillsDir, fetchSkillRows]);

  const rescanChannels = useCallback(async (): Promise<ScanOutcome> => {
    const startedAt = Date.now();
    const prev = channelRows;
    try {
      const arr = await telegramStatusAll();
      const nextPoll = new Map(arr.map((s) => [s.channelId, s]));
      setPollStatuses(nextPoll);
      const next = mergeAllManual(
        channelCatalog.channels.map((ch) =>
          mapChannelRow(ch, nextPoll, Boolean(getChannelSecret(ch.id, 'botToken'))),
        ),
      );
      return {
        sheetId: 'channels',
        label: 'Channels',
        count: next.length,
        ...diffRows(prev, next),
        durationMs: Date.now() - startedAt,
      };
    } catch (e) {
      return {
        sheetId: 'channels',
        label: 'Channels',
        count: prev.length,
        added: [],
        removed: [],
        updated: [],
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - startedAt,
      };
    }
  }, [channelRows, channelCatalog]);

  const rescanMemory = useCallback(async (): Promise<ScanOutcome> => {
    const startedAt = Date.now();
    const prev = memoryRowsMerged;
    if (!projectRoot) {
      return {
        sheetId: 'memory',
        label: 'Memory',
        count: prev.length,
        added: [],
        removed: [],
        updated: [],
        skipped: 'No project selected',
        durationMs: Date.now() - startedAt,
      };
    }
    try {
      const rows = await loadMemoryRows(projectRoot);
      setMemoryRows(rows);
      setMemoryError(null);
      const next = mergeAllManual(rows);
      return {
        sheetId: 'memory',
        label: 'Memory',
        count: next.length,
        ...diffRows(prev, next),
        durationMs: Date.now() - startedAt,
      };
    } catch (e) {
      return {
        sheetId: 'memory',
        label: 'Memory',
        count: prev.length,
        added: [],
        removed: [],
        updated: [],
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - startedAt,
      };
    }
  }, [memoryRowsMerged, projectRoot]);

  const rescanCommands = useCallback(async (): Promise<ScanOutcome> => {
    const startedAt = Date.now();
    const prev = commandRowsMerged;
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
      const allRows = [...slash, ...mappings, ...systemCli];
      setCommandRows(allRows);
      setCommandsError(null);
      const next = mergeAllManual(allRows);
      return {
        sheetId: 'commands',
        label: 'Commands',
        count: next.length,
        ...diffRows(prev, next),
        durationMs: Date.now() - startedAt,
      };
    } catch (e) {
      return {
        sheetId: 'commands',
        label: 'Commands',
        count: prev.length,
        added: [],
        removed: [],
        updated: [],
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - startedAt,
      };
    }
  }, [commandRowsMerged, projectRoot, channelCatalog]);

  const rescanConnectedInstances = useCallback(async (): Promise<ScanOutcome> => {
    const startedAt = Date.now();
    const prev = connectedInstanceRows;
    try {
      const snapshot = await runDiscoveryPlan(loadLastDiscoveryPlan());
      setConnectedInstanceScan(snapshot);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CONNECTED_INSTANCE_SCAN_STORAGE_KEY, JSON.stringify(snapshot));
      }
      const next = mergeAllManual(buildConnectedInstanceRows(snapshot));
      return {
        sheetId: 'connected-instances',
        label: 'Network Instances',
        count: next.length,
        ...diffRows(prev, next),
        durationMs: Date.now() - startedAt,
      };
    } catch (e) {
      return {
        sheetId: 'connected-instances',
        label: 'Network Instances',
        count: prev.length,
        added: [],
        removed: [],
        updated: [],
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - startedAt,
      };
    }
  }, [connectedInstanceRows]);

  const activeRows = useMemo(() => {
    let rows =
      activeSheet === SYSTEM_INSTALLED_APPS_SHEET
        ? systemInstalledAppsRows
        : activeSheet === 'coding-tools'
          ? codingToolRows
          : activeSheet === 'mcp'
            ? mcpRows
            : activeSheet === 'skills'
              ? skillsRowsMerged
              : activeSheet === 'channels'
                ? channelRows
                : activeSheet === 'memory'
                  ? memoryRowsMerged
                  : activeSheet === 'commands'
                    ? commandRowsMerged
                    : activeSheet === 'connected-instances'
                      ? connectedInstanceRows
                      : [];
    if (categoryFilter !== 'all') {
      rows = rows.filter((r) => r.category1 === categoryFilter);
    }
    return rows;
  }, [
    activeSheet,
    systemInstalledAppsRows,
    codingToolRows,
    mcpRows,
    skillsRowsMerged,
    channelRows,
    memoryRowsMerged,
    commandRowsMerged,
    connectedInstanceRows,
    categoryFilter,
  ]);

  const categoryOptions = useMemo(() => {
    const set = new Set(activeRows.map((r) => r.category1));
    return ['all', ...Array.from(set).sort()];
  }, [activeRows]);

  const handleTestPluginRow = useCallback(
    async (row: IntegrationRow) => {
      if (row.sourceKind !== 'plugin-installed' && row.sourceKind !== 'plugin-marketplace') return;
      const marketplaceEntry = MARKETPLACE.find((mp) => mp.id === row.sourceId);
      const installedPlugin = catalog.plugins.find((p) => p.id === row.sourceId);

      let command = '';
      let appBundleName: string | undefined;
      if (marketplaceEntry?.kind === 'cli' && marketplaceEntry.defaultCli?.command) {
        command = marketplaceEntry.defaultCli.command;
      } else if (marketplaceEntry?.kind === 'editor' && marketplaceEntry.defaultEditor?.command) {
        command = marketplaceEntry.defaultEditor.command;
        appBundleName = marketplaceEntry.appBundleName;
      } else if (marketplaceEntry?.kind === 'mcp' && marketplaceEntry.defaultMcp?.command) {
        command = marketplaceEntry.defaultMcp.command;
      } else if (installedPlugin && (installedPlugin.kind === 'cli' || installedPlugin.kind === 'editor' || installedPlugin.kind === 'mcp')) {
        command = installedPlugin.command ?? '';
      }

      if (!command) {
        setPluginTestResults((prev) => ({
          ...prev,
          [row.rowKey]: { ok: false, testedAt: Date.now(), detail: 'No probe command for this row' },
        }));
        return;
      }

      setPluginTestingKeys((prev) => {
        const next = new Set(prev);
        next.add(row.rowKey);
        return next;
      });

      const baseName = command.split('/').pop() || command;
      let exists = false;
      let resolved: ResolvedPluginPath = { commandPath: null, appBundlePath: null };
      let detail: string | undefined;
      try {
        exists = await checkCommandExists(baseName);
      } catch (err) {
        detail = err instanceof Error ? err.message : 'checkCommandExists failed';
      }
      try {
        resolved = await resolveInstallPath(command, appBundleName);
      } catch (err) {
        if (!detail) {
          detail = err instanceof Error ? err.message : 'resolveInstallPath failed';
        }
      }

      const ok = exists || Boolean(resolved.appBundlePath || resolved.commandPath);
      let summary: string;
      if (ok) {
        // Probe the CLI binary for a version string; fall back to the resolved path.
        let versionStr: string | null = null;
        if (exists) {
          try {
            versionStr = await probeCommandVersion(baseName);
          } catch {
            // version probe is best-effort; silence the error
          }
        }
        summary = versionStr ?? resolved.appBundlePath ?? resolved.commandPath ?? `${baseName} on PATH`;
      } else {
        summary = detail ?? 'Command not found on PATH; no .app bundle detected';
      }

      setSystemCommandStatus((prev) => ({ ...prev, [row.sourceId]: exists }));
      setResolvedInstallPaths((prev) => {
        if (resolved.commandPath || resolved.appBundlePath) {
          return { ...prev, [row.sourceId]: resolved };
        }
        const next = { ...prev };
        delete next[row.sourceId];
        return next;
      });
      setPluginTestResults((prev) => ({
        ...prev,
        [row.rowKey]: { ok, testedAt: Date.now(), detail: summary },
      }));
      setPluginTestingKeys((prev) => {
        const next = new Set(prev);
        next.delete(row.rowKey);
        return next;
      });
    },
    [catalog],
  );

  const handleTestConnectedInstanceRow = useCallback(async (row: IntegrationRow) => {
    if (row.sourceKind !== 'connected-instance') return;

    setPluginTestingKeys((prev) => {
      const next = new Set(prev);
      next.add(row.rowKey);
      return next;
    });

    try {
      const { ok, detail } = await probeConnectedInstanceAvailability(row);
      setConnectedReachability((prev) => ({
        ...prev,
        [row.rowKey]: { status: ok ? 'live' : 'disconnected', label: ok ? 'Live' : 'Disconnected' },
      }));
      setPluginTestResults((prev) => ({
        ...prev,
        [row.rowKey]: { ok, testedAt: Date.now(), detail },
      }));
    } catch (e) {
      setPluginTestResults((prev) => ({
        ...prev,
        [row.rowKey]: {
          ok: false,
          testedAt: Date.now(),
          detail: e instanceof Error ? e.message : String(e),
        },
      }));
    } finally {
      setPluginTestingKeys((prev) => {
        const next = new Set(prev);
        next.delete(row.rowKey);
        return next;
      });
    }
  }, []);

  const handleIntegrationTestRow = useCallback(
    async (row: IntegrationRow) => {
      if (row.sourceKind === 'connected-instance') {
        await handleTestConnectedInstanceRow(row);
        return;
      }
      await handleTestPluginRow(row);
    },
    [handleTestConnectedInstanceRow, handleTestPluginRow],
  );

  const executeDiscoveryPlan = useCallback(async (plan: DiscoveryPlan) => {
    const startedAt = Date.now();
    setConnectedInstanceScanRunning(true);
    const seededRows = buildConnectedInstanceRows(null);
    try {
      const snapshot = await runDiscoveryPlan(plan);
      setConnectedInstanceScan(snapshot);
      saveLastDiscoveryPlan(plan);
      setDiscoveryPlanDraft(plan);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CONNECTED_INSTANCE_SCAN_STORAGE_KEY, JSON.stringify(snapshot));
      }
      const summary = summarizeDiscoverySnapshot(snapshot, Date.now() - startedAt, seededRows);
      const payload = { snapshot, summary };
      setDiscoveryResult({ summary, warnings: snapshot.warnings });
      return payload;
    } catch (error) {
      const scannedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      const snapshot: ConnectedInstanceScanSnapshot = {
        scannedAt,
        devices: [],
        containers: [],
        services: [],
        warnings: [message],
      };
      setConnectedInstanceScan(snapshot);
      const summary = summarizeDiscoverySnapshot(snapshot, Date.now() - startedAt, seededRows);
      const payload = { snapshot, summary };
      setDiscoveryResult({ summary, warnings: snapshot.warnings });
      return payload;
    } finally {
      setConnectedInstanceScanRunning(false);
    }
  }, []);

  useEffect(() => {
    if (activeSheet !== 'connected-instances' || connectedInstanceScan || connectedInstanceScanRunning) return;
    void executeDiscoveryPlan(loadLastDiscoveryPlan());
  }, [activeSheet, connectedInstanceScan, connectedInstanceScanRunning, executeDiscoveryPlan]);

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
  };

  const handleRunRuntimeCommand = useCallback(async (command: IntegrationRuntimeCommand) => {
    await spawnTerminal({
      command: command.command,
      args: command.args,
      cwd: pmRoot || projectRoot || '.',
    });
  }, [pmRoot, projectRoot]);

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
    async (channelId: string) => {
      const target = channelCatalogRef.current.channels.find((c) => c.id === channelId);
      if (!target) return;
      const confirmed = await confirmAction.open({
        title: 'Delete channel',
        message: `Delete channel "${target.label}"?`,
        confirmLabel: 'Delete',
      });
      if (!confirmed) return;
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
    [confirmAction],
  );

  const handleChannelClearLog = useCallback(async (channelId: string) => {
    const confirmed = await confirmAction.open({
      title: 'Clear activity log',
      message: 'Clear this channel\'s activity log?',
      confirmLabel: 'Clear',
    });
    if (!confirmed) return;
    clearChannelActivity(channelId);
    setRecentMessages((prev) => prev.filter((e) => e.channelId !== channelId));
  }, [confirmAction]);

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
    async (mappingId: string) => {
      if (DEFAULT_COMMAND_MAPPING_IDS.has(mappingId)) return;
      const current = channelCatalogRef.current;
      const target = current.commandMappings.find((m) => m.id === mappingId);
      if (!target) return;
      const confirmed = await confirmAction.open({
        title: 'Delete command',
        message: `Delete command "${target.trigger}"?`,
        confirmLabel: 'Delete',
      });
      if (!confirmed) return;
      const nextCatalog: ChannelCatalog = {
        ...current,
        commandMappings: current.commandMappings.filter((m) => m.id !== mappingId),
      };
      setChannelCatalog(nextCatalog);
      saveChannelCatalog(nextCatalog);
      setSelectedRow(null);
      refreshManual();
    },
    [confirmAction],
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
      await botTokenAlert.open({
        title: 'Bot token required',
        message: 'Set the Bot Token first.',
      });
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

  const sheetTabs: ReadonlyArray<SheetTabItem<IntegrationSheet>> = [
    {
      key: SYSTEM_INSTALLED_APPS_SHEET,
      label: t.integrations.sheetPlugins,
      badge: systemInstalledAppsRows.length,
    },
    { key: 'coding-tools', label: 'Coding Tools', badge: codingToolRows.length },
    { key: 'mcp', label: t.integrations.sheetMcp, badge: mcpRows.length },
    { key: 'skills', label: t.integrations.sheetSkills, badge: skillsRowsMerged.length },
    { key: 'channels', label: t.integrations.sheetChannels, badge: channelRows.length },
    { key: 'memory', label: t.integrations.sheetMemory, badge: memoryRowsMerged.length },
    { key: 'commands', label: t.integrations.sheetCommands, badge: commandRowsMerged.length },
    { key: 'connected-instances', label: 'Network Instances', badge: connectedInstanceRows.length },
    { key: 'connect', label: 'Connect' },
  ];

  const handleSheetSelect = (key: IntegrationSheet) => {
    setSelectedRow(null);
    setCheckedRowKeys(new Set());
    router.push(`/integrations-hub/${key}`);
  };

  const handleToggleCheck = useCallback((rowKey: string, checked: boolean) => {
    setCheckedRowKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowKey); else next.delete(rowKey);
      return next;
    });
  }, []);

  const handleToggleCheckAll = useCallback((checked: boolean, visibleRowKeys: string[]) => {
    setCheckedRowKeys((prev) => {
      const next = new Set(prev);
      if (checked) visibleRowKeys.forEach((k) => next.add(k));
      else visibleRowKeys.forEach((k) => next.delete(k));
      return next;
    });
  }, []);

  const isPluginSystemSheet =
    activeSheet === SYSTEM_INSTALLED_APPS_SHEET || activeSheet === 'coding-tools' || activeSheet === 'mcp';

  const canToggleRowEnabled = useCallback(
    (row: IntegrationRow) => {
      if (isPluginSystemSheet) return row.sourceKind === 'plugin-installed';
      if (activeSheet === 'channels') return row.sourceKind === 'channel';
      if (activeSheet === 'commands') {
        return row.sourceKind === 'command-mapping' || row.sourceKind === 'system-cli';
      }
      return false;
    },
    [activeSheet, isPluginSystemSheet],
  );

  const handleIntegrationRowEnabled = useCallback(
    (row: IntegrationRow, enabled: boolean) => {
      if (row.enabled === enabled) return;

      if (isPluginSystemSheet) {
        if (row.sourceKind !== 'plugin-installed') return;
        const next = setPluginEnabled(catalogRef.current, row.sourceId, enabled);
        catalogRef.current = next;
        updateCatalog(next);
        return;
      }

      if (activeSheet === 'channels') {
        if (row.sourceKind !== 'channel') return;
        const current = channelCatalogRef.current;
        const next: ChannelCatalog = {
          ...current,
          channels: current.channels.map((c) =>
            c.id === row.sourceId ? { ...c, enabled } : c,
          ),
        };
        channelCatalogRef.current = next;
        updateChannels(next);
        return;
      }

      if (activeSheet === 'commands') {
        if (row.sourceKind === 'command-mapping') {
          const current = channelCatalogRef.current;
          const next: ChannelCatalog = {
            ...current,
            commandMappings: current.commandMappings.map((m) =>
              m.id === row.sourceId ? { ...m, enabled } : m,
            ),
          };
          channelCatalogRef.current = next;
          updateChannels(next);
        } else if (row.sourceKind === 'system-cli') {
          setSystemCliExposed(row.sourceId, enabled);
          setSystemCliExposure((prev) => ({ ...prev, [row.sourceId]: enabled }));
        } else {
          return;
        }
        void loadCommands();
      }
    },
    [activeSheet, isPluginSystemSheet, updateCatalog, updateChannels, loadCommands],
  );

  const showIntegrationRowTest =
    isPluginSystemSheet || activeSheet === 'connected-instances';

  const testPluginRowsForSheet = useCallback(
    async (sheetId: IntegrationInventorySheet, rows: IntegrationRow[]): Promise<ScanOutcome> => {
      const startedAt = Date.now();
      const testableRows = rows.filter(
        (r) => r.sourceKind === 'plugin-installed' || r.sourceKind === 'plugin-marketplace',
      );
      if (testableRows.length === 0) {
        return createSheetTestOutcome({
          sheetId,
          count: 0,
          skipped: 'Select one or more plugin rows to test.',
          durationMs: Date.now() - startedAt,
        });
      }
      try {
        for (const row of testableRows) {
          await handleTestPluginRow(row);
        }
        return createSheetTestOutcome({ sheetId, count: testableRows.length, durationMs: Date.now() - startedAt });
      } catch (e) {
        return createSheetTestOutcome({
          sheetId,
          count: testableRows.length,
          error: e instanceof Error ? e.message : String(e),
          durationMs: Date.now() - startedAt,
        });
      }
    },
    [handleTestPluginRow],
  );

  const testSkillsSheet = useCallback(
    async (rows: IntegrationRow[]): Promise<ScanOutcome> => {
      const startedAt = Date.now();
      if (!skillsDir) {
        return createSheetTestOutcome({
          sheetId: 'skills',
          count: rows.length,
          skipped: 'Skills directory not configured',
          durationMs: Date.now() - startedAt,
        });
      }
      try {
        await fetchSkillRows();
        return createSheetTestOutcome({ sheetId: 'skills', count: rows.length, durationMs: Date.now() - startedAt });
      } catch (e) {
        return createSheetTestOutcome({
          sheetId: 'skills',
          count: rows.length,
          error: e instanceof Error ? e.message : String(e),
          durationMs: Date.now() - startedAt,
        });
      }
    },
    [fetchSkillRows, skillsDir],
  );

  const testChannelsSheet = useCallback(async (rows: IntegrationRow[]): Promise<ScanOutcome> => {
    const startedAt = Date.now();
    try {
      const arr = await telegramStatusAll();
      setPollStatuses(new Map(arr.map((s) => [s.channelId, s])));
      return createSheetTestOutcome({ sheetId: 'channels', count: rows.length, durationMs: Date.now() - startedAt });
    } catch (e) {
      return createSheetTestOutcome({
        sheetId: 'channels',
        count: rows.length,
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - startedAt,
      });
    }
  }, []);

  const testMemorySheet = useCallback(
    async (rows: IntegrationRow[]): Promise<ScanOutcome> => {
      const startedAt = Date.now();
      if (!projectRoot) {
        return createSheetTestOutcome({
          sheetId: 'memory',
          count: rows.length,
          skipped: 'No project selected',
          durationMs: Date.now() - startedAt,
        });
      }
      try {
        await loadMemoryRows(projectRoot);
        return createSheetTestOutcome({ sheetId: 'memory', count: rows.length, durationMs: Date.now() - startedAt });
      } catch (e) {
        return createSheetTestOutcome({
          sheetId: 'memory',
          count: rows.length,
          error: e instanceof Error ? e.message : String(e),
          durationMs: Date.now() - startedAt,
        });
      }
    },
    [projectRoot],
  );

  const testCommandsSheet = useCallback(
    async (rows: IntegrationRow[]): Promise<ScanOutcome> => {
      const startedAt = Date.now();
      try {
        await loadSlashCommandRows(projectRoot);
        await listGlobalCliInventory().catch(() => []);
        return createSheetTestOutcome({ sheetId: 'commands', count: rows.length, durationMs: Date.now() - startedAt });
      } catch (e) {
        return createSheetTestOutcome({
          sheetId: 'commands',
          count: rows.length,
          error: e instanceof Error ? e.message : String(e),
          durationMs: Date.now() - startedAt,
        });
      }
    },
    [projectRoot],
  );

  const testConnectedInstancesSheet = useCallback(
    async (rows: IntegrationRow[]): Promise<ScanOutcome> => {
      const startedAt = Date.now();
      try {
        for (const row of rows.filter((r) => r.sourceKind === 'connected-instance')) {
          await handleTestConnectedInstanceRow(row);
        }
        return createSheetTestOutcome({
          sheetId: 'connected-instances',
          count: rows.length,
          durationMs: Date.now() - startedAt,
        });
      } catch (e) {
        return createSheetTestOutcome({
          sheetId: 'connected-instances',
          count: rows.length,
          error: e instanceof Error ? e.message : String(e),
          durationMs: Date.now() - startedAt,
        });
      }
    },
    [handleTestConnectedInstanceRow],
  );

  const sheetActions = useMemo(
    () =>
      createIntegrationSheetActionRegistry<SharedPluginCtx>({
        system_installed_apps: {
          scan: rescanSystemInstalledApps,
          test: (rows) => testPluginRowsForSheet('system_installed_apps', rows),
          testMode: 'selected-rows',
        },
        'coding-tools': {
          scan: rescanCodingTools,
          test: (rows) => testPluginRowsForSheet('coding-tools', rows),
          testMode: 'selected-rows',
        },
        mcp: {
          scan: rescanMcp,
          test: (rows) => testPluginRowsForSheet('mcp', rows),
          testMode: 'selected-rows',
        },
        skills: { scan: rescanSkills, test: testSkillsSheet },
        channels: { scan: rescanChannels, test: testChannelsSheet },
        memory: { scan: rescanMemory, test: testMemorySheet },
        commands: { scan: rescanCommands, test: testCommandsSheet },
        'connected-instances': { scan: rescanConnectedInstances, test: testConnectedInstancesSheet },
      }),
    [
      rescanSystemInstalledApps,
      rescanCodingTools,
      rescanMcp,
      rescanSkills,
      rescanChannels,
      rescanMemory,
      rescanCommands,
      rescanConnectedInstances,
      testPluginRowsForSheet,
      testSkillsSheet,
      testChannelsSheet,
      testMemorySheet,
      testCommandsSheet,
      testConnectedInstancesSheet,
    ],
  );

  const activeSheetAction = isIntegrationInventorySheet(activeSheet) ? sheetActions[activeSheet] : null;
  const activeSheetTestRows = useMemo(() => {
    if (!activeSheetAction) return [];
    if (activeSheetAction.testMode === 'selected-rows') {
      return activeRows.filter((r) => checkedRowKeys.has(r.rowKey));
    }
    return activeRows;
  }, [activeRows, activeSheetAction, checkedRowKeys]);

  const runAllScans = useCallback(async () => {
    setScanActionKind('scan');
    setScanRunning(true);
    setScanReport(null);
    const startedAt = Date.now();
    let shared: SharedPluginCtx | undefined;
    try {
      shared = await runPluginSystemScan();
      setSystemCommandStatus(shared.status);
      setResolvedInstallPaths(shared.paths);
    } catch {
      shared = undefined;
    }
    const scanSheets = [...INTEGRATION_INVENTORY_SHEETS];
    const results = await Promise.allSettled(scanSheets.map((sheet) => sheetActions[sheet].scan(shared)));
    const outcomes: ScanOutcome[] = results.map((r, index) => {
      const sheetId = scanSheets[index];
      return r.status === 'fulfilled'
        ? r.value
        : createSheetTestOutcome({
            sheetId,
            count: 0,
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
            durationMs: 0,
          });
    });
    setScanReport({ kind: 'scan', startedAt, durationMs: Date.now() - startedAt, outcomes });
    setScanRunning(false);
  }, [runPluginSystemScan, sheetActions]);

  const runSheetRescan = useCallback(
    async (sheet: IntegrationSheet) => {
      if (!isIntegrationInventorySheet(sheet)) return;
      setScanActionKind('scan');
      setScanRunning(true);
      setScanReport(null);
      const startedAt = Date.now();
      let outcome: ScanOutcome;
      try {
        outcome = await sheetActions[sheet].scan();
      } catch (e) {
        outcome = createSheetTestOutcome({
          sheetId: sheet,
          count: 0,
          error: e instanceof Error ? e.message : String(e),
          durationMs: Date.now() - startedAt,
        });
      }
      setScanReport({ kind: 'scan', startedAt, durationMs: Date.now() - startedAt, outcomes: [outcome] });
      setScanRunning(false);
    },
    [sheetActions],
  );

  const runSheetTest = useCallback(async () => {
    if (!activeSheetAction) return;
    setScanActionKind('test');
    setScanRunning(true);
    setScanReport(null);
    const startedAt = Date.now();
    let outcome: ScanOutcome;
    try {
      outcome = await activeSheetAction.test(activeSheetTestRows);
    } catch (e) {
      outcome = createSheetTestOutcome({
        sheetId: activeSheetAction.sheetId,
        count: activeSheetTestRows.length,
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - startedAt,
      });
    }
    setScanReport({ kind: 'test', startedAt, durationMs: Date.now() - startedAt, outcomes: [outcome] });
    setScanRunning(false);
  }, [activeSheetAction, activeSheetTestRows]);

  const activeSheetRequiresSelection = activeSheetAction?.testMode === 'selected-rows';
  const activeSheetCanTest = Boolean(activeSheetAction) && (!activeSheetRequiresSelection || activeSheetTestRows.length > 0);

  const activeSheetLoading =
    activeSheet === SYSTEM_INSTALLED_APPS_SHEET
      ? macosAppsScanning && !macosAppsSnapshot
      : activeSheet === 'skills'
        ? skillsLoading
        : activeSheet === 'memory'
          ? memoryLoading
          : activeSheet === 'commands'
            ? commandsLoading
            : false;

  const activeSheetError =
    activeSheet === SYSTEM_INSTALLED_APPS_SHEET
      ? macosAppsScanPhase === 'error' || macosAppsScanPhase === 'permission'
        ? macosAppsScanError
        : null
      : activeSheet === 'skills'
        ? skillsError
        : activeSheet === 'memory'
          ? memoryError
          : activeSheet === 'commands'
            ? commandsError
            : null;

  const RESCANABLE_SHEETS = new Set<IntegrationSheet>(INTEGRATION_INVENTORY_SHEETS);

  const toolbar = activeSheet === 'connect' || isCapabilitySheet(activeSheet) ? null : (
    <div className="flex flex-wrap items-center gap-2 border-b border-stone-200/10 px-4 py-2">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t.integrations.searchPlaceholder}
        className="min-w-[200px] flex-1 border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72 px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/25"
      />
      {RESCANABLE_SHEETS.has(activeSheet) && (
        <button
          type="button"
          onClick={() => void runSheetRescan(activeSheet)}
          disabled={scanRunning || connectedInstanceScanRunning || macosAppsScanning}
          title={
            activeSheet === SYSTEM_INSTALLED_APPS_SHEET
              ? 'Rescan macOS Applications folders and PATH probes'
              : 'Rescan this sheet'
          }
          className="flex items-center gap-1 border border-stone-200/20 px-2 py-2 text-xs text-stone-300 hover:border-emerald-300/30 disabled:opacity-50"
        >
          <RotateCw
            size={12}
            className={
              scanRunning || connectedInstanceScanRunning || macosAppsScanning ? 'animate-spin' : ''
            }
          />
          {activeSheet === SYSTEM_INSTALLED_APPS_SHEET
            ? t.integrations.systemInstalledApps.scanButton
            : 'Rescan'}
        </button>
      )}
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
      {activeSheet === 'skills' && (
        <Link href="/settings" className="text-xs text-emerald-300/80 hover:text-emerald-200">
          {t.plugins.settings}
        </Link>
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
      {activeSheet === 'connected-instances' && (
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={() => void executeDiscoveryPlan(loadLastDiscoveryPlan())}
            disabled={connectedInstanceScanRunning}
            className="border border-r-0 border-emerald-400/30 bg-emerald-950/20 px-2 py-2 text-xs text-emerald-300 disabled:opacity-50"
            title="Run last discovery plan"
          >
            {connectedInstanceScanRunning ? 'Discovering...' : 'Discover'}
          </button>
          <button
            type="button"
            onClick={() => {
              setDiscoveryPlanDraft(loadLastDiscoveryPlan());
              setDiscoverDialogOpen(true);
            }}
            disabled={connectedInstanceScanRunning}
            className="border border-emerald-400/30 bg-emerald-950/20 px-1.5 py-2 text-emerald-300 disabled:opacity-50"
            title="Configure discovery scope and probes"
            aria-label="Open discovery plan"
          >
            <ChevronDown size={14} />
          </button>
        </div>
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
      <div className="flex items-center gap-1 border-l border-stone-200/15 pl-2">
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
    </div>
  );

  return (
    <>
      <WorkstationFrame
        className="w-full"
        header={
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">
                  {t.integrations.title}
                </h1>
                <button
                  type="button"
                  onClick={() =>
                    pluginGuidePath
                      ? void openPath(pluginGuidePath).catch(() => {})
                      : undefined
                  }
                  className="flex shrink-0 items-center gap-2 border border-emerald-500/20 bg-emerald-950/25 px-3 py-1.5 text-xs text-emerald-400"
                >
                  <FileText size={13} />
                  {t.integrations.hubGuide}
                  <ExternalLink size={11} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {activeSheetAction && activeSheet !== SYSTEM_INSTALLED_APPS_SHEET && (
                  <button
                    type="button"
                    onClick={() => void runSheetTest()}
                    disabled={!activeSheetCanTest || scanRunning || pluginTestingKeys.size > 0}
                    title={
                      activeSheetRequiresSelection && activeSheetTestRows.length === 0
                        ? 'Select rows to test'
                        : activeSheetRequiresSelection
                          ? `Test ${activeSheetTestRows.length} selected item${activeSheetTestRows.length > 1 ? 's' : ''}`
                          : `Test ${activeSheetAction.label}`
                    }
                    className="flex shrink-0 items-center gap-2 border border-emerald-400/30 bg-emerald-950/25 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-950/45 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CheckCircle2 size={13} />
                    {pluginTestingKeys.size > 0 || (scanRunning && scanActionKind === 'test')
                      ? 'Testing...'
                      : activeSheetRequiresSelection
                        ? `Test Selected${activeSheetTestRows.length > 0 ? ` (${activeSheetTestRows.length})` : ''}`
                        : 'Test Sheet'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void runAllScans()}
                  disabled={scanRunning || connectedInstanceScanRunning}
                  title="Re-scan every sheet and report what changed"
                  className="flex shrink-0 items-center gap-2 border border-cyan-400/30 bg-cyan-950/25 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-950/45 disabled:opacity-50"
                >
                  <RefreshCw size={13} className={scanRunning ? 'animate-spin' : ''} />
                  {scanRunning && scanActionKind === 'scan' ? 'Scanning...' : 'Scan All'}
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-stone-400">{t.integrations.subtitle}</p>
          </div>
        }
        panelClassName="border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72"
        toolbar={toolbar}
        scrollChildren={false}
        bottomTabs={
          <BottomSheetTabs<IntegrationSheet>
            tabs={sheetTabs}
            activeKey={activeSheet}
            onSelect={handleSheetSelect}
            reorderable
            orderStorageKey={INTEGRATIONS_HUB_SHEET_ORDER_STORAGE_KEY}
          />
        }
      >
        {activeSheet === 'connect' ? (
          <div className="h-full overflow-auto p-4">
            <ConnectSheet />
          </div>
        ) : isCapabilitySheet(activeSheet) ? (
          <CapabilitySheetView sheet={activeSheet} />
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-3 p-4">
            {!projectRoot && activeSheet === 'memory' && (
              <p className="shrink-0 border border-amber-400/25 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
                {t.integrations.selectProjectHint}
              </p>
            )}
            {activeSheet === 'commands' && (
              <div className="shrink-0 border border-cyan-400/20 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-100/90">
                {t.integrations.commandsInventorySummary
                  .replace('{detected}', String(systemCliRows.length))
                  .replace('{exposed}', String(exposedSystemCliCount))
                  .replace('{whitelisted}', String(exposedSystemCliConfigured))}
              </div>
            )}
            {activeSheet === 'connected-instances' && (
              <div className="shrink-0 border border-emerald-400/20 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-100/90">
                {connectedInstanceScanRunning
                  ? 'Discovery running… see progress in the dialog or panel at bottom-right.'
                  : connectedInstanceScan
                    ? `Last discovery ${new Date(connectedInstanceScan.scannedAt).toLocaleString()} · ${connectedInstanceScan.devices.length} hosts · ${connectedInstanceScan.containers.length} containers · ${connectedInstanceScan.services.length} services · ${discoveryResult?.summary.newInstanceCount ?? '—'} new instance row(s)${
                        connectedInstanceScan.warnings.length > 0
                          ? ` · ${connectedInstanceScan.warnings.length} warning(s)`
                          : ''
                      }`
                    : 'Discovery has not run yet. Opening this sheet runs your last plan (default: Passive LAN).'}
              </div>
            )}

            {activeSheet === SYSTEM_INSTALLED_APPS_SHEET && macosAppsScanPhase !== 'idle' && (
              <SystemAppsScanBanner
                phase={macosAppsScanPhase}
                snapshot={macosAppsSnapshot}
                errorMessage={macosAppsScanError}
                lastScannedAt={macosAppsLastScannedAt}
                appCount={macosAppsSnapshot?.apps.length ?? 0}
              />
            )}
            <div className="min-h-0 flex-1">
              <IntegrationsTable
                rows={activeRows}
                selectedRowKey={selectedRow?.rowKey ?? null}
                onRowClick={setSelectedRow}
                checkedKeys={checkedRowKeys}
                onToggleCheck={handleToggleCheck}
                onToggleCheckAll={handleToggleCheckAll}
                globalFilter={search}
                isLoading={activeSheetLoading}
                errorMessage={activeSheetError}
                frozenDataColCount={frozenDataColCount}
                rowDensity={rowDensity}
                methodColumnHeader={
                  activeSheet === 'connected-instances'
                    ? t.integrations.colScanMethod
                    : activeSheet === 'mcp'
                      ? t.integrations.colServerType
                      : undefined
                }
                compactStatusCell={activeSheet === 'connected-instances'}
                onTestRow={
                  showIntegrationRowTest ? handleIntegrationTestRow : undefined
                }
                testResults={
                  showIntegrationRowTest ? pluginTestResults : undefined
                }
                testingKeys={
                  showIntegrationRowTest ? pluginTestingKeys : undefined
                }
                canToggleRowEnabled={
                  isPluginSystemSheet || activeSheet === 'channels' || activeSheet === 'commands'
                    ? canToggleRowEnabled
                    : undefined
                }
                onToggleEnabled={
                  isPluginSystemSheet || activeSheet === 'channels' || activeSheet === 'commands'
                    ? handleIntegrationRowEnabled
                    : undefined
                }
              />
            </div>

            {activeSheet === 'channels' && (
              <div className="shrink-0 max-h-[40%] overflow-y-auto">
                <ChannelsActivityAndGuide
                  channels={channelCatalog.channels}
                  messages={recentMessages}
                  guideOpen={showChannelGuide}
                  onToggleGuide={() => setShowChannelGuide((v) => !v)}
                />
              </div>
            )}
          </div>
        )}
      </WorkstationFrame>

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
        onTogglePluginAutostart={(id) => updateCatalog(togglePluginAutostart(catalog, id))}
        mcpStart={(p) => void mcpStart(p)}
        mcpStop={(id) => void mcpKill(id)}
        mcpRestart={async (p) => {
          await mcpKill(p.id);
          await new Promise((r) => setTimeout(r, 80));
          await mcpStart(p);
        }}
        mcpViewLogs={setLogsForId}
        onOpenPath={(path) => void openPath(path).catch(() => {})}
        runtimeRootPath={pmRoot}
        onRunRuntimeCommand={handleRunRuntimeCommand}
        onSkillUninstall={async (path) => {
          if (!skillsDir) return;
          const confirmed = await confirmAction.open({
            title: 'Delete skill',
            message: t.plugins.deleteSkillConfirm.replace('{path}', path),
            confirmLabel: 'Delete',
          });
          if (!confirmed) return;
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

      <DiscoverPlanDialog
        open={discoverDialogOpen}
        initialPlan={discoveryPlanDraft}
        onClose={() => setDiscoverDialogOpen(false)}
        onDone={() => {
          setDiscoverDialogOpen(false);
          setDiscoveryResult(null);
        }}
        onRun={executeDiscoveryPlan}
      />

      {!discoverDialogOpen && (discoveryResult || connectedInstanceScanRunning) && (
        <DiscoveryResultPanel
          summary={discoveryResult?.summary ?? null}
          warnings={discoveryResult?.warnings ?? []}
          running={connectedInstanceScanRunning}
          onClose={() => {
            if (connectedInstanceScanRunning) return;
            setDiscoveryResult(null);
          }}
          onRunAgain={() => {
            setDiscoveryResult(null);
            setDiscoverDialogOpen(true);
          }}
        />
      )}

      <ScanReportPanel
        report={scanReport}
        running={scanRunning}
        runningKind={scanActionKind}
        onClose={() => setScanReport(null)}
      />
      {confirmAction.dialog}
      {botTokenAlert.dialog}
    </>
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
