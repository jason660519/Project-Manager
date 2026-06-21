import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PortalSolutionsPanel } from '../app/portal/PortalSolutionsPanel';

vi.mock('../lib/auth/portalProjects', () => ({
  listPortalProjects: vi.fn(),
}));

import { listPortalProjects } from '../lib/auth/portalProjects';

describe('PortalSolutionsPanel', () => {
  it('loads and renders solution detail links for projects that publish URLs', async () => {
    vi.mocked(listPortalProjects).mockResolvedValue({
      projects: [
        {
          id: 'project-1',
          workspaceId: 'workspace-1',
          name: 'Alpha Project',
          solutionDetailUrl: 'https://example.test/solutions/alpha',
          createdAt: '2026-06-21T00:00:00.000Z',
        },
        {
          id: 'project-2',
          workspaceId: 'workspace-1',
          name: 'Beta Project',
          solutionDetailUrl: null,
          createdAt: '2026-06-21T00:00:00.000Z',
        },
      ],
      error: null,
    });

    render(<PortalSolutionsPanel workspaceRole="viewer" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /Open solution page/i })).toHaveAttribute(
      'href',
      'https://example.test/solutions/alpha',
    );
    expect(screen.queryByText('Beta Project')).not.toBeInTheDocument();
  });

  it('shows query errors instead of failing silently', async () => {
    vi.mocked(listPortalProjects).mockResolvedValue({
      projects: [],
      error: 'permission denied for table projects',
    });

    render(<PortalSolutionsPanel workspaceRole="user" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText(/permission denied for table projects/i)).toBeInTheDocument();
    });
  });
});
