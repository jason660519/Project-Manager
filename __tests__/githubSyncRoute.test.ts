import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../app/api/github/sync/route';

function request(body: unknown) {
  return new Request('http://localhost/api/github/sync', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never;
}

describe('github sync API route', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv('GITHUB_TOKEN', 'ghp-test');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('paginates all issue pages and filters pull requests', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              number: 1,
              title: 'Open issue',
              body: null,
              state: 'open',
              labels: [{ name: 'bug' }],
              created_at: '2026-05-01T00:00:00Z',
              updated_at: '2026-05-02T00:00:00Z',
              html_url: 'https://github.com/org/repo/issues/1',
              user: { login: 'jason' },
            },
            ...Array.from({ length: 99 }, (_, index) => ({
              number: index + 100,
              title: `PR ${index}`,
              body: null,
              state: 'open',
              labels: [],
              created_at: '2026-05-01T00:00:00Z',
              updated_at: '2026-05-02T00:00:00Z',
              html_url: `https://github.com/org/repo/pull/${index}`,
              user: { login: 'jason' },
              pull_request: {},
            })),
          ]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              number: 2,
              title: 'Closed issue',
              body: 'Done',
              state: 'closed',
              labels: [{ name: 'done' }],
              created_at: '2026-05-03T00:00:00Z',
              updated_at: '2026-05-04T00:00:00Z',
              html_url: 'https://github.com/org/repo/issues/2',
              user: null,
            },
          ]),
          { status: 200 },
        ),
      );

    const res = await POST(request({ repoUrl: 'https://github.com/org/repo' }));
    const body = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('page=1');
    expect(fetchMock.mock.calls[1][0]).toContain('page=2');
    expect(body).toEqual([
      expect.objectContaining({ number: 1, state: 'open' }),
      expect.objectContaining({ number: 2, state: 'closed' }),
    ]);
  });
});
