'use client';

import { Send } from 'lucide-react';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';

interface ChatInputProps {
  placeholder: string;
  sendLabel: string;
  loadingLabel: string;
  loading: boolean;
  onSend: (message: string) => void;
}

export function ChatInput({ placeholder, sendLabel, loadingLabel, loading, onSend }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sentRef = useRef(false);
  const canSend = value.trim().length > 0 && !loading;

  // Autofocus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize the textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [value]);

  const submit = () => {
    const message = value.trim();
    if (!message || loading) return;
    sentRef.current = true;
    onSend(message);
    setValue('');
    // Reset height after clearing value
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
    }
    // Re-focus after send
    setTimeout(() => el?.focus(), 0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    submit();
  };

  return (
    <div>
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            sentRef.current = false;
            setValue(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="min-h-[34px] max-h-[200px] w-full resize-none rounded-lg border border-stone-200/15 bg-stone-950/70 px-3 py-2 text-[11px] text-stone-100 outline-none placeholder:text-stone-500 focus:border-amber-200/40 leading-relaxed"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-amber-200/25 bg-amber-500/10 text-amber-100 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-200/40 border-t-amber-100" />
          ) : (
            <Send size={13} />
          )}
        </button>
      </div>
    </div>
  );
}
