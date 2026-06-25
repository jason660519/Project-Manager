import type {
  AgentRuntimeInventoryDiagnostic,
  AgentRuntimeInventoryServiceResult,
  AgentRuntimePathObservation,
  AgentRuntimeToolRow,
} from '../../agent-runtime';
import type {
  AgentRuntimeRedactedSessionTargetListResult,
  AgentRuntimeSessionTargetListRequest,
} from '../../bridge';
import type { IntegrationRow, IntegrationStatus } from '../types';

export type AgentRuntimeSessionTargetLister = (
  request: AgentRuntimeSessionTargetListRequest,
) => Promise<AgentRuntimeRedactedSessionTargetListResult>;

export interface AgentRuntimeSessionTargetHydrationOptions {
  maxTargets?: number;
  maxDepth?: number;
}

export interface AgentRuntimeSessionTargetHydrationResult {
  rows: IntegrationRow[];
  diagnostics: AgentRuntimeInventoryDiagnostic[];
}

function statusFor(row: AgentRuntimeToolRow): IntegrationStatus {
  if (row.status === 'ready') return 'installed';
  if (row.status === 'partial') return 'warning';
  if (row.status === 'missing') return 'not_installed';
  return 'unavailable';
}

function statusLabelFor(row: AgentRuntimeToolRow): string {
  if (row.status === 'ready') return 'Ready';
  if (row.status === 'partial') return 'Partial';
  if (row.status === 'missing') return 'Missing';
  return 'Unsupported';
}

function categoryFor(row: AgentRuntimeToolRow): string {
  return statusLabelFor(row);
}

function capabilityBadges(row: AgentRuntimeToolRow): string[] {
  return Object.entries(row.capabilities)
    .filter(([, enabled]) => enabled)
    .map(([capability]) => capability);
}

function primaryPath(paths: AgentRuntimePathObservation[]): string {
  return (
    paths.find((path) => path.kind === 'config-root' && path.exists)?.path ??
    paths.find((path) => path.exists && !path.secretBearing)?.path ??
    paths.find((path) => path.exists)?.path ??
    ''
  );
}

function notesFor(row: AgentRuntimeToolRow): string {
  const existingPathCount = row.paths.filter((path) => path.exists).length;
  if (row.status === 'missing') {
    return 'No command or non-secret path evidence detected.';
  }
  const warningSuffix = row.warnings.length > 0 ? ` ${row.warnings.length} warning(s).` : '';
  const commandLabel = row.command
    ? row.commandAvailable
      ? `${row.command} command available.`
      : `${row.command} command missing.`
    : 'No command configured.';
  return `${commandLabel} ${existingPathCount} path evidence item(s).${warningSuffix}`.trim();
}

function installMethodFor(row: AgentRuntimeToolRow): string {
  if (row.commandAvailable) return 'system_path';
  if (row.paths.some((path) => path.kind === 'binary' && path.exists)) return 'local_file';
  return 'manual';
}

export function mapAgentRuntimeInventoryRows(result: AgentRuntimeInventoryServiceResult): IntegrationRow[] {
  return result.inventory.rows.map((row) => {
    const warningBadge = row.warnings.length > 0 ? [`${row.warnings.length} warning`] : [];
    const diagnosticsBadge = result.diagnostics.length > 0 ? [`${result.diagnostics.length} diagnostic`] : [];
    return {
      rowKey: row.rowId,
      sheet: 'agent-runtime',
      sourceKind: 'agent-runtime',
      sourceId: row.toolId,
      enabled: row.status === 'ready' || row.status === 'partial',
      category1: 'Agent Runtime',
      category2: categoryFor(row),
      githubUrl: '',
      company: 'Local',
      name: row.label,
      version: '',
      license: '',
      scope: 'user',
      port: '',
      installPath: primaryPath(row.paths),
      installMethod: installMethodFor(row),
      status: statusFor(row),
      statusLabel: statusLabelFor(row),
      lastUpdated: result.loadedAt,
      notes: notesFor(row),
      lv: null,
      badges: [...capabilityBadges(row), ...warningBadge, ...diagnosticsBadge],
      payload: {
        agentRuntime: {
          rowId: row.rowId,
          toolId: row.toolId,
          label: row.label,
          command: row.command,
          commandAvailable: row.commandAvailable,
          status: row.status,
          capabilities: row.capabilities,
          paths: row.paths,
          warnings: row.warnings,
        },
        diagnostics: result.diagnostics,
        loadedAt: result.loadedAt,
      },
    };
  });
}

function existingSessionRoots(row: IntegrationRow): string[] {
  const runtimePayload = row.payload.agentRuntime;
  if (!runtimePayload || typeof runtimePayload !== 'object' || !('paths' in runtimePayload)) return [];
  const paths = (runtimePayload as { paths?: unknown }).paths;
  if (!Array.isArray(paths)) return [];

  return paths
    .filter((path): path is AgentRuntimePathObservation => {
      if (!path || typeof path !== 'object') return false;
      const candidate = path as Partial<AgentRuntimePathObservation>;
      return candidate.kind === 'sessions-root' && candidate.exists === true && typeof candidate.path === 'string';
    })
    .map((path) => path.path);
}

function blockedDiagnostic(row: IntegrationRow, result: AgentRuntimeRedactedSessionTargetListResult): AgentRuntimeInventoryDiagnostic {
  const reason = result.blockedReasons.find((blockedReason) => blockedReason.trim()) ?? 'No target metadata returned.';
  return {
    code: 'session_target_list_failed',
    severity: 'warning',
    message: `Session target listing blocked for ${row.name}: ${reason}`,
  };
}

function thrownDiagnostic(row: IntegrationRow): AgentRuntimeInventoryDiagnostic {
  return {
    code: 'session_target_list_failed',
    severity: 'warning',
    message: `Session target listing failed for ${row.name}; error details redacted.`,
  };
}

export async function hydrateAgentRuntimeRowsWithSessionTargets(
  rows: IntegrationRow[],
  lister: AgentRuntimeSessionTargetLister,
  options: AgentRuntimeSessionTargetHydrationOptions = {},
): Promise<AgentRuntimeSessionTargetHydrationResult> {
  const maxTargets = options.maxTargets ?? 20;
  const maxDepth = options.maxDepth ?? 1;
  const diagnostics: AgentRuntimeInventoryDiagnostic[] = [];
  let changed = false;

  const hydratedRows = await Promise.all(
    rows.map(async (row) => {
      if (row.sourceKind !== 'agent-runtime') return row;

      const rootPaths = existingSessionRoots(row);
      if (rootPaths.length === 0) return row;

      try {
        const result = await lister({
          approved: true,
          rootPaths,
          maxTargets,
          maxDepth,
        });
        if (result.status !== 'ready') {
          diagnostics.push(blockedDiagnostic(row, result));
          return row;
        }

        changed = true;
        return {
          ...row,
          payload: {
            ...row.payload,
            agentRuntime: {
              ...(row.payload.agentRuntime && typeof row.payload.agentRuntime === 'object'
                ? row.payload.agentRuntime
                : {}),
              sessionTargets: result.targets,
            },
          },
        };
      } catch {
        diagnostics.push(thrownDiagnostic(row));
        return row;
      }
    }),
  );

  return {
    rows: changed ? hydratedRows : rows,
    diagnostics,
  };
}
