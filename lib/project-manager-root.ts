import sampleSelf from '../config/samples/project-manager-self.sample.json';
import type { ProjectManagerConfig } from './types';

/** Plugin ids that support dev-stack autostart (project-scoped sidecars). */
export const PROJECT_SCOPED_AUTOSTART_PLUGIN_IDS = new Set(['openclaw', 'hermes-agent']);

function readEnvRepoRoot(): string {
  if (typeof process === 'undefined') return '';
  const candidate =
    process.env.PROJECT_MANAGER_REPO_ROOT ??
    process.env.PM_REPO_ROOT ??
    process.env.PROJECT_MANAGER_ROOT ??
    '';
  return typeof candidate === 'string' ? candidate.trim() : '';
}

/** Resolve the Project Manager repository root for sidecar paths and mirror writes. */
export function resolveProjectManagerRepoRoot(override?: string): string {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;
  const envRoot = readEnvRepoRoot();
  if (envRoot) return envRoot;
  if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
    return process.cwd();
  }
  const fromSample = (sampleSelf as ProjectManagerConfig).project?.root;
  return fromSample?.trim() ?? '';
}

/** Absolute or repo-relative path to a project-scoped CLI wrapper under `.project-manager/bin/`. */
export function projectScopedBin(binaryName: string, repoRoot?: string): string {
  const relative = `.project-manager/bin/${binaryName}`;
  const root = repoRoot !== undefined ? repoRoot.trim() : resolveProjectManagerRepoRoot();
  if (!root) return relative;
  return `${root.replace(/\/+$/, '')}/${relative}`;
}
