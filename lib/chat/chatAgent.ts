import {
  createRuntimeAdapterFromConfig,
  getAdapterExecutionKind,
} from '../adapters/registry';
import {
  onAgentExit,
  onAgentStdout,
  safeUnlisten,
  callLlmRouted,
  isTauriRuntime,
  killProcess,
  spawnAgent,
  type AgentExitPayload,
  type AgentStdioPayload,
} from '../bridge';
import type { Feature } from '../types';
import { loadAIAssistantsConsoleState } from '../ai-assistants/repository';
import type { PermissionState, TerminalOperationalBoundaries } from '../ai-assistants/types';
import { createDefaultTerminalBoundaries } from '../ai-assistants/terminalBoundaries';
import type { ChatContext, ChatMessage, SendChatMessageRequest, SendChatMessageResult } from './types';
import { imageAttachments } from './multimodal';

const ROUTES: Record<string, string> = {
  projects: '/project-progress-dashboard#projects',
  project: '/project-progress-dashboard#projects',
  dashboard: '/project-progress-dashboard',
  features: '/features',
  engineers: '/ai_assistants/engineers',
  plugins: '/integrations-hub/system_installed_apps',
  skills: '/skills',
  channels: '/integrations-hub/channels',
  sessions: '/sessions',
  'cron-jobs': '/cron-jobs',
  cron: '/cron-jobs',
  logs: '/logs',
  keys: '/keys',
  settings: '/settings',
  docs: '/documentation',
  documentation: '/documentation',
  chat: '/ai_assistants',
};

// ---------------------------------------------------------------------------
// System Prompt v2
// ---------------------------------------------------------------------------

/**
 * Build a rich Chinese-language system prompt with full project context.
 * Truncates at ~6000 chars to stay within reasonable token budgets.
 */
export function buildSystemPrompt(context: ChatContext): string {
  const project = context.selectedProject;
  const features = context.features ?? project?.config.features ?? [];
  const selectedFeature = context.selectedFeature;

  // Feature summary by status
  const statusCounts: Record<string, number> = {};
  const phaseCounts: Record<string, number> = {};
  for (const f of features) {
    statusCounts[f.status] = (statusCounts[f.status] ?? 0) + 1;
    phaseCounts[f.phase ?? 'unknown'] = (phaseCounts[f.phase ?? 'unknown'] ?? 0) + 1;
  }

  // Feature summary by status
  const statusSummary = Object.entries(statusCounts)
    .map(([s, c]) => `${s}: ${c}`)
    .join(', ');

  // Adapter list
  const agentNames = context.adapters
    .filter((a) => a.type === 'agent')
    .map((a) => a.name)
    .join(', ');

  // Recent runs summary (top 5)
  const recentRunsLines = (context.recentRuns ?? []).slice(0, 5).map((r) =>
    `- ${r.featureId} ${r.featureName}: ${r.success ? '✅' : '❌'} (exit ${r.exitCode})`
  );

  // Dashboard projects
  const dashboardNames = context.dashboardProjects ?? [];

  const parts: string[] = [
    `你係 Project Manager 嘅 AI 助手，我叫小龍蝦 🦞`,
    '講嘢風格輕鬆自然，但講到 code 就會戴返工程師眼鏡認真對待。用繁體中文同用戶溝通。',
    '',
    '**專案資訊：**',
    `- 專案名稱：${project?.config.project.name ?? '未選擇'}`,
    `- 專案路徑：${project?.config.project.root ?? '無'}`,
    `- 預設 IDE：${project?.config.project.defaultIDE ?? '無'}`,
    `- 當前頁面：${context.currentView}`,
    '',
    `**功能列表：**${features.length} 個功能`,
    `狀態分佈：${statusSummary || '無'}`,
  ];

  if (Object.keys(phaseCounts).length > 0) {
    const phaseSummary = Object.entries(phaseCounts)
      .map(([p, c]) => `${p}: ${c}`)
      .join(', ');
    parts.push(`階段分佈：${phaseSummary}`);
  }

  if (agentNames) {
    parts.push(`可用 Agent：${agentNames}`);
  }

  if (selectedFeature) {
    parts.push(
      '',
      `**已選功能：**`,
      `- ${selectedFeature.id}: ${selectedFeature.name}`,
      `  狀態：${selectedFeature.status}（${selectedFeature.progress}%）`,
      `  分類：${selectedFeature.category}`,
      `  實作：${selectedFeature.paths?.implementation ?? '未指定'}`,
    );
  }

  if (dashboardNames.length > 0) {
    parts.push('', `**Dashboard 專案：**${dashboardNames.join(', ')}`);
  }

  if (recentRunsLines.length > 0) {
    parts.push('', '**最近執行記錄：**', ...recentRunsLines);
  }

  parts.push(
    '',
    `**執行中任務：**${context.activeRunCount} 個`,
    '',
    '**能力說明：**',
    '- 搜尋檔案內容：問我「搜尋 X」或「search for X」',
    '- 讀取檔案：問我「打開檔案 Y」',
    '- 查看功能詳情：`/feature <id>`',
    '- 查看執行記錄：`/runs`',
    '- 查看記憶：`/memory`',
    '- 導航頁面：`/go <view>` 或「打開 dashboard」',
    '',
    '請簡潔回答，用繁體中文。如果要做 code review 或技術分析，切換到工程師模式認真處理。',
  );

  const full = parts.join('\n');
  // Truncate to ~6000 chars if needed
  if (full.length > 6000) {
    return full.slice(0, 5997) + '...';
  }
  return full;
}

