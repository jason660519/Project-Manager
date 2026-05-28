import {
  listProjectFiles,
  readFile,
  writeFile,
  type FileNode,
} from '../bridge';
import type { AgentWorkflowRun } from './dagTypes';

export interface AgentWorkflowRunStoreAdapter {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  listProjectFiles: (root: string, maxDepth?: number) => Promise<FileNode[]>;
}

const DEFAULT_STORE_ADAPTER: AgentWorkflowRunStoreAdapter = {
  readFile,
  writeFile,
  listProjectFiles,
};

function trimTrailingSlash(path: string): string {
  return path.replace(/\/+$/, '');
}

function safeFileSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

export function workflowRunsDirectory(projectRoot: string): string {
  return `${trimTrailingSlash(projectRoot)}/.project-manager/workflow-runs`;
}

export function workflowRunPath(projectRoot: string, workflowRunId: string): string {
  return `${workflowRunsDirectory(projectRoot)}/${safeFileSegment(workflowRunId)}.json`;
}

export function serializeAgentWorkflowRun(run: AgentWorkflowRun): string {
  return `${JSON.stringify(run, null, 2)}\n`;
}

export function parseAgentWorkflowRun(raw: string): AgentWorkflowRun {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('WorkflowRun file must contain a JSON object.');
  }
  const run = parsed as Partial<AgentWorkflowRun>;
  if (!run.id || !run.workflowId || !Array.isArray(run.nodeRuns)) {
    throw new Error('WorkflowRun file is missing id, workflowId, or nodeRuns.');
  }
  return run as AgentWorkflowRun;
}

export async function saveAgentWorkflowRun(
  projectRoot: string,
  run: AgentWorkflowRun,
  adapter: AgentWorkflowRunStoreAdapter = DEFAULT_STORE_ADAPTER,
): Promise<string> {
  const path = workflowRunPath(projectRoot, run.id);
  await adapter.writeFile(path, serializeAgentWorkflowRun(run));
  return path;
}

export async function readAgentWorkflowRun(
  projectRoot: string,
  workflowRunId: string,
  adapter: AgentWorkflowRunStoreAdapter = DEFAULT_STORE_ADAPTER,
): Promise<AgentWorkflowRun> {
  const raw = await adapter.readFile(workflowRunPath(projectRoot, workflowRunId));
  return parseAgentWorkflowRun(raw);
}

export async function listAgentWorkflowRuns(
  projectRoot: string,
  adapter: AgentWorkflowRunStoreAdapter = DEFAULT_STORE_ADAPTER,
): Promise<AgentWorkflowRun[]> {
  const files = await adapter.listProjectFiles(workflowRunsDirectory(projectRoot), 1).catch(() => []);
  const jsonFiles = flattenFileNodes(files).filter((file) => !file.isDir && file.name.endsWith('.json'));
  const runs = await Promise.all(
    jsonFiles.map(async (file) => {
      try {
        return parseAgentWorkflowRun(await adapter.readFile(file.path));
      } catch {
        return null;
      }
    }),
  );
  return runs
    .filter((run): run is AgentWorkflowRun => run !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function flattenFileNodes(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) => [node, ...flattenFileNodes(node.children ?? [])]);
}
