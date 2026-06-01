'use client';

import { FileText, Send, Square, X } from 'lucide-react';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  appendXmuxSnippetToInput,
  getXmuxDraggedSnippet,
} from '../../lib/xmux/selectedElementSnippet';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface AttachedFile {
  id: string;
  name: string;
  content: string;
  /** MIME type hint */
  type: string;
  size: number;
  /** Data URL for preview (images) */
  previewUrl?: string;
}

export interface ChatInputApi {
  setValue: (value: string) => void;
  appendValue: (suffix: string) => void;
  getValue: () => string;
}

interface ChatInputProps {
  placeholder: string;
  sendLabel: string;
  loadingLabel: string;
  loading: boolean;
  onSend: (message: string, files?: AttachedFile[]) => void;
  onCancel?: () => void;
  /** External ref for focus delegation (e.g. keyboard shortcuts) */
  externalRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** Children rendered to the left of the textarea (e.g. quick actions) */
  beforeArea?: React.ReactNode;
  /** Children rendered between textarea and send button (e.g. settings) */
  afterArea?: React.ReactNode;
  /** Expose a setValue callback so parent components can set input content */
  onSetValueRef?: React.MutableRefObject<((value: string) => void) | undefined>;
  /** Read/write helpers for parents that append content (e.g. xmux Select Element). */
  onInputApiRef?: React.MutableRefObject<ChatInputApi | undefined>;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB per file
const MAX_FILES = 5;

const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.json', '.yaml', '.yml', '.csv', '.log', '.env', '.toml', '.xml'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

/**
 * Read a file as text (or data URL for images).
 */
function readFile(file: File): Promise<AttachedFile> {
  return new Promise((resolve, reject) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const isImage = IMAGE_EXTENSIONS.includes(ext);
    const asDataUrl = isImage;
    const reader = new FileReader();

    reader.onload = () => {
      const content = reader.result as string;
      resolve({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        content: asDataUrl ? '' : content, // images: content is the data URL itself for preview
        type: file.type,
        size: file.size,
        previewUrl: asDataUrl ? content : undefined,
      });
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));

    if (asDataUrl) reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function ChatInput({
  placeholder,
  loadingLabel,
  loading,
  onSend,
  onCancel,
  externalRef,
  beforeArea,
  afterArea,
  onSetValueRef,
  onInputApiRef,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sentRef = useRef(false);
  const composingRef = useRef(false);
  const valueRef = useRef(value);
  const canSend = (value.trim().length > 0 || files.length > 0) && !loading;

  valueRef.current = value;

  const focusInput = (cursorToEnd = false, valueLength?: number) => {
    const textarea = textareaRef.current;
    textarea?.focus();
    if (!cursorToEnd || !textarea) return;
    const nextLength = valueLength ?? textarea.value.length;
    const schedule =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (callback: FrameRequestCallback) => window.setTimeout(callback, 0);
    schedule(() => {
      textarea.setSelectionRange(nextLength, nextLength);
      textarea.scrollTop = textarea.scrollHeight;
    });
  };

  // Expose setValue / append / getValue to parent via refs
  useEffect(() => {
    const setInputValue = (newValue: string) => {
      valueRef.current = newValue;
      setValue(newValue);
      focusInput(true, newValue.length);
    };
    const api: ChatInputApi = {
      setValue: setInputValue,
      appendValue: (suffix: string) => {
        const current = valueRef.current;
        const next = appendXmuxSnippetToInput(current, suffix);
        valueRef.current = next;
        setValue(next);
        focusInput(true, next.length);
      },
      getValue: () => valueRef.current,
    };
    if (onSetValueRef) {
      onSetValueRef.current = setInputValue;
    }
    if (onInputApiRef) {
      onInputApiRef.current = api;
    }
    return () => {
      if (onSetValueRef) onSetValueRef.current = undefined;
      if (onInputApiRef) onInputApiRef.current = undefined;
    };
  }, [onInputApiRef, onSetValueRef]);

  // Sync external ref
  useEffect(() => {
    if (externalRef) {
      (externalRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = textareaRef.current;
    }
  });

  // Autofocus
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [value]);

  const submit = () => {
    const message = value.trim();
    if (!message && files.length === 0) return;
    if (loading) return;
    sentRef.current = true;
    onSend(message, files.length > 0 ? [...files] : undefined);
    valueRef.current = '';
    setValue('');
    setFiles([]);
    setFileError(null);
    const el = textareaRef.current;
    if (el) el.style.height = 'auto';
    setTimeout(() => el?.focus(), 0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && loading && onCancel) {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.nativeEvent.isComposing || composingRef.current) return;
    event.preventDefault();
    submit();
  };

  const handleAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    // Validate
    if (files.length + selected.length > MAX_FILES) {
      setFileError(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const tooBig = selected.find((f) => f.size > MAX_FILE_SIZE);
    if (tooBig) {
      setFileError(`File too large (max 1MB): ${tooBig.name}`);
      return;
    }

    try {
      const read = await Promise.all(selected.map((f) => readFile(f)));
      setFiles((prev) => [...prev, ...read]);
    } catch (err) {
      setFileError((err as Error).message);
    }

    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const insertTemplate = (template: string) => {
    valueRef.current = template;
    setValue(template);
    textareaRef.current?.focus();
  };

  const appendSnippetAtEnd = (snippet: string) => {
    const next = appendXmuxSnippetToInput(valueRef.current, snippet);
    valueRef.current = next;
    setValue(next);
    focusInput(true, next.length);
  };

  const handleDragOver = (event: React.DragEvent<HTMLTextAreaElement>) => {
    if (!getXmuxDraggedSnippet(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (event: React.DragEvent<HTMLTextAreaElement>) => {
    const snippet = getXmuxDraggedSnippet(event.dataTransfer);
    if (!snippet) return;
    event.preventDefault();
    appendSnippetAtEnd(snippet);
  };

  return (
    <div>
      {/* File chips */}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-[9px] text-amber-100/70"
            >
              {file.previewUrl ? (
                <img src={file.previewUrl} alt="" className="h-4 w-4 rounded object-cover" />
              ) : (
                <FileText size={10} />
              )}
              <span className="max-w-[120px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                className="ml-0.5 text-stone-500 hover:text-red-400"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={[...SUPPORTED_EXTENSIONS, ...IMAGE_EXTENSIONS].join(',')}
        className="hidden"
        onChange={handleFilesSelected}
      />

      {/* Input row */}
      <div className="flex items-end gap-1.5">
        {/* Left toolbar (before area) */}
        {beforeArea && (
          <div className="flex items-center gap-0.5 pb-1">{beforeArea}</div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            sentRef.current = false;
            valueRef.current = event.target.value;
            setValue(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          placeholder={placeholder}
          rows={1}
          className="min-h-[34px] max-h-[200px] w-full resize-none rounded-lg border border-stone-200/15 bg-stone-950/70 px-3 py-2 text-[11px] text-stone-100 outline-none placeholder:text-stone-500 focus:border-amber-200/40 leading-relaxed"
        />

        {/* Right toolbar (after area) */}
        {afterArea && (
          <div className="flex items-center gap-0.5 pb-1">{afterArea}</div>
        )}

        {/* Attach file */}
        <button
          type="button"
          onClick={handleAttach}
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded text-stone-500 transition-colors hover:bg-white/[0.06] hover:text-stone-200"
          title="Attach file"
        >
          <FileText size={13} />
        </button>

        {/* Send / stop */}
        <button
          type="button"
          onClick={loading && onCancel ? onCancel : submit}
          disabled={loading ? !onCancel : !canSend}
          aria-label={loading && onCancel ? 'Stop response' : 'Send message'}
          title={loading && onCancel ? 'Stop response (Esc)' : 'Send message'}
          className={[
            'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            loading && onCancel
              ? 'border-red-200/25 bg-red-500/10 text-red-100 hover:bg-red-500/15'
              : 'border-amber-200/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15',
          ].join(' ')}
        >
          {loading && !onCancel ? (
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-200/40 border-t-amber-100" />
          ) : loading ? (
            <Square size={12} />
          ) : (
            <Send size={13} />
          )}
        </button>
      </div>

      {/* File error */}
      {fileError && (
        <p className="mt-1 text-[9px] text-red-400">{fileError}</p>
      )}
    </div>
  );
}
