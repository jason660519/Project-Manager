'use client';

import { Send } from 'lucide-react';
import { KeyboardEvent, useState } from 'react';

interface ChatInputProps {
  placeholder: string;
  sendLabel: string;
  loadingLabel: string;
  loading: boolean;
  onSend: (message: string) => void;
}

export function ChatInput({ placeholder, sendLabel, loadingLabel, loading, onSend }: ChatInputProps) {
  const [value, setValue] = useState('');
  const canSend = value.trim().length > 0 && !loading;

  const submit = () => {
    const message = value.trim();
    if (!message || loading) return;
    onSend(message);
    setValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    submit();
  };

  return (
    <div className="border-t border-stone-200/15 p-2">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={2}
        className="min-h-14 w-full resize-none rounded border border-stone-200/15 bg-stone-950/70 px-2 py-2 text-[11px] text-stone-100 outline-none placeholder:text-stone-500 focus:border-amber-200/40"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!canSend}
        className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded border border-amber-200/25 bg-amber-500/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send size={12} />
        <span>{loading ? loadingLabel : sendLabel}</span>
      </button>
    </div>
  );
}
