import type { InstalledMacApp } from '../../bridge';
import { MARKETPLACE, type MarketplacePlugin } from '../marketplace-catalog';
import { mergeAllManual } from '../manual-metadata';
import { registryFor } from '../registry';
import { RECOMMENDED_INSTALL_APPS } from '../recommended-apps';
import type { IntegrationRow, IntegrationScope } from '../types';
import type { ResolvedPluginPath } from './plugins';

const SYSTEM_APPS_SHEET = 'system_installed_apps' as const;

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function macAppMatches(app: InstalledMacApp, ...needles: Array<string | undefined>): boolean {
  const haystack = normalizeToken(`${app.name} ${app.path}`);
  return needles
    .filter((needle): needle is string => Boolean(needle?.trim()))
    .some((needle) => haystack.includes(normalizeToken(needle)));
}

function pickPluginRow(rows: IntegrationRow[], sourceId: string): IntegrationRow | undefined {
  return (
    rows.find((row) => row.sourceId === sourceId && row.sourceKind === 'plugin-installed') ??
    rows.find((row) => row.sourceId === sourceId)
  );
}

function isMarketplaceEntryDetected(
  mp: MarketplacePlugin,
  ctx: {
    systemCommandStatus: Record<string, boolean>;
    resolvedInstallPaths?: Record<string, ResolvedPluginPath>;
  },
  macApps: InstalledMacApp[],
): boolean {
  if (ctx.systemCommandStatus[mp.id] === true) return true;
  const resolved = ctx.resolvedInstallPaths?.[mp.id];
  if (resolved?.appBundlePath || resolved?.commandPath) return true;

  const cliCommand = mp.kind === 'cli' ? mp.defaultCli?.command : mp.defaultEditor?.command;
  const cliBase = cliCommand?.split('/').pop();

  if (macApps.some((app) => macAppMatches(app, mp.appBundleName, mp.name, cliBase))) {
    return true;
  }

  return false;
}

function installPathForDetected(
  mp: MarketplacePlugin,
  row: IntegrationRow,
  ctx: { resolvedInstallPaths?: Record<string, ResolvedPluginPath> },
  macApps: InstalledMacApp[],
  detected: boolean,
): string {
  if (!detected) return row.installPath;
  const resolved = ctx.resolvedInstallPaths?.[mp.id];
  if (resolved?.appBundlePath || resolved?.commandPath) {
    return resolved.appBundlePath ?? resolved.commandPath ?? row.installPath;
  }
  const cliCommand = mp.kind === 'cli' ? mp.defaultCli?.command : mp.defaultEditor?.command;
  const cliBase = cliCommand?.split('/').pop();
  const macMatch = macApps.find((app) => macAppMatches(app, mp.appBundleName, mp.name, cliBase));
  return macMatch?.path ?? row.installPath;
}

function remapMarketplaceRow(
  row: IntegrationRow,
  mp: MarketplacePlugin,
  detected: boolean,
  installPath: string,
): IntegrationRow {
  const reg = registryFor(mp.id);
  const tagParts = [row.category1, row.category2].filter(Boolean);
  return {
    ...row,
    rowKey: `system-apps:${mp.id}`,
    sheet: SYSTEM_APPS_SHEET,
    category1: reg.category1 ?? row.category1,
    category2: reg.category2 ?? row.category2,
    company: reg.company ?? row.company,
    installPath,
    installMethod: reg.installMethod ?? row.installMethod,
    status: detected ? 'installed' : 'not_installed',
    statusLabel: detected ? 'Installed' : 'Not Installed',
    notes: row.notes || tagParts.join(', '),
    badges: detected ? ['Installed'] : [],
  };
}

function mapRecommendedAppRow(app: (typeof RECOMMENDED_INSTALL_APPS)[number], macApps: InstalledMacApp[]): IntegrationRow {
  const match = macApps.find((candidate) =>
    macAppMatches(candidate, app.name, app.name.split(/\s+/)[0]),
  );
  const detected = Boolean(match);
  return {
    rowKey: `system-apps:recommended:${normalizeToken(app.name)}`,
    sheet: SYSTEM_APPS_SHEET,
    sourceKind: 'plugin-marketplace',
    sourceId: `recommended:${normalizeToken(app.name)}`,
    enabled: false,
    category1: app.category,
    category2: 'Desktop App',
    githubUrl: '',
    company: app.name.startsWith('Adobe') ? 'Adobe' : app.name,
    name: app.name,
    version: '',
    license: '',
    scope: 'user' as IntegrationScope,
    port: '',
    installPath: match?.path ?? '',
    installMethod: 'desktop_app',
    status: detected ? 'installed' : 'not_installed',
    statusLabel: detected ? 'Installed' : 'Not Installed',
    lastUpdated: '',
    notes: app.primaryFunction,
    lv: null,
    badges: detected ? ['Installed'] : [],
    payload: { recommendedApp: app, websiteUrl: app.websiteUrl },
  };
}

function mapMacosAppRow(app: InstalledMacApp): IntegrationRow {
  return {
    rowKey: `system-apps:mac:${app.id}`,
    sheet: SYSTEM_APPS_SHEET,
    sourceKind: 'plugin-marketplace',
    sourceId: app.id,
    enabled: false,
    category1: 'macOS application',
    category2: 'Desktop App',
    githubUrl: '',
    company: '',
    name: app.name,
    version: '',
    license: '',
    scope: 'user' as IntegrationScope,
    port: '',
    installPath: app.path,
    installMethod: 'desktop_app',
    status: 'installed',
    statusLabel: 'Installed',
    lastUpdated: '',
    notes: app.description ?? '',
    lv: null,
    badges: ['Installed'],
    payload: { macApp: app },
  };
}

/**
 * Unified System Installed Apps inventory: marketplace CLIs/IDEs (installed +
 * not installed), curated recommendations, and unmatched macOS `.app` bundles.
 */
export function buildSystemInstalledAppsRows(
  pluginSheetRows: IntegrationRow[],
  ctx: {
    systemCommandStatus: Record<string, boolean>;
    resolvedInstallPaths?: Record<string, ResolvedPluginPath>;
  },
  macApps: InstalledMacApp[],
): IntegrationRow[] {
  const rows: IntegrationRow[] = [];
  const matchedMacAppIds = new Set<string>();

  for (const mp of MARKETPLACE) {
    if (mp.kind !== 'cli' && mp.kind !== 'editor') continue;
    const base = pickPluginRow(pluginSheetRows, mp.id);
    if (!base) continue;

    const detected = isMarketplaceEntryDetected(mp, ctx, macApps);
    if (detected) {
      for (const app of macApps) {
        const cliCommand = mp.kind === 'cli' ? mp.defaultCli?.command : mp.defaultEditor?.command;
        const cliBase = cliCommand?.split('/').pop();
        if (macAppMatches(app, mp.appBundleName, mp.name, cliBase)) {
          matchedMacAppIds.add(app.id);
        }
      }
    }

    const installPath = installPathForDetected(mp, base, ctx, macApps, detected);
    rows.push(remapMarketplaceRow(base, mp, detected, installPath));
  }

  for (const recommended of RECOMMENDED_INSTALL_APPS) {
    const match = macApps.find((app) => macAppMatches(app, recommended.name, recommended.name.split(/\s+/)[0]));
    if (match) matchedMacAppIds.add(match.id);
    rows.push(mapRecommendedAppRow(recommended, macApps));
  }

  for (const app of macApps) {
    if (matchedMacAppIds.has(app.id)) continue;
    rows.push(mapMacosAppRow(app));
  }

  return mergeAllManual(rows);
}
