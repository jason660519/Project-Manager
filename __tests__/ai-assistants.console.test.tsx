import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIAssistantsConsoleClient } from '../app/ai_assistants/AIAssistantsConsoleClient';
import type { AgentWorkflowRun } from '../lib/agent-workflows';
import {
  autoRequestEligibleProjectWorkflowDrafts,
  createProjectWorkflowRun,
  getProjectWorkflowTemplateById,
  requestProjectWorkflowDraftRun,
  setProjectWorkflowExecutionMode,
  startProjectWorkflowNode,
} from '../lib/project-workflows/projectWorkflowEngine';
import {
  listProjectWorkflowRuns,
  saveProjectWorkflowExecutionRequests,
  saveProjectWorkflowRun,
} from '../lib/project-workflows';
import { getProjectManagerRoot } from '../lib/bridge';
import {
  loadWorkflowExecutionRecordRows,
  loadWorkflowExecutionRequestRows,
} from '../lib/integrations/load-project-inventory';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('../lib/agent-workflows', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/agent-workflows')>();
  return {
    ...actual,
    listAgentWorkflowRuns: vi.fn(async () => []),
  };
});

vi.mock('../lib/project-workflows', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/project-workflows')>();
  return {
    ...actual,
    listProjectWorkflowRuns: vi.fn(async () => []),
    saveProjectWorkflowExecutionRequests: vi.fn(async () => []),
    saveProjectWorkflowRun: vi.fn(async () => '/repo/Project-Manager/.project-manager/project-workflow-runs/project-workflow-run-F53.json'),
  };
});

vi.mock('../lib/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/bridge')>();
  return {
    ...actual,
    getProjectManagerRoot: vi.fn(async () => '/Users/jasonmacbbookpro/Project/Project-Manager'),
  };
});

vi.mock('../lib/integrations/load-project-inventory', () => ({
  loadWorkflowExecutionRecordRows: vi.fn(async () => []),
  loadWorkflowExecutionRequestRows: vi.fn(async () => []),
}));

