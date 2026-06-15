import {
  listProjectFiles,
  readFile,
  writeFile,
  type FileNode,
} from '../bridge';
import type { ProjectWorkflowRun } from './projectWorkflowEngine';

export interface ProjectWorkflowRunStoreAdapter {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  listProjectFiles: (root: string, maxDepth?: number) => Promise<FileNode[]>;
}

const DEFAULT_STORE_ADAPTER: ProjectWorkflowRunStoreAdapter = {
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

export function projectWorkflowRunsDirectory(projectRoot: string): string {
  return `${trimTrailingSlash(projectRoot)}/.project-manager/project-workflow-runs`;
}

export function projectWorkflowRunPath(projectRoot: string, workflowRunId: string): string {
  return `${projectWorkflowRunsDirectory(projectRoot)}/${safeFileSegment(workflowRunId)}.json`;
}

export function serializeProjectWorkflowRun(run: ProjectWorkflowRun): string {
  return `${JSON.stringify(run, null, 2)}\n`;
}

export function parseProjectWorkflowRun(raw: string): ProjectWorkflowRun {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('ProjectWorkflowRun file must contain a JSON object.');
  }
  const run = parsed as Partial<ProjectWorkflowRun>;
  if (!run.id || !run.templateId || !Array.isArray(run.nodeRuns)) {
    throw new Error('ProjectWorkflowRun file is missing id, templateId, or nodeRuns.');
  }
  return run as ProjectWorkflowRun;
}

export async function saveProjectWorkflowRun(
  projectRoot: string,
  run: ProjectWorkflowRun,
  adapter: ProjectWorkflowRunStoreAdapter = DEFAULT_STORE_ADAPTER,
): Promise<string> {
  const path = projectWorkflowRunPath(projectRoot, run.id);
  await adapter.writeFile(path, serializeProjectWorkflowRun(run));
  return path;
}

export async function readProjectWorkflowRun(
  projectRoot: string,
  workflowRunId: string,
  adapter: ProjectWorkflowRunStoreAdapter = DEFAULT_STORE_ADAPTER,
): Promise<ProjectWorkflowRun> {
  const raw = await adapter.readFile(projectWorkflowRunPath(projectRoot, workflowRunId));
  return parseProjectWorkflowRun(raw);
}

export async function listProjectWorkflowRuns(
  projectRoot: string,
  adapter: ProjectWorkflowRunStoreAdapter = DEFAULT_STORE_ADAPTER,
): Promise<ProjectWorkflowRun[]> {
  const files = await adapter.listProjectFiles(projectWorkflowRunsDirectory(projectRoot), 1).catch(() => []);
  const jsonFiles = flattenFileNodes(files).filter((file) => !file.isDir && file.name.endsWith('.json'));
  const runs = await Promise.all(
    jsonFiles.map(async (file) => {
      try {
        return parseProjectWorkflowRun(await adapter.readFile(file.path));
      } catch {
        return null;
      }
    }),
  );
  return runs
    .filter((run): run is ProjectWorkflowRun => run !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function flattenFileNodes(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) => [node, ...flattenFileNodes(node.children ?? [])]);
}
