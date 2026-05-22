import { describe, it, expect } from 'vitest';
import { parseGithubUrl, mapGithubResponse, isoToDays } from '../app/api/github/lib';

describe('parseGithubUrl', () => {
  it('accepts valid https://github.com/owner/repo', () => {
    const result = parseGithubUrl('https://github.com/owner/my-app');
    expect(result).toEqual({ owner: 'owner', repo: 'my-app' });
  });

  it('accepts trailing slash', () => {
    const result = parseGithubUrl('https://github.com/owner/my-app/');
    expect(result).toEqual({ owner: 'owner', repo: 'my-app' });
  });

  it('rejects non-github URLs', () => {
    expect(() => parseGithubUrl('https://gitlab.com/owner/repo')).toThrow('GitHub');
  });

  it('rejects URLs without owner/repo', () => {
    expect(() => parseGithubUrl('https://github.com')).toThrow('Invalid');
  });
});

describe('isoToDays', () => {
  it('returns days from epoch for valid ISO string', () => {
    const days = isoToDays('2026-05-20T00:00:00.000Z');
    expect(days).toBeGreaterThan(20000); // ~20580-20590
  });

  it('returns undefined for null', () => {
    expect(isoToDays(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(isoToDays(undefined)).toBeUndefined();
  });
});

describe('mapGithubResponse', () => {
  it('maps PRs and issues to RawGitHubFeature[]', () => {
    const mockData = {
      data: {
        repository: {
          pullRequests: {
            nodes: [
              {
                number: 1,
                title: 'Fix login',
                updatedAt: '2026-05-15T00:00:00Z',
                isDraft: false,
                labels: { nodes: [{ name: 'bug' }] },
              },
            ],
          },
          issues: {
            nodes: [
              {
                number: 42,
                title: 'Add dark mode',
                labels: { nodes: [{ name: 'enhancement' }] },
              },
            ],
          },
        },
      },
    };

    const features = mapGithubResponse(mockData);
    expect(features).toHaveLength(2);

    const pr = features.find(f => f.id === 'PR-1');
    const issue = features.find(f => f.id === 'ISS-42');

    expect(pr).toBeDefined();
    expect(pr!.name).toBe('Fix login');
    expect(pr!.category).toBe('GitHub/PR');
    expect(pr!.status).toBe('in_progress');
    expect(pr!.notes).toContain('idle');

    expect(issue).toBeDefined();
    expect(issue!.name).toBe('Add dark mode');
    expect(issue!.category).toBe('GitHub/Issue');
    expect(issue!.status).toBe('todo');
    expect(issue!.notes).toContain('Labels');
  });

  it('handles empty repository', () => {
    const mockData = {
      data: {
        repository: {
          pullRequests: { nodes: [] },
          issues: { nodes: [] },
        },
      },
    };
    const features = mapGithubResponse(mockData);
    expect(features).toHaveLength(0);
  });

  it('returns empty array when data shape is wrong', () => {
    const features = mapGithubResponse({ data: { repository: null } });
    expect(features).toHaveLength(0);
  });

  it('flags PR idle for 5+ days', () => {
    // Simulate 10 days ago
    const tenDaysAgo = new Date(Date.now() - 10 * 86400_000).toISOString();
    const mockData = {
      data: {
        repository: {
          pullRequests: {
            nodes: [
              {
                number: 5,
                title: 'Stale PR',
                updatedAt: tenDaysAgo,
                isDraft: false,
                labels: { nodes: [] },
              },
            ],
          },
          issues: { nodes: [] },
        },
      },
    };
    const features = mapGithubResponse(mockData);
    expect(features).toHaveLength(1);
    expect(features[0].notes).toContain('idle');
    expect(features[0].days_idle).toBeGreaterThanOrEqual(9);
  });

  it('marks blocked PR as on_hold', () => {
    const mockData = {
      data: {
        repository: {
          pullRequests: {
            nodes: [
              {
                number: 10,
                title: 'Blocked PR',
                updatedAt: '2026-05-15T00:00:00Z',
                isDraft: false,
                labels: { nodes: [{ name: 'blocked' }] },
              },
            ],
          },
          issues: { nodes: [] },
        },
      },
    };
    const features = mapGithubResponse(mockData);
    expect(features[0].status).toBe('on_hold');
  });

  it('marks in-progress issue based on WIP label', () => {
    const mockData = {
      data: {
        repository: {
          pullRequests: { nodes: [] },
          issues: {
            nodes: [
              {
                number: 99,
                title: 'WIP feature',
                labels: { nodes: [{ name: 'WIP' }] },
              },
            ],
          },
        },
      },
    };
    const features = mapGithubResponse(mockData);
    expect(features[0].status).toBe('in_progress');
    expect(features[0].notes).toContain('WIP');
  });
});
