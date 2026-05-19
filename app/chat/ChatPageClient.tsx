'use client';

import { Bot, ChevronDown, MessageSquareText, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInput } from '../../components/chat/ChatInput';
import { ChatMessage as ChatMessageView } from '../../components/chat/ChatMessage';
import type { ChatMessage } from '../../lib/chat/types';

interface StoredSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

function makeMessage(role: ChatMessage['role'], content: string, status?: ChatMessage['status']): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    createdAt: Date.now(),
    status,
  };
}

function generateTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user');
  if (!first) return 'New Chat';
  const text = first.content.trim();
  return text.length > 48 ? text.slice(0, 48) + '…' : text;
}

function loadSessions(): StoredSession[] {
  try {
    const raw = localStorage.getItem('projectManager:chat-sessions');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredSession[];
    return parsed.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function saveSessions(sessions: StoredSession[]) {
  try {
    localStorage.setItem('projectManager:chat-sessions', JSON.stringify(sessions.slice(0, 50)));
  } catch {
    // quota exceeded — silently drop
  }
}

function CurrentSessionMessages({ messages, loading }: { messages: ChatMessage[]; loading: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {messages.map((message) => (
        <ChatMessageView key={message.id} message={message} />
      ))}
      {loading && (
        <div className="mr-4 rounded border border-stone-200/15 bg-stone-950/60 px-2.5 py-2 text-[11px] text-stone-400">
          Thinking...
        </div>
      )}
      <div ref={scrollRef} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

import type { ChatContext } from '../../lib/chat/types';

interface ChatPageClientProps {
  initialChatContext?: ChatContext;
}

export function ChatPageClient({ initialChatContext }: ChatPageClientProps) {
  const router = useRouter();

  // Sessions state
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // Side toggles
  const [showHistory, setShowHistory] = useState(true);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Load persisted history on first mount
  useEffect(() => {
    if (historyLoaded) return;
    const stored = loadSessions();
    setSessions(stored);
    if (stored.length > 0 && !activeSessionId) {
      // Resume most recent session
      const latest = stored[0];
      setActiveSessionId(latest.id);
      setMessages(latest.messages);
    }
    setHistoryLoaded(true);
  }, [historyLoaded, activeSessionId]);

  const persistCurrentSession = useCallback((msgs: ChatMessage[], id: string | null) => {
    if (!id || msgs.length === 0) return;
    const title = generateTitle(msgs);
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, title, messages: msgs, createdAt: Date.now() } : s,
      );
      // If it's a new session not yet in the list, prepend it
      if (!prev.some((s) => s.id === id)) {
        updated.unshift({ id, title, messages: msgs, createdAt: Date.now() });
      }
      saveSessions(updated);
      return updated;
    });
  }, []);

  const handleSend = async (content: string) => {
    if (loading) return;

    const userMessage = makeMessage('user', content);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setLoading(true);

    // Create or reuse a session ID
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setActiveSessionId(sessionId);
    }

    try {
      // For now, use a simple echo until we can wire real project context here
      const { sendChatMessage } = await import('../../lib/chat/chatAgent');
      const effectiveContext = initialChatContext ?? {
        currentView: 'chat',
        selectedProject: undefined,
        selectedFeature: undefined,
        adapters: [],
        activeRunCount: 0,
        recentRuns: [],
      };
      const result = await sendChatMessage({
        content,
        history: nextMessages,
        context: effectiveContext,
        navigate: (href) => router.push(href),
      });

      const assistantMessage = makeMessage(
        'assistant',
        result.content,
        result.error ? 'error' : 'sent',
      );
      const finalMessages = [...nextMessages, assistantMessage];
      setMessages(finalMessages);
      persistCurrentSession(finalMessages, sessionId);
    } catch {
      const errorMessage = makeMessage('assistant', 'Sorry, something went wrong. Please try again.', 'error');
      const finalMessages = [...nextMessages, errorMessage];
      setMessages(finalMessages);
      persistCurrentSession(finalMessages, sessionId);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    // Save current before starting new
    if (activeSessionId && messages.length > 0) {
      persistCurrentSession(messages, activeSessionId);
    }
    setActiveSessionId(null);
    setMessages([]);
  };

  const handleSelectSession = (sessionId: string) => {
    // Save current before switching
    if (activeSessionId && messages.length > 0) {
      persistCurrentSession(messages, activeSessionId);
    }
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setActiveSessionId(session.id);
      setMessages(session.messages);
    }
    // On smaller screens, collapse history after picking
    if (typeof window !== 'undefined' && window.innerWidth < 900) {
      setShowHistory(false);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      saveSessions(next);
      return next;
    });
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
  };

  return (
    <div className="flex h-[calc(100vh-var(--pm-topbar-h,48px)-40px)] gap-0 lg:gap-4">
      {/* ── History sidebar ──────────────────────────────────────────────── */}
      <div
        className={[
          'flex flex-col border-stone-200/15 bg-white/[0.02] lg:flex',
          showHistory
            ? 'w-[220px] shrink-0 border-r lg:border-r-0'
            : 'hidden',
        ].join(' ')}
      >
        {/* Header row */}
        <div className="flex h-10 items-center justify-between border-b border-stone-200/15 px-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            History
          </h2>
          <button
            type="button"
            onClick={handleNewChat}
            className="flex items-center gap-1 rounded border border-amber-200/20 bg-amber-500/8 px-2 py-1 text-[10px] font-semibold text-amber-100 transition-colors hover:bg-amber-500/15"
          >
            <MessageSquareText size={11} />
            <span>New</span>
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="px-3 pt-4 text-[10px] leading-relaxed text-stone-500">
              No conversations yet. Start a new chat above.
            </p>
          ) : (
            <div className="space-y-0.5 p-1.5">
              {sessions.map((session) => {
                const active = session.id === activeSessionId;
                return (
                  <div
                    key={session.id}
                    className={[
                      'group flex items-start gap-1 rounded px-2 py-1.5 text-[11px] transition-colors',
                      active
                        ? 'bg-stone-200/10 text-stone-100'
                        : 'text-stone-400 hover:bg-white/[0.04] hover:text-stone-200',
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectSession(session.id)}
                      className="min-w-0 flex-1 truncate text-left leading-normal"
                      title={session.title}
                    >
                      {session.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSession(session.id)}
                      className="shrink-0 rounded p-0.5 text-stone-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      aria-label="Delete session"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Main chat area ────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="flex h-10 items-center gap-2 border-b border-stone-200/15 px-3">
          {/* Mobile toggle for history */}
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-stone-400 hover:text-stone-200 lg:hidden"
          >
            <ChevronDown size={11} className={`transition-transform ${showHistory ? '' : '-rotate-90'}`} />
            <span>History</span>
          </button>

          <Bot size={14} className="text-amber-200/60 shrink-0" />
          <h1 className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-200">
            AI Assistant
          </h1>

          {activeSessionId && messages.length > 0 && (
            <button
              type="button"
              onClick={handleNewChat}
              className="flex items-center gap-1 rounded border border-stone-200/15 px-2 py-1 text-[10px] text-stone-400 transition-colors hover:border-amber-200/25 hover:text-amber-100"
            >
              <MessageSquareText size={11} />
              <span>New Chat</span>
            </button>
          )}
        </div>

        {/* Messages */}
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-stone-200/15 bg-white/[0.03]">
              <Bot size={22} className="text-amber-200/50" />
            </div>
            <p className="text-[13px] font-semibold text-stone-200">Project Manager Assistant</p>
            <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-stone-400">
              Ask me about your project, features, recent runs, or use commands like{' '}
              <code className="rounded bg-black/30 px-1 font-mono text-[10px] text-amber-100">/status</code>,{' '}
              <code className="rounded bg-black/30 px-1 font-mono text-[10px] text-amber-100">/help</code>,{' '}
              <code className="rounded bg-black/30 px-1 font-mono text-[10px] text-amber-100">/go dashboard</code>.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['/status', '/help', '/go dashboard'].map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => handleSend(cmd)}
                  className="rounded border border-stone-200/15 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] text-amber-100/80 transition-colors hover:bg-white/[0.08] hover:border-amber-200/30"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <CurrentSessionMessages messages={messages} loading={loading} />
        )}

        {/* Input */}
        <div className="border-t border-stone-200/15 p-3 lg:p-4">
          <ChatInput
            placeholder="Ask me anything..."
            sendLabel="Send"
            loadingLabel="Thinking..."
            loading={loading}
            onSend={handleSend}
          />
        </div>
      </div>
    </div>
  );
}
