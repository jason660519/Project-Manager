import {
  ExecutionContext,
  ExecutionResult,
  IDEAdapterConfig,
  RuntimeAdapter,
} from '../types';

function isAbsoluteLike(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:\//.test(path);
}

function normalizePortablePath(input: string): string {
  const path = input.trim().replace(/\\/g, '/');
  const driveMatch = path.match(/^([A-Za-z]:)(\/.*)?$/);
  const drive = driveMatch?.[1] ?? '';
  const body = driveMatch ? (driveMatch[2] ?? '/') : path;
  const absolute = body.startsWith('/');
  const parts: string[] = [];

  for (const segment of body.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (parts.length > 0) {
        parts.pop();
      } else if (!absolute) {
        parts.push(segment);
      }
      continue;
    }
    parts.push(segment);
  }

  const prefix = drive || (absolute ? '/' : '');
  const joined = parts.join('/');
  if (!joined) return prefix || '.';
  return `${prefix}${prefix && !prefix.endsWith('/') ? '/' : ''}${joined}`;
}

function resolveProjectPath(projectRoot: string, filePath: string): { root: string; fullPath: string } {
  const root = normalizePortablePath(projectRoot || '.');
  const candidate = filePath.trim() || '.';
  const fullPath = isAbsoluteLike(candidate)
    ? normalizePortablePath(candidate)
    : normalizePortablePath(`${root}/${candidate}`);
  return { root, fullPath };
}

export class LocalIDEAdapter implements RuntimeAdapter {
  id: string;
  name: string;
  type: 'ide' = 'ide';
  private command: string;

  constructor(config: IDEAdapterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.command = config.command;
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { feature, projectRoot } = context;
    const filePath = feature.paths.implementation || feature.paths.tdd || feature.paths.spec || '.';

    const { root: normalizedRoot, fullPath } = resolveProjectPath(projectRoot, filePath);

    const insideRoot =
      normalizedRoot === '/'
        ? fullPath.startsWith('/')
        : fullPath === normalizedRoot || fullPath.startsWith(`${normalizedRoot}/`);

    if (!insideRoot) {
      return { success: false, message: '路徑超出專案根目錄，已拒絕執行' };
    }

    return {
      success: true,
      message: `已嘗試在 ${this.name} 中開啟 ${filePath}`,
      command: this.command,
      args: [fullPath],
      dryRun: true,
      logs: `Dry run: ${this.command} ${JSON.stringify(fullPath)}`,
    };
  }
}
