import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIAssistantsConsoleClient } from '../app/ai_assistants/AIAssistantsConsoleClient';
import type { AgentWorkflowRun } from '../lib/agent-workflows';
import {
  createProjectWorkflowRun,
  getProjectWorkflowTemplateById,
} from '../lib/project-workflows/projectWorkflowEngine';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
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

  it('shows a Project Workflow empty state when no graph runs exist', () => {
    render(<AIAssistantsConsoleClient activeSheet="workflow-runs" initialProjectWorkflowRuns={[]} />);

    expect(screen.getByText(/No Project Workflow runs found yet/)).toBeInTheDocument();
    expect(screen.getByText(/Use \/workflow <featureId>/)).toBeInTheDocument();
  });
});
