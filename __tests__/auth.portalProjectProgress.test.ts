import { describe, expect, it, vi } from 'vitest';
import {
  derivePortalProjectOverallStatus,
  formatProjectOverallStatusLabel,
  formatProjectProgressSummaryLine,
  listPortalProjectProgress,
  summarizePortalProjectProgress,
} from '../lib/auth/portalProjectProgress';
import type { PortalFeature } from '../lib/auth/portalFeatures';
import type { PortalProject } from '../lib/auth/portalProjects';

vi.mock('../lib/auth/portalProjects', () => ({
  listPortalProjects: vi.fn(),
}));

vi.mock('../lib/auth/portalFeatures', () => ({
  listPortalFeatures: vi.fn(),
}));

import { listPortalFeatures } from '../lib/auth/portalFeatures';
import { listPortalProjects } from '../lib/auth/portalProjects';

const baseProject: PortalProject = {
  id: 'project-1',
  workspaceId: 'workspace-1',
  name: 'Alpha Project',
  solutionDetailUrl: null,
  createdAt: '2026-06-01T12:00:00.000Z',
};

function feature(partial: Partial<PortalFeature> & Pick<PortalFeature, 'status'>): PortalFeature {
  return {
    id: partial.id ?? 'feature-1',
    workspaceId: partial.workspaceId ?? 'workspace-1',
    projectId: partial.projectId ?? 'project-1',
    projectName: partial.projectName ?? 'Alpha Project',
    featureKey: partial.featureKey ?? 'F01',
    title: partial.title ?? 'Feature',
    status: partial.status,
    progressPercent: partial.progressPercent ?? null,
    solutionDetailUrl: partial.solutionDetailUrl ?? null,
    updatedAt: partial.updatedAt ?? '2026-06-21T12:00:00.000Z',
  };
}

describe('portal project progress summaries', () => {
  it('aggregates feature counts and average progress per project', () => {
    expect(
      summarizePortalProjectProgress(
        [baseProject],
        [
          feature({ id: 'f1', status: 'in_progress', progressPercent: 40 }),
          feature({ id: 'f2', status: 'done', progressPercent: 100 }),
          feature({ id: 'f3', status: 'blocked', progressPercent: 10 }),
        ],
      ),
    ).toEqual([
      expect.objectContaining({
        projectId: 'project-1',
        featureCount: 3,
        inProgressCount: 1,
        doneCount: 1,
        blockedCount: 1,
        averageProgressPercent: 50,
        overallStatus: 'blocked',
      }),
    ]);
  });

  it('includes projects without indexed features', () => {
    expect(
      summarizePortalProjectProgress(
        [
          baseProject,
          {
            ...baseProject,
            id: 'project-2',
            name: 'Beta Project',
          },
        ],
        [feature({ projectId: 'project-1', status: 'planned' })],
      ),
    ).toEqual([
      expect.objectContaining({
        projectId: 'project-1',
        featureCount: 1,
        overallStatus: 'planned',
      }),
      expect.objectContaining({
        projectId: 'project-2',
        featureCount: 0,
        overallStatus: 'empty',
      }),
    ]);
  });

  it('derives overall status labels for portal summaries', () => {
    expect(derivePortalProjectOverallStatus([feature({ status: 'review' })])).toBe('review');
    expect(formatProjectOverallStatusLabel('done')).toBe('Complete');
    expect(
      formatProjectProgressSummaryLine(
        summarizePortalProjectProgress([baseProject], [
          feature({ status: 'in_progress', progressPercent: 55 }),
        ])[0],
      ),
    ).toContain('55% avg');
  });

  it('loads project progress through the portal query helpers', async () => {
    vi.mocked(listPortalProjects).mockResolvedValue({
      projects: [baseProject],
      error: null,
    });
    vi.mocked(listPortalFeatures).mockResolvedValue({
      features: [feature({ status: 'in_progress', progressPercent: 25 })],
      error: null,
    });

    await expect(listPortalProjectProgress('workspace-1')).resolves.toEqual({
      summaries: [
        expect.objectContaining({
          projectName: 'Alpha Project',
          inProgressCount: 1,
        }),
      ],
      error: null,
    });
  });

  it('returns a visible error when feature lookup fails', async () => {
    vi.mocked(listPortalProjects).mockResolvedValue({
      projects: [baseProject],
      error: null,
    });
    vi.mocked(listPortalFeatures).mockResolvedValue({
      features: [],
      error: 'permission denied for table features',
    });

    await expect(listPortalProjectProgress('workspace-1')).resolves.toEqual({
      summaries: [],
      error: 'permission denied for table features',
    });
  });
});
