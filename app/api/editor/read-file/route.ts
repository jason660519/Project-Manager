import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = '/Volumes/KLEVV-4T-1/Project-Manager';
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

export async function POST(request: NextRequest) {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const filePath = body.path;

    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid "path" in request body' }, { status: 400 });
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

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: 'Path is not a file' }, { status: 400 });
    }

    // Enforce max file size
    if (stat.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (${stat.size} bytes). Maximum is ${MAX_FILE_SIZE} bytes` },
        { status: 400 },
      );
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');

    return NextResponse.json({
      content,
      size: stat.size,
    });
  } catch (err: any) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: `Failed to read file: ${err.message}` }, { status: 500 });
  }
}
