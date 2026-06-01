'use client';

import { Bot, ChevronDown, ExternalLink, MessageSquareText, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sendChatMessage, buildTerminalToolContext } from '../../lib/chat/chatAgent';
import { buildToolContextForExecution, executeConfirmedToolCall } from '../../lib/chat/executeConfirmedTool';
import { resolveToolCallStatusFromResult } from '../../lib/chat/toolCallDisplay';
import type { ChatAttachment, ChatContext, ChatMessage } from '../../lib/chat/types';
import { useI18n } from '../../lib/i18n';
import { ChatInput, type AttachedFile, type ChatInputApi } from './ChatInput';
import {
  formatXmuxSelectedElementSnippet,
  isXmuxSelectedElementPayload,
  type XmuxSelectedElementSnippetPayload,
} from '../../lib/xmux/selectedElementSnippet';
import { ChatMessage as ChatMessageView } from './ChatMessage';
import { ChatSettings } from './ChatSettings';
import { QuickActions } from './QuickActions';
import { ThinkingIndicator } from './ThinkingIndicator';
import { ToolCallGroup } from './ToolCallCard';
import type { ToolCallDisplay } from './ToolCallCard';
import {
  loadChatSessions,
  saveChatSessions,
  upsertChatSession,
} from '../../lib/chat/sessionStorage';
import { formatAttachmentDisplayText, formatTextAttachmentBlock } from '../../lib/chat/multimodal';

// ────────────────────────────────────────────────────────────────────────────

interface ChatPanelProps {
  context: ChatContext;
  defaultExpanded?: boolean;
  /** When provided, the panel renders as a floating window (no self-collapse). */
  toggleOpen?: (open: boolean) => void;
  docked?: boolean;
}

type XmuxSelectedElementPayload = XmuxSelectedElementSnippetPayload;
const PANEL_ACTIVE_SESSION_KEY = 'projectManager:chat-panel-active-session';

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

// ────────────────────────────────────────────────────────────────────────────

