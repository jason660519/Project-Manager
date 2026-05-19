import {
  createRuntimeAdapterFromConfig,
  getAdapterExecutionKind,
} from '../adapters/registry';
import {
  onAgentExit,
  onAgentStdout,
  spawnAgent,
  type AgentExitPayload,
  type AgentStdioPayload,
} from '../bridge';
import type { Feature } from '../types';
import type { ChatContext, SendChatMessageRequest, SendChatMessageResult } from './types';

const ROUTES: Record<string, string> = {
  projects: '/projects',
  dashboard: '/project-progress-dashboard',
  features: '/features',
  files: '/project-files',
  'project-files': '/project-files',
  engineers: '/engineers',
  plugins: '/plugins',
  skills: '/skills',
  channels: '/channels',
  sessions: '/sessions',
  'cron-jobs': '/cron-jobs',
  cron: '/cron-jobs',
  logs: '/logs',
  keys: '/keys',
  settings: '/settings',
  docs: '/documentation',
  documentation: '/documentation',
  chat: '/chat',
};

const HELP_TEXT = [
  'I can help with Project Manager from the sidebar.',
  '',
  'Commands:',
  '- `/help` - show commands',
  '- `/status` - summarize the selected project',
  '- `/go <view>` - open a view, like `/go logs`',
  '- `/dispatch <feature-id>` - prepare a dispatch prompt for a feature',
].join('\n');

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function routeForView(view: string): string | undefined {
  return ROUTES[normalize(view).replace(/^\//, '')];
}

function findFeature(context: ChatContext, featureId: string): Feature | undefined {
  const normalizedId = normalize(featureId);
  return context.selectedProject?.config.features.find((feature) =>
    normalize(feature.id) === normalizedId || normalize(feature.name) === normalizedId
  );
}

function summarizeStatus(context: ChatContext): string {
  const project = context.selectedProject;
  if (!project) return 'No project is selected. Add or select a project from the Projects view first.';

  const features = project.config.features;
  const counts = features.reduce<Record<string, number>>((acc, feature) => {
    acc[feature.status] = (acc[feature.status] ?? 0) + 1;
    return acc;
  }, {});
  const recent = context.recentRuns?.slice(0, 3).map((run) =>
    `- ${run.featureName}: ${run.success ? 'success' : 'failed'} (exit ${run.exitCode})`
  );

  return [
    `Project: ${project.config.project.name}`,
    `Root: ${project.config.project.root}`,
    `Current view: ${context.currentView}`,
    `Features: ${features.length} total, ${counts.done ?? 0} done, ${counts.in_progress ?? 0} in progress, ${counts.todo ?? 0} todo, ${counts.on_hold ?? 0} on hold`,
    `Active runs: ${context.activeRunCount}`,
    recent && recent.length > 0 ? ['Recent runs:', ...recent].join('\n') : null,
  ].filter(Boolean).join('\n');
}

function buildDispatchResponse(context: ChatContext, featureId: string): string {
  const feature = findFeature(context, featureId);
  if (!feature) return `I could not find feature ${featureId}. Try /status to inspect the selected project.`;
  return [
    `Ready to dispatch ${feature.id}: ${feature.name}.`,
    '',
    `Status: ${feature.status} (${feature.progress}%)`,
    `Implementation: ${feature.paths.implementation ?? 'unspecified'}`,
    '',
    'For v1, open the feature from Dashboard or Features and use the existing Dispatch control. A later chat action can open that modal directly.',
  ].join('\n');
}

function naturalLanguageRoute(content: string): string | undefined {
  const text = normalize(content);
  const match = text.match(/\b(?:open|go to|show|navigate to)\s+([a-z-]+)\b/);
  return match ? routeForView(match[1]) : undefined;
}

function localCommand(request: SendChatMessageRequest): SendChatMessageResult | null {
  const content = request.content.trim();
  const lowered = normalize(content);

  if (lowered === '/help' || lowered === 'help') {
    return { content: HELP_TEXT, handledLocally: true };
  }

  if (lowered === '/status' || lowered.includes('project status') || lowered.includes('feature status')) {
    return { content: summarizeStatus(request.context), handledLocally: true };
  }

  if (lowered.startsWith('/go ')) {
    const route = routeForView(content.slice(4));
    if (!route) return { content: 'I do not recognize that view. Try `/help` for supported commands.', handledLocally: true, error: true };
    request.navigate?.(route);
    return { content: `Opened ${route}.`, handledLocally: true, route };
  }

  if (lowered.startsWith('/dispatch ')) {
    return { content: buildDispatchResponse(request.context, content.slice('/dispatch '.length)), handledLocally: true };
  }

  const route = naturalLanguageRoute(content);
  if (route) {
    request.navigate?.(route);
    return { content: `Opened ${route}.`, handledLocally: true, route };
  }

  if (lowered.startsWith('/')) {
    return { content: 'Unknown command. Try `/help` for supported commands.', handledLocally: true, error: true };
  }

  return null;
}

function fallbackFeature(context: ChatContext): Feature {
  return context.selectedFeature ?? context.selectedProject?.config.features[0] ?? {
    id: 'chat',
    name: 'Sidebar Chatbot',
    category: 'Assistant',
    status: 'in_progress',
    progress: 0,
    paths: {},
  };
}

function buildAgentPrompt(content: string, context: ChatContext): string {
  const project = context.selectedProject;
  const selectedFeature = context.selectedFeature;
  const recentRuns = context.recentRuns?.slice(0, 5).map((run) =>
    `- ${run.featureId} ${run.featureName}: ${run.success ? 'success' : 'failed'} exit=${run.exitCode}`
  ).join('\n') || 'None';

  return [
    'You are the Project Manager sidebar assistant. Answer concisely and use app context.',
    '',
    'Current context:',
    `- View: ${context.currentView}`,
    `- Project: ${project?.config.project.name ?? 'none'}`,
    `- Root: ${project?.config.project.root ?? 'none'}`,
    `- Selected feature: ${selectedFeature ? `${selectedFeature.id} ${selectedFeature.name} ${selectedFeature.status}` : 'none'}`,
    `- Active runs: ${context.activeRunCount}`,
    'Recent runs:',
    recentRuns,
    '',
    'User message:',
    content,
  ].join('\n');
}

function waitForAgentOutput(pid: number): Promise<string> {
  if (pid === 0 || typeof window === 'undefined') {
    return Promise.resolve('I sent this to the configured project agent. No live output is available in browser dry-run mode.');
  }

  return new Promise((resolve) => {
    const lines: string[] = [];
    let settled = false;
    let unStdout: (() => void) | undefined;
    let unExit: (() => void) | undefined;

    const finish = (message: string) => {
      if (settled) return;
      settled = true;
      unStdout?.();
      unExit?.();
      resolve(message);
    };

    void onAgentStdout((payload: AgentStdioPayload) => {
      if (payload.pid === pid) lines.push(payload.line);
    }).then((unlisten) => { unStdout = unlisten; });

    void onAgentExit((payload: AgentExitPayload) => {
      if (payload.pid !== pid) return;
      const output = lines.join('\n').trim();
      if (payload.code === 0) finish(output || 'Done.');
      else finish(output || `Agent exited with code ${payload.code}.`);
    }).then((unlisten) => { unExit = unlisten; });

    window.setTimeout(() => {
      finish(lines.join('\n').trim() || 'The agent is still running. Check Logs for live output.');
    }, 15000);
  });
}

export async function sendChatMessage(request: SendChatMessageRequest): Promise<SendChatMessageResult> {
  const local = localCommand(request);
  if (local) return local;

  const project = request.context.selectedProject;
  if (!project) {
    return { content: 'Select a project first so I can answer with project context.', error: true };
  }

  const adapter = request.context.adapters.find((candidate) =>
    getAdapterExecutionKind(candidate) === 'agent-cli'
  );
  if (!adapter) {
    return { content: 'No agent adapter is configured for this project.', error: true };
  }

  const runtime = createRuntimeAdapterFromConfig(adapter);
  const prompt = buildAgentPrompt(request.content, request.context);
  const result = await runtime.execute({
    feature: fallbackFeature(request.context),
    prompt,
    projectRoot: project.config.project.root,
  });

  if (!result.success || !result.command || !result.args) {
    return { content: result.message || 'The agent command could not be prepared.', error: true };
  }

  const pid = await spawnAgent({
    command: result.command,
    args: result.args,
    workingDir: project.config.project.root,
  });
  return { content: await waitForAgentOutput(pid) };
}
