import { NextRequest, NextResponse } from 'next/server';

interface GithubIssueResponse {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  labels: string[];
  createdAt: string;
  updatedAt: string;
  url: string;
  user?: string;
}

interface RequestBody {
  repoUrl: string;
}

interface GitHubApiIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: { name: string }[];
  created_at: string;
  updated_at: string;
  html_url: string;
  user: { login: string } | null;
}

/**
 * Proxy GitHub Issues REST API call from the Next.js server layer so
 * the GITHUB_TOKEN never touches browser JS. Used only in browser/dev mode.
 * Tauri mode calls the Rust `fetch_github_issues` command directly via IPC.
 */
export async function POST(request: NextRequest) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN not set in server environment' },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null) as RequestBody | null;
  if (!body?.repoUrl) {
    return NextResponse.json({ error: 'repoUrl is required' }, { status: 400 });
  }

  // Parse owner/repo from the URL
  const normalizedRepoUrl = body.repoUrl.trim().replace(/\/+$/, '').replace(/\.git$/, '');
  const parts = normalizedRepoUrl.split('/');
  if (parts.length < 2) {
    return NextResponse.json(
      { error: `Invalid GitHub URL: ${body.repoUrl}` },
      { status: 400 },
    );
  }
  const owner = parts[parts.length - 2];
  const repo = parts[parts.length - 1];

  try {
    // Fetch open issues from GitHub REST API
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100&sort=updated&direction=desc`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'ProjectManager/0.1.0',
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `GitHub API ${res.status}: ${text}` },
        { status: res.status },
      );
    }

    const data = (await res.json()) as GitHubApiIssue[];

    // Map REST API to our GithubIssue shape
    // Filter out pull requests (GitHub REST API returns PRs alongside issues)
    const issues: GithubIssueResponse[] = data
      .filter((item) => !('pull_request' in item))
      .map((item) => ({
        id: item.number,
        number: item.number,
        title: item.title,
        body: item.body ?? undefined,
        state: item.state as 'open' | 'closed',
        labels: item.labels.map((l) => l.name),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        url: item.html_url,
        user: item.user?.login ?? undefined,
      }));

    return NextResponse.json(issues);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `GitHub request failed: ${message}` }, { status: 500 });
  }
}