// ---------------------------------------------------------------------------
// Memory System
// ---------------------------------------------------------------------------

const MEMORY_KEY = 'pm-assistant-memory';

interface AssistantMemory {
  lastSearch?: string;
  lastInteractionAt?: number;
  [key: string]: unknown;
}

function memoryStorageKey(context?: ChatContext): string {
  const project = context?.selectedProject;
  const scope = project?.id || project?.config.project.root || 'global';
  return `${MEMORY_KEY}:${encodeURIComponent(scope)}`;
}

function loadMemory(context?: ChatContext): AssistantMemory {
  if (typeof window === 'undefined') return {};
  try {
    const scopedKey = memoryStorageKey(context);
    const raw = window.localStorage.getItem(scopedKey)
      ?? (scopedKey.endsWith(':global') ? window.localStorage.getItem(MEMORY_KEY) : null);
    return raw ? (JSON.parse(raw) as AssistantMemory) : {};
  } catch {
    return {};
  }
}

export function saveMemory(key: string, value: unknown, context?: ChatContext): void {
  if (typeof window === 'undefined') return;
  try {
    const mem = loadMemory(context);
    mem[key] = value;
    mem.lastInteractionAt = Date.now();
    window.localStorage.setItem(memoryStorageKey(context), JSON.stringify(mem));
  } catch {
    // ignore storage errors
  }
}