const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach((key) => delete localStorageStore[key]); }),
  get length() { return Object.keys(localStorageStore).length; },
  key: vi.fn((_index: number) => ''),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('AIAssistantsConsoleClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    window.history.pushState({}, '', '/');
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders the control console tabs and overview metrics', () => {
    render(<AIAssistantsConsoleClient activeSheet="overview" />);

    expect(screen.getByText('AI Assistants Control Console')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Instance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Permissions/i })).toBeInTheDocument();
    expect(screen.getByText('Terminal Operational Boundaries')).toBeInTheDocument();
    expect(screen.getByText('Whitelist')).toBeInTheDocument();
    expect(screen.getByText('Blacklist')).toBeInTheDocument();
    expect(screen.getByText('git status --short')).toBeInTheDocument();
    expect(screen.getByText('rm -rf *')).toBeInTheDocument();
  });

  it('validates instance URLs and shows production URL warnings', async () => {
    const user = userEvent.setup();
    render(<AIAssistantsConsoleClient activeSheet="instances" />);

    const gatewayInput = screen.getByLabelText(/Gateway Access/i);
    await user.clear(gatewayInput);
    await user.type(gatewayInput, 'ftp://example.test');
    await user.click(screen.getByRole('button', { name: 'Validate' }));

    expect(screen.getByText(/Gateway Access must use https/i)).toBeInTheDocument();
  });

  it('records audit history when a high-risk skill is enabled', async () => {
    const user = userEvent.setup();
    render(<AIAssistantsConsoleClient activeSheet="skills" />);

    await user.click(screen.getAllByRole('button', { name: 'Enable' })[0]);
    await user.click(screen.getByRole('button', { name: /Audit/i }));

    expect(push).toHaveBeenCalledWith('/ai_assistants/audit');
  });

  it('updates permission state from the permissions sheet', async () => {
    const user = userEvent.setup();
    render(<AIAssistantsConsoleClient activeSheet="permissions" />);

    const commandPermission = screen.getByText('tool:run_command');
    expect(commandPermission).toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[3], 'guarded');

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'projectManager:ai-assistants-console:v1',
      expect.stringContaining('"scope":"tool:run_command"'),
    );
  });

  it('hydrates sidecar data after mount without React state warnings', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('terminal-boundaries')) {
        return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
      }
      if (url.includes('terminal-block-suggestions')) {
        return new Response(JSON.stringify({ suggestions: [] }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AIAssistantsConsoleClient
        activeSheet="overview"
        projectRoot="/repo/Project-Manager"
      />,
    );

    await screen.findByText('Terminal Operational Boundaries');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const reactStateWarnings = consoleError.mock.calls
      .flat()
      .filter((message) => typeof message === 'string')
      .filter((message) => message.includes("hasn't mounted yet") || message.includes('side-effect in your render'));

    expect(reactStateWarnings).toHaveLength(0);

    consoleError.mockRestore();
    vi.unstubAllGlobals();
  });

  it('does not request sidecar data when projectRoot is unavailable', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AIAssistantsConsoleClient activeSheet="overview" />);

    await screen.findByText('Terminal Operational Boundaries');
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/assistants/terminal-boundaries'),
        expect.anything(),
      );
      expect(fetchMock).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/assistants/terminal-block-suggestions'),
        expect.anything(),
      );
    });

    vi.unstubAllGlobals();
  });

  it('renders persisted workflow runs and isolated node session scopes', () => {
    const sampleRun: AgentWorkflowRun = {
      id: 'workflow-run-F35-software-dev-20260528041000',
      workflowId: 'software-dev-parallel-v1',
      workflowVersion: 1,
      workflowTitle: 'Software Development Parallel DAG',
      projectId: 'project-manager',
      featureId: 'F35',
      status: 'queued',
      createdAt: '2026-05-28T04:10:00.000Z',
      updatedAt: '2026-05-28T04:10:00.000Z',
      selectedBy: 'dispatch',
      nodeRuns: [
        {
          id: 'workflow-run-F35-software-dev-20260528041000:planner',
          workflowRunId: 'workflow-run-F35-software-dev-20260528041000',
          workflowId: 'software-dev-parallel-v1',
          nodeId: 'planner',
          title: 'Planner',
          role: 'planner',
          status: 'ready',
          attempts: 0,
          maxAttempts: 2,
          retryOn: ['runtime-error'],
          dependencies: [],
          sessionScope: {
            projectId: 'project-manager',
            workflowId: 'software-dev-parallel-v1',
            workflowRunId: 'workflow-run-F35-software-dev-20260528041000',
            nodeId: 'planner',
            agentId: 'planner-planner',
          },
          runtime: {
            provider: 'xmux',
            isolation: 'host-process',
            workingDirectoryMode: 'project-root',
          },
          model: { mode: 'inherit-engineer-role' },
          outputArtifacts: [
            {
              artifactId: 'implementation-plan',
              nodeId: 'planner',
              status: 'pending',
              required: true,
              description: 'Plan and verification matrix',
            },
          ],
        },
      ],
    };

    render(<AIAssistantsConsoleClient activeSheet="workflow-runs" initialWorkflowRuns={[sampleRun]} />);

    expect(screen.getAllByText('Workflow Runs').length).toBeGreaterThan(0);
    expect(screen.getByText('Software Development Parallel DAG')).toBeInTheDocument();
    expect(screen.getByText(/workflow-run-F35-software-dev-20260528041000\/planner\/planner-planner/)).toBeInTheDocument();
  });

  it('renders Project Workflow runs as a graph canvas with node inspector context', async () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const projectWorkflowRun = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F53',
      createdBy: 'PM Lead',
      now: '2026-06-16T00:00:00.000Z',
    });

    render(
      <AIAssistantsConsoleClient
        activeSheet="workflow-runs"
        initialProjectWorkflowRuns={[projectWorkflowRun]}
      />,
    );

    expect(screen.getByText('Workflow Graph')).toBeInTheDocument();
    expect(screen.getByText(/Software Engineering Loop/)).toBeInTheDocument();
    expect(screen.getByText('F53')).toBeInTheDocument();
    expect(screen.getByText('Analysis')).toBeInTheDocument();
    expect(screen.getByText('Implementation')).toBeInTheDocument();
    expect(screen.getByText('Node Inspector')).toBeInTheDocument();
    expect(screen.getByText('Software PM workflow human')).toBeInTheDocument();
    expect(screen.getByText('.project-manager/features/F53/')).toBeInTheDocument();
    expect(screen.getByText('intake-brief')).toBeInTheDocument();
    expect(screen.getByText(/No actor or command is executed/)).toBeInTheDocument();
  });

  it('selects a Project Workflow run and node from workflow run deep-link params', async () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const firstRun = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F52',
      createdBy: 'PM Lead',
      now: '2026-06-16T00:00:00.000Z',
    });
    const targetRun = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      createdBy: 'PM Lead',
      now: '2026-06-16T00:01:00.000Z',
    });
    window.history.pushState(
      {},
      '',
      `/ai_assistants/workflow-runs?workItemId=F54&workflowRunId=${targetRun.id}&nodeId=verification`,
    );

    render(
      <AIAssistantsConsoleClient
        activeSheet="workflow-runs"
        initialProjectWorkflowRuns={[firstRun, targetRun]}
      />,
    );

    expect(screen.getByText('Workflow Graph')).toBeInTheDocument();
    expect(screen.getByText('Software Engineering Loop · F54')).toBeInTheDocument();
    expect(screen.getByText('Software PM workflow tool runner')).toBeInTheDocument();
    expect(screen.getByText('verification-results')).toBeInTheDocument();
  });

  it('shows a Project Workflow empty state when no graph runs exist', () => {
    render(<AIAssistantsConsoleClient activeSheet="workflow-runs" initialProjectWorkflowRuns={[]} />);

    expect(screen.getByText(/No Project Workflow runs found yet/)).toBeInTheDocument();
    expect(screen.getByText(/Use \/workflow <featureId>/)).toBeInTheDocument();
  });

  it('saves a Project Workflow run sidecar from the Workflow Runs tab and reloads graph data', async () => {
    const user = userEvent.setup();
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const savedRun = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F53',
      createdBy: 'PM Lead',
      now: '2026-06-16T05:05:00.000Z',
    });
    vi.mocked(listProjectWorkflowRuns)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([savedRun]);

    render(
      <AIAssistantsConsoleClient
        activeSheet="workflow-runs"
        projectRoot="/repo/Project-Manager"
        initialProjectWorkflowRuns={[]}
      />,
    );

    const featureInput = await screen.findByLabelText(/Feature or work item id/i);
    await user.clear(featureInput);
    await user.type(featureInput, 'F53');
    await user.click(screen.getByRole('button', { name: /Save workflow run/i }));

    await waitFor(() => expect(saveProjectWorkflowRun).toHaveBeenCalledTimes(1));
    expect(saveProjectWorkflowRun).toHaveBeenCalledWith(
      '/repo/Project-Manager',
      expect.objectContaining({
        templateId: 'software-engineering-loop',
        workItemId: 'F53',
      }),
    );
    expect(listProjectWorkflowRuns).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/Saved workflow run:/)).toBeInTheDocument();
    expect(await screen.findByText('Workflow Graph')).toBeInTheDocument();
  });

  it('shows the newly saved workflow run when the sidecar reload returns empty', async () => {
    const user = userEvent.setup();
    vi.mocked(listProjectWorkflowRuns)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    render(
      <AIAssistantsConsoleClient
        activeSheet="workflow-runs"
        projectRoot="/repo/Project-Manager"
        initialProjectWorkflowRuns={[]}
      />,
    );

    const featureInput = await screen.findByLabelText(/Feature or work item id/i);
    await user.clear(featureInput);
    await user.type(featureInput, 'F54');
    await user.click(screen.getByRole('button', { name: /Save workflow run/i }));

    expect(await screen.findByText('Workflow Graph')).toBeInTheDocument();
    expect(screen.getByText('F54')).toBeInTheDocument();
  });

  it('resolves the persisted sample Project Manager root before saving workflow runs', async () => {
    const user = userEvent.setup();
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const savedRun = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F53',
      createdBy: 'PM Lead',
      now: '2026-06-16T05:05:00.000Z',
    });
    vi.mocked(listProjectWorkflowRuns)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([savedRun]);

    render(
      <AIAssistantsConsoleClient
        activeSheet="workflow-runs"
        projectRoot="/Users/Project-Manager"
        initialProjectWorkflowRuns={[]}
      />,
    );

    const featureInput = await screen.findByLabelText(/Feature or work item id/i);
    await user.clear(featureInput);
    await user.type(featureInput, 'F53');
    await user.click(screen.getByRole('button', { name: /Save workflow run/i }));

    await waitFor(() => expect(saveProjectWorkflowRun).toHaveBeenCalledTimes(1));
    expect(getProjectManagerRoot).toHaveBeenCalled();
    expect(saveProjectWorkflowRun).toHaveBeenCalledWith(
      '/Users/jasonmacbbookpro/Project/Project-Manager',
      expect.objectContaining({
        templateId: 'software-engineering-loop',
        workItemId: 'F53',
      }),
    );
  });

  it('starts a selected workflow node and persists an execution draft preview', async () => {
    const user = userEvent.setup();
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const projectWorkflowRun = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      createdBy: 'PM Lead',
      now: '2026-06-16T06:00:00.000Z',
    });
    const startedRun = startProjectWorkflowNode(template, projectWorkflowRun, 'intake', '2026-06-16T06:01:00.000Z');
    vi.mocked(saveProjectWorkflowRun).mockResolvedValueOnce(
      '/repo/Project-Manager/.project-manager/project-workflow-runs/project-workflow-run-F54.json',
    );
    vi.mocked(listProjectWorkflowRuns)
      .mockResolvedValueOnce([projectWorkflowRun])
      .mockResolvedValueOnce([startedRun]);

    render(
      <AIAssistantsConsoleClient
        activeSheet="workflow-runs"
        projectRoot="/repo/Project-Manager"
        initialProjectWorkflowRuns={[projectWorkflowRun]}
      />,
    );

    expect(screen.getByText('Execution Mode')).toBeInTheDocument();
    expect(screen.getAllByText('manual only').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Start node' }));

    await waitFor(() => expect(saveProjectWorkflowRun).toHaveBeenCalledTimes(1));
    expect(saveProjectWorkflowRun).toHaveBeenCalledWith(
      '/repo/Project-Manager',
      expect.objectContaining({
        id: projectWorkflowRun.id,
        executionDrafts: [
          expect.objectContaining({
            nodeId: 'intake',
            status: 'manual_run_required',
          }),
        ],
      }),
    );
    expect(await screen.findByText('Execution Draft')).toBeInTheDocument();
    expect(screen.getByText('manual_run_required')).toBeInTheDocument();
    expect(screen.getByText(/Run is manual-only/)).toBeInTheDocument();
  });

  it('changes run-level execution mode and requests a draft run from the graph UI', async () => {
    const user = userEvent.setup();
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const projectWorkflowRun = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      createdBy: 'PM Lead',
      now: '2026-06-16T06:00:00.000Z',
    });
    const autoModeRun = setProjectWorkflowExecutionMode(projectWorkflowRun, 'auto_safe_nodes', 'PM Lead', '2026-06-16T06:04:00.000Z');
    const startedRun = startProjectWorkflowNode(template, autoModeRun, 'intake', '2026-06-16T06:05:00.000Z');
    const requestedRun = requestProjectWorkflowDraftRun(
      startedRun,
      startedRun.executionDrafts[0].id,
      'PM Lead',
      '2026-06-16T06:06:00.000Z',
    );
    vi.mocked(saveProjectWorkflowRun)
      .mockResolvedValueOnce('/repo/Project-Manager/.project-manager/project-workflow-runs/project-workflow-run-F54.json')
      .mockResolvedValueOnce('/repo/Project-Manager/.project-manager/project-workflow-runs/project-workflow-run-F54.json')
      .mockResolvedValueOnce('/repo/Project-Manager/.project-manager/project-workflow-runs/project-workflow-run-F54.json');
    vi.mocked(listProjectWorkflowRuns)
      .mockResolvedValueOnce([projectWorkflowRun])
      .mockResolvedValueOnce([autoModeRun])
      .mockResolvedValueOnce([startedRun])
      .mockResolvedValueOnce([requestedRun]);

    render(
      <AIAssistantsConsoleClient
        activeSheet="workflow-runs"
        projectRoot="/repo/Project-Manager"
        initialProjectWorkflowRuns={[projectWorkflowRun]}
      />,
    );

    expect(await screen.findByText('Workflow Graph')).toBeInTheDocument();
    await waitFor(() => expect(listProjectWorkflowRuns).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'Auto-run safe nodes' }));
    await waitFor(() => expect(saveProjectWorkflowRun).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getAllByText('auto-run safe nodes').length).toBeGreaterThan(0));

    await user.click(screen.getByRole('button', { name: 'Start node' }));
    await waitFor(() => expect(saveProjectWorkflowRun).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Execution Draft')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Run draft' }));
    await waitFor(() => expect(saveProjectWorkflowRun).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(saveProjectWorkflowExecutionRequests).toHaveBeenCalledWith(
      '/repo/Project-Manager',
      expect.objectContaining({
        executionDrafts: [
          expect.objectContaining({
            status: 'run_requested',
            runRequestedBy: 'PM Lead',
          }),
        ],
      }),
    ));
    expect(await screen.findByText('run_requested')).toBeInTheDocument();
    expect(screen.getByText('pending_external_executor')).toBeInTheDocument();
  });

  it('shows Integration Hub executor candidates for drafts with registered capabilities', async () => {
    const user = userEvent.setup();
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const projectWorkflowRun = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      createdBy: 'PM Lead',
      now: '2026-06-16T07:10:00.000Z',
    });
    const startedRun = startProjectWorkflowNode(template, projectWorkflowRun, 'verification', '2026-06-16T07:11:00.000Z');
    vi.mocked(listProjectWorkflowRuns).mockResolvedValueOnce([startedRun]);

    render(
      <AIAssistantsConsoleClient
        activeSheet="workflow-runs"
        projectRoot="/repo/Project-Manager"
        initialProjectWorkflowRuns={[startedRun]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Verification/ }));

    expect(await screen.findByText('Executor Candidate')).toBeInTheDocument();
    expect(screen.getByText('Run Project Manager verification baseline')).toBeInTheDocument();
    expect(screen.getByText('npm run verify:baseline')).toBeInTheDocument();
    expect(screen.getByText('dry_run_only')).toBeInTheDocument();
  });

  it('auto-requests a safe draft after Start node when the run is in auto-safe mode', async () => {
    const user = userEvent.setup();
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const initial = {
      ...createProjectWorkflowRun(template, {
        projectId: 'project-manager',
        workItemId: 'F54',
        createdBy: 'PM Lead',
        now: '2026-06-16T07:20:00.000Z',
      }),
      executionMode: 'auto_safe_nodes' as const,
    };
    const readyForAnalysis = {
      ...initial,
      nodeRuns: initial.nodeRuns.map((nodeRun) =>
        nodeRun.nodeId === 'intake'
          ? { ...nodeRun, status: 'succeeded' as const, completedAt: '2026-06-16T07:21:00.000Z' }
          : nodeRun.nodeId === 'analysis'
            ? { ...nodeRun, status: 'ready' as const }
            : nodeRun,
      ),
    };
    const startedRun = startProjectWorkflowNode(template, readyForAnalysis, 'analysis', '2026-06-16T07:22:00.000Z');
    const autoRequestedRun = autoRequestEligibleProjectWorkflowDrafts(
      startedRun,
      'Auto Run Policy',
      '2026-06-16T07:23:00.000Z',
    );
    vi.mocked(saveProjectWorkflowRun).mockResolvedValueOnce(
      '/repo/Project-Manager/.project-manager/project-workflow-runs/project-workflow-run-F54.json',
    );
    vi.mocked(listProjectWorkflowRuns)
      .mockResolvedValueOnce([readyForAnalysis])
      .mockResolvedValueOnce([autoRequestedRun]);

    render(
      <AIAssistantsConsoleClient
        activeSheet="workflow-runs"
        projectRoot="/repo/Project-Manager"
        initialProjectWorkflowRuns={[readyForAnalysis]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Analysis/ }));
    await user.click(screen.getByRole('button', { name: 'Start node' }));

    await waitFor(() => expect(saveProjectWorkflowRun).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(saveProjectWorkflowExecutionRequests).toHaveBeenCalledWith(
      '/repo/Project-Manager',
      expect.objectContaining({
        executionDrafts: [
          expect.objectContaining({
            nodeId: 'analysis',
            status: 'run_requested',
            runRequestedBy: 'Auto Run Policy',
          }),
        ],
      }),
    ));
    expect(saveProjectWorkflowRun).toHaveBeenCalledWith(
      '/repo/Project-Manager',
      expect.objectContaining({
        executionDrafts: [
          expect.objectContaining({
            nodeId: 'analysis',
            status: 'run_requested',
            runRequestedBy: 'Auto Run Policy',
          }),
        ],
      }),
    );
    expect(await screen.findByText('run_requested')).toBeInTheDocument();
    expect(screen.getByText('Auto Run Policy')).toBeInTheDocument();
    expect(screen.getByText('pending_external_executor')).toBeInTheDocument();
  });

  it('passes Integration Hub command mapping executor registry when persisting requested drafts', async () => {
    const user = userEvent.setup();
    localStorageStore['projectManager.shared.channels'] = JSON.stringify({
      channels: [],
      commandMappings: [
        {
          id: 'analysis-dry-run',
          trigger: '/analysis-dry-run',
          action: 'custom',
          description: 'Prepare analysis plan',
          enabled: true,
          executor: {
            capabilityId: 'software:analysis:agent',
            command: { command: 'pm-agent', args: ['dry-run', 'analysis', '--feature', 'F54'] },
            commandPreview: 'pm-agent dry-run analysis --feature F54',
          },
        },
      ],
    });
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const initial = {
      ...createProjectWorkflowRun(template, {
        projectId: 'project-manager',
        workItemId: 'F54',
        createdBy: 'PM Lead',
        now: '2026-06-16T11:10:00.000Z',
      }),
      executionMode: 'auto_safe_nodes' as const,
    };
    const readyForAnalysis = {
      ...initial,
      nodeRuns: initial.nodeRuns.map((nodeRun) =>
        nodeRun.nodeId === 'intake'
          ? { ...nodeRun, status: 'succeeded' as const, completedAt: '2026-06-16T11:11:00.000Z' }
          : nodeRun.nodeId === 'analysis'
            ? { ...nodeRun, status: 'ready' as const }
            : nodeRun,
      ),
    };
    const startedRun = startProjectWorkflowNode(template, readyForAnalysis, 'analysis', '2026-06-16T11:12:00.000Z');
    const autoRequestedRun = autoRequestEligibleProjectWorkflowDrafts(
      startedRun,
      'Auto Run Policy',
      '2026-06-16T11:13:00.000Z',
    );
    vi.mocked(saveProjectWorkflowRun).mockResolvedValueOnce(
      '/repo/Project-Manager/.project-manager/project-workflow-runs/project-workflow-run-F54.json',
    );
    vi.mocked(listProjectWorkflowRuns)
      .mockResolvedValueOnce([readyForAnalysis])
      .mockResolvedValueOnce([autoRequestedRun]);

    render(
      <AIAssistantsConsoleClient
        activeSheet="workflow-runs"
        projectRoot="/repo/Project-Manager"
        initialProjectWorkflowRuns={[readyForAnalysis]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Analysis/ }));
    await user.click(screen.getByRole('button', { name: 'Start node' }));

    await waitFor(() => expect(saveProjectWorkflowExecutionRequests).toHaveBeenCalledWith(
      '/repo/Project-Manager',
      expect.objectContaining({
        executionDrafts: [
          expect.objectContaining({
            nodeId: 'analysis',
            status: 'run_requested',
          }),
        ],
      }),
      undefined,
      expect.objectContaining({
        'software:analysis:agent': expect.objectContaining({
          sourceId: 'analysis-dry-run',
          commandPreview: 'pm-agent dry-run analysis --feature F54',
          command: { command: 'pm-agent', args: ['dry-run', 'analysis', '--feature', 'F54'] },
        }),
      }),
    ));
  });

  it('shows Integration Hub command mapping executor candidates in the Workflow Runs inspector', async () => {
    const user = userEvent.setup();
    localStorageStore['projectManager.shared.channels'] = JSON.stringify({
      channels: [],
      commandMappings: [
        {
          id: 'analysis-dry-run',
          trigger: '/analysis-dry-run',
          action: 'custom',
          description: 'Prepare analysis plan',
          enabled: true,
          executor: {
            capabilityId: 'software:analysis:agent',
            command: { command: 'pm-agent', args: ['dry-run', 'analysis', '--feature', 'F54'] },
            commandPreview: 'pm-agent dry-run analysis --feature F54',
            label: 'Analysis dry-run agent',
          },
        },
      ],
    });
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const initial = {
      ...createProjectWorkflowRun(template, {
        projectId: 'project-manager',
        workItemId: 'F54',
        createdBy: 'PM Lead',
        now: '2026-06-16T11:30:00.000Z',
      }),
      executionMode: 'auto_safe_nodes' as const,
    };
    const readyForAnalysis = {
      ...initial,
      nodeRuns: initial.nodeRuns.map((nodeRun) =>
        nodeRun.nodeId === 'intake'
          ? { ...nodeRun, status: 'succeeded' as const, completedAt: '2026-06-16T11:31:00.000Z' }
          : nodeRun.nodeId === 'analysis'
            ? { ...nodeRun, status: 'ready' as const }
            : nodeRun,
      ),
    };
    const startedRun = startProjectWorkflowNode(template, readyForAnalysis, 'analysis', '2026-06-16T11:32:00.000Z');
    const autoRequestedRun = autoRequestEligibleProjectWorkflowDrafts(
      startedRun,
      'Auto Run Policy',
      '2026-06-16T11:33:00.000Z',
    );
    vi.mocked(listProjectWorkflowRuns).mockResolvedValueOnce([autoRequestedRun]);

    render(
      <AIAssistantsConsoleClient
        activeSheet="workflow-runs"
        projectRoot="/repo/Project-Manager"
        initialProjectWorkflowRuns={[autoRequestedRun]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Analysis/ }));

    expect(await screen.findByText('Executor Candidate')).toBeInTheDocument();
    expect(screen.getByText('Analysis dry-run agent')).toBeInTheDocument();
    expect(screen.getByText('pm-agent dry-run analysis --feature F54')).toBeInTheDocument();
  });

  it('opens the Integration Hub execution request queue from a requested draft', async () => {
    const user = userEvent.setup();
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const initial = {
      ...createProjectWorkflowRun(template, {
        projectId: 'project-manager',
        workItemId: 'F54',
        createdBy: 'PM Lead',
        now: '2026-06-16T11:40:00.000Z',
      }),
      executionMode: 'auto_safe_nodes' as const,
    };
    const readyForAnalysis = {
      ...initial,
      nodeRuns: initial.nodeRuns.map((nodeRun) =>
        nodeRun.nodeId === 'intake'
          ? { ...nodeRun, status: 'succeeded' as const, completedAt: '2026-06-16T11:41:00.000Z' }
          : nodeRun.nodeId === 'analysis'
            ? { ...nodeRun, status: 'ready' as const }
            : nodeRun,
      ),
    };
    const startedRun = startProjectWorkflowNode(template, readyForAnalysis, 'analysis', '2026-06-16T11:42:00.000Z');
    const autoRequestedRun = autoRequestEligibleProjectWorkflowDrafts(
      startedRun,
      'Auto Run Policy',
      '2026-06-16T11:43:00.000Z',
    );
    vi.mocked(listProjectWorkflowRuns).mockResolvedValueOnce([autoRequestedRun]);

    render(
      <AIAssistantsConsoleClient
        activeSheet="workflow-runs"
        projectRoot="/repo/Project-Manager"
        initialProjectWorkflowRuns={[autoRequestedRun]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Analysis/ }));
    await user.click(await screen.findByRole('button', { name: 'Review execution request' }));

    expect(push).toHaveBeenCalledWith('/integrations-hub/workflow-execution-requests');
  });

  it('opens Integration Hub commands when a workflow draft has no executor candidate', async () => {
    const user = userEvent.setup();
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const initial = {
      ...createProjectWorkflowRun(template, {
        projectId: 'project-manager',
        workItemId: 'F54',
        createdBy: 'PM Lead',
        now: '2026-06-16T11:50:00.000Z',
      }),
      executionMode: 'auto_safe_nodes' as const,
    };
    const readyForAnalysis = {
      ...initial,
      nodeRuns: initial.nodeRuns.map((nodeRun) =>
        nodeRun.nodeId === 'intake'
          ? { ...nodeRun, status: 'succeeded' as const, completedAt: '2026-06-16T11:51:00.000Z' }
          : nodeRun.nodeId === 'analysis'
            ? { ...nodeRun, status: 'ready' as const }
            : nodeRun,
      ),
    };
    const startedRun = startProjectWorkflowNode(template, readyForAnalysis, 'analysis', '2026-06-16T11:52:00.000Z');
    const autoRequestedRun = autoRequestEligibleProjectWorkflowDrafts(
      startedRun,
      'Auto Run Policy',
      '2026-06-16T11:53:00.000Z',
    );
    vi.mocked(listProjectWorkflowRuns).mockResolvedValueOnce([autoRequestedRun]);

    render(
      <AIAssistantsConsoleClient
        activeSheet="workflow-runs"
        projectRoot="/repo/Project-Manager"
        initialProjectWorkflowRuns={[autoRequestedRun]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Analysis/ }));

    expect(await screen.findByText('Executor Candidate')).toBeInTheDocument();
    expect(screen.getByText('unresolved')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Configure executor' }));

    expect(push).toHaveBeenCalledWith('/integrations-hub/commands');
  });

  it('shows execution request review state and dry-run record evidence in the workflow inspector', async () => {
    const user = userEvent.setup();
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const initial = {
      ...createProjectWorkflowRun(template, {
        projectId: 'project-manager',
        workItemId: 'F54',
        createdBy: 'PM Lead',
        now: '2026-06-16T12:00:00.000Z',
      }),
      executionMode: 'auto_safe_nodes' as const,
    };
    const readyForAnalysis = {
      ...initial,
      nodeRuns: initial.nodeRuns.map((nodeRun) =>
        nodeRun.nodeId === 'intake'
          ? { ...nodeRun, status: 'succeeded' as const, completedAt: '2026-06-16T12:01:00.000Z' }
          : nodeRun.nodeId === 'analysis'
            ? { ...nodeRun, status: 'ready' as const }
            : nodeRun,
      ),
    };
    const startedRun = startProjectWorkflowNode(template, readyForAnalysis, 'analysis', '2026-06-16T12:02:00.000Z');
    const autoRequestedRun = autoRequestEligibleProjectWorkflowDrafts(
      startedRun,
      'Auto Run Policy',
      '2026-06-16T12:03:00.000Z',
    );
    const draft = autoRequestedRun.executionDrafts[0];
    vi.mocked(listProjectWorkflowRuns).mockResolvedValueOnce([autoRequestedRun]);
    vi.mocked(loadWorkflowExecutionRequestRows).mockResolvedValueOnce([
      {
        rowKey: 'workflow-execution-request:request-1',
        sheet: 'workflow-execution-requests',
        sourceKind: 'workflow-execution-request',
        sourceId: 'request-1',
        enabled: false,
        category1: 'Workflow Execution',
        category2: 'approved_for_executor',
        githubUrl: '',
        company: 'Project Manager',
        name: 'F54 · Analysis',
        version: 'schema v1',
        license: '',
        scope: 'project',
        port: '',
        installPath: '/repo/.project-manager/project-workflow-execution-requests/request.json',
        installMethod: 'Auto Run Policy',
        status: 'idle',
        statusLabel: 'pending_external_executor',
        lastUpdated: '2026-06-16T12:04:00.000Z',
        notes: 'Command preview: pm-agent dry-run analysis --feature F54',
        lv: null,
        badges: ['approved_for_executor', 'dry_run_only', 'commands', 'software:analysis:agent'],
        payload: {
          id: 'request-1',
          workflowRunId: autoRequestedRun.id,
          draftId: draft.id,
          workItemId: 'F54',
          nodeId: 'analysis',
          reviewStatus: 'approved_for_executor',
          policyGate: {
            state: 'approved_for_executor',
            reason: 'Human approved this dry-run request for a future executor handoff.',
          },
          commandPreview: 'pm-agent dry-run analysis --feature F54',
        },
      },
    ]);
    vi.mocked(loadWorkflowExecutionRecordRows).mockResolvedValueOnce([
      {
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
        lastUpdated: '2026-06-16T12:05:00.000Z',
        notes: 'Dry-run executor validated the approved command package. No process was spawned.',
        lv: null,
        badges: ['dry_run_completed', 'dry_run_only', 'ready', 'completed', 'software:analysis:agent'],
        payload: {
          id: 'record-1',
          requestId: 'request-1',
          workflowRunId: autoRequestedRun.id,
          draftId: draft.id,
          workItemId: 'F54',
          nodeId: 'analysis',
          status: 'dry_run_completed',
          runnerResult: {
            state: 'completed',
            exitCode: 0,
            stdoutPreview: 'Dry-run executor validated the approved command package. No process was spawned.',
          },
        },
      },
    ]);

    render(
      <AIAssistantsConsoleClient
        activeSheet="workflow-runs"
        projectRoot="/repo/Project-Manager"
        initialProjectWorkflowRuns={[autoRequestedRun]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Analysis/ }));

    expect(await screen.findByText('Execution Evidence')).toBeInTheDocument();
    expect(screen.getByText('approved_for_executor')).toBeInTheDocument();
    expect(screen.getByText('dry_run_completed')).toBeInTheDocument();
    expect(screen.getByText('completed · exit 0')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Review execution request' }));

    expect(push).toHaveBeenCalledWith('/integrations-hub/workflow-execution-requests?requestId=request-1');

    await user.click(screen.getByRole('button', { name: 'Open execution record' }));

    expect(push).toHaveBeenCalledWith('/integrations-hub/workflow-execution-records?recordId=record-1');
  });
});
