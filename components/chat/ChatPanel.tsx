'use client';

import { Bot, ChevronDown, MessageSquareText, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { sendChatMessage } from '../../lib/chat/chatAgent';
import type { ChatContext, ChatMessage } from '../../lib/chat/types';
import { useI18n } from '../../lib/i18n';
import { ChatInput } from './ChatInput';
import { ChatMessage as ChatMessageView } from './ChatMessage';

interface ChatPanelProps {
  context: ChatContext;
  defaultExpanded?: boolean;
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

export function ChatPanel({ context, defaultExpanded = false }: ChatPanelProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof scrollRef.current?.scrollIntoView === 'function') {
      scrollRef.current.scrollIntoView({ block: 'end' });
    }
  }, [messages, loading, expanded]);

  const handleSend = async (content: string) => {
    if (loading) return;
    const userMessage = makeMessage('user', content);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const result = await sendChatMessage({
        content,
        history: nextMessages,
        context,
        navigate: (href) => router.push(href),
      });
      setMessages((current) => [
        ...current,
        makeMessage('assistant', result.content, result.error ? 'error' : 'sent'),
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        makeMessage('assistant', t.chat.error, 'error'),
      ]);
    } finally {
      setLoading(false);
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
    <div className="absolute bottom-14 left-2 z-50 w-[320px] max-w-[calc(100vw-24px)] rounded border border-stone-200/15 bg-stone-950/95 shadow-2xl shadow-black/40 backdrop-blur">
      <div className="flex h-10 items-center gap-2 border-b border-stone-200/15 px-3">
        <Bot size={14} className="text-amber-200/80" />
        <h2 className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-100">
          {t.chat.title}
        </h2>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Collapse chat"
          className="rounded p-1 text-stone-500 transition-colors hover:bg-white/5 hover:text-stone-200"
        >
          <ChevronDown size={14} />
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Close chat"
          className="rounded p-1 text-stone-500 transition-colors hover:bg-white/5 hover:text-stone-200"
        >
          <X size={14} />
        </button>
      </div>

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
          </div>
        )}
        {loading && (
          <div className="mt-2 rounded border border-stone-200/15 bg-stone-950/60 px-2.5 py-2 text-[11px] text-stone-400">
            {t.chat.loading}
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <ChatInput
        placeholder={t.chat.placeholder}
        sendLabel={t.chat.send}
        loadingLabel={t.chat.loading}
        loading={loading}
        onSend={handleSend}
      />
    </div>
  );
}
