import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

const MAX_SIZE_BYTES = 256 * 1024;

function isEnvFileName(name: string): boolean {
  return (
    name === '.env' ||
    name === '.envrc' ||
    name.startsWith('.env.') ||
    name === 'env' ||
    name === 'env.local'
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { root?: unknown } | null;
    const root = typeof body?.root === 'string' ? body.root.trim() : '';
    if (!root) {
      return NextResponse.json({ error: 'Missing project root' }, { status: 400 });
    }

    const rootStat = await stat(root).catch(() => null);
    if (!rootStat?.isDirectory()) {
      return NextResponse.json({ error: `Project root does not exist: ${root}` }, { status: 400 });
    }

    const entries = await readdir(root, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (!entry.isFile() || !isEnvFileName(entry.name)) continue;

      const path = join(root, entry.name);
      const fileStat = await stat(path).catch(() => null);
      if (!fileStat || fileStat.size > MAX_SIZE_BYTES) continue;

      const content = await readFile(path, 'utf8').catch(() => null);
      if (content == null) continue;

      files.push({
        path,
        name: basename(path),
        content,
      });
    }

    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
