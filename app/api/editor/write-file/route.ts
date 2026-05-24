import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = '/Volumes/KLEVV-4T-1/Project-Manager';

export async function POST(request: NextRequest) {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { path: filePath, content } = body;

    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid "path" in request body' }, { status: 400 });
    }

    if (content === undefined || content === null) {
      return NextResponse.json({ error: 'Missing "content" in request body' }, { status: 400 });
    }

    // Resolve to absolute path and verify it's under the project root
    const absolutePath = path.resolve(filePath);
    const normalizedRoot = path.resolve(PROJECT_ROOT);

    if (!absolutePath.startsWith(normalizedRoot + path.sep) && absolutePath !== normalizedRoot) {
      return NextResponse.json(
        { error: 'Access denied: path is outside the project directory' },
        { status: 403 },
      );
    }

    // Create parent directories if they don't exist
    const dir = path.dirname(absolutePath);
    fs.mkdirSync(dir, { recursive: true });

    // Write the file
    fs.writeFileSync(absolutePath, content, 'utf-8');

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: `Failed to write file: ${err.message}` }, { status: 500 });
  }
}
