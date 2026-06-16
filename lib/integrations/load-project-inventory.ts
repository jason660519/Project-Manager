import { listProjectFiles, readFile, skillList, type FileNode } from '../bridge';
import { MEMORY_ARTIFACT_DEFS } from './memory-catalog';
import { mapMemoryRow, type MemoryScanResult } from './mappers/memory';
import { mapSlashCommandRow, type SlashCommandFile } from './mappers/commands';
import type { IntegrationRow } from './types';
import { parseFrontmatter } from '../skills/utils';

interface WorkflowExecutionRequestFile {
  id: string;
  workflowRunId: string;
  workItemId: string;
  nodeId: string;
  nodeTitle: string;
  actorKind: string;
  status: string;
  executionState: string;
  reviewStatus?: string;
  policyGate?: {
    state?: string;
    reason?: string;
  };
  requestedBy: string;
  requestedAt: string;
  capabilityId: string;
  executorResolution?: {
    state?: string;
    integrationSheet?: string;
    sourceKind?: string;
    sourceId?: string;
    commandPreview?: string;
  };
  memoryFiles?: string[];
  allowedTools?: string[];
  expectedHandoffArtifactId?: string;
  expectedEvidenceIds?: string[];
  safetyNotice?: string;
}

interface WorkflowExecutionRecordFile {
  id: string;
  requestId: string;
  workflowRunId: string;
  workItemId: string;
  nodeId: string;
  nodeTitle: string;
  draftId: string;
  status: string;
  consumedBy: string;
  consumedAt: string;
  executionState: string;
  capabilityId: string;
  workingDir?: string;
  commandPreview?: string;
  policyDecision?: {
    state?: string;
    reason?: string;
  };
  runnerResult?: {
    state?: string;
  };
  safetyNotice?: string;
}

async function probeMemoryFile(absPath: string): Promise<MemoryScanResult> {
  try {
    await readFile(absPath);
    return { absPath, exists: true, modified: '' };
  } catch {
    return { absPath, exists: false, modified: '' };
  }
}

export async function loadMemoryRows(projectRoot: string): Promise<IntegrationRow[]> {
  if (!projectRoot) {
    return MEMORY_ARTIFACT_DEFS.map((def) => mapMemoryRow(def, '', undefined));
  }
  const root = projectRoot.replace(/\/+$/, '');
  const rows: IntegrationRow[] = [];
  for (const def of MEMORY_ARTIFACT_DEFS) {
    const absPath = `${root}/${def.relPath}`;
    const scan = await probeMemoryFile(absPath);
    rows.push(mapMemoryRow(def, root, scan));
  }
  return rows;
}

function triggerFromCommandPath(relPath: string): string {
  const base = relPath.replace(/\\/g, '/').split('/').pop() ?? relPath;
  const stem = base.replace(/\.md$/i, '');
  return stem.startsWith('/') ? stem : `/${stem}`;
}

export async function loadSlashCommandRows(projectRoot: string): Promise<IntegrationRow[]> {
  if (!projectRoot) return [];
  const root = projectRoot.replace(/\/+$/, '');
  const commandsDir = `${root}/.claude/commands`;
  try {
    const files = await skillList(commandsDir);
    const parsed: SlashCommandFile[] = await Promise.all(
      files.map(async (f) => {
        let description = '';
        let name = f.relPath.replace(/\.md$/i, '');
        try {
          const raw = await readFile(f.absPath);
          const fm = parseFrontmatter(raw);
          description = fm.description;
          if (fm.name) name = fm.name;
        } catch {
          /* use defaults */
        }
        return {
          absPath: f.absPath,
          relPath: f.relPath,
          trigger: triggerFromCommandPath(f.relPath),
          name,
          description,
          modified: f.modified,
          size: f.size,
        };
      }),
    );
    parsed.sort((a, b) => a.trigger.localeCompare(b.trigger));
    return parsed.map((file) => mapSlashCommandRow(file, commandsDir));
  } catch {
    return [];
  }
}