function getMemoryDump(context?: ChatContext): string {
  const mem = loadMemory(context);
  const entries = Object.entries(mem).filter(
    ([k]) => k !== 'lastInteraction' && k !== 'lastInteractionAt',
  );
  if (entries.length === 0) return '目前沒有任何已儲存的記憶。';
  return entries
    .map(([k, v]) => `- ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Tool Execution
// ---------------------------------------------------------------------------

export async function executeSearch(query: string, projectRoot: string): Promise<string> {
  try {
    const res = await fetch('/api/chat/tools/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, root: projectRoot }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Search failed' }));
      return `搜尋失敗：${err.error ?? res.statusText}`;
    }
    const data = await res.json();
    return data.results ?? data.content ?? JSON.stringify(data);
  } catch (e) {
    return `搜尋出錯：${(e as Error).message}`;
  }
}

export async function executeReadFile(path: string, projectRoot: string): Promise<string> {
  try {
    const res = await fetch('/api/chat/tools/file', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, root: projectRoot }),
    });
    if (!res.ok) {
      if (res.status === 404) return `找不到檔案：${path}`;
      const err = await res.json().catch(() => ({ error: 'File read failed' }));
      return `讀取失敗：${err.error ?? res.statusText}`;
    }
    const data = await res.json();
    return data.content ?? data.result ?? JSON.stringify(data);
  } catch (e) {
    return `讀取出錯：${(e as Error).message}`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function routeForView(view: string): string | undefined {
  return ROUTES[normalize(view).replace(/^\//, '')];
}

function findFeature(context: ChatContext, featureId: string): Feature | undefined {
  const features = context.features ?? context.selectedProject?.config.features ?? [];
  const normalizedId = normalize(featureId);
  return features.find(
    (f) => normalize(f.id) === normalizedId || normalize(f.name) === normalizedId,
  );
}

// ---------------------------------------------------------------------------
// Slash Commands v2
// ---------------------------------------------------------------------------

const HELP_TEXT = `**🦞 Project Manager 小龍蝦助手**

| 指令 | 說明 |
|------|------|
| \`/help\` | 顯示此幫助訊息 |
| \`/status\` | 顯示專案摘要 |
| \`/feature <id>\` | 查看功能詳情 |
| \`/runs\` | 查看執行記錄 |
| \`/config\` | 顯示專案配置 |
| \`/memory\` | 查看已儲存記憶 |
| \`/go <view>\` | 導航至頁面 |
| \`/dispatch <id>\` | 準備 Dispatch 提示 |

**自然語言：**
- 「搜尋 &lt;關鍵字&gt;」— 搜尋專案檔案
- 「search for &lt;keyword&gt;」— 同上（英文）
- 「打開 dashboard」— 導航到 Dashboard
- 「帶我去 logs」— 導航到 Logs`;

function summarizeStatus(context: ChatContext): string {
  const project = context.selectedProject;
  if (!project) return '目前未選擇任何專案。請先在 Dashboard Projects 分頁中加入或選擇一個專案。';

  const features = context.features ?? project.config.features ?? [];
  const statusCounts: Record<string, number> = {};
  const phaseCounts: Record<string, number> = {};
  for (const f of features) {
    statusCounts[f.status] = (statusCounts[f.status] ?? 0) + 1;
    phaseCounts[f.phase ?? 'unknown'] = (phaseCounts[f.phase ?? 'unknown'] ?? 0) + 1;
  }

  const statusRows = Object.entries(statusCounts)
    .map(([s, c]) => `| ${s} | ${c} |`)
    .join('\n');

  const phaseRows = Object.entries(phaseCounts)
    .map(([p, c]) => `| ${p} | ${c} |`)
    .join('\n');

  const adapterList = context.adapters.map((a) => `- ${a.type}: ${a.name}`).join('\n') || '無';
  const dashboardNames = context.dashboardProjects ?? [];

  const recent = context.recentRuns?.slice(0, 3).map((r) =>
    `- ${r.featureId} ${r.featureName}: ${r.success ? '✅' : '❌'} (exit ${r.exitCode})`
  );

  return [
    `## 📊 專案狀態`,
    '',
    `**專案名稱：** ${project.config.project.name}`,
    `**專案路徑：** ${project.config.project.root}`,
    `**預設 IDE：** ${project.config.project.defaultIDE ?? '無'}`,
    `**當前頁面：** ${context.currentView}`,
    '',
    `### 功能狀態分佈`,
    `| 狀態 | 數量 |`,
    `|------|------|`,
    statusRows,
    '',
    `### 階段分佈`,
    `| 階段 | 數量 |`,
    `|------|------|`,
    phaseRows,
    '',
    `**總功能數：** ${features.length}　**執行中任務：** ${context.activeRunCount}`,
    '',
    `### 可用 Adapters`,
    adapterList,
    '',
    dashboardNames.length > 0 ? `### Dashboard 專案\n${dashboardNames.join(', ')}` : null,
    recent && recent.length > 0
      ? `\n### 最近執行\n${recent.join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function summarizeFeature(context: ChatContext, featureId: string): string {
  const feature = findFeature(context, featureId);
  if (!feature) {
    return `找不到功能 **${featureId}**。請用 \`/status\` 查看所有功能。`;
  }

  const notes = feature.notes ? `\n**備註：** ${feature.notes}` : '';

  return [
    `## 📋 ${feature.id}: ${feature.name}`,
    '',
    `| 屬性 | 值 |`,
    `|------|-----|`,
    `| 狀態 | ${feature.status} |`,
    `| 進度 | ${feature.progress}% |`,
    `| 分類 | ${feature.category} |`,
    `| 階段 | ${feature.phase ?? '未指定'} |`,
    `| 實作路徑 | ${feature.paths?.implementation ?? '未指定'} |`,
    `| 測試路徑 | ${feature.paths?.test ?? '未指定'} |`,
    notes,
  ].join('\n');
}

function summarizeRuns(context: ChatContext): string {
  const activeRuns = context.activeRuns ?? [];
  const recentRuns = context.recentRuns ?? [];

  const parts: string[] = ['## 🏃 執行記錄'];

  if (activeRuns.length > 0) {
    parts.push('', '### 執行中', ...activeRuns.map((r) =>
      `- **${r.featureId}** ${r.featureName} (phase: ${r.phase}, started: ${new Date(r.startedAt).toLocaleString()})`
    ));
  } else {
    parts.push('', '目前沒有執行中的任務。');
  }

  if (recentRuns.length > 0) {
    parts.push('', '### 最近執行', ...recentRuns.map((r) =>
      `- ${r.featureId} ${r.featureName}: ${r.success ? '✅' : '❌'} exit=${r.exitCode} (${new Date(r.completedAt).toLocaleString()})`
    ));
  }

  return parts.join('\n');
}

function summarizeConfig(context: ChatContext): string {
  const project = context.selectedProject;
  if (!project) return '目前未選擇任何專案。';

  const adapterList = context.adapters
    .map((a) => `| ${a.id} | ${a.name} | ${a.type} |`)
    .join('\n');

  return [
    `## ⚙️ 專案配置`,
    '',
    `| 屬性 | 值 |`,
    `|------|-----|`,
    `| 專案 ID | ${project.id} |`,
    `| 專案名稱 | ${project.config.project.name} |`,
    `| 專案路徑 | ${project.config.project.root} |`,
    `| 預設 IDE | ${project.config.project.defaultIDE ?? '無'} |`,
    `| 功能數量 | ${project.config.features.length} |`,
    `| Adapters | ${context.adapters.length} 個 |`,
    '',
    `### Adapters`,
    `| ID | 名稱 | 類型 |`,
    `|----|------|------|`,
    adapterList,
  ].join('\n');
}

function buildDispatchResponse(context: ChatContext, featureId: string): string {
  const feature = findFeature(context, featureId);
  if (!feature) {
    return `找不到功能 **${featureId}**。請用 \`/status\` 查看所有功能。`;
  }
  return [
    `## 🚀 Dispatch: ${feature.id} ${feature.name}`,
    '',
    `**狀態：** ${feature.status}（${feature.progress}%）`,
    `**分類：** ${feature.category}`,
    `**實作路徑：** ${feature.paths?.implementation ?? '未指定'}`,
    `**測試路徑：** ${feature.paths?.test ?? '未指定'}`,
    '',
    '請從 Dashboard 或 Features 頁面使用 Dispatch 功能來分派此任務。',
    `或直接輸入 \`/go features\` 前往功能頁面。`,
  ].join('\n');
}

function naturalLanguageRoute(content: string): string | undefined {
  const text = normalize(content);
  const match = text.match(/\b(?:open|go to|show|navigate to)\s+([a-z-]+)\b/);
  return match ? routeForView(match[1]) : undefined;
}

function naturalLanguageSearch(content: string): string | undefined {
  const text = normalize(content);
  // Chinese: 搜尋 X
  const chineseMatch = text.match(/搜尋\s+(.+)/);
  if (chineseMatch) return chineseMatch[1].trim();

  // English: search for X
  const englishMatch = text.match(/search\s+(?:for\s+)?(.+)/i);
  if (englishMatch) return englishMatch[1].trim();

  return undefined;
}

function naturalLanguageChineseRoute(content: string): string | undefined {
  const text = content.trim();
  const mappings: Record<string, string> = {
    打開dashboard: 'dashboard',
    帶我去logs: 'logs',
    帶我去log: 'logs',
    打開logs: 'logs',
    打開log: 'logs',
    打開features: 'features',
    打開功能: 'features',
    打開settings: 'settings',
    打開設定: 'settings',
    打開keys: 'keys',
    打開plugins: 'plugins',
    打開channels: 'channels',
    打開sessions: 'sessions',
    打開文檔: 'documentation',
    打開文件: 'documentation',
    打開docs: 'documentation',
  };
  const normalized = text.replace(/\s+/g, '');
  const target = mappings[normalized];
  if (target) return routeForView(target);
  return undefined;
}

function localCommand(request: SendChatMessageRequest): SendChatMessageResult | null {
  const content = request.content.trim();
  const lowered = normalize(content);

  // /help
  if (lowered === '/help' || lowered === 'help') {
    return { content: HELP_TEXT, handledLocally: true };
  }

  // /status
  if (lowered === '/status' || lowered.includes('project status') || lowered.includes('feature status')) {
    saveMemory('lastInteraction', '/status', request.context);
    return { content: summarizeStatus(request.context), handledLocally: true };
  }

  // /feature <id>
  if (lowered.startsWith('/feature ')) {
    saveMemory('lastInteraction', content, request.context);
    return { content: summarizeFeature(request.context, content.slice('/feature '.length)), handledLocally: true };
  }

  // /runs
  if (lowered === '/runs') {
    saveMemory('lastInteraction', '/runs', request.context);
    return { content: summarizeRuns(request.context), handledLocally: true };
  }

  // /config
  if (lowered === '/config') {
    saveMemory('lastInteraction', '/config', request.context);
    return { content: summarizeConfig(request.context), handledLocally: true };
  }

  // /memory
  if (lowered === '/memory' || lowered === 'memory') {
    saveMemory('lastInteraction', '/memory', request.context);
    return { content: getMemoryDump(request.context), handledLocally: true };
  }

  // /go <view>
  if (lowered.startsWith('/go ')) {
    const route = routeForView(content.slice(4));
    if (!route) {
      return {
        content: '唔好意思，我唔識呢個頁面。試下 `/help` 睇下有咩指令可以用。',
        handledLocally: true,
        error: true,
      };
    }
    request.navigate?.(route);
    return { content: `已打開 ${route}。`, handledLocally: true, route };
  }

  // /dispatch <id>
  if (lowered.startsWith('/dispatch ')) {
    saveMemory('lastInteraction', content, request.context);
    return {
      content: buildDispatchResponse(request.context, content.slice('/dispatch '.length)),
      handledLocally: true,
    };
  }

  // Natural language: Chinese navigation
  const chineseRoute = naturalLanguageChineseRoute(content);
  if (chineseRoute) {
    request.navigate?.(chineseRoute);
    return { content: `已打開 ${chineseRoute}。`, handledLocally: true, route: chineseRoute };
  }

  // Natural language: English navigation
  const route = naturalLanguageRoute(content);
  if (route) {
    request.navigate?.(route);
    return { content: `Opened ${route}.`, handledLocally: true, route };
  }

  // Natural language: Search
  const searchQuery = naturalLanguageSearch(content);
  if (searchQuery && request.context.selectedProject) {
    saveMemory('lastSearch', searchQuery, request.context);
    saveMemory('lastInteraction', `search: ${searchQuery}`, request.context);
    // Defer to tool execution — handled below after localCommand check
    // We return a placeholder so the caller can do the async search
    return {
      content: `正在搜尋「${searchQuery}」...`,
      handledLocally: true,
    };
  }

  // Unknown slash command
  if (lowered.startsWith('/')) {
    return { content: '未知指令。輸入 `/help` 查看可用指令。', handledLocally: true, error: true };
  }

  return null;
}

// ---------------------------------------------------------------------------
// AI Chat API
// ---------------------------------------------------------------------------

function fallbackFeature(context: ChatContext): Feature {
  return (
    context.selectedFeature ??
    context.selectedProject?.config.features[0] ?? {
      id: 'chat',
      name: 'Sidebar Chatbot',
      category: 'Assistant',
      status: 'in_progress',
      progress: 0,
      paths: {},
    }
  );
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || (error instanceof Error && error.name === 'AbortError');
}

function buildAgentPrompt(content: string, context: ChatContext): string {
  const project = context.selectedProject;
  const selectedFeature = context.selectedFeature;
  const recentRuns = (context.recentRuns ?? [])
    .slice(0, 5)
    .map(
      (run) =>
        `- ${run.featureId} ${run.featureName}: ${run.success ? 'success' : 'failed'} exit=${run.exitCode}`,
    )
    .join('\n') || 'None';

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

/**
 * Load the user's preferred chat provider + model from their Key settings.
 */
async function loadChatProvider(): Promise<{ provider: string; model?: string; systemPrompt?: string } | undefined> {
  if (typeof window === 'undefined') return undefined;
  try {
    const settingsRaw = window.localStorage.getItem('pm-chat-settings');
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw);
      if (settings.provider && settings.provider !== 'auto') {
        return {
          provider: settings.provider,
          model: settings.model || undefined,
          systemPrompt: settings.systemPrompt || undefined,
        };
      }
    }
    const raw = window.localStorage.getItem('projectManager-llm-provider-order');
    if (!raw) return undefined;
    const order: { provider: string; model?: string; enabled: boolean }[] = JSON.parse(raw);
    const first = order.find((e) => e.enabled);
    if (!first) return undefined;
    return { provider: first.provider, model: first.model };
  } catch {
    return undefined;
  }
}

/**
 * Call the server-side AI proxy with conversation history.
 * Injects the system prompt as the first message.
 */
async function callChatApi(
  content: string,
  history: ChatMessage[],
  context: ChatContext,
  onStream?: (chunk: string) => void,
  chatSettingsOverride?: { provider: string; model: string; systemPrompt: string },
  abortSignal?: AbortSignal,
  attachments?: SendChatMessageRequest['attachments'],
): Promise<Pick<SendChatMessageResult, 'content' | 'provider' | 'model' | 'routeDecision'>> {
  // Build messages array WITHOUT system prompt (passed separately via systemPrompt field)
  const systemPrompt = chatSettingsOverride?.systemPrompt || buildSystemPrompt(context);
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  for (const m of history) {
    if (m.role === 'user') {
      messages.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant') {
      messages.push({ role: 'assistant', content: m.content });
    }
  }
  messages.push({ role: 'user', content });

  // Determine provider config
  let providerConfig: { provider?: string; model?: string; systemPrompt?: string } = {};
  if (chatSettingsOverride?.provider && chatSettingsOverride.provider !== 'auto') {
    providerConfig = {
      provider: chatSettingsOverride.provider,
      model: chatSettingsOverride.model || undefined,
      systemPrompt,
    };
  } else {
    const userProvider = await loadChatProvider();
    if (userProvider) {
      providerConfig = userProvider;
    }
  }

  const chatPayload: Record<string, unknown> = { messages };
  const multimodalAttachments = imageAttachments(attachments);
  if (multimodalAttachments.length > 0) chatPayload.attachments = multimodalAttachments;
  if (providerConfig.provider) chatPayload.provider = providerConfig.provider;
  if (providerConfig.model) chatPayload.model = providerConfig.model;
  // Always pass system prompt via the dedicated field
  chatPayload.systemPrompt = systemPrompt;

  if (isTauriRuntime()) {
    const nativeResult = await callLlmRouted({
      modelAlias: 'pm-code',
      taskClass: 'chat',
      provider: providerConfig.provider,
      model: providerConfig.model,
      maxTokens: 4096,
      messages,
      systemPrompt,
      attachments: multimodalAttachments,
    });
    if (onStream && nativeResult.content) onStream(nativeResult.content);
    return {
      content: nativeResult.content,
      provider: nativeResult.provider,
      model: nativeResult.model,
      routeDecision: nativeResult.routeDecision,
    };
  }

  // Streaming
  if (onStream) {
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(chatPayload),
      signal: abortSignal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Streaming chat API failed');
    }
    const responseProvider = res.headers.get('x-ai-provider') ?? undefined;
    const responseModel = res.headers.get('x-ai-model') ?? undefined;

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body for streaming');

    const decoder = new TextDecoder();
    let result = '';
    let buffer = '';

    while (true) {
      if (abortSignal?.aborted) throw new DOMException('Chat request aborted', 'AbortError');
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const dataPrefix = 'data: ';
        if (!trimmed.startsWith(dataPrefix)) continue;

        try {
          const json = JSON.parse(trimmed.slice(dataPrefix.length));
          if (json.done) break;
          if (json.text) {
            result += json.text;
            onStream(json.text);
          }
          if (json.error) {
            throw new Error(json.error);
          }
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
            throw parseErr;
          }
        }
      }
    }

    return { content: result, provider: responseProvider, model: responseModel };
  }

  // Non-streaming
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(chatPayload),
    signal: abortSignal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Chat API failed');
  }

  const data = await res.json();
  return { content: data.content ?? '', provider: data.provider, model: data.model };
}

