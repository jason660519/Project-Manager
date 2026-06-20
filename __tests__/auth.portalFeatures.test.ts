import { describe, expect, it, vi } from 'vitest';
import {
  formatFeatureStatusLabel,
  listPortalFeatures,
  normalizePortalFeatureRows,
  type PortalFeatureClient,
} from '../lib/auth/portalFeatures';

function clientWithResult(
  result: {
    data: Parameters<typeof normalizePortalFeatureRows>[0];
    error: { message?: string } | null;
  },
): PortalFeatureClient {
  const order = vi.fn(async () => result);
  const eq = vi.fn((): { eq: typeof eq; is: typeof isNull; order: typeof order } => ({
    eq,
    is: isNull,
    order,
  }));
  const isNull = vi.fn((): { eq: typeof eq; is: typeof isNull; order: typeof order } => ({
    eq,
    is: isNull,
    order,
  }));

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq, is: isNull, order })),
    })),
  };
}

describe('portal feature query helpers', () => {
  it('normalizes valid feature rows and drops malformed entries', () => {
    expect(
      normalizePortalFeatureRows([
        {
          id: 'feature-1',
          workspace_id: 'workspace-1',
          project_id: 'project-1',
          feature_key: 'F01',
          title: 'Portal Feature',
          status: 'in_progress',
          progress_percent: 42.5,
          solution_detail_url: 'https://example.test/features/f01',
          updated_at: '2026-06-21T12:00:00.000Z',
          projects: { name: 'Alpha Project' },
        },
        {
          id: 'feature-2',
          feature_key: 'F02',
          title: 'Missing workspace',
          status: 'planned',
          updated_at: '2026-06-21T12:00:00.000Z',
        },
      ]),
    ).toEqual([
      {
        id: 'feature-1',
        workspaceId: 'workspace-1',
        projectId: 'project-1',
        projectName: 'Alpha Project',
        featureKey: 'F01',
        title: 'Portal Feature',
        status: 'in_progress',
        progressPercent: 42.5,
        solutionDetailUrl: 'https://example.test/features/f01',
        updatedAt: '2026-06-21T12:00:00.000Z',
      },
    ]);
  });

  it('loads features through the Supabase client abstraction', async () => {
    const client = clientWithResult({
      data: [
        {
          id: 'feature-1',
          workspace_id: 'workspace-1',
          project_id: 'project-1',
          feature_key: 'F01',
          title: 'Portal Feature',
          status: 'review',
          progress_percent: null,
          solution_detail_url: null,
          updated_at: '2026-06-21T12:00:00.000Z',
        },
      ],
      error: null,
    });

    await expect(listPortalFeatures(client, 'workspace-1')).resolves.toEqual({
      features: [
        expect.objectContaining({
          featureKey: 'F01',
          status: 'review',
        }),
      ],
      error: null,
    });

    expect(client.from).toHaveBeenCalledWith('features');
  });

  it('returns a visible error when Supabase rejects the feature query', async () => {
    const client = clientWithResult({
      data: null,
      error: { message: 'permission denied for table features' },
    });

    await expect(listPortalFeatures(client)).resolves.toEqual({
      features: [],
      error: 'permission denied for table features',
    });
  });

  it('formats feature status labels for the portal list', () => {
    expect(formatFeatureStatusLabel('in_progress')).toBe('In progress');
    expect(formatFeatureStatusLabel('done')).toBe('Done');
  });
});
