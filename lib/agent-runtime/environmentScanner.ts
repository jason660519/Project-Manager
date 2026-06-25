import { DEFAULT_AGENT_TOOL_SPECS } from './toolCatalog';
import type {
  AgentRuntimeFilesystemSnapshot,
  AgentRuntimeInventory,
  AgentRuntimePathObservation,
  AgentRuntimePathSpec,
  AgentRuntimeScanOptions,
  AgentRuntimeToolRow,
  AgentRuntimeToolSpec,
  AgentRuntimeWarning,
} from './types';

function normalizePath(input: string): string {
  const replaced = input.trim().replace(/\\/g, '/');
  const driveMatch = replaced.match(/^([A-Za-z]:)(\/.*)?$/);
  const drive = driveMatch?.[1] ?? '';
  const body = driveMatch ? (driveMatch[2] ?? '/') : replaced;
  const absolute = body.startsWith('/');
  const parts: string[] = [];

  for (const part of body.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length > 0) parts.pop();
      continue;
    }
    parts.push(part);
  }

  const prefix = drive || (absolute ? '/' : '');
  const joined = parts.join('/');
  if (!joined) return prefix || '.';
  return `${prefix}${prefix && !prefix.endsWith('/') ? '/' : ''}${joined}`;
}

function expandPath(path: string, options: AgentRuntimeScanOptions): string {
  const home = normalizePath(options.homeDir);
  const projectRoot = normalizePath(options.projectRoot);
  if (path === '~') return home;
  if (path.startsWith('~/')) return normalizePath(`${home}/${path.slice(2)}`);
  return normalizePath(path.replaceAll('{projectRoot}', projectRoot).replaceAll('{home}', home));
}

function observePath(
  spec: AgentRuntimePathSpec,
  existingPaths: Set<string>,
  options: AgentRuntimeScanOptions,
  sessionRootChildCounts: Record<string, number>,
): AgentRuntimePathObservation {
  const path = expandPath(spec.path, options);
  const childCount = spec.kind === 'sessions-root' ? sessionRootChildCounts[path] : undefined;
  return {
    kind: spec.kind,
    path,
    exists: existingPaths.has(path),
    required: spec.required === true,
    secretBearing: spec.secretBearing === true || spec.kind === 'secret-file',
    ...(typeof childCount === 'number' && Number.isFinite(childCount) && childCount >= 0
      ? { childCount }
      : {}),
  };
}

function commandAvailable(spec: AgentRuntimeToolSpec, commands: Set<string>, paths: AgentRuntimePathObservation[]): boolean {
  if (spec.command && commands.has(spec.command)) return true;
  return paths.some((path) => path.kind === 'binary' && path.exists);
}

function hasAnyPathEvidence(paths: AgentRuntimePathObservation[]): boolean {
  return paths.some((path) => path.exists && path.kind !== 'secret-file');
}

function configRootHasEvidence(configRoot: AgentRuntimePathObservation | undefined, paths: AgentRuntimePathObservation[]): boolean {
  if (!configRoot) return false;
  if (configRoot.exists) return true;
  return paths.some((path) => path.exists && path.path.startsWith(`${configRoot.path}/`));
}

function statusFor(
  spec: AgentRuntimeToolSpec,
  commandExists: boolean,
  paths: AgentRuntimePathObservation[],
): AgentRuntimeToolRow['status'] {
  if (spec.supported === false) return 'unsupported';
  const configRoot = paths.find((path) => path.kind === 'config-root');
  const requiredMissing = paths.some((path) => {
    if (!path.required || path.exists) return false;
    if (path.kind === 'config-root') return !configRootHasEvidence(path, paths);
    return true;
  });
  const anyEvidence = commandExists || hasAnyPathEvidence(paths);
  if (!anyEvidence) return 'missing';
  if (!commandExists || !configRootHasEvidence(configRoot, paths) || requiredMissing) return 'partial';
  return 'ready';
}

function warningsFor(
  spec: AgentRuntimeToolSpec,
  commandExists: boolean,
  paths: AgentRuntimePathObservation[],
): AgentRuntimeWarning[] {
  const warnings: AgentRuntimeWarning[] = [];
  if (spec.supported === false) {
    warnings.push({
      code: 'unsupported_tool',
      message: spec.unsupportedReason ?? `${spec.label} is not supported.`,
      severity: 'info',
    });
    return warnings;
  }

  const anyPathEvidence = hasAnyPathEvidence(paths);
  const configRoot = paths.find((path) => path.kind === 'config-root');
  const anyEvidence = commandExists || anyPathEvidence;

  if (commandExists && configRoot && !configRootHasEvidence(configRoot, paths)) {
    warnings.push({
      code: 'config_root_missing',
      message: `${spec.label} command is available but config root is missing.`,
      severity: 'warning',
      path: configRoot.path,
    });
  }

  if (!commandExists && anyPathEvidence) {
    warnings.push({
      code: 'command_missing',
      message: `${spec.label} config evidence exists but command is missing.`,
      severity: 'warning',
    });
  }

  for (const path of paths) {
    if (anyEvidence && path.required && !path.exists && !configRootHasEvidence(path.kind === 'config-root' ? path : undefined, paths)) {
      warnings.push({
        code: 'required_path_missing',
        message: `${spec.label} required path is missing.`,
        severity: 'warning',
        path: path.path,
      });
    }
    if (path.secretBearing && path.exists) {
      warnings.push({
        code: 'secret_file_not_parsed',
        message: `${spec.label} secret-bearing file is present but was not parsed.`,
        severity: 'info',
        path: path.path,
      });
    }
  }

  return warnings;
}

function buildRow(
  spec: AgentRuntimeToolSpec,
  snapshot: AgentRuntimeFilesystemSnapshot,
  options: AgentRuntimeScanOptions,
): AgentRuntimeToolRow {
  const existingPaths = new Set(snapshot.existingPaths.map(normalizePath));
  const availableCommands = new Set(snapshot.availableCommands.map((command) => command.trim()).filter(Boolean));
  const sessionRootChildCounts = Object.fromEntries(
    Object.entries(snapshot.sessionRootChildCounts ?? {}).map(([path, count]) => [normalizePath(path), count]),
  );
  const paths = spec.paths.map((pathSpec) => observePath(pathSpec, existingPaths, options, sessionRootChildCounts));
  const commandExists = commandAvailable(spec, availableCommands, paths);
  return {
    rowId: `agent-runtime:${spec.id}`,
    toolId: spec.id,
    label: spec.label,
    command: spec.command,
    commandAvailable: commandExists,
    status: statusFor(spec, commandExists, paths),
    capabilities: { ...spec.capabilities },
    paths,
    warnings: warningsFor(spec, commandExists, paths),
  };
}

export function scanAgentEnvironment(
  snapshot: AgentRuntimeFilesystemSnapshot,
  options: AgentRuntimeScanOptions,
): AgentRuntimeInventory {
  const specs = options.specs ?? DEFAULT_AGENT_TOOL_SPECS;
  return {
    rows: specs.map((spec) => buildRow(spec, snapshot, options)),
  };
}

export const __agentRuntimeScannerInternals = {
  normalizePath,
  expandPath,
};
