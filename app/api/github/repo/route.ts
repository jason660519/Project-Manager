import { NextRequest, NextResponse } from 'next/server';
import { fetchGithubFeatures } from '../lib';

/**
 * POST /api/github/repo
 *
 * Fetches GitHub repo PRs/issues via GraphQL and maps them to features.
 * Used by F04 (Add Project by GitHub URL) in browser mode.
 * Separate from /api/github/sync (F15) which uses REST API for issues only.
 */
export async function POST(request: NextRequest) {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN not set in server environment' },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null) as { repoUrl?: string } | null;
  if (!body?.repoUrl) {
    return NextResponse.json(
      { error: 'repoUrl is required in request body' },
      { status: 400 },
    );
  }

  try {
    const features = await fetchGithubFeatures(token, body.repoUrl);
    return NextResponse.json({ features });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
