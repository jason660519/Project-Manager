import type { AnyPlugin, PluginCatalog } from '../types/plugins';
import { writeFile } from '../bridge';

export const PLUGIN_CATALOG_MIRROR_REL = '.project-manager/plugins.json';

export interface PluginMirrorEntry {
  enabled: boolean;
  autostart: boolean;
  kind: AnyPlugin['kind'];
}

export interface PluginCatalogMirror {
  schemaVersion: 1;
  updatedAt: string;
  plugins: Record<string, PluginMirrorEntry>;
}

function mirrorEntry(plugin: AnyPlugin): PluginMirrorEntry {
  return {
    enabled: plugin.enabled,
    autostart: plugin.autostart ?? false,
    kind: plugin.kind,
  };
}

export function buildPluginCatalogMirror(catalog: PluginCatalog): PluginCatalogMirror {
  const plugins: Record<string, PluginMirrorEntry> = {};
  for (const plugin of catalog.plugins) {
    plugins[plugin.id] = mirrorEntry(plugin);
  }
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    plugins,
  };
}

export function parsePluginCatalogMirror(raw: unknown): PluginCatalogMirror | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<PluginCatalogMirror>;
  if (candidate.schemaVersion !== 1 || typeof candidate.updatedAt !== 'string') return null;
  if (!candidate.plugins || typeof candidate.plugins !== 'object') return null;

  const plugins: Record<string, PluginMirrorEntry> = {};
  for (const [id, entry] of Object.entries(candidate.plugins)) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Partial<PluginMirrorEntry>;
    if (typeof row.enabled !== 'boolean' || typeof row.autostart !== 'boolean') continue;
    if (typeof row.kind !== 'string') continue;
    plugins[id] = {
      enabled: row.enabled,
      autostart: row.autostart,
      kind: row.kind as AnyPlugin['kind'],
    };
  }

  return {
    schemaVersion: 1,
    updatedAt: candidate.updatedAt,
    plugins,
  };
}

export function pluginMirrorPath(repoRoot: string): string {
  const root = repoRoot.replace(/\/+$/, '');
  return `${root}/${PLUGIN_CATALOG_MIRROR_REL}`;
}

export async function writePluginCatalogMirror(
  catalog: PluginCatalog,
  repoRoot: string,
): Promise<void> {
  const trimmed = repoRoot.trim();
  if (!trimmed) return;
  const mirror = buildPluginCatalogMirror(catalog);
  const content = `${JSON.stringify(mirror, null, 2)}\n`;
  await writeFile(pluginMirrorPath(trimmed), content);
}

/** Fire-and-forget mirror write; logs failures without throwing to callers. */
export function schedulePluginCatalogMirror(catalog: PluginCatalog, repoRoot?: string): void {
  const root = repoRoot?.trim();
  if (!root || typeof window === 'undefined') return;
  void writePluginCatalogMirror(catalog, root).catch((error) => {
    console.warn('[plugin-catalog-mirror] write failed:', error);
  });
}
