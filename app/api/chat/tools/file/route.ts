import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';

const MAX_FILE_SIZE = 100 * 1024; // 100 KB
const ALLOWED_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.css',
  '.html', '.yml', '.yaml', '.toml', '.env', '.gitignore', '.csv', '.log',
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { path?: string; root?: string } | null;
    if (!body?.path) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }

    const root = body.root || process.cwd();

    // Resolve and validate path
    const targetPath = resolve(root, body.path);

    // Security: ensure path is within root
    if (!targetPath.startsWith(resolve(root))) {
      return NextResponse.json({ error: 'Path traversal denied' }, { status: 403 });
    }

    if (!existsSync(targetPath)) {
      return NextResponse.json({ error: `File not found: ${body.path}` }, { status: 404 });
    }

    const stat = statSync(targetPath);
    if (stat.isDirectory()) {
      return NextResponse.json({ error: 'Path is a directory, not a file' }, { status: 400 });
    }

    if (stat.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `File too large (${(stat.size / 1024).toFixed(1)} KB). Max: ${MAX_FILE_SIZE / 1024} KB.`,
      }, { status: 413 });
    }

    // Check extension for text files
    const ext = '.' + body.path.split('.').pop()?.toLowerCase();
    const isText = ALLOWED_EXTENSIONS.includes(ext) || !ext;

    if (!isText) {
      return NextResponse.json({
        content: `[Binary file: ${body.path} (${ext}, ${(stat.size / 1024).toFixed(1)} KB)]`,
      });
    }

    const content = readFileSync(targetPath, 'utf-8');
    const lines = content.split('\n');

    // Syntax highlight hint based on extension
    const langMap: Record<string, string> = {
      '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
      '.json': 'json', '.md': 'markdown', '.css': 'css', '.html': 'html',
      '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'toml',
    };
    const lang = langMap[ext] || '';

    return NextResponse.json({
      content: `\`\`\`${lang}\n${content.slice(0, 50000)}\n\`\`\``,
      path: body.path,
      lines: lines.length,
      size: stat.size,
    });
  } catch (e) {
    return NextResponse.json({ error: `Read failed: ${(e as Error).message}` }, { status: 500 });
  }
}
