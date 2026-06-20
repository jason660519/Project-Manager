import { describe, expect, it, vi } from 'vitest';
import {
  formatReportTypeLabel,
  listPortalReports,
  normalizeReportMetadataRows,
  type ReportMetadataClient,
} from '../lib/auth/reportMetadata';

function clientWithResult(
  result: {
    data: Parameters<typeof normalizeReportMetadataRows>[0];
    error: { message?: string } | null;
  },
): ReportMetadataClient {
  const order = vi.fn(async () => result);
  const eq = vi.fn((): { eq: typeof eq; order: typeof order } => ({ eq, order }));
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq, order })),
    })),
  };
}

describe('portal report metadata query helpers', () => {
  it('normalizes valid report rows and drops malformed entries', () => {
    expect(
      normalizeReportMetadataRows([
        {
          id: 'report-1',
          workspace_id: 'workspace-1',
          project_id: 'project-1',
          report_key: 'delivery-q2',
          title: 'Q2 Delivery',
          report_type: 'delivery_summary',
          status: 'published',
          summary: 'Summary text',
          content_url: 'https://example.test/reports/q2',
          published_at: '2026-06-21T00:00:00.000Z',
          projects: { name: 'Alpha Project' },
        },
        {
          id: 'report-2',
          report_key: 'missing-workspace',
          title: 'Invalid',
          report_type: 'general',
          status: 'published',
        },
      ]),
    ).toEqual([
      {
        id: 'report-1',
        workspaceId: 'workspace-1',
        projectId: 'project-1',
        projectName: 'Alpha Project',
        reportKey: 'delivery-q2',
        title: 'Q2 Delivery',
        reportType: 'delivery_summary',
        status: 'published',
        summary: 'Summary text',
        contentUrl: 'https://example.test/reports/q2',
        publishedAt: '2026-06-21T00:00:00.000Z',
      },
    ]);
  });

  it('loads report metadata through the Supabase client abstraction', async () => {
    const client = clientWithResult({
      data: [
        {
          id: 'report-published',
          workspace_id: 'workspace-1',
          report_key: 'milestone-1',
          title: 'Milestone 1',
          report_type: 'milestone',
          status: 'published',
          content_url: 'https://example.test/reports/milestone-1',
        },
      ],
      error: null,
    });

    await expect(listPortalReports(client)).resolves.toEqual({
      reports: [
        expect.objectContaining({
          id: 'report-published',
          title: 'Milestone 1',
          contentUrl: 'https://example.test/reports/milestone-1',
        }),
      ],
      error: null,
    });

    expect(client.from).toHaveBeenCalledWith('report_metadata');
  });

  it('returns a visible error when Supabase rejects the report query', async () => {
    const client = clientWithResult({
      data: null,
      error: { message: 'permission denied for table report_metadata' },
    });

    await expect(listPortalReports(client)).resolves.toEqual({
      reports: [],
      error: 'permission denied for table report_metadata',
    });
  });

  it('scopes report queries to the active workspace when provided', async () => {
    const client = clientWithResult({
      data: [],
      error: null,
    });

    await listPortalReports(client, 'workspace-1');

    const fromMock = vi.mocked(client.from);
    const select = vi.mocked(fromMock.mock.results[0]?.value.select);
    expect(select).toHaveBeenCalled();
    const query = select.mock.results[0]?.value;
    expect(query.eq).toHaveBeenCalledWith('workspace_id', 'workspace-1');
  });

  it('formats report type labels for the portal list', () => {
    expect(formatReportTypeLabel('delivery_summary')).toBe('Delivery summary');
    expect(formatReportTypeLabel('general')).toBe('Report');
  });
});
