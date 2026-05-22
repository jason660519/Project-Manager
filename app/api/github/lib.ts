/**
 * Shared utilities for GitHub integration — URL parsing, GraphQL query,
 * response mapping. Used by both the browser API route and the Tauri
 * `fetch_github_repo` command.
 */

export interface RawGitHubFeature {
  id: string;
  name: string;
  category: string;
  status: string;
  progress: number;
  days_idle?: number;
  notes?: string;
}

/** Parse a GitHub URL into owner/repo tuple. */
export function parseGithubUrl(url: string): { owner: string; repo: string } {
  const trimmed = url.trim().replace(/\/$/, '');
  const match = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);
  if (!match) {
    throw new Error(
      'Invalid GitHub URL — expected https://github.com/owner/repo',
    );
  }
  return { owner: match[1], repo: match[2] };
}

/** GraphQL query body for fetching open PRs + issues. */
export const GITHUB_GRAPHQL_QUERY = `
query($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    pullRequests(states: [OPEN], first: 20, orderBy: { field: UPDATED_AT, direction: ASC }) {
      nodes {
        number
        title
        updatedAt
        isDraft
        labels(first: 5) { nodes { name } }
      }
    }
    issues(states: [OPEN], first: 30) {
      nodes {
        number
        title
        labels(first: 5) { nodes { name } }
      }
    }
  }
}
`;

export function nowDays(): number {
  return Math.floor(Date.now() / 86400_000);
}

/** Parse ISO-8601 date string to epoch days. */
export function isoToDays(iso: string | undefined | null): number | undefined {
  if (!iso) return undefined;
  const d = Date.parse(iso);
  if (isNaN(d)) return undefined;
  return Math.floor(d / 86400_000);
}

function isBlocked(labels: string[]): boolean {
  return labels.some((l) => {
    const low = l.toLowerCase();
    return low.includes('block') || low.includes('hold') || low.includes('stuck');
  });
}

function isWip(labels: string[]): boolean {
  return labels.some((l) => {
    const low = l.toLowerCase();
    return low.includes('wip') || low.includes('in progress') || low.includes('in-progress');
  });
}

function extractLabels(
  nodes: Array<{ name?: string }> | undefined,
): string[] {
  return (nodes ?? []).map((n) => n.name ?? '').filter(Boolean);
}

/** Map a GitHub GraphQL response to RawGitHubFeature[]. */
export function mapGithubResponse(
  data: unknown,
  _nowIso?: string,
): RawGitHubFeature[] {
  const nowD = nowDays();
  const root = (data as any)?.data?.repository;
  if (!root) return [];

  const features: RawGitHubFeature[] = [];

  // PRs
  const prNodes: unknown[] = root.pullRequests?.nodes ?? [];
  for (const pr of prNodes as any[]) {
    if (!pr) continue;
    const number = pr.number ?? 0;
    const title = pr.title ?? 'Untitled PR';
    const updatedAt: string | undefined = pr.updatedAt;
    const labels = extractLabels(pr.labels?.nodes);

    const updatedDays = isoToDays(updatedAt) ?? nowD;
    const daysIdle = nowD - updatedDays;
    const blocked = isBlocked(labels);
    const status = blocked ? 'on_hold' : 'in_progress';

    let notes: string | undefined;
    if (blocked) {
      notes = undefined;
    } else if (daysIdle >= 5) {
      notes = `PR #${number} idle for ${daysIdle} day${daysIdle === 1 ? '' : 's'} — review dispatch recommended`;
    } else if (labels.length > 0) {
      notes = `Labels: ${labels.join(', ')}`;
    }

    features.push({
      id: `PR-${number}`,
      name: title,
      category: 'GitHub/PR',
      status,
      progress: 0,
      days_idle: daysIdle,
      notes,
    });
  }

  // Issues
  const issueNodes: unknown[] = root.issues?.nodes ?? [];
  for (const issue of issueNodes as any[]) {
    if (!issue) continue;
    const number = issue.number ?? 0;
    const title = issue.title ?? 'Untitled Issue';
    const labels = extractLabels(issue.labels?.nodes);

    let status: string;
    if (isBlocked(labels)) {
      status = 'on_hold';
    } else if (isWip(labels)) {
      status = 'in_progress';
    } else {
      status = 'todo';
    }

    const notes = labels.length > 0 ? `Labels: ${labels.join(', ')}` : undefined;

    features.push({
      id: `ISS-${number}`,
      name: title,
      category: 'GitHub/Issue',
      status,
      progress: 0,
      notes,
    });
  }

  return features;
}

/** Fetch GitHub repo data via GraphQL and map to features. */
export async function fetchGithubFeatures(
  token: string,
  repoUrl: string,
): Promise<RawGitHubFeature[]> {
  const { owner, repo } = parseGithubUrl(repoUrl);

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'ProjectManager/0.1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: GITHUB_GRAPHQL_QUERY,
      variables: { owner, repo },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }

  const data = await res.json();

  if (data.errors?.length) {
    throw new Error(
      `GitHub GraphQL: ${data.errors.map((e: any) => e.message).join(', ')}`,
    );
  }

  return mapGithubResponse(data);
}
