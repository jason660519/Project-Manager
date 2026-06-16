import { describe, expect, it, vi } from 'vitest';

import {
  autoRequestEligibleProjectWorkflowDrafts,
  createProjectWorkflowRun,
  getProjectWorkflowTemplateById,
  requestProjectWorkflowDraftRun,
  setProjectWorkflowExecutionMode,
  startProjectWorkflowNode,
} from '../lib/project-workflows/projectWorkflowEngine';
import {
  approveProjectWorkflowExecutionRequest,
  buildProjectWorkflowExecutorHandoffRecord,
  buildProjectWorkflowExecutorRunRecord,
  buildProjectWorkflowExecutionRequests,
  evaluateProjectWorkflowExecutionRequestConsumption,
  projectWorkflowExecutionRequestPath,
  projectWorkflowExecutionRequestsDirectory,
  projectWorkflowExecutorHandoffRecordPath,
  projectWorkflowExecutorHandoffRecordsDirectory,
  saveProjectWorkflowExecutorHandoffRecord,
  saveProjectWorkflowExecutorRunRecord,
  saveProjectWorkflowExecutionRequests,
  serializeProjectWorkflowExecutorHandoffRecord,
  serializeProjectWorkflowExecutorRunRecord,
  runProjectWorkflowExecutorDryRun,
  runProjectWorkflowExecutorLive,
} from '../lib/project-workflows/projectWorkflowExecutionPackageStore';

