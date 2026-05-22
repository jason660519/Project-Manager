import { NextRequest, NextResponse } from 'next/server';

interface IssuePayload {
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

interface GitHubApiIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: Array<{ name: string }>;
  created_at: string;
  updated_at: string;
  html_url: string;
  user: { login: string } | null;
}

interface IssueActionBody {
  action: 'create' | 'update' | 'comment' | 'close_with_comment' | 'reopen_with_comment' | 'fetch_comments';
  repoUrl: string;
  issueNumber?: number;
  title?: string;
  body?: string;
  comment?: string;
}

interface GitHubApiComment {
  id: number;
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  user: { login: string } | null;
}

interface IssueCommentPayload {
  id: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  user?: string;
}

function parseOwnerRepo(repoUrl: string): { owner: string; repo: string } {
  const normalizedRepoUrl = repoUrl.trim().replace(/\/+$/, '').replace(/\.git$/, '');
  const parts = normalizedRepoUrl.split('/');
  if (parts.length < 2 || !normalizedRepoUrl.includes('github.com')) {
    throw new Error(`Invalid GitHub URL: ${repoUrl}`);
  }
  return { owner: parts[parts.length - 2]!, repo: parts[parts.length - 1]! };
}

function toIssuePayload(issue: GitHubApiIssue): IssuePayload {
  return {
    id: issue.id ?? issue.number,
    number: issue.number,
    title: issue.title,
    body: issue.body ?? undefined,
    state: issue.state === 'closed' ? 'closed' : 'open',
    labels: (issue.labels ?? []).map((l) => l.name),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    url: issue.html_url,
    user: issue.user?.login ?? undefined,
  };
}

function toIssueCommentPayload(comment: GitHubApiComment): IssueCommentPayload {
  return {
    id: comment.id,
    body: comment.body ?? '',
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    url: comment.html_url,
    user: comment.user?.login ?? undefined,
  };
}

async function githubRequest<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ProjectManager/0.1.0',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function POST(request: NextRequest) {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'GITHUB_TOKEN not set in server environment' }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as IssueActionBody | null;
  if (!body?.repoUrl || !body?.action) {
    return NextResponse.json({ error: 'action and repoUrl are required' }, { status: 400 });
  }

  const { owner, repo } = parseOwnerRepo(body.repoUrl);
  const baseIssueUrl = `https://api.github.com/repos/${owner}/${repo}/issues`;

  try {
    if (body.action === 'create') {
      if (!body.title?.trim()) {
        return NextResponse.json({ error: 'title is required for create action' }, { status: 400 });
      }
      const created = await githubRequest<GitHubApiIssue>(token, baseIssueUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: body.title.trim(), body: body.body ?? '' }),
      });
      return NextResponse.json(toIssuePayload(created));
    }

    if (!body.issueNumber || !Number.isFinite(body.issueNumber)) {
      return NextResponse.json({ error: 'issueNumber is required' }, { status: 400 });
    }

    if (body.action === 'fetch_comments') {
      const comments = await githubRequest<GitHubApiComment[]>(
        token,
        `${baseIssueUrl}/${body.issueNumber}/comments?per_page=30&sort=updated&direction=desc`,
        { method: 'GET' },
      );
      return NextResponse.json(comments.map(toIssueCommentPayload));
    }

    if (body.action === 'update') {
      const updated = await githubRequest<GitHubApiIssue>(token, `${baseIssueUrl}/${body.issueNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: body.title, body: body.body }),
      });
      return NextResponse.json(toIssuePayload(updated));
    }

    if (body.action === 'comment') {
      if (!body.comment?.trim()) {
        return NextResponse.json({ error: 'comment is required for comment action' }, { status: 400 });
      }
      await githubRequest(token, `${baseIssueUrl}/${body.issueNumber}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.comment.trim() }),
      });
      const issue = await githubRequest<GitHubApiIssue>(token, `${baseIssueUrl}/${body.issueNumber}`, {
        method: 'GET',
      });
      return NextResponse.json(toIssuePayload(issue));
    }

    if (body.action === 'close_with_comment') {
      if (body.comment?.trim()) {
        await githubRequest(token, `${baseIssueUrl}/${body.issueNumber}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: body.comment.trim() }),
        });
      }
      const closed = await githubRequest<GitHubApiIssue>(token, `${baseIssueUrl}/${body.issueNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'closed' }),
      });
      return NextResponse.json(toIssuePayload(closed));
    }

    if (body.action === 'reopen_with_comment') {
      if (body.comment?.trim()) {
        await githubRequest(token, `${baseIssueUrl}/${body.issueNumber}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: body.comment.trim() }),
        });
      }
      const reopened = await githubRequest<GitHubApiIssue>(token, `${baseIssueUrl}/${body.issueNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'open' }),
      });
      return NextResponse.json(toIssuePayload(reopened));
    }

    return NextResponse.json({ error: `Unsupported action: ${body.action}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
