import { buildAgentRuntimeSnapshot } from '../bridge';
import { scanAgentEnvironment } from './environmentScanner';
import type {
  AgentRuntimeFilesystemSnapshot,
  AgentRuntimeInventory,
  AgentRuntimeScanOptions,
  AgentRuntimeToolSpec,
} from './types';

export type AgentRuntimeInventoryDiagnosticSeverity = 'info' | 'warning' | 'error';

export interface AgentRuntimeInventoryDiagnostic {
  code: 'snapshot_load_failed' | 'session_target_list_failed';
  severity: AgentRuntimeInventoryDiagnosticSeverity;
  message: string;
}

export interface AgentRuntimeInventoryServiceOptions {
  homeDir?: string;
  projectRoot?: string;
  specs?: AgentRuntimeToolSpec[];
  snapshotLoader?: (projectRoot?: string) => Promise<AgentRuntimeFilesystemSnapshot>;
  now?: () => Date;
}

export interface AgentRuntimeInventoryServiceResult {
  inventory: AgentRuntimeInventory;
  snapshot: AgentRuntimeFilesystemSnapshot;
  diagnostics: AgentRuntimeInventoryDiagnostic[];
  loadedAt: string;
}

const EMPTY_SNAPSHOT: AgentRuntimeFilesystemSnapshot = {
  existingPaths: [],
  availableCommands: [],
};

function messageFromError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return 'Failed to load agent runtime snapshot.';
}

function sanitizeSnapshot(snapshot: AgentRuntimeFilesystemSnapshot): AgentRuntimeFilesystemSnapshot {
  return {
    existingPaths: [...snapshot.existingPaths],
    availableCommands: [...snapshot.availableCommands],
    ...(snapshot.homeDir ? { homeDir: snapshot.homeDir } : {}),
    ...(snapshot.projectRoot ? { projectRoot: snapshot.projectRoot } : {}),
  };
}

export async function loadAgentRuntimeInventory(
  options: AgentRuntimeInventoryServiceOptions,
): Promise<AgentRuntimeInventoryServiceResult> {
  const diagnostics: AgentRuntimeInventoryDiagnostic[] = [];
  const snapshotLoader = options.snapshotLoader ?? buildAgentRuntimeSnapshot;
  let snapshot: AgentRuntimeFilesystemSnapshot;

  try {
    snapshot = sanitizeSnapshot(await snapshotLoader(options.projectRoot));
  } catch (error) {
    snapshot = EMPTY_SNAPSHOT;
    diagnostics.push({
      code: 'snapshot_load_failed',
      severity: 'error',
      message: messageFromError(error),
    });
  }

  const scanOptions: AgentRuntimeScanOptions = {
    homeDir: options.homeDir ?? snapshot.homeDir ?? '',
    projectRoot: options.projectRoot ?? snapshot.projectRoot ?? '',
    specs: options.specs,
  };

  return {
    inventory: scanAgentEnvironment(snapshot, scanOptions),
    snapshot,
    diagnostics,
    loadedAt: (options.now ?? (() => new Date()))().toISOString(),
  };
}
