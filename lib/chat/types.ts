import type { AnyAdapterConfig, CompletedRun, Feature, ProjectEntry, ViewId } from '../types';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  status?: 'sent' | 'loading' | 'error';
}

export interface ChatRunSummary {
  featureId: string;
  featureName: string;
  phase: string;
  startedAt: number;
}

export interface ChatContext {
  currentView: ViewId;
  selectedProject?: ProjectEntry;
  selectedFeature?: Feature;
  adapters: AnyAdapterConfig[];
  activeRunCount: number;
  activeRuns?: ChatRunSummary[];
  recentRuns?: CompletedRun[];
  features?: Feature[];
  dashboardProjects?: string[];
}

export interface SendChatMessageRequest {
  content: string;
  history: ChatMessage[];
  context: ChatContext;
  navigate?: (href: string) => void;
  /** Cancels the in-flight provider request and stream reader when the user stops generation. */
  abortSignal?: AbortSignal;
  /** Optional streaming callback — called with each chunk of text as it arrives. */
  onStream?: (chunk: string) => void;
  /** Optional provider/model/systemPrompt override from chat settings. */
  chatSettings?: { provider: string; model: string; systemPrompt: string };
  /** Agent API callbacks for tool calling support */
  onThinkingStart?: () => void;
  onThinking?: (text: string) => void;
  onToolCall?: (id: string, name: string, args: Record<string, unknown>) => void;
  onToolResult?: (id: string, content: string, error?: boolean) => void;
}

export interface SendChatMessageResult {
  content: string;
  handledLocally?: boolean;
  route?: string;
  error?: boolean;
  /** Tool calls that the AI made during this response */
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: string;
    error?: boolean;
  }>;
}
