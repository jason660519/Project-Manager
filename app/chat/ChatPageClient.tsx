'use client';

import { Bot, ChevronDown, Download, MessageSquareText, Mic, Search, Send, Square, Tag, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '../../lib/i18n';
import { ChatInput, type AttachedFile } from '../../components/chat/ChatInput';
import { ChatMessage as ChatMessageView } from '../../components/chat/ChatMessage';
import { ChatSettings } from '../../components/chat/ChatSettings';
import { QuickActions } from '../../components/chat/QuickActions';
import { ThinkingIndicator } from '../../components/chat/ThinkingIndicator';
import { ToolCallGroup } from '../../components/chat/ToolCallCard';
import type { ToolCallDisplay } from '../../components/chat/ToolCallCard';
import type { ChatMessage } from '../../lib/chat/types';
import type { ChatAttachment } from '../../lib/chat/types';
import {
  generateChatSessionTitle,
  loadChatSessions,
  saveChatSessions,
  upsertChatSession,
  type StoredChatSession,
} from '../../lib/chat/sessionStorage';
import { formatChatAsFeatureNotes } from '../../lib/chat/exportFeatureNotes';
import { formatAttachmentDisplayText, formatTextAttachmentBlock } from '../../lib/chat/multimodal';

function toChatAttachments(files?: AttachedFile[]): ChatAttachment[] | undefined {
  if (!files?.length) return undefined;
  return files.map((file) => ({
    name: file.name,
    type: file.type,
    size: file.size,
    content: file.content || undefined,
    dataUrl: file.previewUrl,
  }));
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
  return generateChatSessionTitle(messages);
}

function CurrentSessionMessages({
  messages, loading, thinkingActive, thinkingText, toolCalls,
  onConfirmGuarded, onDenyGuarded,
}: {
  messages: ChatMessage[]; loading: boolean;
  thinkingActive: boolean; thinkingText: string;
  toolCalls: ToolCallDisplay[];
  onConfirmGuarded?: (call: ToolCallDisplay) => void | Promise<void>;
  onDenyGuarded?: (call: ToolCallDisplay) => void;
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
      <ToolCallGroup
        calls={toolCalls}
        onConfirmGuarded={onConfirmGuarded}
        onDenyGuarded={onDenyGuarded}
      />
      
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
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sessions state
  const [sessions, setSessions] = useState<StoredChatSession[]>([]);
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
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionTimeFilter, setSessionTimeFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [editingTagsSessionId, setEditingTagsSessionId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');

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
      if (e.key === 'Escape' && loading) {
        e.preventDefault();
        abortControllerRef.current?.abort();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, showHistory]);

  // Load persisted settings on mount
  useEffect(() => {
    const saved = loadChatSettings();
    setChatSettings(saved);
  }, []);

  // Load persisted history on first mount
  useEffect(() => {
    if (historyLoaded) return;
    const stored = loadChatSessions();
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
    setSessions((prev) => {
      const updated = upsertChatSession(prev, id, msgs);
      saveChatSessions(updated);
      return updated;
    });
  }, []);

  const handleConfirmGuarded = useCallback(async (call: ToolCallDisplay) => {
    const projectRoot = initialChatContext?.selectedProject?.config.project.root ?? '';
    if (!projectRoot) return;
    const { buildTerminalToolContext } = await import('../../lib/chat/chatAgent');
    const { buildToolContextForExecution, executeConfirmedToolCall } = await import('../../lib/chat/executeConfirmedTool');
    const { resolveToolCallStatusFromResult } = await import('../../lib/chat/toolCallDisplay');
    const terminalCtx = buildTerminalToolContext(projectRoot);
    setToolCalls((prev) =>
      prev.map((tc) => (tc.id === call.id ? { ...tc, status: 'running' as const } : tc)),
    );
    const result = await executeConfirmedToolCall(
      { id: call.id, name: call.name, arguments: call.arguments },
      buildToolContextForExecution({
        projectRoot,
        assistantId: terminalCtx.assistantId,
        terminalBoundaries: terminalCtx.terminalBoundaries,
        runCommandPermission: 'guarded',
      }),
    );
    const resolved = resolveToolCallStatusFromResult(result.content, result.error);
    setToolCalls((prev) =>
      prev.map((tc) => (tc.id === call.id ? { ...tc, ...resolved } : tc)),
    );
  }, [initialChatContext?.selectedProject?.config.project.root]);

  const handleDenyGuarded = useCallback((call: ToolCallDisplay) => {
    setToolCalls((prev) =>
      prev.map((tc) =>
        tc.id === call.id
          ? {
              ...tc,
              status: 'error' as const,
              error: true,
              result: 'Guarded terminal execution denied by user.',
            }
          : tc,
      ),
    );
  }, []);

  const handleSend = async (content: string, files?: AttachedFile[]) => {
    if (loading) return;
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Append file context to the message
    let augmentedContent = content;
    const attachments = toChatAttachments(files);
    const fileBlock = formatTextAttachmentBlock(attachments);
    if (fileBlock) {
      augmentedContent = content
        ? `${content}\n\n${fileBlock}`
        : `Please analyze these files:\n\n${fileBlock}`;
    }

    // If the last message is an error, remove it — new message starts fresh
    const cleanedMessages = messages.length > 0 && messages[messages.length - 1].status === 'error'
      ? messages.slice(0, -1)
      : messages;

    const userMessage = makeMessage('user', content || formatAttachmentDisplayText(attachments));
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
    let accumulated = '';

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

      const result = await sendChatMessage({
        content: augmentedContent,
        history: nextMessages,
        context: effectiveContext,
        navigate: (href) => router.push(href),
        abortSignal: abortController.signal,
        attachments,
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
          void import('../../lib/chat/toolCallDisplay').then(({ resolveToolCallStatusFromResult }) => {
            const resolved = resolveToolCallStatusFromResult(content, error);
            setToolCalls(prev => prev.map(tc =>
              tc.id === id ? { ...tc, ...resolved } : tc
            ));
          });
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
      assistantMessage.provider = result.provider ?? (chatSettings.provider !== 'auto' ? chatSettings.provider : undefined);
      assistantMessage.model = result.model ?? (chatSettings.provider !== 'auto' ? chatSettings.model : undefined);
      // Attach tool calls to the assistant message for display
      (assistantMessage as any).toolCalls = result.toolCalls || toolCalls;

      const finalMessages = [...nextMessages, assistantMessage];
      setMessages(finalMessages);
      persistCurrentSession(finalMessages, sessionId);
    } catch (error) {
      const stopped = (error as Error).name === 'AbortError' || abortController.signal.aborted;
      const errorMessage = makeMessage(
        'assistant',
        stopped
          ? accumulated || 'Response stopped. Partial output was preserved.'
          : 'Sorry, something went wrong. Please try again.',
        stopped ? 'sent' : 'error',
      );
      const finalMessages = [...nextMessages, errorMessage];
      setMessages(finalMessages);
      persistCurrentSession(finalMessages, sessionId);
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setThinkingActive(false);
      setLoading(false);
    }
  };

  const handleCancelResponse = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  useEffect(() => () => {
    abortControllerRef.current?.abort();
  }, []);

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
      saveChatSessions(next);
      return next;
    });
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
  };

  const handleEditSessionTags = (session: StoredChatSession) => {
    setEditingTagsSessionId(session.id);
    setTagDraft((session.tags ?? []).join(', '));
  };

  const handleSaveSessionTags = (sessionId: string) => {
    const tags = tagDraft
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 12);
    setSessions((prev) => {
      const next = prev.map((session) =>
        session.id === sessionId ? { ...session, tags } : session,
      );
      saveChatSessions(next);
      return next;
    });
    setEditingTagsSessionId(null);
    setTagDraft('');
  };

  // Export current conversation as feature-notes Markdown.
  const handleExport = useCallback(() => {
    if (messages.length === 0) return;
    const title = generateTitle(messages);
    const markdown = formatChatAsFeatureNotes({
      title,
      messages,
      projectName: initialChatContext?.selectedProject?.config.project.name,
      featureId: initialChatContext?.selectedFeature?.id,
      tags: sessions.find((session) => session.id === activeSessionId)?.tags,
    });
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').slice(0, 40)}-feature-notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeSessionId, initialChatContext?.selectedFeature?.id, initialChatContext?.selectedProject?.config.project.name, messages, sessions]);

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

  const filteredSessions = sessions.filter((session) => {
    const query = sessionSearch.trim().toLowerCase();
    const now = Date.now();
    const ageMs = now - session.createdAt;
    const inSelectedTimeRange =
      sessionTimeFilter === 'all' ||
      (sessionTimeFilter === 'today' && new Date(session.createdAt).toDateString() === new Date(now).toDateString()) ||
      (sessionTimeFilter === '7d' && ageMs <= 7 * 24 * 60 * 60 * 1000) ||
      (sessionTimeFilter === '30d' && ageMs <= 30 * 24 * 60 * 60 * 1000);
    if (!inSelectedTimeRange) return false;
    if (!query) return true;
    return (
      session.title.toLowerCase().includes(query) ||
      (session.tags ?? []).some((tag) => tag.toLowerCase().includes(query)) ||
      session.messages.some((message) =>
        `${message.content} ${message.provider ?? ''} ${message.model ?? ''}`.toLowerCase().includes(query),
      )
    );
  });

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

        <div className="border-b border-stone-200/15 px-2 py-2">
          <label className="flex h-8 items-center gap-2 rounded border border-stone-200/15 bg-stone-950/60 px-2 text-stone-500 focus-within:border-amber-200/35 focus-within:text-amber-200">
            <Search size={12} className="shrink-0" />
            <input
              value={sessionSearch}
              onChange={(event) => setSessionSearch(event.target.value)}
              placeholder="Search sessions"
              className="min-w-0 flex-1 bg-transparent text-[11px] text-stone-200 outline-none placeholder:text-stone-600"
              aria-label="Search sessions"
            />
          </label>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {[
              ['all', 'All'],
              ['today', 'Today'],
              ['7d', '7d'],
              ['30d', '30d'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSessionTimeFilter(value as typeof sessionTimeFilter)}
                className={[
                  'h-6 rounded border px-1 text-[10px] transition-colors',
                  sessionTimeFilter === value
                    ? 'border-amber-200/35 bg-amber-500/12 text-amber-100'
                    : 'border-stone-200/10 text-stone-500 hover:text-stone-300',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="px-3 pt-4 text-[10px] leading-relaxed text-stone-500">
              {t.chat.noConversations}
            </p>
          ) : filteredSessions.length === 0 ? (
            <p className="px-3 pt-4 text-[10px] leading-relaxed text-stone-500">
              No saved sessions match this search.
            </p>
          ) : (
            <div className="space-y-0.5 p-1.5">
              {filteredSessions.map((session) => {
                const active = session.id === activeSessionId;
                return (
                  <div
                    key={session.id}
                    className={[
                      'group relative flex items-start gap-1 rounded px-2 py-1.5 text-[11px] transition-colors',
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
                      {(session.tags?.length ?? 0) > 0 && (
                        <span className="mt-1 block truncate text-[9px] text-stone-500">
                          {session.tags?.map((tag) => `#${tag}`).join(' ')}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditSessionTags(session)}
                      className="shrink-0 rounded p-0.5 text-stone-600 opacity-0 transition-opacity hover:text-amber-200 group-hover:opacity-100"
                      aria-label="Edit session tags"
                      title="Edit tags"
                    >
                      <Tag size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSession(session.id)}
                      className="shrink-0 rounded p-0.5 text-stone-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      aria-label="Delete session"
                    >
                      <Trash2 size={11} />
                    </button>
                    {editingTagsSessionId === session.id && (
                      <div className="absolute left-2 right-2 top-full z-10 mt-1 rounded border border-stone-200/15 bg-stone-950 p-2 shadow-xl">
                        <input
                          value={tagDraft}
                          onChange={(event) => setTagDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') handleSaveSessionTags(session.id);
                            if (event.key === 'Escape') setEditingTagsSessionId(null);
                          }}
                          aria-label="Session tags"
                          placeholder="tag-a, tag-b"
                          className="h-7 w-full rounded border border-stone-200/15 bg-black/30 px-2 text-[11px] text-stone-100 outline-none placeholder:text-stone-600 focus:border-amber-200/35"
                        />
                        <div className="mt-1 flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingTagsSessionId(null)}
                            className="rounded px-2 py-1 text-[10px] text-stone-500 hover:text-stone-300"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveSessionTags(session.id)}
                            className="rounded border border-amber-200/25 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-100"
                          >
                            Save tags
                          </button>
                        </div>
                      </div>
                    )}
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
              onClick={loading ? handleCancelResponse : handleTopSend}
              className={[
                'flex items-center gap-1 rounded border px-2 py-1 text-[10px] transition-colors',
                loading
                  ? 'border-red-200/25 bg-red-500/10 text-red-100 hover:bg-red-500/20'
                  : 'border-amber-200/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20',
              ].join(' ')}
              title={loading ? 'Stop response (Esc)' : t.chat.sendMessage}
              aria-label={loading ? 'Stop response' : t.chat.sendMessage}
            >
              {loading ? <Square size={11} /> : <Send size={11} />}
              <span className="hidden sm:inline">{loading ? 'Stop' : t.chat.sendMessage}</span>
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
            onConfirmGuarded={handleConfirmGuarded}
            onDenyGuarded={handleDenyGuarded}
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
            onCancel={handleCancelResponse}
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
