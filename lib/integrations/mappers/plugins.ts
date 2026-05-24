import type { McpRunStatus } from '../../bridge';
import type {
  AnyPlugin,
  CliPlugin,
  EditorPlugin,
  McpPlugin,
  PluginCatalog,
  ProviderPlugin,
} from '../../types/plugins';
import { registryFor } from '../registry';
import type { IntegrationRow, IntegrationScope, IntegrationStatus } from '../types';

export interface ResolvedPluginPath {
  /** Absolute path of the executable as found on PATH (null if missing). */
  commandPath: string | null;
  /** macOS .app bundle path when the editor's display name matches an installed app. */
  appBundlePath: string | null;
}

export interface PluginMapperContext {
  apiKeys: Record<string, string>;
  systemCommandStatus: Record<string, boolean>;
  mcpStatuses: Map<string, McpRunStatus>;
  /**
   * Resolved real install paths keyed by plugin id. Populated by the host view
   * after running `resolveInstallPath` over the marketplace + installed plugins.
   * Missing entries fall back to `installPathFor(plugin)` (the raw command name).
   */
  resolvedInstallPaths?: Record<string, ResolvedPluginPath>;
}

function kindToCategory1(kind: AnyPlugin['kind']): string {
  switch (kind) {
    case 'provider':
      return 'AI Provider';
    case 'cli':
      return 'Coding Editor/Orchestrator';
    case 'editor':
      return 'Coding Editor/Orchestrator';
    case 'mcp':
      return 'MCP Server';
    case 'skill':
      return 'Skills';
    case 'frontend':
      return 'Frontend Plugin';
    default:
      return 'Plugin';
  }
}

function kindToCategory2(kind: AnyPlugin['kind']): string {
  switch (kind) {
    case 'provider':
      return 'API';
    case 'cli':
      return 'CLI';
    case 'editor':
      return 'Desktop App';
    case 'mcp':
      return 'stdio/http';
    case 'skill':
      return 'Skill pack';
    case 'frontend':
      return 'Editor Component';
    default:
      return '';
  }
}

function resolveStatus(
  plugin: AnyPlugin,
  ctx: PluginMapperContext,
): { status: IntegrationStatus; statusLabel: string; badges: string[] } {
  const badges: string[] = [];

  if (plugin.kind === 'provider') {
    const keySet = Boolean(ctx.apiKeys[plugin.id]);
    if (keySet) badges.push('API key set');
    const modelCount = plugin.models?.length ?? 0;
    if (modelCount > 0) badges.push(`${modelCount} models`);
    return {
      status: plugin.enabled ? (keySet ? 'connected' : 'warning') : 'stopped',
      statusLabel: keySet ? 'Key configured' : 'Key missing',
      badges,
    };
  }

  if (plugin.kind === 'mcp') {
    const run = ctx.mcpStatuses.get(plugin.id);
    if (run?.phase === 'running') {
      badges.push(`PID ${run.pid}`);
      return { status: 'running', statusLabel: 'Running', badges };
    }
    if (run?.phase === 'errored') {
      return { status: 'warning', statusLabel: 'Errored', badges };
    }
    if (run?.phase === 'stopped') {
      return { status: 'stopped', statusLabel: 'Stopped', badges };
    }
    return { status: 'idle', statusLabel: 'Idle', badges };
  }

  if (plugin.kind === 'cli' || plugin.kind === 'editor') {
    const detected = ctx.systemCommandStatus[plugin.id];
    if (detected === true) {
      badges.push('On system PATH');
      return { status: 'installed', statusLabel: 'Installed', badges };
    }
    if (detected === false) {
      return { status: 'unavailable', statusLabel: 'Not on PATH', badges };
    }
    return { status: plugin.enabled ? 'installed' : 'stopped', statusLabel: plugin.enabled ? 'Enabled' : 'Disabled', badges };
  }

  return {
    status: plugin.enabled ? 'installed' : 'stopped',
    statusLabel: plugin.enabled ? 'Enabled' : 'Disabled',
    badges,
  };
}

function installPathFor(
  plugin: AnyPlugin,
  resolved?: ResolvedPluginPath,
): string {
  if (plugin.kind === 'provider') return plugin.baseUrl;
  if (plugin.kind === 'mcp') {
    if (resolved?.commandPath) {
      const args = (plugin.args ?? []).join(' ');
      return args ? `${resolved.commandPath} ${args}` : resolved.commandPath;
    }
    const parts = [plugin.command, ...(plugin.args ?? [])].filter(Boolean);
    return parts.join(' ') || plugin.url || '';
  }
  if (plugin.kind === 'cli') {
    return resolved?.commandPath ?? plugin.command;
  }
  if (plugin.kind === 'editor') {
    // Prefer the .app bundle on macOS so users see where the IDE actually
    // lives, fall back to the resolved CLI launcher, then the raw command.
    return resolved?.appBundlePath ?? resolved?.commandPath ?? plugin.command;
  }
  if (plugin.kind === 'skill') return plugin.installedPath;
  if (plugin.kind === 'frontend') return plugin.implementationPath || plugin.packageName;
  return '';
}