// ---------------------------------------------------------------------------
// Agent dispatch fallback
// ---------------------------------------------------------------------------

function createChatAbortError(): DOMException {
  return new DOMException('Chat request aborted', 'AbortError');
}

function waitForAgentOutput(pid: number, abortSignal?: AbortSignal): Promise<string> {
  if (pid === 0 || typeof window === 'undefined') {
    return Promise.resolve(
      '已將任務發送到已配置的專案 Agent。瀏覽器 dry-run 模式下沒有即時輸出。',
    );
  }

  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    let settled = false;
    let unStdout: (() => void) | undefined;
    let unExit: (() => void) | undefined;
    let timeoutId: number | undefined;

    const cleanup = () => {
      const stdoutCleanup = unStdout;
      const exitCleanup = unExit;
      unStdout = undefined;
      unExit = undefined;
      safeUnlisten(stdoutCleanup);
      safeUnlisten(exitCleanup);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      abortSignal?.removeEventListener('abort', abort);
    };

    const finish = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(message);
    };

    const abort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      void killProcess(pid).catch((error) => {
        console.warn('[chat] failed to kill aborted agent process', { pid, error });
      });
      reject(createChatAbortError());
    };

    if (abortSignal?.aborted) {
      abort();
      return;
    }
    abortSignal?.addEventListener('abort', abort, { once: true });

    void onAgentStdout((payload: AgentStdioPayload) => {
      if (payload.pid === pid) lines.push(payload.line);
    }).then((unlisten) => {
      unStdout = unlisten;
    });

    void onAgentExit((payload: AgentExitPayload) => {
      if (payload.pid !== pid) return;
      const output = lines.join('\n').trim();
      if (payload.code === 0) finish(output || '完成。');
      else finish(output || `Agent 退出，exit code: ${payload.code}。`);
    }).then((unlisten) => {
      unExit = unlisten;
    });

    timeoutId = window.setTimeout(() => {
      finish(lines.join('\n').trim() || 'Agent 仍在執行中。請到 Logs 頁面查看即時輸出。');
    }, 15000);
  });
}

