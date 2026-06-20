import { describe, expect, it, vi } from 'vitest';
import {
  listPortalProjects,
  normalizePortalProjectRows,
  type PortalProjectClient,
} from '../lib/auth/portalProjects';

function clientWithResult(
  result: {
    data: Parameters<typeof normalizePortalProjectRows>[0];
    error: { message?: string } | null;
  },
): PortalProjectClient {
  const order = vi.fn(async () => result);
  const eq = vi.fn((): { eq: typeof eq; order: typeof order } => ({ eq, order }));
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq, order })),
    })),
  };
}

describe('portal project query helpers', () => {
  it('normalizes valid project rows and drops malformed entries', () => {
    expect(
      normalizePortalProjectRows([
        {
          id: 'project-1',
          workspace_id: 'workspace-1',
          name: 'Alpha Project',
          solution_detail_url: 'https://example.test/solutions/alpha',
          created_at: '2026-06-21T00:00:00.000Z',
        },
        {
          id: 'project-2',
          name: 'Missing workspace',
          created_at: '2026-06-21T00:00:00.000Z',
        },
      ]),
    ).toEqual([
      {
        id: 'project-1',
        workspaceId: 'workspace-1',
        name: 'Alpha Project',
        solutionDetailUrl: 'https://example.test/solutions/alpha',
        createdAt: '2026-06-21T00:00:00.000Z',
      },
    ]);
  });

  it('treats blank solution URLs as null', () => {
    expect(
      normalizePortalProjectRows([
        {
          id: 'project-1',
          workspace_id: 'workspace-1',
          name: 'Alpha Project',
          solution_detail_url: '   ',
          created_at: '2026-06-21T00:00:00.000Z',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        solutionDetailUrl: null,
      }),
    ]);
  });

  it('loads projects through the Supabase client abstraction', async () => {
    const client = clientWithResult({
      data: [
        {
          id: 'project-1',
          workspace_id: 'workspace-1',
          name: 'Alpha Project',
          solution_detail_url: null,
          created_at: '2026-06-21T00:00:00.000Z',
        },
      ],
      error: null,
    });

    await expect(listPortalProjects(client)).resolves.toEqual({
      projects: [
        expect.objectContaining({
          id: 'project-1',
          name: 'Alpha Project',
        }),
      ],
      error: null,
    });

    expect(client.from).toHaveBeenCalledWith('projects');
  });

  it('returns a visible error when Supabase rejects the project query', async () => {
    const client = clientWithResult({
      data: null,
      error: { message: 'permission denied for table projects' },
    });

    await expect(listPortalProjects(client)).resolves.toEqual({
      projects: [],
      error: 'permission denied for table projects',
    });
  });
});
