export type AgentRuntimeToolStatus = 'ready' | 'partial' | 'missing' | 'unsupported';

export type AgentRuntimeCapability = 'runtime' | 'mcp' | 'skills' | 'sessions' | 'cost';

export type AgentRuntimePathKind =
  | 'config-root'
  | 'config-file'
  | 'mcp-file'
  | 'skills-root'
  | 'sessions-root'
  | 'binary'
  | 'secret-file';

export type AgentRuntimeWarningSeverity = 'info' | 'warning' | 'error';

export interface AgentRuntimeCapabilities {
  runtime: boolean;
  mcp: boolean;
  skills: boolean;
  sessions: boolean;
  cost: boolean;
}

export interface AgentRuntimePathSpec {
  kind: AgentRuntimePathKind;
  path: string;
  required?: boolean;
  secretBearing?: boolean;
}

export interface AgentRuntimeToolSpec {
  id: string;
  label: string;
  command?: string;
  supported?: boolean;
  unsupportedReason?: string;
  capabilities: AgentRuntimeCapabilities;
  paths: AgentRuntimePathSpec[];
}

export interface AgentRuntimeFilesystemSnapshot {
  existingPaths: string[];
  availableCommands: string[];
  homeDir?: string;
  projectRoot?: string;
  sessionRootChildCounts?: Record<string, number>;
  /**
   * Accepted by the type so fixture builders can model risky inputs.
   * The scanner deliberately never reads or emits this content.
   */
  fileContents?: Record<string, string>;
}

export interface AgentRuntimeScanOptions {
  homeDir: string;
  projectRoot: string;
  specs?: AgentRuntimeToolSpec[];
}

export interface AgentRuntimePathObservation {
  kind: AgentRuntimePathKind;
  path: string;
  exists: boolean;
  required: boolean;
  secretBearing: boolean;
  childCount?: number;
}

export interface AgentRuntimeWarning {
  code:
    | 'unsupported_tool'
    | 'config_root_missing'
    | 'command_missing'
    | 'required_path_missing'
    | 'secret_file_not_parsed';
  message: string;
  severity: AgentRuntimeWarningSeverity;
  path?: string;
}

export interface AgentRuntimeToolRow {
  rowId: string;
  toolId: string;
  label: string;
  command?: string;
  commandAvailable: boolean;
  status: AgentRuntimeToolStatus;
  capabilities: AgentRuntimeCapabilities;
  paths: AgentRuntimePathObservation[];
  warnings: AgentRuntimeWarning[];
}

export interface AgentRuntimeInventory {
  rows: AgentRuntimeToolRow[];
}
