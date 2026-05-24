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
  pull_request?: unknown;
}

const GITHUB_ISSUE_PAGE_SIZE = 100;
const GITHUB_ISSUE_PAGE_LIMIT = 10;

function parseGithubOwnerRepo(repoUrl: string): { owner: string; repo: string } | null {
  const normalizedRepoUrl = repoUrl.trim().replace(/\/+$/, '').replace(/\.git$/, '');
  try {
    const parsed = new URL(normalizedRepoUrl);
    if (parsed.hostname !== 'github.com') return null;
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
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

  const parsedRepo = parseGithubOwnerRepo(body.repoUrl);
  if (!parsedRepo) {
    return NextResponse.json(
      { error: `Invalid GitHub URL: ${body.repoUrl}. Use https://github.com/owner/repo.` },
      { status: 400 },
    );
  }
  const { owner, repo } = parsedRepo;

  try {
    const data: GitHubApiIssue[] = [];
    let page = 1;
    let truncated = false;

    while (true) {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=${GITHUB_ISSUE_PAGE_SIZE}&page=${page}&sort=updated&direction=desc`,
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

      const pageData = (await res.json()) as GitHubApiIssue[];
      data.push(...pageData);
      if (pageData.length < GITHUB_ISSUE_PAGE_SIZE) break;
      if (page >= GITHUB_ISSUE_PAGE_LIMIT) {
        truncated = true;
        break;
      }
      page += 1;
    }

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

    return NextResponse.json(issues, {
      headers: truncated ? { 'X-Project-Manager-Truncated': 'true' } : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `GitHub request failed: ${message}` }, { status: 500 });
  }
}
