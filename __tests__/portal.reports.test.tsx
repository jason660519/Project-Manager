import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PortalReportsPanel } from '../app/portal/PortalReportsPanel';

vi.mock('../lib/auth/reportMetadata', () => ({
  formatReportTypeLabel: (value: string) => value,
  listPortalReports: vi.fn(),
}));

import { listPortalReports } from '../lib/auth/reportMetadata';

describe('PortalReportsPanel', () => {
  it('loads and renders published reports for an allowed workspace role', async () => {
    vi.mocked(listPortalReports).mockResolvedValue({
      reports: [
        {
          id: 'report-1',
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          projectName: 'Alpha Project',
          reportKey: 'alpha-delivery',
          title: 'Alpha Delivery Published',
          reportType: 'delivery_summary',
          status: 'published',
          summary: 'Portal-visible summary.',
          contentUrl: 'https://example.test/reports/alpha-delivery',
          publishedAt: '2026-06-21T00:00:00.000Z',
        },
      ],
      error: null,
    });

    render(<PortalReportsPanel workspaceRole="viewer" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Delivery Published')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /Open report/i })).toHaveAttribute(
      'href',
      'https://example.test/reports/alpha-delivery',
    );
    expect(screen.getByText(/Portal-visible summary\./)).toBeInTheDocument();
  });

  it('shows query errors instead of failing silently', async () => {
    vi.mocked(listPortalReports).mockResolvedValue({
      reports: [],
      error: 'permission denied for table report_metadata',
    });

    render(<PortalReportsPanel workspaceRole="user" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText(/permission denied for table report_metadata/i)).toBeInTheDocument();
    });
  });
});
