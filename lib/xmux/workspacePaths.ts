import { resolveProjectRoot } from '../storage/dashboardLayout';
import type { ProjectEntry } from '../types';

type WorkspacePathSource = 'project.root' | 'configPath';

export type WorkspacePathResolution =
  | {
      ok: true;
      cwd: string;
      source: WorkspacePathSource;
      warning?: string;
    }
  | {
      ok: false;
      error: string;
    };

export type FolderPathValidation =
  | { ok: true; path: string }
  | { ok: false; error: string };

function tidy(input: string): string {
  return input.trim().replace(/\/+$/, '');
}

function dirname(input: string): string {
  const idx = input.lastIndexOf('/');
  if (idx < 0) return '';
  if (idx === 0) return '/';
  return input.slice(0, idx);
}

function isUrlPath(path: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(path);
}

function validateLocalAbsolutePath(path: string): FolderPathValidation {
  const trimmed = tidy(path);
  if (!trimmed) {
    return { ok: false, error: 'Project root path is empty.' };
  }
  if (trimmed.includes('\0')) {
    return { ok: false, error: 'Project root path contains an invalid null byte.' };
  }
  if (isUrlPath(trimmed)) {
    return { ok: false, error: `Project root must be a local folder path, not a URL: ${trimmed}` };
  }
  if (!trimmed.startsWith('/')) {
    return { ok: false, error: `Project root must be an absolute local path: ${trimmed}` };
  }
  return { ok: true, path: trimmed };
}

function normalizeCandidate(
  input: string,
  source: WorkspacePathSource,
  options: { allowJsonFileFallback?: boolean } = {},
): WorkspacePathResolution {
  const local = validateLocalAbsolutePath(input);
  if (!local.ok) return { ok: false, error: `${source}: ${local.error}` };

  let root = tidy(resolveProjectRoot(local.path));
  if (options.allowJsonFileFallback && root.endsWith('.json')) {
    root = dirname(root);
  }

  const validatedRoot = validateLocalAbsolutePath(root);
  if (!validatedRoot.ok) {
    return { ok: false, error: `${source}: ${validatedRoot.error}` };
  }
  return { ok: true, cwd: validatedRoot.path, source };
}

export function validateWorkspaceFolderPath(path: string): FolderPathValidation {
  const local = validateLocalAbsolutePath(path);
  if (!local.ok) return local;
  const root = tidy(resolveProjectRoot(local.path));
  return validateLocalAbsolutePath(root);
}

export function deriveProjectWorkspacePath(project: ProjectEntry): WorkspacePathResolution {
  const rootInput = project.config.project.root ?? '';
  const root = normalizeCandidate(rootInput, 'project.root');
  if (root.ok) return root;

  const configPath = normalizeCandidate(project.configPath ?? '', 'configPath', {
    allowJsonFileFallback: true,
  });
  if (configPath.ok) {
    return {
      ...configPath,
      warning: `Using project config path because ${root.error}`,
    };
  }

  return {
    ok: false,
    error: `Unable to derive a valid local project root. ${root.error}; ${configPath.error}`,
  };
}