// ---------------------------------------------------------------------------
// Agent API with Tool Calling
// ---------------------------------------------------------------------------

interface AgentStreamCallbacks {
  onThinkingStart?: () => void;
  onThinking?: (text: string) => void;
  onToolCall?: (id: string, name: string, args: Record<string, unknown>) => void;
  onToolResult?: (id: string, content: string, error?: boolean) => void;
  onText?: (chunk: string) => void;
}

interface AgentStreamResult {
  content: string;
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown>; result?: string; error?: boolean }>;
  provider?: string;
  model?: string;
  routeDecision?: SendChatMessageResult['routeDecision'];
}

export function buildTerminalToolContext(projectRoot: string): {
  assistantId: string;
  terminalBoundaries: TerminalOperationalBoundaries;
  runCommandPermission: PermissionState;
} {
  const state = typeof window !== 'undefined' ? loadAIAssistantsConsoleState() : null;
  const assistant =
    state?.assistants.find((item) => item.id === state.selectedAssistantId) ?? state?.assistants[0];
  const assistantId = assistant?.id ?? 'pm-assistant';
  const runCommandPermission =
    assistant?.permissions.find((permission) => permission.scope === 'tool:run_command')?.state ??
    'blocked';
  const terminalBoundaries =
    assistant?.terminalBoundaries ?? createDefaultTerminalBoundaries();
  return { assistantId, terminalBoundaries, runCommandPermission };
}