export function ChatPanel({ context, defaultExpanded = false, toggleOpen, docked = false }: ChatPanelProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const closePanel = useCallback(() => {
    setExpanded(false);
    toggleOpen?.(false);
  }, [toggleOpen]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [thinkingActive, setThinkingActive] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  const [toolCalls, setToolCalls] = useState<ToolCallDisplay[]>([]);
  const [chatSettings, setChatSettings] = useState<{ provider: string; model: string; systemPrompt: string }>({
    provider: 'auto',
    model: '',
    systemPrompt: '',
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const setInputValueRef = useRef<((v: string) => void) | undefined>(undefined);
  const inputApiRef = useRef<ChatInputApi | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load saved settings
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('pm-chat-settings');
      if (raw) {
        const s = JSON.parse(raw);
        setChatSettings({ provider: s.provider || 'auto', model: s.model || '', systemPrompt: s.systemPrompt || '' });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sessions = loadChatSessions();
    if (sessions.length === 0) return;
    const savedActiveId = window.localStorage.getItem(PANEL_ACTIVE_SESSION_KEY);
    const session = sessions.find((item) => item.id === savedActiveId) ?? sessions[0];
    setActiveSessionId(session.id);
    setMessages(session.messages);
  }, []);

  const persistPanelSession = useCallback((nextMessages: ChatMessage[], sessionId: string | null) => {
    if (typeof window === 'undefined' || nextMessages.length === 0) return;
    const id = sessionId ?? `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (!sessionId) setActiveSessionId(id);
    window.localStorage.setItem(PANEL_ACTIVE_SESSION_KEY, id);
    const sessions = upsertChatSession(loadChatSessions(), id, nextMessages);
    saveChatSessions(sessions);
  }, []);

  useEffect(() => {
    if (typeof scrollRef.current?.scrollIntoView === 'function') {
      scrollRef.current.scrollIntoView({ block: 'end' });
    }
  }, [messages, loading, expanded]);

  useEffect(() => {
    if (!docked || typeof window === 'undefined') return;
    const handleSelectedElement = (event: Event) => {
      const detail = (event as CustomEvent<XmuxSelectedElementPayload>).detail;
      if (!isXmuxSelectedElementPayload(detail)) return;
      const api = inputApiRef.current;
      if (api) {
        const snippet = formatXmuxSelectedElementSnippet(detail);
        api.appendValue(snippet);
      }
    };
    window.addEventListener('pm:xmux-selected-element', handleSelectedElement);
    return () => window.removeEventListener('pm:xmux-selected-element', handleSelectedElement);
  }, [docked]);

  const handleConfirmGuarded = useCallback(async (call: ToolCallDisplay) => {
    const projectRoot = context.selectedProject?.config.project.root ?? '';
    if (!projectRoot) return;
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
  }, [context.selectedProject?.config.project.root]);

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

  const handleStreamSend = useCallback(async (content: string, files?: AttachedFile[]) => {
    if (loading) return;
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Augment message with file context
    let augmentedContent = content;
    const attachments = toChatAttachments(files);
    const fileBlock = formatTextAttachmentBlock(attachments);
    if (fileBlock) {
      augmentedContent = content
        ? `${content}\n\n${fileBlock}`
        : `Please analyze these files:\n\n${fileBlock}`;
    }

    // Clear previous error messages
    const cleanedMessages = messages.length > 0 && messages[messages.length - 1].status === 'error'
      ? messages.slice(0, -1)
      : messages;

    const userMessage = makeMessage('user', content || formatAttachmentDisplayText(attachments));
    const nextMessages = [...cleanedMessages, userMessage];
    setMessages(nextMessages);
    setLoading(true);

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setActiveSessionId(sessionId);
      if (typeof window !== 'undefined') window.localStorage.setItem(PANEL_ACTIVE_SESSION_KEY, sessionId);
    }

    const assistantId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const placeholder = makeMessage('assistant', '');
    placeholder.id = assistantId;
    let accumulated = '';

    // Show placeholder immediately for streaming
    setMessages((prev) => [...prev, placeholder]);

    try {
      // Reset tool/thinking state
      setThinkingActive(false);
      setThinkingText('');
      setToolCalls([]);

      const result = await sendChatMessage({
        content: augmentedContent,
        history: nextMessages,
        context,
        navigate: (href) => router.push(href),
        abortSignal: abortController.signal,
        attachments,
        onStream: (chunk: string) => {
          accumulated += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
          );
        },
        chatSettings: chatSettings.provider !== 'auto' ? chatSettings : undefined,
        onThinkingStart: () => { setThinkingActive(true); setThinkingText(''); },
        onThinking: (text: string) => { setThinkingText(prev => prev + text); },
        onToolCall: (id: string, name: string, args: Record<string, unknown>) => {
          setToolCalls(prev => [...prev, { id, name, arguments: args, status: 'running' as const }]);
        },
        onToolResult: (id: string, content: string, error?: boolean) => {
          setThinkingActive(false);
          const resolved = resolveToolCallStatusFromResult(content, error);
          setToolCalls(prev => prev.map(tc =>
            tc.id === id ? { ...tc, ...resolved } : tc
          ));
        },
      });

      setThinkingActive(false);

      const finalContent = result.content || accumulated;
      const assistantMessage = makeMessage('assistant', finalContent, result.error ? 'error' : 'sent');
      assistantMessage.id = assistantId;
      assistantMessage.provider = result.provider ?? (chatSettings.provider !== 'auto' ? chatSettings.provider : undefined);
      assistantMessage.model = result.model ?? (chatSettings.provider !== 'auto' ? chatSettings.model : undefined);
      (assistantMessage as any).toolCalls = result.toolCalls || toolCalls;
      const finalMessages = [...nextMessages, assistantMessage];
      setMessages((prev) => {
        const withoutPlaceholder = prev.filter((m) => m.id !== assistantId);
        return [...withoutPlaceholder, assistantMessage];
      });
      persistPanelSession(finalMessages, sessionId);
    } catch (error) {
      if ((error as Error).name === 'AbortError' || abortController.signal.aborted) {
        const cancelledMessage = makeMessage('assistant', accumulated || 'Response stopped. Partial output was preserved.', 'sent');
        cancelledMessage.id = assistantId;
        const finalMessages = [...nextMessages, cancelledMessage];
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || cancelledMessage.content, status: 'sent' as const }
              : m,
          ),
        );
        persistPanelSession(finalMessages, sessionId);
        return;
      }
      const errorMessage = makeMessage('assistant', t.chat.error, 'error');
      errorMessage.id = assistantId;
      persistPanelSession([...nextMessages, errorMessage], sessionId);
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: t.chat.error, status: 'error' as const } : m)),
      );
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setThinkingActive(false);
      setLoading(false);
    }
  }, [activeSessionId, loading, messages, context, router, chatSettings, persistPanelSession, t.chat.error]);

  const handleCancelResponse = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!loading) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      handleCancelResponse();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCancelResponse, loading]);

  useEffect(() => () => {
    abortControllerRef.current?.abort();
  }, []);

  const handleSettingsChange = (s: { provider: string; model: string; systemPrompt: string }) => {
    setChatSettings(s);
    // Persist
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('pm-chat-settings', JSON.stringify(s));
    }
  };

  if (!expanded) {
    return (
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-9 w-full items-center gap-2 rounded border border-stone-200/15 bg-white/[0.03] px-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-300 transition-colors hover:border-amber-200/30 hover:text-amber-100"
        >
          <MessageSquareText size={13} className="shrink-0 text-amber-200/80" />
          <span className="min-w-0 flex-1 truncate">{t.chat.title}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={[
        docked
          ? 'flex h-full min-h-0 w-full flex-col overflow-hidden'
          : 'flex h-full min-h-0 w-full flex-col overflow-hidden rounded shadow-2xl shadow-black/40 backdrop-blur',
        'border border-stone-200/15 bg-stone-950/95 animate-in fade-in slide-in-from-bottom-2 duration-200',
      ].join(' ')}
    >
      {/* ── Header (drag handle) ────────────────────────────────────────── */}
      <div
        data-drag-handle={!docked ? true : undefined}
        className={[
          'flex h-10 shrink-0 items-center gap-2 border-b border-stone-200/15 px-3 select-none',
          docked ? '' : 'cursor-grab active:cursor-grabbing',
        ].join(' ')}
      >
        <Bot size={14} className="text-amber-200/80" />
        <h2 className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-100">
          {t.chat.title}
        </h2>

        <button
          type="button"
          onClick={closePanel}
          aria-label="Collapse chat"
          className="rounded p-1 text-stone-500 transition-colors hover:bg-white/5 hover:text-stone-200"
        >
          <ChevronDown size={14} />
        </button>
        <button
          type="button"
          onClick={() => router.push('/ai_assistants')}
          aria-label="Open full chat page"
          className="rounded p-1 text-stone-500 transition-colors hover:bg-white/5 hover:text-stone-200"
        >
          <ExternalLink size={13} />
        </button>
        <button
          type="button"
          onClick={closePanel}
          aria-label="Close chat"
          className="rounded p-1 text-stone-500 transition-colors hover:bg-white/5 hover:text-stone-200"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
        aria-label="AI Assistant conversation"
        data-testid="chat-message-scroll"
      >
        {messages.length === 0 ? (
          <div className="rounded border border-dashed border-stone-200/15 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-stone-400">
            {t.chat.welcome}
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => (
              <ChatMessageView key={message.id} message={message} />
            ))}
            
            {/* Thinking & Tools */}
            <ThinkingIndicator active={thinkingActive} text={thinkingText} />
            <ToolCallGroup
              calls={toolCalls}
              onConfirmGuarded={handleConfirmGuarded}
              onDenyGuarded={handleDenyGuarded}
            />
          </div>
        )}

        {/* Loading — animated typing dots (mirrors ChatPageClient style) */}
        {loading && (
          <div className="mt-2 flex items-center gap-1 rounded border border-stone-200/15 bg-stone-950/60 px-3 py-2.5 text-[11px] text-stone-400">
            <span className="flex items-center gap-0.5">
              <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-amber-300/60" style={{ animationDelay: '0ms' }} />
              <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-amber-300/60" style={{ animationDelay: '150ms' }} />
              <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-amber-300/60" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* ── Input ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-stone-200/15 p-2">
        <ChatInput
          placeholder={t.chat.placeholder}
          sendLabel={t.chat.send}
          loadingLabel={t.chat.loading}
          loading={loading}
          onSend={handleStreamSend}
          onCancel={handleCancelResponse}
          onSetValueRef={setInputValueRef}
          onInputApiRef={inputApiRef}
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
              onChange={handleSettingsChange}
              projectRoot={context.selectedProject?.config.project.root}
            />
          }
        />
      </div>
    </div>
  );
}
