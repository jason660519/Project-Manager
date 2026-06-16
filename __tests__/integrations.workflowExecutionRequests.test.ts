import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/bridge', () => ({
  listProjectFiles: vi.fn(),
  readFile: vi.fn(),
  skillList: vi.fn(),
}));

import { listProjectFiles, readFile } from '../lib/bridge';
import {
  loadWorkflowExecutionRecordRows,
  loadWorkflowExecutionRequestRows,
} from '../lib/integrations/load-project-inventory';

describe('Integrations Hub workflow execution request rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads dry-run workflow execution request packages as Integration Hub rows', async () => {
    vi.mocked(listProjectFiles).mockResolvedValueOnce([
      {
        name: 'request.json',
        path: '/repo/.project-manager/project-workflow-execution-requests/request.json',
        isDir: false,
        children: [],
      },
    ]);
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({
      schemaVersion: 1,
      id: 'request-1',
      workflowRunId: 'run-1',
      workItemId: 'F54',
      nodeId: 'verification',
      nodeTitle: 'Verification',
      draftId: 'draft-1',
      actorKind: 'tool',
      status: 'pending_external_executor',
      executionState: 'dry_run_only',
      reviewStatus: 'review_required',
      policyGate: {
        state: 'review_required',
        reason: 'Human review is required before any external executor may consume this request.',
      },
      requestedBy: 'PM Lead',
      requestedAt: '2026-06-16T08:06:00.000Z',
      capabilityId: 'software:verification:tool',
      executorResolution: {
        state: 'resolved',
        executionState: 'dry_run_only',
        capabilityId: 'software:verification:tool',
        integrationSheet: 'commands',
        sourceKind: 'command-mapping',
        sourceId: 'npm:verify-baseline',
        commandPreview: 'npm run verify:baseline',
      },
      memoryFiles: ['.project-manager/features/F54/feature-spec.md'],
      allowedTools: ['tool:verification'],
      expectedHandoffArtifactId: 'verification-results',
      expectedEvidenceIds: ['verification-log'],
      safetyNotice: 'Dry-run execution request only; Project Manager did not execute the command.',
    }));

    const rows = await loadWorkflowExecutionRequestRows('/repo');

    expect(listProjectFiles).toHaveBeenCalledWith(
      '/repo/.project-manager/project-workflow-execution-requests',
      1,
    );
    expect(rows).toEqual([
      expect.objectContaining({
        rowKey: 'workflow-execution-request:request-1',
        sheet: 'workflow-execution-requests',
        sourceKind: 'workflow-execution-request',
        sourceId: 'request-1',
        enabled: false,
        category1: 'Workflow Execution',
        category2: 'review_required',
        name: 'F54 · Verification',
        status: 'idle',
        statusLabel: 'pending_external_executor',
        notes: expect.stringContaining('npm run verify:baseline'),
        badges: ['review_required', 'dry_run_only', 'commands', 'software:verification:tool'],
      }),
    ]);
    expect(rows[0].payload).toMatchObject({
      workflowRunId: 'run-1',
      nodeId: 'verification',
      reviewStatus: 'review_required',
      policyGate: {
        state: 'review_required',
      },
      commandPreview: 'npm run verify:baseline',
      safetyNotice: 'Dry-run execution request only; Project Manager did not execute the command.',
    });
  });

  it('returns an empty queue when the project has no request package directory yet', async () => {
    vi.mocked(listProjectFiles).mockRejectedValueOnce(new Error('not found'));

    await expect(loadWorkflowExecutionRequestRows('/repo')).resolves.toEqual([]);
  });

  it('loads dry-run executor handoff records as Integration Hub audit rows', async () => {
    vi.mocked(listProjectFiles).mockResolvedValueOnce([
      {
        name: 'record.json',
        path: '/repo/.project-manager/project-workflow-execution-records/record.json',
        isDir: false,
        children: [],
      },
    ]);
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({
      schemaVersion: 1,
      id: 'record-1',
      requestId: 'request-1',
      workflowRunId: 'run-1',
      workItemId: 'F54',
      nodeId: 'verification',
      nodeTitle: 'Verification',
      draftId: 'draft-1',
      status: 'ready_for_executor',
      consumedBy: 'Dry Run Executor',
      consumedAt: '2026-06-16T09:34:00.000Z',
      executionState: 'dry_run_only',
      capabilityId: 'software:verification:tool',
      commandPreview: 'npm run verify:baseline',
      command: { command: 'npm', args: ['run', 'verify:baseline'] },
      policyDecision: {
        state: 'ready',
        requestId: 'request-1',
        executionState: 'dry_run_only',
        command: { command: 'npm', args: ['run', 'verify:baseline'] },
        reason: 'Approved dry-run request is ready for a future executor handoff.',
      },
      runnerResult: {
        state: 'completed',
        exitCode: 0,
        stdoutPreview: 'Dry-run executor validated the approved command package. No process was spawned.',
        stderrPreview: '',
      },
      safetyNotice: 'Handoff record only; Project Manager did not execute the command.',
    }));

    const rows = await loadWorkflowExecutionRecordRows('/repo');

    expect(listProjectFiles).toHaveBeenCalledWith(
      '/repo/.project-manager/project-workflow-execution-records',
      1,
    );
    expect(rows).toEqual([
      expect.objectContaining({
        rowKey: 'workflow-execution-record:record-1',
        sheet: 'workflow-execution-records',
        sourceKind: 'workflow-execution-record',
        sourceId: 'record-1',
        category1: 'Workflow Execution Audit',
        category2: 'ready_for_executor',
        name: 'F54 · Verification',
        status: 'idle',
        statusLabel: 'ready_for_executor',
        notes: expect.stringContaining('npm run verify:baseline'),
        badges: ['ready_for_executor', 'dry_run_only', 'ready', 'completed', 'software:verification:tool'],
      }),
    ]);
    expect(rows[0].payload).toMatchObject({
      requestId: 'request-1',
      nodeId: 'verification',
      policyDecision: {
        state: 'ready',
      },
      runnerResult: {
        state: 'completed',
        exitCode: 0,
      },
      commandPreview: 'npm run verify:baseline',
      safetyNotice: 'Handoff record only; Project Manager did not execute the command.',
    });
  });

  it('returns an empty audit log when the project has no execution records directory yet', async () => {
    vi.mocked(listProjectFiles).mockRejectedValueOnce(new Error('not found'));

    await expect(loadWorkflowExecutionRecordRows('/repo')).resolves.toEqual([]);
  });
});