/**
 * Call the AI Agent API with tool support.
 * Streams thinking, tool calls, and text responses.
 */
async function callAgentApi(
  content: string,
  history: ChatMessage[],
  context: ChatContext,
  callbacks: AgentStreamCallbacks,
  chatSettingsOverride?: { provider: string; model: string; systemPrompt: string },
  abortSignal?: AbortSignal,
  attachments?: SendChatMessageRequest['attachments'],
): Promise<AgentStreamResult> {
  const systemPrompt = chatSettingsOverride?.systemPrompt || buildSystemPrompt(context);
  
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of history) {
    if (m.role === 'user') messages.push({ role: 'user', content: m.content });
    else if (m.role === 'assistant') messages.push({ role: 'assistant', content: m.content });
  }
  messages.push({ role: 'user', content });

  // Build tool context
  const project = context.selectedProject;
  const terminalCtx = buildTerminalToolContext(project?.config.project.root ?? '');
  const toolContext = {
    projectRoot: project?.config.project.root ?? '',
    assistantId: terminalCtx.assistantId,
    terminalBoundaries: terminalCtx.terminalBoundaries,
    runCommandPermission: terminalCtx.runCommandPermission,
    features: (context.features ?? project?.config.features ?? []).map(f => ({
      id: f.id, name: f.name, status: f.status, progress: f.progress,
      category: f.category, phase: f.phase, points: f.points,
      notes: f.notes, paths: f.paths,
    })),
    config: {
      projectName: project?.config.project.name,
      defaultIDE: project?.config.project.defaultIDE,
      agentCount: context.adapters?.length ?? 0,
      featureCount: (context.features ?? project?.config.features ?? []).length,
      adapterNames: context.adapters?.map(a => a.name),
    },
    activeRuns: context.activeRuns?.map(r => ({
      pid: 0, featureId: r.featureId, featureName: r.featureName,
      phase: r.phase, command: '', startedAt: r.startedAt,
    })),
    recentRuns: context.recentRuns?.slice(0, 10).map(r => ({
      featureName: r.featureName, exitCode: r.exitCode, success: r.success,
    })),
  };

  // Determine provider
  let providerConfig: { provider?: string; model?: string; systemPrompt?: string } = {};
  if (chatSettingsOverride?.provider && chatSettingsOverride.provider !== 'auto') {
    providerConfig = chatSettingsOverride;
  } else {
    const userProvider = await loadChatProvider();
    if (userProvider) providerConfig = userProvider;
  }

  const payload: Record<string, unknown> = {
    messages,
    tools: true,
    context: toolContext,
    systemPrompt, // Always pass the rich system prompt
  };
  const multimodalAttachments = imageAttachments(attachments);
  if (multimodalAttachments.length > 0) payload.attachments = multimodalAttachments;
  if (providerConfig.provider) payload.provider = providerConfig.provider;
  if (providerConfig.model) payload.model = providerConfig.model;

  if (isTauriRuntime()) {
    const nativeResult = await callLlmRouted({
      modelAlias: 'pm-reasoning',
      taskClass: 'agent-chat',
      provider: providerConfig.provider,
      model: providerConfig.model,
      maxTokens: 8192,
      messages,
      systemPrompt,
      attachments: multimodalAttachments,
    });
    callbacks.onText?.(nativeResult.content);
    return {
      content: nativeResult.content,
      toolCalls: [],
      provider: nativeResult.provider,
      model: nativeResult.model,
      routeDecision: nativeResult.routeDecision,
    };
  }

  const res = await fetch('/api/chat/agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: abortSignal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Agent API failed');
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let contentAccum = '';
  let provider: string | undefined;
  let model: string | undefined;
  const toolCalls: AgentStreamResult['toolCalls'] = [];

  while (true) {
    if (abortSignal?.aborted) throw new DOMException('Chat request aborted', 'AbortError');
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      
      try {
        const json = JSON.parse(trimmed.slice(6));
        
        switch (json.type) {
          case 'thinking_start':
            callbacks.onThinkingStart?.();
            break;
          case 'metadata':
            provider = typeof json.provider === 'string' ? json.provider : provider;
            model = typeof json.model === 'string' ? json.model : model;
            break;
          case 'thinking':
            callbacks.onThinking?.(json.text);
            break;
          case 'tool_call': {
            const tc = { id: json.id, name: json.name, arguments: json.arguments || {} };
            toolCalls.push(tc);
            callbacks.onToolCall?.(json.id, json.name, json.arguments || {});
            break;
          }
          case 'tool_result': {
            const existing = toolCalls.find(t => t.id === json.id);
            if (existing) {
              existing.result = json.content;
              existing.error = json.error;
            }
            callbacks.onToolResult?.(json.id, json.content, json.error);
            break;
          }
          case 'text':
            contentAccum += json.text;
            callbacks.onText?.(json.text);
            break;
          case 'error':
            contentAccum = `❌ ${json.error}`;
            break;
          case 'done':
            break;
        }
      } catch { /* skip malformed */ }
    }
  }

  return { content: contentAccum, toolCalls, provider, model };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function sendChatMessage(
  request: SendChatMessageRequest,
): Promise<SendChatMessageResult> {
  // 1. Check for local commands
  const local = localCommand(request);
  if (local) {
    // If it was a search query that needs async execution
    if (local.handledLocally && local.content.startsWith('正在搜尋')) {
      const query = request.content.replace(/^搜尋\s+/i, '').replace(/^search\s+(?:for\s+)?/i, '');
      const root = request.context.selectedProject?.config.project.root ?? '';
      if (root) {
        try {
          const results = await executeSearch(query.trim(), root);
          return { content: results, handledLocally: true };
        } catch {
          return { content: `搜尋「${query}」失敗。`, handledLocally: true, error: true };
        }
      }
    }
    return local;
  }

  saveMemory('lastInteraction', request.content, request.context);

  const project = request.context.selectedProject;

  // 2. Agent API with tool calling (takes priority when project context available)
  if (project && request.context.features && request.context.features.length > 0) {
    try {
      const result = await callAgentApi(
        request.content,
        request.history,
        request.context,
        {
          onThinking: request.onThinking,
          onToolCall: request.onToolCall,
          onToolResult: request.onToolResult,
          onThinkingStart: request.onThinkingStart,
          onText: request.onStream,
        },
        request.chatSettings,
        request.abortSignal,
        request.attachments,
      );
      
      // If we got a meaningful response, return it
      if (result.content || result.toolCalls.length > 0) {
        return {
          content: result.content || '已執行工具呼叫，詳見上方結果。',
          toolCalls: result.toolCalls.length > 0 ? result.toolCalls : undefined,
          provider: result.provider,
          model: result.model,
          routeDecision: result.routeDecision,
        };
      }
    } catch (error) {
      if (isAbortError(error, request.abortSignal)) throw error;
      // Fall through to agent dispatch or simple chat
    }
  }

  const adapter = request.context.adapters.find(
    (candidate) => getAdapterExecutionKind(candidate) === 'agent-cli',
  );

  // 3. Agent dispatch path (project + agent adapter available)
  if (project && adapter) {
    const runtime = createRuntimeAdapterFromConfig(adapter);
    const prompt = buildAgentPrompt(request.content, request.context);
    const result = await runtime.execute({
      feature: fallbackFeature(request.context),
      prompt,
      projectRoot: project.config.project.root,
    });

    if (!result.success || !result.command || !result.args) {
      try {
        const apiContent = await callChatApi(
          request.content,
          request.history,
          request.context,
          request.onStream,
          request.chatSettings,
          request.abortSignal,
          request.attachments,
        );
        return apiContent;
      } catch (error) {
        if (isAbortError(error, request.abortSignal)) throw error;
        return { content: result.message || 'Agent 指令準備失敗。', error: true };
      }
    }

    const pid = await spawnAgent({
      command: result.command,
      args: result.args,
      workingDir: project.config.project.root,
    });
    const agentOutput = await waitForAgentOutput(pid, request.abortSignal);
    if (agentOutput.includes('Agent exited with code') && !agentOutput.includes('code 0')) {
      try {
        const apiContent = await callChatApi(
          request.content,
          request.history,
          request.context,
          request.onStream,
          request.chatSettings,
          request.abortSignal,
          request.attachments,
        );
        return apiContent;
      } catch (error) {
        if (isAbortError(error, request.abortSignal)) throw error;
        return { content: agentOutput, error: true };
      }
    }
    return { content: agentOutput };
  }

  // 3. AI API fallback
  try {
    const result = await callChatApi(
      request.content,
      request.history,
      request.context,
      request.onStream,
      request.chatSettings,
      request.abortSignal,
      request.attachments,
    );
    return result;
  } catch (e) {
    if (isAbortError(e, request.abortSignal)) throw e;
    const err = e as Error;
    if (
      err.message.includes('ANTHROPIC_API_KEY') ||
      err.message.includes('OPENAI_API_KEY') ||
      err.message.includes('GEMINI_API_KEY') ||
      err.message.includes('DEEPSEEK_API_KEY')
    ) {
      return {
        content: 'AI 助手目前無法回應，因為尚未配置 API 金鑰。請到 Settings 或 Keys 頁面新增。',
        error: true,
      };
    }
    if (err.message.includes('429') || err.message.includes('rate limit')) {
      return {
        content: 'AI 服務目前被速率限制了，請稍等片刻再試。',
        error: true,
      };
    }
    if (
      err.message.includes('401') ||
      err.message.includes('unauthorized') ||
      err.message.includes('403') ||
      err.message.includes('forbidden')
    ) {
      return {
        content: 'AI 服務認證失敗，請檢查 Settings 中的 API 金鑰。',
        error: true,
      };
    }
    return {
      content: `抱歉，我暫時無法連到 AI 服務。（${err.message}）`,
      error: true,
    };
  }
}
