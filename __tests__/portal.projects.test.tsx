import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PortalProjectsPanel } from '../app/portal/PortalProjectsPanel';

vi.mock('../lib/auth/portalProjectProgress', () => ({
  formatProjectOverallStatusLabel: (value: string) => value,
  formatProjectProgressSummaryLine: () => '2 features · 1 active · 50% avg',
  listPortalProjectProgress: vi.fn(),
}));

import { listPortalProjectProgress } from '../lib/auth/portalProjectProgress';

describe('PortalProjectsPanel', () => {
  it('loads and renders project progress summaries for portal roles', async () => {
    vi.mocked(listPortalProjectProgress).mockResolvedValue({
      summaries: [
        {
          projectId: 'project-1',
          projectName: 'Alpha Project',
          createdAt: '2026-06-01T12:00:00.000Z',
          featureCount: 2,
          plannedCount: 0,
          inProgressCount: 1,
          blockedCount: 0,
          reviewCount: 0,
          doneCount: 1,
          archivedCount: 0,
          averageProgressPercent: 50,
          lastFeatureUpdatedAt: '2026-06-21T12:00:00.000Z',
          overallStatus: 'in_progress',
        },
      ],
      error: null,
    });

    render(<PortalProjectsPanel workspaceRole="viewer" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    });

    expect(screen.getByText(/2 features · 1 active · 50% avg/)).toBeInTheDocument();
    expect(screen.getByText('in_progress')).toBeInTheDocument();
  });

  it('does not query progress when workspace context is missing', async () => {
    render(<PortalProjectsPanel workspaceRole="viewer" workspaceId={null} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading project progress/i)).not.toBeInTheDocument();
    });

    expect(listPortalProjectProgress).not.toHaveBeenCalled();
  });

  it('shows query errors instead of failing silently', async () => {
    vi.mocked(listPortalProjectProgress).mockResolvedValue({
      summaries: [],
      error: 'permission denied for table features',
    });

    render(<PortalProjectsPanel workspaceRole="user" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText(/permission denied for table features/i)).toBeInTheDocument();
    });
  });
});
