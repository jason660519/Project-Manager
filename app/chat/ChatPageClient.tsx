'use client';

import { Bot, ChevronDown, Download, MessageSquareText, Mic, Send, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '../../lib/i18n';
import { ChatInput } from '../../components/chat/ChatInput';
import { ChatMessage as ChatMessageView } from '../../components/chat/ChatMessage';
import { ChatSettings } from '../../components/chat/ChatSettings';
import { QuickActions } from '../../components/chat/QuickActions';
import { ThinkingIndicator } from '../../components/chat/ThinkingIndicator';
import { ToolCallGroup } from '../../components/chat/ToolCallCard';
import type { ToolCallDisplay } from '../../components/chat/ToolCallCard';
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

function CurrentSessionMessages({
  messages, loading, thinkingActive, thinkingText, toolCalls,
}: {
  messages: ChatMessage[]; loading: boolean;
  thinkingActive: boolean; thinkingText: string;
  toolCalls: ToolCallDisplay[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  // Delay the loading indicator so brief requests don't flicker
  useEffect(() => {
    if (!loading) {
      setShowLoading(false);
      return;
    }
    const timer = setTimeout(() => setShowLoading(true), 300);
    return () => clearTimeout(timer);
  }, [loading]);

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {messages.map((message) => (
        <ChatMessageView key={message.id} message={message} />
      ))}
      
      {/* Thinking indicator */}
      <ThinkingIndicator active={thinkingActive} text={thinkingText} />
      
      {/* Tool calls */}
      <ToolCallGroup calls={toolCalls} />
      
      {showLoading && (
        <div className="mr-4 flex animate-pulse items-center gap-2 rounded border border-stone-200/15 bg-stone-950/60 px-2.5 py-2 text-[11px] text-stone-400">
          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400/80" />
          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400/80 [animation-delay:0.15s]" />
          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400/80 [animation-delay:0.3s]" />
        </div>
      )}
      <div ref={scrollRef} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

import { loadChatSettings } from '../../components/chat/ChatSettings';
import type { ChatContext } from '../../lib/chat/types';

interface ChatPageClientProps {
  initialChatContext?: ChatContext;
  embedded?: boolean;
}

export function ChatPageClient({ initialChatContext, embedded = false }: ChatPageClientProps) {
  const router = useRouter();
  const { t } = useI18n();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const setInputValueRef = useRef<((value: string) => void) | undefined>(undefined);

  // Sessions state
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // Agent/tool state
  const [thinkingActive, setThinkingActive] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  const [toolCalls, setToolCalls] = useState<ToolCallDisplay[]>([]);

  // Chat settings (provider, model, system prompt)
  const [chatSettings, setChatSettings] = useState<{ provider: string; model: string; systemPrompt: string }>({
    provider: 'auto',
    model: '',
    systemPrompt: '',
  });

  // Side toggles
  const [showHistory, setShowHistory] = useState(true);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Keyboard shortcuts (must be after all useState declarations)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K → focus input
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      // Escape → close mobile history
      if (e.key === 'Escape' && showHistory && typeof window !== 'undefined' && window.innerWidth < 1024) {
        setShowHistory(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHistory]);

  // Load persisted settings on mount
  useEffect(() => {
    const saved = loadChatSettings();
    setChatSettings(saved);
  }, []);

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

  const handleSend = async (content: string, files?: { name: string; content: string; previewUrl?: string }[]) => {
    if (loading) return;

    // Append file context to the message
    let augmentedContent = content;
    if (files && files.length > 0) {
      const fileBlock = files
        .map((f) => {
          const body = f.previewUrl ? `[Image: ${f.name}]` : `\`\`\`\n${f.content.slice(0, 5000)}\n\`\`\``;
          return `--- File: ${f.name} ---\n${body}\n---`;
        })
        .join('\n\n');
      augmentedContent = content
        ? `${content}\n\n${fileBlock}`
        : `Please analyze these files:\n\n${fileBlock}`;
    }

    // If the last message is an error, remove it — new message starts fresh
    const cleanedMessages = messages.length > 0 && messages[messages.length - 1].status === 'error'
      ? messages.slice(0, -1)
      : messages;

    const userMessage = makeMessage('user', content);
    const nextMessages = [...cleanedMessages, userMessage];
    setMessages(nextMessages);
    setLoading(true);

    // Create or reuse a session ID
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setActiveSessionId(sessionId);
    }

    // Create a placeholder assistant message that will accumulate streamed text
    const assistantId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const placeholder = makeMessage('assistant', '');
    placeholder.id = assistantId;

    try {
      const { sendChatMessage } = await import('../../lib/chat/chatAgent');
      const effectiveContext = initialChatContext ?? {
        currentView: 'chat',
        selectedProject: undefined,
        selectedFeature: undefined,
        adapters: [],
        activeRunCount: 0,
        recentRuns: [],
      };

      // Reset tool/thinking state for new message
      setThinkingActive(false);
      setThinkingText('');
      setToolCalls([]);

      // Add placeholder, then start streaming updates into it
      setMessages([...nextMessages, placeholder]);

      let accumulated = '';
      const result = await sendChatMessage({
        content: augmentedContent,
        history: nextMessages,
        context: effectiveContext,
        navigate: (href) => router.push(href),
        chatSettings: chatSettings.provider !== 'auto' ? chatSettings : undefined,
        onStream: (chunk: string) => {
          accumulated += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
          );
        },
        onThinkingStart: () => {
          setThinkingActive(true);
          setThinkingText('');
        },
        onThinking: (text: string) => {
          setThinkingText(prev => prev + text);
        },
        onToolCall: (id: string, name: string, args: Record<string, unknown>) => {
          setToolCalls(prev => [...prev, { id, name, arguments: args, status: 'running' as ToolCallDisplay['status'] }]);
        },
        onToolResult: (id: string, content: string, error?: boolean) => {
          setThinkingActive(false);
          setToolCalls(prev => prev.map(tc =>
            tc.id === id ? { ...tc, result: content, error, status: (error ? 'error' : 'done') as ToolCallDisplay['status'] } : tc
          ));
        },
      });

      setThinkingActive(false);

      const finalContent = result.content || accumulated;
      const assistantMessage = makeMessage(
        'assistant',
        finalContent,
        result.error ? 'error' : 'sent',
      );
      assistantMessage.id = assistantId;
      // Attach tool calls to the assistant message for display
      (assistantMessage as any).toolCalls = result.toolCalls || toolCalls;

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

  // Export current conversation as Markdown
  const handleExport = useCallback(() => {
    if (messages.length === 0) return;
    const title = generateTitle(messages);
    const markdown = [
      `# ${title}`,
      '',
      `Exported: ${new Date().toISOString()}`,
      '',
      ...messages.map((m) => {
        const role = m.role === 'user' ? '**You**' : '**AI**';
        const time = new Date(m.createdAt).toLocaleString();
        return `### ${role} — ${time}\n\n${m.content}\n`;
      }),
    ].join('\n');
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').slice(0, 40)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages]);

  // Start Talk: create a new session and focus input
  const handleStartTalk = useCallback(() => {
    if (activeSessionId && messages.length > 0) {
      persistCurrentSession(messages, activeSessionId);
    }
    setActiveSessionId(null);
    setMessages([]);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [activeSessionId, messages, persistCurrentSession]);

  // Send from top bar: trigger the same as pressing send in ChatInput
  const handleTopSend = useCallback(() => {
    const textarea = inputRef.current;
    if (!textarea || !textarea.value.trim()) return;
    // Simulate Enter key press to trigger the existing send logic
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }, []);

  return (
    <div className={clsx('flex gap-0 lg:gap-4', embedded ? 'h-full min-h-0' : 'h-[calc(100vh-var(--pm-topbar-h,48px)-40px)]')}>
      {/* ── History sidebar ──────────────────────────────────────────────── */}
      {/* Overlay backdrop for mobile */}
      {showHistory && (
        <div
          className="fixed inset-0 z-10 bg-black/30 lg:hidden"
          onClick={() => setShowHistory(false)}
        />
      )}
      <div
        className={[
          'flex flex-col border-stone-200/15 bg-stone-950/95 lg:bg-white/[0.02] z-20',
          showHistory
            ? 'fixed inset-y-0 left-0 z-20 w-[260px] border-r lg:static lg:z-auto lg:w-[220px] lg:flex lg:border-r-0'
            : 'hidden',
        ].join(' ')}
      >
        {/* Header row */}
        <div className="flex h-10 items-center justify-between border-b border-stone-200/15 px-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            {t.chat.history}
          </h2>
          <div className="flex items-center gap-1">
            {/* Start Talk */}
            <button
              type="button"
              onClick={handleStartTalk}
              className="flex items-center gap-1 rounded border border-emerald-200/20 bg-emerald-500/10 px-1.5 py-1 text-[10px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/20"
              title={t.chat.startTalk}
            >
              <Mic size={11} />
            </button>
            {/* Settings (inline ChatSettings popover) */}
            <ChatSettings
              current={chatSettings}
              onChange={(s) => setChatSettings(s)}
            />
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="px-3 pt-4 text-[10px] leading-relaxed text-stone-500">
              {t.chat.noConversations}
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

        {/* Footer: New Chat button */}
        <div className="border-t border-stone-200/15 px-2 py-2">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded border border-amber-200/20 bg-amber-500/8 text-[10px] font-semibold text-amber-100 transition-colors hover:bg-amber-500/15"
          >
            <MessageSquareText size={11} />
            <span>{t.chat.new}</span>
          </button>
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
            <span>{t.chat.history}</span>
          </button>

          <Bot size={14} className="text-amber-200/60 shrink-0" />
          <h1 className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-200">
            AI Assistant
          </h1>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {/* New Session */}
            <button
              type="button"
              onClick={handleNewChat}
              className="flex items-center gap-1 rounded border border-stone-200/15 px-2 py-1 text-[10px] text-stone-400 transition-colors hover:border-amber-200/25 hover:text-amber-100"
              title={t.chat.newSession}
            >
              <MessageSquareText size={11} />
              <span className="hidden sm:inline">{t.chat.newSession}</span>
            </button>

            {/* Export */}
            <button
              type="button"
              onClick={handleExport}
              disabled={messages.length === 0}
              className="flex items-center gap-1 rounded border border-stone-200/15 px-2 py-1 text-[10px] text-stone-400 transition-colors hover:border-stone-200/25 hover:text-stone-200 disabled:cursor-not-allowed disabled:opacity-30"
              title={t.chat.exportChat}
            >
              <Download size={11} />
              <span className="hidden sm:inline">{t.chat.exportChat}</span>
            </button>

            {/* Send */}
            <button
              type="button"
              onClick={handleTopSend}
              className="flex items-center gap-1 rounded border border-amber-200/25 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-100 transition-colors hover:bg-amber-500/20"
              title={t.chat.sendMessage}
            >
              <Send size={11} />
              <span className="hidden sm:inline">{t.chat.sendMessage}</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-stone-200/15 bg-white/[0.03]">
              <Bot size={22} className="text-amber-200/50" />
            </div>
            <p className="text-[13px] font-semibold text-stone-200">{t.chat.welcomeTitle}</p>
            <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-stone-400">
              {t.chat.welcome}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['/status', '/help', '/go dashboard'].map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => handleSend(cmd)}
                  className="rounded-full border border-stone-300/20 bg-white/[0.04] px-3.5 py-1.5 font-mono text-[10px] text-amber-100/80 transition-all hover:bg-amber-500/12 hover:border-amber-300/40 hover:text-amber-50 active:scale-[0.97]"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <CurrentSessionMessages
            messages={messages}
            loading={loading}
            thinkingActive={thinkingActive}
            thinkingText={thinkingText}
            toolCalls={toolCalls}
          />
        )}

        {/* Input */}
        <div className="border-t border-stone-200/15 p-3 lg:p-4">
          <ChatInput
            placeholder={t.chat.placeholder}
            sendLabel={t.chat.send}
            loadingLabel={t.chat.loading}
            loading={loading}
            onSend={handleSend}
            externalRef={inputRef}
            onSetValueRef={setInputValueRef}
            beforeArea={
              <QuickActions
                onAction={(template) => {
                  setInputValueRef.current?.(template);
                }}
              />
            }
            afterArea={
              <ChatSettings
                current={chatSettings}
                onChange={(s) => setChatSettings(s)}
              />
            }
          />
          <p className="mt-2 flex items-center justify-center gap-2 text-center text-[9px] tracking-[0.06em] text-stone-600/70">
            <span>{t.chat.enterToSend}</span>
            <kbd className="rounded border border-stone-700/40 bg-stone-800/50 px-1 py-px font-mono text-[8px] text-stone-500">
              {'⌘K'}
            </kbd>
          </p>
        </div>
      </div>
    </div>
  );
}
