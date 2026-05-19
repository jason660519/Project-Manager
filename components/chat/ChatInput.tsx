'use client';

import { FileText, Send, X } from 'lucide-react';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';

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

interface ChatInputProps {
  placeholder: string;
  sendLabel: string;
  loadingLabel: string;
  loading: boolean;
  onSend: (message: string, files?: AttachedFile[]) => void;
  /** External ref for focus delegation (e.g. keyboard shortcuts) */
  externalRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** Children rendered to the left of the textarea (e.g. quick actions) */
  beforeArea?: React.ReactNode;
  /** Children rendered between textarea and send button (e.g. settings) */
  afterArea?: React.ReactNode;
  /** Expose a setValue callback so parent components can set input content */
  onSetValueRef?: React.MutableRefObject<((value: string) => void) | undefined>;
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
  externalRef,
  beforeArea,
  afterArea,
  onSetValueRef,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sentRef = useRef(false);
  const canSend = (value.trim().length > 0 || files.length > 0) && !loading;

  // Expose setValue to parent via ref
  useEffect(() => {
    if (onSetValueRef) {
      onSetValueRef.current = (newValue: string) => {
        setValue(newValue);
        textareaRef.current?.focus();
      };
    }
    return () => {
      if (onSetValueRef) onSetValueRef.current = undefined;
    };
  }, [onSetValueRef]);

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
    setValue('');
    setFiles([]);
    setFileError(null);
    const el = textareaRef.current;
    if (el) el.style.height = 'auto';
    setTimeout(() => el?.focus(), 0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
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
    setValue(template);
    textareaRef.current?.focus();
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
            setValue(event.target.value);
          }}
          onKeyDown={handleKeyDown}
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

        {/* Send */}
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

      {/* File error */}
      {fileError && (
        <p className="mt-1 text-[9px] text-red-400">{fileError}</p>
      )}
    </div>
  );
}