describe('Project Workflow execution request packages', () => {
  it('builds a dry-run package for a manually requested Integration Hub executor candidate', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      createdBy: 'PM Lead',
      now: '2026-06-16T08:00:00.000Z',
    });
    const withDraft = startProjectWorkflowNode(template, run, 'verification', '2026-06-16T08:05:00.000Z');
    const requested = requestProjectWorkflowDraftRun(
      withDraft,
      withDraft.executionDrafts[0].id,
      'PM Lead',
      '2026-06-16T08:06:00.000Z',
    );

    const packages = buildProjectWorkflowExecutionRequests(requested);

    expect(packages).toHaveLength(1);
    expect(packages[0]).toMatchObject({
      schemaVersion: 1,
      workflowRunId: requested.id,
      workItemId: 'F54',
      nodeId: 'verification',
      nodeTitle: 'Verification',
      draftId: withDraft.executionDrafts[0].id,
      status: 'pending_external_executor',
      requestedBy: 'PM Lead',
      requestedAt: '2026-06-16T08:06:00.000Z',
      executionState: 'dry_run_only',
      capabilityId: 'software:verification:tool',
      reviewStatus: 'review_required',
      policyGate: {
        state: 'review_required',
        reason: 'Human review is required before any external executor may consume this request.',
      },
      executorResolution: {
        state: 'resolved',
        executionState: 'dry_run_only',
        integrationSheet: 'commands',
        sourceKind: 'command-mapping',
        sourceId: 'npm:verify-baseline',
        commandPreview: 'npm run verify:baseline',
      },
      safetyNotice: 'Dry-run execution request only; Project Manager did not execute the command.',
    });
    expect(packages[0].command).toEqual({ command: 'npm', args: ['run', 'verify:baseline'] });
    expect(packages[0].memoryFiles).toContain('.project-manager/features/F54/feature-spec.md');
    expect(packages[0].allowedTools).toContain('tool:verification');
  });

  it('approves a request for future executor consumption without executing it', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T08:30:00.000Z',
    });
    const withDraft = startProjectWorkflowNode(template, run, 'verification', '2026-06-16T08:31:00.000Z');
    const requested = requestProjectWorkflowDraftRun(
      withDraft,
      withDraft.executionDrafts[0].id,
      'PM Lead',
      '2026-06-16T08:32:00.000Z',
    );
    const [request] = buildProjectWorkflowExecutionRequests(requested);

    const approved = approveProjectWorkflowExecutionRequest(
      request,
      'Lead PM',
      '2026-06-16T08:33:00.000Z',
    );

    expect(approved).toMatchObject({
      id: request.id,
      reviewStatus: 'approved_for_executor',
      approvedBy: 'Lead PM',
      approvedAt: '2026-06-16T08:33:00.000Z',
      policyGate: {
        state: 'approved_for_executor',
        reason: 'Human approved this dry-run request for a future executor handoff.',
      },
      executionState: 'dry_run_only',
      safetyNotice: 'Dry-run execution request only; Project Manager did not execute the command.',
    });
    expect(approved.command).toEqual({ command: 'npm', args: ['run', 'verify:baseline'] });
  });

  it('builds an unresolved dry-run package for auto-requested agent drafts without running the agent', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T08:10:00.000Z',
    });
    const autoMode = setProjectWorkflowExecutionMode(run, 'auto_safe_nodes', 'PM Lead', '2026-06-16T08:11:00.000Z');
    const withDraft = startProjectWorkflowNode(template, autoMode, 'analysis', '2026-06-16T08:12:00.000Z');
    const requested = autoRequestEligibleProjectWorkflowDrafts(
      withDraft,
      'Auto Run Policy',
      '2026-06-16T08:13:00.000Z',
    );

    const packages = buildProjectWorkflowExecutionRequests(requested);

    expect(packages).toHaveLength(1);
    expect(packages[0]).toMatchObject({
      nodeId: 'analysis',
      requestedBy: 'Auto Run Policy',
      requestedAt: '2026-06-16T08:13:00.000Z',
      executionState: 'dry_run_only',
      capabilityId: 'software:analysis:agent',
      executorResolution: {
        state: 'unresolved',
        executionState: 'dry_run_only',
      },
    });
    expect(packages[0].command).toBeUndefined();
  });

  it('builds request packages with an injected Integration Hub executor registry', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T11:00:00.000Z',
    });
    const autoMode = setProjectWorkflowExecutionMode(run, 'auto_safe_nodes', 'PM Lead', '2026-06-16T11:01:00.000Z');
    const withDraft = startProjectWorkflowNode(template, autoMode, 'analysis', '2026-06-16T11:02:00.000Z');
    const requested = autoRequestEligibleProjectWorkflowDrafts(
      withDraft,
      'Auto Run Policy',
      '2026-06-16T11:03:00.000Z',
    );

    const packages = buildProjectWorkflowExecutionRequests(requested, {
      'software:analysis:agent': {
        state: 'resolved',
        executionState: 'dry_run_only',
        integrationSheet: 'commands',
        sourceKind: 'command-mapping',
        sourceId: 'analysis:prepare-plan',
        label: 'Prepare analysis plan',
        commandPreview: 'pm-agent dry-run analysis --feature F54',
        command: { command: 'pm-agent', args: ['dry-run', 'analysis', '--feature', 'F54'] },
        safetyNotice: 'Dry-run executor candidate only; Project Manager has not executed this command.',
      },
    });

    expect(packages).toHaveLength(1);
    expect(packages[0]).toMatchObject({
      nodeId: 'analysis',
      requestedBy: 'Auto Run Policy',
      executionState: 'dry_run_only',
      capabilityId: 'software:analysis:agent',
      executorResolution: {
        state: 'resolved',
        integrationSheet: 'commands',
        sourceKind: 'command-mapping',
        sourceId: 'analysis:prepare-plan',
        label: 'Prepare analysis plan',
        commandPreview: 'pm-agent dry-run analysis --feature F54',
      },
    });
    expect(packages[0].command).toEqual({
      command: 'pm-agent',
      args: ['dry-run', 'analysis', '--feature', 'F54'],
    });
  });

  it('persists request packages under a stable feature-neutral queue directory', async () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T08:20:00.000Z',
    });
    const withDraft = startProjectWorkflowNode(template, run, 'verification', '2026-06-16T08:21:00.000Z');
    const requested = requestProjectWorkflowDraftRun(
      withDraft,
      withDraft.executionDrafts[0].id,
      'PM Lead',
      '2026-06-16T08:22:00.000Z',
    );
    const writes: Array<{ path: string; content: string }> = [];

    const paths = await saveProjectWorkflowExecutionRequests('/repo/Project-Manager', requested, {
      writeFile: vi.fn(async (path, content) => {
        writes.push({ path, content });
      }),
    });

    expect(projectWorkflowExecutionRequestsDirectory('/repo/Project-Manager')).toBe(
      '/repo/Project-Manager/.project-manager/project-workflow-execution-requests',
    );
    expect(paths).toEqual([
      projectWorkflowExecutionRequestPath('/repo/Project-Manager', buildProjectWorkflowExecutionRequests(requested)[0].id),
    ]);
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0].content)).toMatchObject({
      workflowRunId: requested.id,
      nodeId: 'verification',
      status: 'pending_external_executor',
    });
  });

  it('blocks executor consumption until a request is approved', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T08:40:00.000Z',
    });
    const withDraft = startProjectWorkflowNode(template, run, 'verification', '2026-06-16T08:41:00.000Z');
    const requested = requestProjectWorkflowDraftRun(
      withDraft,
      withDraft.executionDrafts[0].id,
      'PM Lead',
      '2026-06-16T08:42:00.000Z',
    );
    const [request] = buildProjectWorkflowExecutionRequests(requested);

    expect(evaluateProjectWorkflowExecutionRequestConsumption(request)).toEqual({
      state: 'blocked',
      requestId: request.id,
      reason: 'Execution request must be approved_for_executor before any executor may consume it.',
    });
  });

  it('blocks approved requests with unresolved executor candidates', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T08:50:00.000Z',
    });
    const autoMode = setProjectWorkflowExecutionMode(run, 'auto_safe_nodes', 'PM Lead', '2026-06-16T08:51:00.000Z');
    const withDraft = startProjectWorkflowNode(template, autoMode, 'analysis', '2026-06-16T08:52:00.000Z');
    const requested = autoRequestEligibleProjectWorkflowDrafts(
      withDraft,
      'Auto Run Policy',
      '2026-06-16T08:53:00.000Z',
    );
    const [request] = buildProjectWorkflowExecutionRequests(requested);
    const approved = approveProjectWorkflowExecutionRequest(request, 'Lead PM', '2026-06-16T08:54:00.000Z');

    expect(evaluateProjectWorkflowExecutionRequestConsumption(approved)).toEqual({
      state: 'blocked',
      requestId: request.id,
      reason: 'Execution request has no resolved Integration Hub executor candidate.',
    });
  });

  it('marks approved resolved dry-run requests ready for a future executor without executing them', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T09:00:00.000Z',
    });
    const withDraft = startProjectWorkflowNode(template, run, 'verification', '2026-06-16T09:01:00.000Z');
    const requested = requestProjectWorkflowDraftRun(
      withDraft,
      withDraft.executionDrafts[0].id,
      'PM Lead',
      '2026-06-16T09:02:00.000Z',
    );
    const [request] = buildProjectWorkflowExecutionRequests(requested);
    const approved = approveProjectWorkflowExecutionRequest(request, 'Lead PM', '2026-06-16T09:03:00.000Z');

    expect(evaluateProjectWorkflowExecutionRequestConsumption(approved)).toEqual({
      state: 'ready',
      requestId: request.id,
      executionState: 'dry_run_only',
      command: { command: 'npm', args: ['run', 'verify:baseline'] },
      reason: 'Approved dry-run request is ready for a future executor handoff.',
    });
  });

  it('builds a dry-run handoff record for approved ready requests without executing the command', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T09:10:00.000Z',
    });
    const withDraft = startProjectWorkflowNode(template, run, 'verification', '2026-06-16T09:11:00.000Z');
    const requested = requestProjectWorkflowDraftRun(
      withDraft,
      withDraft.executionDrafts[0].id,
      'PM Lead',
      '2026-06-16T09:12:00.000Z',
    );
    const [request] = buildProjectWorkflowExecutionRequests(requested);
    const approved = approveProjectWorkflowExecutionRequest(request, 'Lead PM', '2026-06-16T09:13:00.000Z');

    const record = buildProjectWorkflowExecutorHandoffRecord(
      approved,
      'Dry Run Executor',
      '2026-06-16T09:14:00.000Z',
    );

    expect(record).toMatchObject({
      schemaVersion: 1,
      id: `${approved.id}:handoff:2026-06-16T09-14-00.000Z`,
      requestId: approved.id,
      workflowRunId: approved.workflowRunId,
      workItemId: 'F54',
      nodeId: 'verification',
      status: 'ready_for_executor',
      consumedBy: 'Dry Run Executor',
      consumedAt: '2026-06-16T09:14:00.000Z',
      executionState: 'dry_run_only',
      command: { command: 'npm', args: ['run', 'verify:baseline'] },
      commandPreview: 'npm run verify:baseline',
      policyDecision: {
        state: 'ready',
        reason: 'Approved dry-run request is ready for a future executor handoff.',
      },
      safetyNotice: 'Handoff record only; Project Manager did not execute the command.',
    });
    expect(serializeProjectWorkflowExecutorHandoffRecord(record)).toContain('"status": "ready_for_executor"');
  });

  it('builds a blocked handoff record when policy rejects the package', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T09:20:00.000Z',
    });
    const withDraft = startProjectWorkflowNode(template, run, 'verification', '2026-06-16T09:21:00.000Z');
    const requested = requestProjectWorkflowDraftRun(
      withDraft,
      withDraft.executionDrafts[0].id,
      'PM Lead',
      '2026-06-16T09:22:00.000Z',
    );
    const [request] = buildProjectWorkflowExecutionRequests(requested);

    const record = buildProjectWorkflowExecutorHandoffRecord(
      request,
      'Dry Run Executor',
      '2026-06-16T09:23:00.000Z',
    );

    expect(record).toMatchObject({
      requestId: request.id,
      status: 'blocked_by_policy',
      consumedBy: 'Dry Run Executor',
      consumedAt: '2026-06-16T09:23:00.000Z',
      executionState: 'dry_run_only',
      commandPreview: 'npm run verify:baseline',
      policyDecision: {
        state: 'blocked',
        reason: 'Execution request must be approved_for_executor before any executor may consume it.',
      },
      safetyNotice: 'Handoff record only; Project Manager did not execute the command.',
    });
    expect(record.command).toBeUndefined();
  });

  it('persists executor handoff records under a stable audit directory', async () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T09:30:00.000Z',
    });
    const withDraft = startProjectWorkflowNode(template, run, 'verification', '2026-06-16T09:31:00.000Z');
    const requested = requestProjectWorkflowDraftRun(
      withDraft,
      withDraft.executionDrafts[0].id,
      'PM Lead',
      '2026-06-16T09:32:00.000Z',
    );
    const [request] = buildProjectWorkflowExecutionRequests(requested);
    const approved = approveProjectWorkflowExecutionRequest(request, 'Lead PM', '2026-06-16T09:33:00.000Z');
    const record = buildProjectWorkflowExecutorHandoffRecord(
      approved,
      'Dry Run Executor',
      '2026-06-16T09:34:00.000Z',
    );
    const writes: Array<{ path: string; content: string }> = [];

    const path = await saveProjectWorkflowExecutorHandoffRecord('/repo/Project-Manager', record, {
      writeFile: vi.fn(async (writePath, content) => {
        writes.push({ path: writePath, content });
      }),
    });

    expect(projectWorkflowExecutorHandoffRecordsDirectory('/repo/Project-Manager')).toBe(
      '/repo/Project-Manager/.project-manager/project-workflow-execution-records',
    );
    expect(path).toBe(projectWorkflowExecutorHandoffRecordPath('/repo/Project-Manager', record.id));
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0].content)).toMatchObject({
      requestId: approved.id,
      nodeId: 'verification',
      status: 'ready_for_executor',
      safetyNotice: 'Handoff record only; Project Manager did not execute the command.',
    });
  });

  it('builds a dry-run executor run record for approved ready requests without spawning a process', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T09:40:00.000Z',
    });
    const withDraft = startProjectWorkflowNode(template, run, 'verification', '2026-06-16T09:41:00.000Z');
    const requested = requestProjectWorkflowDraftRun(
      withDraft,
      withDraft.executionDrafts[0].id,
      'PM Lead',
      '2026-06-16T09:42:00.000Z',
    );
    const [request] = buildProjectWorkflowExecutionRequests(requested);
    const approved = approveProjectWorkflowExecutionRequest(request, 'Lead PM', '2026-06-16T09:43:00.000Z');

    const record = buildProjectWorkflowExecutorRunRecord(
      approved,
      'Integration Hub dry-run runner',
      '2026-06-16T09:44:00.000Z',
    );

    expect(record).toMatchObject({
      schemaVersion: 1,
      id: `${approved.id}:run:2026-06-16T09-44-00.000Z`,
      requestId: approved.id,
      workflowRunId: approved.workflowRunId,
      workItemId: 'F54',
      nodeId: 'verification',
      status: 'dry_run_completed',
      consumedBy: 'Integration Hub dry-run runner',
      consumedAt: '2026-06-16T09:44:00.000Z',
      executionState: 'dry_run_only',
      command: { command: 'npm', args: ['run', 'verify:baseline'] },
      commandPreview: 'npm run verify:baseline',
      runnerResult: {
        state: 'completed',
        exitCode: 0,
        stdoutPreview: 'Dry-run executor validated the approved command package. No process was spawned.',
        stderrPreview: '',
      },
      safetyNotice: 'Dry-run executor result only; Project Manager did not spawn a process or execute the command.',
    });
    expect(serializeProjectWorkflowExecutorRunRecord(record)).toContain('"status": "dry_run_completed"');
  });

  it('builds a blocked dry-run executor run record when policy rejects the package', () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T09:50:00.000Z',
    });
    const withDraft = startProjectWorkflowNode(template, run, 'verification', '2026-06-16T09:51:00.000Z');
    const requested = requestProjectWorkflowDraftRun(
      withDraft,
      withDraft.executionDrafts[0].id,
      'PM Lead',
      '2026-06-16T09:52:00.000Z',
    );
    const [request] = buildProjectWorkflowExecutionRequests(requested);

    const record = buildProjectWorkflowExecutorRunRecord(
      request,
      'Integration Hub dry-run runner',
      '2026-06-16T09:53:00.000Z',
    );

    expect(record).toMatchObject({
      requestId: request.id,
      status: 'blocked_by_policy',
      consumedBy: 'Integration Hub dry-run runner',
      executionState: 'dry_run_only',
      commandPreview: 'npm run verify:baseline',
      runnerResult: {
        state: 'blocked',
        reason: 'Execution request must be approved_for_executor before any executor may consume it.',
      },
      safetyNotice: 'Dry-run executor result only; Project Manager did not spawn a process or execute the command.',
    });
    expect(record.command).toBeUndefined();
    expect(record.runnerResult).not.toHaveProperty('exitCode');
  });

  it('persists dry-run executor run records in the execution records audit directory', async () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T10:00:00.000Z',
    });
    const withDraft = startProjectWorkflowNode(template, run, 'verification', '2026-06-16T10:01:00.000Z');
    const requested = requestProjectWorkflowDraftRun(
      withDraft,
      withDraft.executionDrafts[0].id,
      'PM Lead',
      '2026-06-16T10:02:00.000Z',
    );
    const [request] = buildProjectWorkflowExecutionRequests(requested);
    const approved = approveProjectWorkflowExecutionRequest(request, 'Lead PM', '2026-06-16T10:03:00.000Z');
    const record = buildProjectWorkflowExecutorRunRecord(
      approved,
      'Integration Hub dry-run runner',
      '2026-06-16T10:04:00.000Z',
    );
    const writes: Array<{ path: string; content: string }> = [];

    const path = await saveProjectWorkflowExecutorRunRecord('/repo/Project-Manager', record, {
      writeFile: vi.fn(async (writePath, content) => {
        writes.push({ path: writePath, content });
      }),
    });

    expect(path).toBe(projectWorkflowExecutorHandoffRecordPath('/repo/Project-Manager', record.id));
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0].content)).toMatchObject({
      requestId: approved.id,
      status: 'dry_run_completed',
      runnerResult: {
        state: 'completed',
        exitCode: 0,
      },
    });
  });

  it('runs approved requests through a dry-run runner adapter before building a result record', async () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T10:10:00.000Z',
    });
    const withDraft = startProjectWorkflowNode(template, run, 'verification', '2026-06-16T10:11:00.000Z');
    const requested = requestProjectWorkflowDraftRun(
      withDraft,
      withDraft.executionDrafts[0].id,
      'PM Lead',
      '2026-06-16T10:12:00.000Z',
    );
    const [request] = buildProjectWorkflowExecutionRequests(requested);
    const approved = approveProjectWorkflowExecutionRequest(request, 'Lead PM', '2026-06-16T10:13:00.000Z');
    const runnerAdapter = {
      runDryRunCommand: vi.fn(async () => ({
        exitCode: 7,
        stdoutPreview: 'adapter stdout preview',
        stderrPreview: 'adapter stderr preview',
      })),
    };

    const record = await runProjectWorkflowExecutorDryRun(
      approved,
      'Integration Hub dry-run runner',
      '2026-06-16T10:14:00.000Z',
      runnerAdapter,
    );

    expect(runnerAdapter.runDryRunCommand).toHaveBeenCalledOnce();
    expect(runnerAdapter.runDryRunCommand).toHaveBeenCalledWith({
      request: approved,
      command: { command: 'npm', args: ['run', 'verify:baseline'] },
      commandPreview: 'npm run verify:baseline',
    });
    expect(record).toMatchObject({
      status: 'dry_run_completed',
      runnerResult: {
        state: 'completed',
        exitCode: 7,
        stdoutPreview: 'adapter stdout preview',
        stderrPreview: 'adapter stderr preview',
      },
    });
  });

  it('does not call the dry-run runner adapter when policy blocks a request', async () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T10:20:00.000Z',
    });
    const withDraft = startProjectWorkflowNode(template, run, 'verification', '2026-06-16T10:21:00.000Z');
    const requested = requestProjectWorkflowDraftRun(
      withDraft,
      withDraft.executionDrafts[0].id,
      'PM Lead',
      '2026-06-16T10:22:00.000Z',
    );
    const [request] = buildProjectWorkflowExecutionRequests(requested);
    const runnerAdapter = {
      runDryRunCommand: vi.fn(async () => ({
        exitCode: 0,
        stdoutPreview: 'should not run',
        stderrPreview: '',
      })),
    };

    const record = await runProjectWorkflowExecutorDryRun(
      request,
      'Integration Hub dry-run runner',
      '2026-06-16T10:23:00.000Z',
      runnerAdapter,
    );

    expect(runnerAdapter.runDryRunCommand).not.toHaveBeenCalled();
    expect(record).toMatchObject({
      status: 'blocked_by_policy',
      runnerResult: {
        state: 'blocked',
        reason: 'Execution request must be approved_for_executor before any executor may consume it.',
      },
    });
  });

  it('blocks live executor spawn for approved dry-run-only requests', async () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T12:20:00.000Z',
    });
    const withDraft = startProjectWorkflowNode(template, run, 'verification', '2026-06-16T12:21:00.000Z');
    const requested = requestProjectWorkflowDraftRun(
      withDraft,
      withDraft.executionDrafts[0].id,
      'PM Lead',
      '2026-06-16T12:22:00.000Z',
    );
    const [request] = buildProjectWorkflowExecutionRequests(requested);
    const approved = approveProjectWorkflowExecutionRequest(request, 'Lead PM', '2026-06-16T12:23:00.000Z');
    const liveAdapter = {
      spawnLiveCommand: vi.fn(async () => ({ pid: 1234, spawnToken: 5678 })),
    };

    const record = await runProjectWorkflowExecutorLive(
      approved,
      '/repo/Project-Manager',
      'Integration Hub live runner',
      '2026-06-16T12:24:00.000Z',
      liveAdapter,
    );

    expect(liveAdapter.spawnLiveCommand).not.toHaveBeenCalled();
    expect(record).toMatchObject({
      status: 'blocked_by_policy',
      executionState: 'dry_run_only',
      runnerResult: {
        state: 'blocked',
        reason: 'Execution request is dry_run_only and cannot be spawned as a live command.',
      },
    });
  });

  it('spawns approved live-command requests through a live runner adapter and records pid evidence', async () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T12:30:00.000Z',
    });
    const withDraft = startProjectWorkflowNode(template, run, 'verification', '2026-06-16T12:31:00.000Z');
    const requested = requestProjectWorkflowDraftRun(
      withDraft,
      withDraft.executionDrafts[0].id,
      'PM Lead',
      '2026-06-16T12:32:00.000Z',
    );
    const [request] = buildProjectWorkflowExecutionRequests(requested, {
      'software:verification:tool': {
        state: 'resolved',
        executionState: 'live_command_allowed',
        integrationSheet: 'commands',
        sourceKind: 'command-mapping',
        sourceId: 'npm:verify-baseline-live',
        label: 'Run Project Manager verification baseline live',
        commandPreview: 'npm run verify:baseline',
        command: { command: 'npm', args: ['run', 'verify:baseline'] },
        safetyNotice: 'Live command candidate; only run after explicit approval.',
      },
    });
    const approved = approveProjectWorkflowExecutionRequest(request, 'Lead PM', '2026-06-16T12:33:00.000Z');
    const liveAdapter = {
      spawnLiveCommand: vi.fn(async () => ({ pid: 1234, spawnToken: 5678 })),
    };

    const record = await runProjectWorkflowExecutorLive(
      approved,
      '/repo/Project-Manager',
      'Integration Hub live runner',
      '2026-06-16T12:34:00.000Z',
      liveAdapter,
    );

    expect(liveAdapter.spawnLiveCommand).toHaveBeenCalledOnce();
    expect(liveAdapter.spawnLiveCommand).toHaveBeenCalledWith({
      request: approved,
      command: { command: 'npm', args: ['run', 'verify:baseline'] },
      commandPreview: 'npm run verify:baseline',
      workingDir: '/repo/Project-Manager',
    });
    expect(record).toMatchObject({
      status: 'live_spawned',
      consumedBy: 'Integration Hub live runner',
      workingDir: '/repo/Project-Manager',
      executionState: 'live_command_allowed',
      runnerResult: {
        state: 'spawned',
        pid: 1234,
        spawnToken: 5678,
      },
      safetyNotice: 'Live executor spawn record only; process output is tracked by spawnToken events.',
    });
  });
});
