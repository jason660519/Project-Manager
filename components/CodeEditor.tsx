'use client';

import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import {
  Code2,
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Save,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { openInEditor, readFile, writeFile } from '../lib/bridge';
import { useI18n } from '../lib/i18n';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CodeEditorFile {
  /** Absolute path on disk (Tauri) or relative server path (web). */
  path: string;
  /** Display name shown in the tab header. */
  label?: string;
  /** Language hint for syntax highlighting (e.g. "typescript", "json"). */
  language?: string;
  /** Preloaded content — skips `readFile` on mount when provided. */
  content?: string;
}

interface CodeEditorProps {
  /** File(s) to open. Single file = no tabs; multiple = tab bar. */
  files: CodeEditorFile[];
  /** When true the panel floats as a modal overlay. Default: false. */
  modal?: boolean;
  /** Called when the editor is dismissed (X button or overlay click). */
  onClose?: () => void;
  /** Called after a successful save. */
  onSave?: (path: string) => void;
}

// ── Language detection helpers ────────────────────────────────────────────────

const EXT_LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'jsonc',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  mdx: 'markdown',
  css: 'css',
  scss: 'scss',
  html: 'html',
  htm: 'html',
  py: 'python',
  rs: 'rust',
  go: 'go',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  env: 'dotenv',
  txt: 'plaintext',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  xml: 'xml',
  svg: 'xml',
  proto: 'protobuf',
  dockerfile: 'dockerfile',
  prisma: 'prisma',
};

function detectLanguage(filePath: string, hint?: string): string {
  if (hint) return hint;
  const parts = filePath.split('.');
  if (parts.length < 2) return 'plaintext';
  const ext = parts[parts.length - 1]?.toLowerCase() ?? '';
  if (ext === 'env') return 'dotenv';
  return EXT_LANG_MAP[ext] ?? ext;
}

function displayName(file: CodeEditorFile): string {
  if (file.label) return file.label;
  const parts = file.path.split('/');
  return parts[parts.length - 1] ?? file.path;
}

// ── Theme configuration ───────────────────────────────────────────────────────

