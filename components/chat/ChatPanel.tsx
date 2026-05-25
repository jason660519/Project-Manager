'use client';

import { Bot, ChevronDown, ExternalLink, MessageSquareText, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sendChatMessage } from '../../lib/chat/chatAgent';
import type { ChatContext, ChatMessage } from '../../lib/chat/types';
import { useI18n } from '../../lib/i18n';
import { ChatInput, type AttachedFile } from './ChatInput';
import { ChatMessage as ChatMessageView } from './ChatMessage';
import { ChatSettings } from './ChatSettings';
import { QuickActions } from './QuickActions';
import { ThinkingIndicator } from './ThinkingIndicator';
import { ToolCallGroup } from './ToolCallCard';
import type { ToolCallDisplay } from './ToolCallCard';

// ────────────────────────────────────────────────────────────────────────────

interface ChatPanelProps {
  context: ChatContext;
  defaultExpanded?: boolean;
  /** When provided, the panel renders as a floating window (no self-collapse). */
  toggleOpen?: (open: boolean) => void;
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

export function ChatPanel({ context, defaultExpanded = false, toggleOpen }: ChatPanelProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const closePanel = useCallback(() => {
    setExpanded(false);
    toggleOpen?.(false);
  }, [toggleOpen]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
    if (typeof scrollRef.current?.scrollIntoView === 'function') {
      scrollRef.current.scrollIntoView({ block: 'end' });
    }
  }, [messages, loading, expanded]);

  const handleStreamSend = useCallback(async (content: string, files?: AttachedFile[]) => {
    if (loading) return;

    // Augment message with file context
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

    // Clear previous error messages
    const cleanedMessages = messages.length > 0 && messages[messages.length - 1].status === 'error'
      ? messages.slice(0, -1)
      : messages;

    const userMessage = makeMessage('user', content);
    const nextMessages = [...cleanedMessages, userMessage];
    setMessages(nextMessages);
    setLoading(true);

    const assistantId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const placeholder = makeMessage('assistant', '');
    placeholder.id = assistantId;

    // Show placeholder immediately for streaming
    setMessages((prev) => [...prev, placeholder]);

    try {
      // Reset tool/thinking state
      setThinkingActive(false);
      setThinkingText('');
      setToolCalls([]);

      let accumulated = '';
      const result = await sendChatMessage({
        content: augmentedContent,
        history: nextMessages,
        context,
        navigate: (href) => router.push(href),
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
          setToolCalls(prev => prev.map(tc =>
            tc.id === id ? { ...tc, result: content, error, status: (error ? 'error' : 'done') as ToolCallDisplay['status'] } : tc
          ));
        },
      });

      setThinkingActive(false);

      const finalContent = result.content || accumulated;
      const assistantMessage = makeMessage('assistant', finalContent, result.error ? 'error' : 'sent');
      assistantMessage.id = assistantId;
      (assistantMessage as any).toolCalls = result.toolCalls || toolCalls;
      setMessages((prev) => {
        const withoutPlaceholder = prev.filter((m) => m.id !== assistantId);
        return [...withoutPlaceholder, assistantMessage];
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: t.chat.error, status: 'error' as const } : m)),
      );
    } finally {
      setLoading(false);
    }
  }, [loading, messages, context, router, chatSettings, t.chat.error]);

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
    <div className="w-[340px] max-w-[calc(100vw-24px)] rounded border border-stone-200/15 bg-stone-950/95 shadow-2xl shadow-black/40 backdrop-blur animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* ── Header (drag handle) ────────────────────────────────────────── */}
      <div data-drag-handle className="flex h-10 items-center gap-2 border-b border-stone-200/15 px-3 cursor-grab active:cursor-grabbing select-none">
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
      <div className="max-h-80 min-h-48 overflow-y-auto p-2">
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
            <ToolCallGroup calls={toolCalls} />
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
      <div className="border-t border-stone-200/15 p-2">
        <ChatInput
          placeholder={t.chat.placeholder}
          sendLabel={t.chat.send}
          loadingLabel={t.chat.loading}
          loading={loading}
          onSend={handleStreamSend}
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
              onChange={handleSettingsChange}
            />
          }
        />
      </div>
    </div>
  );
}
