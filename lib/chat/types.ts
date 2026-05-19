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
}

export interface SendChatMessageRequest {
  content: string;
  history: ChatMessage[];
  context: ChatContext;
  navigate?: (href: string) => void;
  /** Optional streaming callback — called with each chunk of text as it arrives. */
  onStream?: (chunk: string) => void;
  /** Optional provider/model/systemPrompt override from chat settings. */
  chatSettings?: { provider: string; model: string; systemPrompt: string };
}

export interface SendChatMessageResult {
  content: string;
  handledLocally?: boolean;
  route?: string;
  error?: boolean;
}