const PM_DARK_THEME: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#0d1117',
    'editor.foreground': '#c9d1d9',
    'editor.lineHighlightBackground': '#161b22',
    'editor.selectionBackground': '#264f78',
    'editorCursor.foreground': '#58a6ff',
    'editorLineNumber.foreground': '#484f58',
    'editorLineNumber.activeForeground': '#c9d1d9',
    'editor.selectionHighlightBackground': '#1f2937',
    'editor.inactiveSelectionBackground': '#1f2937',
    'editorWidget.background': '#161b22',
    'editorWidget.border': '#30363d',
    'input.background': '#0d1117',
    'input.border': '#30363d',
    'focusBorder': '#1f6feb',
    'list.activeSelectionBackground': '#1f2937',
    'list.hoverBackground': '#161b22',
    'sideBar.background': '#0d1117',
    'sideBar.border': '#21262d',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CodeEditor({ files, modal = false, onClose, onSave }: CodeEditorProps) {
  const { t } = useI18n();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [contents, setContents] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dirty, setDirty] = useState<Record<number, boolean>>({});

  const activeFile = files[activeIndex];
  const activeLang = activeFile ? detectLanguage(activeFile.path, activeFile.language) : 'plaintext';
  const isDirty = activeFile && dirty[activeIndex];

  // ── Load file content ─────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const loaded: Record<number, string> = {};
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f.content !== undefined) {
          loaded[i] = f.content;
        } else {
          try {
            loaded[i] = (await readFile(f.path)) || '';
          } catch {
            loaded[i] = `// Unable to read: ${f.path}`;
          }
        }
      }
      if (!cancelled) {
        setContents(loaded);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.map((f) => f.path).join('|')]);

  // ── Editor mount ──────────────────────────────────────────────────────────

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register custom dark theme
    monaco.editor.defineTheme('pm-dark', PM_DARK_THEME);
    monaco.editor.setTheme('pm-dark');

    // Keyboard shortcuts
    editor.addAction({
      id: 'pm-save',
      label: 'Save File',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => handleSave(),
    });
  }, []);

  // ── Track dirty state ─────────────────────────────────────────────────────

  const handleChange = useCallback((value: string | undefined) => {
    if (value === undefined) return;
    setContents((prev) => ({ ...prev, [activeIndex]: value }));
    setDirty((prev) => ({ ...prev, [activeIndex]: true }));
  }, [activeIndex]);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!activeFile || !contents[activeIndex]) return;
    setSaving(true);
    try {
      await writeFile(activeFile.path, contents[activeIndex]);
      setDirty((prev) => ({ ...prev, [activeIndex]: false }));
      onSave?.(activeFile.path);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[CodeEditor] Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [activeFile, activeIndex, contents, onSave]);

  // ── Open in external editor ───────────────────────────────────────────────

  const handleOpenExternal = useCallback(async () => {
    if (!activeFile) return;
    try {
      await openInEditor({ editor: 'codium', path: activeFile.path });
    } catch {
      // Fallback: try 'code' if 'codium' not found
      try {
        await openInEditor({ editor: 'code', path: activeFile.path });
      } catch (err: unknown) {
        console.error('[CodeEditor] openInEditor failed:', err);
      }
    }
  }, [activeFile]);

  // ── Container classes ─────────────────────────────────────────────────────

  const containerClass = modal
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'
    : 'relative flex flex-col h-full';

  const panelClass = expanded
    ? 'fixed inset-4 z-50 flex flex-col rounded-xl border border-[#30363d] bg-[#0d1117] shadow-2xl'
    : modal
      ? 'flex flex-col w-[90vw] max-w-5xl h-[80vh] rounded-xl border border-[#30363d] bg-[#0d1117] shadow-2xl'
      : 'flex flex-col h-full bg-[#0d1117]';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={containerClass}>
      {/* Backdrop for modal */}
      {modal && <div className="absolute inset-0" onClick={onClose} />}

      <div className={panelClass}>
        {/* ── Header bar ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#21262d] shrink-0">
          <Code2 className="w-4 h-4 text-[#58a6ff]" />
          <span className="text-xs font-semibold text-[#8b949e] tracking-wider uppercase">
            {t.codeEditor.title}
          </span>

          {/* File tabs */}
          <div className="flex items-center gap-0 ml-2">
            {files.map((f, i) => (
              <button
                key={f.path}
                onClick={() => setActiveIndex(i)}
                className={`
                  flex items-center gap-1.5 px-3 py-1 text-xs border-b-2 transition-colors
                  ${i === activeIndex
                    ? 'border-[#58a6ff] text-[#c9d1d9]'
                    : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9] hover:border-[#30363d]'
                  }
                `}
              >
                <FileText className="w-3 h-3" />
                {displayName(f)}
                {dirty[i] && <span className="w-1.5 h-1.5 rounded-full bg-[#d29922]" />}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-1">
            {loading && <Loader2 className="w-4 h-4 text-[#8b949e] animate-spin" />}

            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              title={t.codeEditor.saveShortcut}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[#1f2937] text-[#8b949e] hover:text-[#c9d1d9] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {isDirty ? t.codeEditor.save : t.codeEditor.saved}
            </button>

            <button
              onClick={handleOpenExternal}
              title={t.codeEditor.openInEditor}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[#1f2937] text-[#8b949e] hover:text-[#c9d1d9]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t.codeEditor.openInEditor}
            </button>

            <button
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? t.codeEditor.collapse : t.codeEditor.expand}
              className="p-1 rounded hover:bg-[#1f2937] text-[#8b949e] hover:text-[#c9d1d9]"
            >
              {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {onClose && (
              <button
                onClick={onClose}
                title={t.codeEditor.close}
                className="p-1 rounded hover:bg-[#1f2937] text-[#8b949e] hover:text-[#d73a49]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Editor body ────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full text-[#8b949e]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">{t.codeEditor.loading}</span>
            </div>
          ) : (
            <Editor
              height="100%"
              language={activeLang}
              value={contents[activeIndex] ?? ''}
              onChange={handleChange}
              onMount={handleMount}
              loading={
                <div className="flex items-center justify-center h-full text-[#8b949e]">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-sm">{t.codeEditor.loadingEditor}</span>
                </div>
              }
              options={{
                fontSize: 13,
                fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
                lineNumbers: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 2,
                insertSpaces: true,
                renderWhitespace: 'selection',
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true, indentation: true },
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                padding: { top: 8 },
                overviewRulerBorder: false,
                hideCursorInOverviewRuler: true,
                overviewRulerLanes: 0,
                renderLineHighlight: 'all',
                lineDecorationsWidth: 8,
              }}
            />
          )}
        </div>

        {/* ── Status bar ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-1.5 border-t border-[#21262d] shrink-0 text-[10px] text-[#484f58]">
          <span className="uppercase">{activeLang}</span>
          <span>UTF-8</span>
          <span>LF</span>
          <span className="tabular-nums">
            {activeFile?.path ?? '—'}
          </span>
          <div className="flex-1" />
          <span>
            {t.codeEditor.poweredBy}{' '}
            <a
              href="https://microsoft.github.io/monaco-editor/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#58a6ff] hover:underline"
            >
              Monaco Editor
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
