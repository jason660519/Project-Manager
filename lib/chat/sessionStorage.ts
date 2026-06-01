import type { ChatMessage } from './types';

export const CHAT_SESSIONS_STORAGE_KEY = 'projectManager:chat-sessions';

export interface StoredChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  tags?: string[];
}

export function generateChatSessionTitle(messages: ChatMessage[]): string {
  const first = messages.find((message) => message.role === 'user');
  if (!first) return 'New Chat';
  const text = first.content.trim();
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

export function loadChatSessions(): StoredChatSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CHAT_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredChatSession[];
    return parsed.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function saveChatSessions(sessions: StoredChatSession[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(sessions.slice(0, 50)));
  } catch {
    // localStorage quota/private-mode failures should not break chat.
  }
}

export function upsertChatSession(
  sessions: StoredChatSession[],
  sessionId: string,
  messages: ChatMessage[],
): StoredChatSession[] {
  if (messages.length === 0) return sessions;
  const title = generateChatSessionTitle(messages);
  const createdAt = Date.now();
  const updated = sessions.map((session) =>
    session.id === sessionId ? { ...session, title, messages, createdAt } : session,
  );
  if (!sessions.some((session) => session.id === sessionId)) {
    updated.unshift({ id: sessionId, title, messages, createdAt });
  }
  return updated.sort((a, b) => b.createdAt - a.createdAt);
}
