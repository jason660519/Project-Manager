'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage as ChatMessageType } from '../../lib/chat/types';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div
      aria-label={isUser ? 'User message' : 'Assistant message'}
      className={[
        'group rounded border px-2.5 py-2 text-[11px] leading-relaxed',
        isUser
          ? 'ml-4 border-amber-200/20 bg-amber-950/20 text-amber-50/90'
          : 'mr-4 border-stone-200/15 bg-stone-950/60 text-stone-200/90',
        message.status === 'error' ? 'border-red-400/30 text-red-100' : '',
      ].join(' ')}
    >
      {/* Meta row: role label + timestamp + actions */}
      <div className="mb-1 flex items-center gap-2">
        <span className={[
          'text-[9px] font-semibold uppercase tracking-wider',
          isUser ? 'text-amber-200/50' : 'text-stone-300/50',
        ].join(' ')}>
          {isUser ? 'You' : 'AI'}
        </span>
        {message.createdAt && (
          <span className="text-[9px] text-stone-500/60">
            {formatTime(message.createdAt)}
          </span>
        )}
        {!isUser && message.content && (
          <div className="ml-auto flex items-center gap-0.5">
            {message.status === 'error' && (
              <span className="px-1 py-0.5 text-[9px] text-red-400/60">Error</span>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded px-1 py-0.5 text-[9px] text-stone-500/50 opacity-0 transition-all hover:text-stone-300 group-hover:opacity-100"
              title="Copy message"
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {isUser ? (
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="mb-1.5 last:mb-0 whitespace-pre-wrap break-words">{children}</p>,
            ul: ({ children }) => <ul className="mb-1.5 list-disc pl-4">{children}</ul>,
            ol: ({ children }) => <ol className="mb-1.5 list-decimal pl-4">{children}</ol>,
            code: ({ children, className }) => (
              <code className={className ? 'rounded bg-black/40 px-1 py-0.5 font-mono text-[10px] text-cyan-100' : 'rounded bg-black/35 px-1 font-mono text-[10px] text-cyan-100'}>
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="my-2 overflow-x-auto rounded border border-stone-200/10 bg-black/45 p-2 font-mono text-[10px] text-cyan-100">
                {children}
              </pre>
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
      )}
    </div>
  );
}
