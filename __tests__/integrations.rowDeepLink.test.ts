import { describe, expect, it } from 'vitest';

import { selectIntegrationRowFromDeepLink } from '../app/ui/views/Plugins/PluginsHubView';
import type { IntegrationRow } from '../lib/integrations/types';

function row(overrides: Partial<IntegrationRow>): IntegrationRow {
  return {
    rowKey: 'workflow-execution-record:record-1',
    sheet: 'workflow-execution-records',
    sourceKind: 'workflow-execution-record',
    sourceId: 'record-1',
    enabled: false,
    category1: 'Workflow Execution Audit',
    category2: 'dry_run_completed',
    githubUrl: '',
    company: 'Project Manager',
    name: 'F54 · Analysis',
    version: 'schema v1',
    license: '',
    scope: 'project',
    port: '',
    installPath: '/repo/.project-manager/project-workflow-execution-records/record.json',
    installMethod: 'Integration Hub dry-run runner',
    status: 'idle',
    statusLabel: 'dry_run_completed',
    lastUpdated: '2026-06-16T09:34:00.000Z',
    notes: '',
    lv: null,
    badges: [],
    payload: {},
    ...overrides,
  };
}

describe('Integration Hub row deep-link selection', () => {
  it('selects a workflow execution record row by recordId', () => {
    const rows = [
      row({ rowKey: 'workflow-execution-record:record-1', sourceId: 'record-1' }),
      row({ rowKey: 'workflow-execution-record:record-2', sourceId: 'record-2' }),
    ];

    expect(selectIntegrationRowFromDeepLink(rows, { recordId: 'record-2' })?.sourceId).toBe('record-2');
  });

  it('selects rows by sourceId or rowKey fallback', () => {
    const rows = [
      row({ rowKey: 'workflow-execution-request:request-1', sourceKind: 'workflow-execution-request', sourceId: 'request-1' }),
      row({ rowKey: 'workflow-execution-record:record-1', sourceId: 'record-1' }),
    ];

    expect(selectIntegrationRowFromDeepLink(rows, { sourceId: 'request-1' })?.rowKey).toBe(
      'workflow-execution-request:request-1',
    );
    expect(selectIntegrationRowFromDeepLink(rows, { rowKey: 'workflow-execution-record:record-1' })?.sourceId).toBe(
      'record-1',
    );
  });
});
