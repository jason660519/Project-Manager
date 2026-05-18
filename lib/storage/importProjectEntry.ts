import { buildProjectScaffold } from './createProjectScaffold';
import { resolveProjectRoot } from './dashboardLayout';
import { migrateConfig } from './migrate';
import { mergeProjectConfigFromDisk } from './mergeProjectFromDisk';
import { resolveConfigPath } from './resolveConfigPath';
import type { ProjectEntry, ProjectManagerConfig } from '../types';

function newProjectId(): string {
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isMissingConfigError(message: string): boolean {
  return /No such file or directory|Is a directory|os error 2\b|os error 21\b|CONFIG_EXISTS/i.test(
    message,
  );
}

/**
 * Build a ProjectEntry from a folder or config path.
 *
 * On Tauri we run a one-shot layout migration (ADR-008): if the project still
 * has the legacy single-file `.project-manager.json` and not the consolidated
 * `.project-manager/config.json`, the file is moved into the new location
 * before we read it. This means an existing project the user imports today
 * silently lands on the new layout without losing data.
 *
 * Missing config (either layout) is not an error — the folder still
 * registers with `configMissing: true` so the caller can offer AI Scan.
 */
export async function buildProjectEntryFromPath(
  folderOrConfigPath: string,
  options: { isTauri: boolean; existing?: ProjectEntry },
): Promise<ProjectEntry> {
  const trimmedInput = folderOrConfigPath.trim();
  const root = resolveProjectRoot(trimmedInput);
  const resolvedPath = resolveConfigPath(trimmedInput);
  const id = options.existing?.id ?? newProjectId();

  if (options.isTauri) {
    const { migrateProjectLayout, readConfig } = await import('../bridge');
    // Best-effort layout migration. Swallow errors so an FS edge case (e.g.
    // permission denied on rename) doesn't block the import — we just fall
    // through to read whatever layout exists.
    try {
      await migrateProjectLayout(root);
    } catch {
      /* keep going; readConfig below will surface a real error */
    }

    try {
      const disk = await readConfig(resolvedPath);
      const local = options.existing?.config ?? migrateConfig(disk);
      const config = mergeProjectConfigFromDisk(local, disk, resolvedPath);
      return {
        id,
        config,
        configPath: resolvedPath,
        configMissing: false,
        lastSyncedAt: options.existing?.lastSyncedAt,
      };
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (!isMissingConfigError(raw)) throw e;
    }
  } else {
    // Web preview: register folder; scan requires dev API or desktop app.
    const config = buildProjectScaffold(root);
    return {
      id,
      config,
      configPath: resolvedPath,
      configMissing: true,
    };
  }

  const config = buildProjectScaffold(root);
  return {
    id,
    config,
    configPath: resolvedPath,
    configMissing: true,
  };
}

/** Persist scan output to disk and return an updated entry. */
export async function applyScanConfigToProject(
  project: ProjectEntry,
  scanned: ProjectManagerConfig,
): Promise<ProjectEntry> {
  const { writeConfig } = await import('../bridge');
  const root = project.config.project.root.replace(/\/+$/, '');
  const configPath = resolveConfigPath(root);
  const config = migrateConfig({
    ...scanned,
    project: {
      ...scanned.project,
      root,
      name: scanned.project.name || project.config.project.name,
    },
  });
  await writeConfig(configPath, config);
  return {
    ...project,
    config,
    configPath,
    configMissing: false,
    lastSyncedAt: new Date().toISOString(),
  };
}
