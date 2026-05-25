import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { query?: string; root?: string } | null;
    if (!body?.query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const root = body.root || process.cwd();
    const query = body.query.replace(/['";&|`$]/g, ''); // basic sanitization

    // Use ripgrep if available, fallback to grep
    let output: string;
    try {
      output = execSync(`rg --no-heading -n -i --max-count 20 "${query}" "${root}/app" "${root}/lib" "${root}/components" 2>/dev/null`, {
        encoding: 'utf-8',
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });
    } catch {
      // rg not found or no results
      try {
        output = execSync(`grep -rn -i --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" "${query}" "${root}" 2>/dev/null | head -30`, {
          encoding: 'utf-8',
          timeout: 10000,
          maxBuffer: 1024 * 1024,
        });
      } catch {
        return NextResponse.json({ content: 'No results found.', results: 0 });
      }
    }

    if (!output.trim()) {
      return NextResponse.json({ content: 'No results found.', results: 0 });
    }

    const lines = output.trim().split('\n');
    // Format results nicely
    const formatted = lines.map((line) => {
      // Strip the root path for readability
      const clean = line.replace(root, '').replace(/^\/?/, '');
      return `- \`${clean}\``;
    }).join('\n');

    return NextResponse.json({
      content: formatted,
      results: lines.length,
      raw: lines.slice(0, 30),
    });
  } catch (e) {
    return NextResponse.json({ error: `Search failed: ${(e as Error).message}` }, { status: 500 });
  }
}
