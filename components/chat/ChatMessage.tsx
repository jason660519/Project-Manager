'use client';

import ReactMarkdown from 'react-markdown';
import type { ChatMessage as ChatMessageType } from '../../lib/chat/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  return (
    <div
      aria-label={isUser ? 'User message' : 'Assistant message'}
      className={[
        'rounded border px-2.5 py-2 text-[11px] leading-relaxed',
        isUser
          ? 'ml-4 border-amber-200/20 bg-amber-950/20 text-amber-50/90'
          : 'mr-4 border-stone-200/15 bg-stone-950/60 text-stone-200/90',
        message.status === 'error' ? 'border-red-400/30 text-red-100' : '',
      ].join(' ')}
    >
      {isUser ? (
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      ) : (
        <ReactMarkdown
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
