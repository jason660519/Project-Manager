import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(/* turbopackIgnore: true */ process.cwd());
const PRUNED_DIRS = new Set(['.git', 'node_modules', 'target', '.next', 'out', 'dist']);

interface FileNodeResponse {
  name: string;
  path: string;
  isDir: boolean;
  children: FileNodeResponse[];
}

function assertUnderProjectRoot(targetPath: string): string {
  const absolutePath = path.resolve(targetPath);
  const normalizedRoot = PROJECT_ROOT;
  if (!absolutePath.startsWith(normalizedRoot + path.sep) && absolutePath !== normalizedRoot) {
    throw new Error('Access denied: path is outside the project directory');
  }
  return absolutePath;
}

function listNode(targetPath: string, depthRemaining: number): FileNodeResponse {
  const stat = fs.statSync(targetPath);
  const node: FileNodeResponse = {
    name: path.basename(targetPath),
    path: targetPath,
    isDir: stat.isDirectory(),
    children: [],
  };
  if (!node.isDir || depthRemaining <= 0 || PRUNED_DIRS.has(node.name)) {
    return node;
  }
  node.children = fs
    .readdirSync(targetPath)
    .sort((a, b) => a.localeCompare(b))
    .map((childName) => listNode(path.join(targetPath, childName), depthRemaining - 1));
  return node;
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const root = body.root;
    const maxDepth = Number.isInteger(body.maxDepth) ? Number(body.maxDepth) : 4;

    if (!root || typeof root !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid "root" in request body' }, { status: 400 });
    }
    if (maxDepth < 0 || maxDepth > 8) {
      return NextResponse.json({ error: 'maxDepth must be between 0 and 8' }, { status: 400 });
    }

    const absoluteRoot = assertUnderProjectRoot(root);
    if (!fs.existsSync(absoluteRoot)) {
      return NextResponse.json({ nodes: [] });
    }
    const rootStat = fs.statSync(absoluteRoot);
    if (!rootStat.isDirectory()) {
      return NextResponse.json({ error: 'Root is not a directory' }, { status: 400 });
    }

    const nodes = fs
      .readdirSync(absoluteRoot)
      .sort((a, b) => a.localeCompare(b))
      .map((childName) => listNode(path.join(absoluteRoot, childName), maxDepth - 1));
    return NextResponse.json({ nodes });
  } catch (err: unknown) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Failed to list files';
    const status = message.startsWith('Access denied') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