function portFor(plugin: AnyPlugin, reg: ReturnType<typeof registryFor>): string {
  if (reg.port) return reg.port;
  if (plugin.kind === 'provider') {
    try {
      const u = new URL(plugin.baseUrl);
      return u.port || (u.protocol === 'https:' ? '443' : '80');
    } catch {
      return '';
    }
  }
  return '';
}

function mapPlugin(plugin: AnyPlugin, ctx: PluginMapperContext): IntegrationRow {
  const reg = registryFor(plugin.id);
  const { status, statusLabel, badges } = resolveStatus(plugin, ctx);
  const scope = (reg.scope ?? '') as IntegrationScope;
  const sheet = plugin.kind === 'mcp' ? 'mcp' : 'plugins';

  return {
    rowKey: `${sheet}:${plugin.id}`,
    sheet,
    sourceKind: 'plugin-installed',
    sourceId: plugin.id,
    enabled: plugin.enabled,
    category1: reg.category1 ?? kindToCategory1(plugin.kind),
    category2: reg.category2 ?? kindToCategory2(plugin.kind),
    githubUrl: reg.githubUrl ?? '',
    company: reg.company ?? plugin.name,
    name: plugin.name,
    version: plugin.kind === 'skill' && plugin.version ? plugin.version : '',
    license: reg.license ?? '',
    scope,
    port: portFor(plugin, reg),
    installPath:
      reg.installPathHint ?? installPathFor(plugin, ctx.resolvedInstallPaths?.[plugin.id]),
    status,
    statusLabel,
    lastUpdated: plugin.installedAt?.slice(0, 10) ?? '',
    notes: '',
    lv: null,
    badges,
    payload: { plugin, runtime: reg.runtime },
  };
}

export function mapInstalledPlugins(
  catalog: PluginCatalog,
  ctx: PluginMapperContext,
): IntegrationRow[] {
  // Skills have their own sheet. Providers are owned by the Keys view and
  // intentionally hidden from the Plugins hub even if they linger in older
  // persisted catalogs.
  return catalog.plugins
    .filter((p) => p.kind !== 'skill' && p.kind !== 'provider')
    .map((p) => mapPlugin(p, ctx));
}

export type MarketplaceEntry = {
  id: string;
  name: string;
  description: string;
  category: string;
  kind: string;
};

export function mapMarketplaceRow(
  entry: MarketplaceEntry & { installed: boolean },
  resolved?: ResolvedPluginPath,
): IntegrationRow {
  const reg = registryFor(entry.id);
  const detectedPath = resolved?.appBundlePath ?? resolved?.commandPath ?? '';
  const sheet = entry.kind === 'mcp' ? 'mcp' : 'plugins';
  return {
    rowKey: `marketplace:${entry.id}`,
    sheet,
    sourceKind: 'plugin-marketplace',
    sourceId: entry.id,
    enabled: false,
    category1: reg.category1 ?? entry.category,
    category2: reg.category2 ?? entry.kind,
    githubUrl: reg.githubUrl ?? '',
    company: reg.company ?? entry.name,
    name: entry.name,
    version: '',
    license: reg.license ?? '',
    scope: (reg.scope ?? '') as IntegrationScope,
    port: reg.port ?? '',
    installPath: reg.installPathHint ?? detectedPath,
    status: entry.installed ? 'installed' : 'not_installed',
    statusLabel: entry.installed ? 'Installed' : 'Available',
    lastUpdated: '',
    notes: entry.description,
    lv: null,
    badges: entry.installed ? ['Installed'] : [],
    payload: { marketplaceId: entry.id, runtime: reg.runtime },
  };
}

export function isProviderPlugin(p: unknown): p is ProviderPlugin {
  return typeof p === 'object' && p !== null && (p as ProviderPlugin).kind === 'provider';
}

export function isCliPlugin(p: unknown): p is CliPlugin {
  return typeof p === 'object' && p !== null && (p as CliPlugin).kind === 'cli';
}

export function isEditorPlugin(p: unknown): p is EditorPlugin {
  return typeof p === 'object' && p !== null && (p as EditorPlugin).kind === 'editor';
}

export function isMcpPlugin(p: unknown): p is McpPlugin {
  return typeof p === 'object' && p !== null && (p as McpPlugin).kind === 'mcp';
}