export async function loadWorkflowExecutionRequestRows(projectRoot: string): Promise<IntegrationRow[]> {
  if (!projectRoot) return [];
  const root = projectRoot.replace(/\/+$/, '');
  const requestsDir = `${root}/.project-manager/project-workflow-execution-requests`;
  let files: FileNode[];
  try {
    files = await listProjectFiles(requestsDir, 1);
  } catch {
    return [];
  }
  const jsonFiles = flattenFileNodes(files).filter((file) => !file.isDir && file.name.endsWith('.json'));
  const rows = await Promise.all(
    jsonFiles.map(async (file) => {
      try {
        const parsed = JSON.parse(await readFile(file.path)) as Partial<WorkflowExecutionRequestFile>;
        if (!parsed.id || !parsed.workflowRunId || !parsed.workItemId || !parsed.nodeId) return null;
        return mapWorkflowExecutionRequestRow(parsed as WorkflowExecutionRequestFile, file.path);
      } catch {
        return null;
      }
    }),
  );
  return rows
    .filter((row): row is IntegrationRow => row !== null)
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
}

export async function loadWorkflowExecutionRecordRows(projectRoot: string): Promise<IntegrationRow[]> {
  if (!projectRoot) return [];
  const root = projectRoot.replace(/\/+$/, '');
  const recordsDir = `${root}/.project-manager/project-workflow-execution-records`;
  let files: FileNode[];
  try {
    files = await listProjectFiles(recordsDir, 1);
  } catch {
    return [];
  }
  const jsonFiles = flattenFileNodes(files).filter((file) => !file.isDir && file.name.endsWith('.json'));
  const rows = await Promise.all(
    jsonFiles.map(async (file) => {
      try {
        const parsed = JSON.parse(await readFile(file.path)) as Partial<WorkflowExecutionRecordFile>;
        if (!parsed.id || !parsed.requestId || !parsed.workflowRunId || !parsed.workItemId || !parsed.nodeId) {
          return null;
        }
        return mapWorkflowExecutionRecordRow(parsed as WorkflowExecutionRecordFile, file.path);
      } catch {
        return null;
      }
    }),
  );
  return rows
    .filter((row): row is IntegrationRow => row !== null)
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
}

function mapWorkflowExecutionRequestRow(
  request: WorkflowExecutionRequestFile,
  absPath: string,
): IntegrationRow {
  const commandPreview = request.executorResolution?.commandPreview;
  const integrationSheet = request.executorResolution?.integrationSheet;
  const reviewStatus = request.reviewStatus || request.policyGate?.state || 'review_required';
  const badges = [
    reviewStatus,
    request.executionState,
    integrationSheet,
    request.capabilityId,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  return {
    rowKey: `workflow-execution-request:${request.id}`,
    sheet: 'workflow-execution-requests',
    sourceKind: 'workflow-execution-request',
    sourceId: request.id,
    enabled: false,
    category1: 'Workflow Execution',
    category2: reviewStatus,
    githubUrl: '',
    company: 'Project Manager',
    name: `${request.workItemId} · ${request.nodeTitle || request.nodeId}`,
    version: 'schema v1',
    license: '',
    scope: 'project',
    port: '',
    installPath: absPath,
    installMethod: request.requestedBy,
    status: 'idle',
    statusLabel: request.status,
    lastUpdated: request.requestedAt,
    notes: [
      commandPreview ? `Command preview: ${commandPreview}` : 'No executor command registered.',
      request.safetyNotice,
    ].filter(Boolean).join(' '),
    lv: null,
    badges,
    payload: {
      ...request,
      absPath,
      commandPreview,
    },
  };
}

function mapWorkflowExecutionRecordRow(
  record: WorkflowExecutionRecordFile,
  absPath: string,
): IntegrationRow {
  const policyState = record.policyDecision?.state;
  const runnerState = record.runnerResult?.state;
  const badges = [
    record.status,
    record.executionState,
    policyState,
    runnerState,
    record.capabilityId,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  return {
    rowKey: `workflow-execution-record:${record.id}`,
    sheet: 'workflow-execution-records',
    sourceKind: 'workflow-execution-record',
    sourceId: record.id,
    enabled: false,
    category1: 'Workflow Execution Audit',
    category2: record.status,
    githubUrl: '',
    company: 'Project Manager',
    name: `${record.workItemId} · ${record.nodeTitle || record.nodeId}`,
    version: 'schema v1',
    license: '',
    scope: 'project',
    port: '',
    installPath: absPath,
    installMethod: record.consumedBy,
    status: 'idle',
    statusLabel: record.status,
    lastUpdated: record.consumedAt,
    notes: [
      record.commandPreview ? `Command preview: ${record.commandPreview}` : 'No executor command recorded.',
      record.policyDecision?.reason,
      record.safetyNotice,
    ].filter(Boolean).join(' '),
    lv: null,
    badges,
    payload: {
      ...record,
      absPath,
    },
  };
}

function flattenFileNodes(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) => [node, ...flattenFileNodes(node.children ?? [])]);
}
