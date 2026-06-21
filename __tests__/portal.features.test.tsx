import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PortalFeaturesPanel } from '../app/portal/PortalFeaturesPanel';

vi.mock('../lib/auth/portalFeatures', () => ({
  formatFeatureStatusLabel: (value: string) => value,
  listPortalFeatures: vi.fn(),
}));

import { listPortalFeatures } from '../lib/auth/portalFeatures';

describe('PortalFeaturesPanel', () => {
  it('loads and renders feature progress for an allowed workspace role', async () => {
    vi.mocked(listPortalFeatures).mockResolvedValue({
      features: [
        {
          id: 'feature-1',
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          projectName: 'Alpha Project',
          featureKey: 'F01',
          title: 'Portal Feature Alpha',
          status: 'in_progress',
          progressPercent: 55,
          solutionDetailUrl: 'https://example.test/features/f01',
          updatedAt: '2026-06-21T12:00:00.000Z',
        },
      ],
      error: null,
    });

    render(<PortalFeaturesPanel workspaceRole="viewer" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText('Portal Feature Alpha')).toBeInTheDocument();
    });

    expect(screen.getByText('F01')).toBeInTheDocument();
    expect(screen.getByText(/Progress: 55%/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open feature detail/i })).toHaveAttribute(
      'href',
      'https://example.test/features/f01',
    );
  });

  it('shows query errors instead of failing silently', async () => {
    vi.mocked(listPortalFeatures).mockResolvedValue({
      features: [],
      error: 'permission denied for table features',
    });

    render(<PortalFeaturesPanel workspaceRole="user" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText(/permission denied for table features/i)).toBeInTheDocument();
    });
  });
});
