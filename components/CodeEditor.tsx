'use client';

import Editor, { DiffEditor, type OnMount, type DiffOnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import {
  ArrowDown,
  ArrowUp,
  Code2,
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Save,
  SplitSquareVertical,
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

export interface DiffFile {
  original: CodeEditorFile;
  modified: CodeEditorFile;
  /** Label for the comparison (e.g. "HEAD vs Working"). */
  label?: string;
}

interface CodeEditorProps {
  /** File(s) to open. Single file = no tabs; multiple = tab bar. */
  files?: CodeEditorFile[];
  /** Diff comparison mode — overrides `files` when set. */
  diff?: DiffFile;
  /** When true the panel floats as a modal overlay. Default: false. */
  modal?: boolean;
  /** Called when the editor is dismissed (X button or overlay click). */
  onClose?: () => void;
  /** Called after a successful save. */
  onSave?: (path: string) => void;
  /** Called when a tab is closed. */
  onTabClose?: (path: string) => void;
  /** Preferred external editor CLI name. */
  preferredEditor?: string;
  /** Initial line to jump to (1-based). */
  initialLine?: number;
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
    'diffEditor.insertedTextBackground': '#1a3a2a',
    'diffEditor.insertedLineBackground': '#0d2818',
    'diffEditor.removedTextBackground': '#3a1a1a',
    'diffEditor.removedLineBackground': '#280d0d',
  },
};

// ── Go-to-line popover ───────────────────────────────────────────────────────

function GoToLinePopover({
  editor,
  onClose,
}: {
  editor: editor.IStandaloneCodeEditor | editor.IStandaloneDiffEditor | null;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleGo = () => {
    const line = parseInt(value, 10);
    if (!isNaN(line) && line > 0 && editor) {
      // For diff editor, navigate the modified side
      const target = 'getModifiedEditor' in editor ? editor.getModifiedEditor() : editor;
      target.revealLineInCenter(line);
      target.setPosition({ lineNumber: line, column: 1 });
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleGo();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="absolute right-12 top-2 z-50 flex items-center gap-1 rounded border border-[#30363d] bg-[#161b22] px-2 py-1 shadow-lg">
      <span className="text-[10px] text-[#8b949e]">Go to line:</span>
      <input
        ref={inputRef}
        type="number"
        min={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="1"
        className="w-16 border-0 bg-transparent px-1 py-0 text-xs text-[#c9d1d9] outline-none placeholder:text-[#484f58]"
      />
      <button
        onClick={handleGo}
        className="rounded px-1.5 py-0.5 text-[10px] text-[#58a6ff] hover:bg-[#1f2937]"
      >
        Go
      </button>
      <button
        onClick={onClose}
        className="rounded px-1 py-0.5 text-[10px] text-[#8b949e] hover:bg-[#1f2937]"
      >
        ✕
      </button>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CodeEditor({
  files = [],
  diff,
  modal = false,
  onClose,
  onSave,
  onTabClose,
  preferredEditor = 'codium',
  initialLine,
}: CodeEditorProps) {
  const { t } = useI18n();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [contents, setContents] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadErrors, setLoadErrors] = useState<Record<number, string>>({});
  const [saveError, setSaveError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [dirty, setDirty] = useState<Record<number, boolean>>({});
  const [showGoToLine, setShowGoToLine] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'diff'>(
    diff ? 'diff' : 'edit',
  );

  const isDiff = viewMode === 'diff';
  const activeFile = files[activeIndex];
  const activeLang = activeFile ? detectLanguage(activeFile.path, activeFile.language) : 'plaintext';
  const isDirty = activeFile && dirty[activeIndex];
  const activeLoadError = loadErrors[activeIndex];

  // ── Load file content ─────────────────────────────────────────────────────

  useEffect(() => {
    if (isDiff) return; // diff mode loads separately
    let cancelled = false;
    async function load() {
      setLoading(true);
      const loaded: Record<number, string> = {};
      const errors: Record<number, string> = {};
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f.content !== undefined) {
          loaded[i] = f.content;
        } else {
          try {
            loaded[i] = (await readFile(f.path)) || '';
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            loaded[i] = '';
            errors[i] = `Unable to read ${f.path}: ${msg}`;
          }
        }
      }
      if (!cancelled) {
        setContents(loaded);
        setLoadErrors(errors);
        setSaveError('');
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.map((f) => f.path).join('|'), isDiff]);

  // ── Editor mount ──────────────────────────────────────────────────────────

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      monaco.editor.defineTheme('pm-dark', PM_DARK_THEME);
      monaco.editor.setTheme('pm-dark');

      // Cmd+S save
      editor.addAction({
        id: 'pm-save',
        label: 'Save File',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: () => handleSave(),
      });

      // Cmd+G go to line
      editor.addAction({
        id: 'pm-go-to-line',
        label: 'Go to Line',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG],
        run: () => setShowGoToLine((v) => !v),
      });

      // Jump to initial line if specified
      if (initialLine && initialLine > 0) {
        editor.revealLineInCenter(initialLine);
        editor.setPosition({ lineNumber: initialLine, column: 1 });
      }
    },
    [initialLine],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDiffMount: DiffOnMount = useCallback((editor: any, monaco: any) => {
    diffEditorRef.current = editor;
    monacoRef.current = monaco;
    monaco.editor.defineTheme('pm-dark', PM_DARK_THEME);
    monaco.editor.setTheme('pm-dark');
  }, []);

  // ── Track dirty state ─────────────────────────────────────────────────────

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined) return;
      setSaveError('');
      setContents((prev) => ({ ...prev, [activeIndex]: value }));
      setDirty((prev) => ({ ...prev, [activeIndex]: true }));
    },
    [activeIndex],
  );

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!activeFile || contents[activeIndex] === undefined) return;
    setSaving(true);
    setSaveError('');
    try {
      await writeFile(activeFile.path, contents[activeIndex]);
      setDirty((prev) => ({ ...prev, [activeIndex]: false }));
      onSave?.(activeFile.path);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[CodeEditor] Save failed: ${msg}`);
      setSaveError(`Unable to save ${activeFile.path}: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [activeFile, activeIndex, contents, onSave]);

  // ── Close tab ─────────────────────────────────────────────────────────────

  const handleCloseTab = useCallback(
    (index: number, path: string) => {
      if (files.length <= 1) {
        onTabClose?.(path);
        return; // last tab — parent handles dismissal
      }
      onTabClose?.(path);
      // Remove from contents and dirty state
      setContents((prev) => {
        const next = { ...prev };
        delete next[index];
        // Re-index remaining entries
        const remapped: Record<number, string> = {};
        let newIdx = 0;
        for (const [k, v] of Object.entries(next)) {
          const oldIdx = parseInt(k, 10);
          if (oldIdx !== index) {
            remapped[newIdx++] = v;
          }
        }
        return remapped;
      });
      setDirty((prev) => {
        const next = { ...prev };
        delete next[index];
        const remapped: Record<number, boolean> = {};
        let newIdx = 0;
        for (const [k, v] of Object.entries(next)) {
          const oldIdx = parseInt(k, 10);
          if (oldIdx !== index) {
            remapped[newIdx++] = v;
          }
        }
        return remapped;
      });
      if (activeIndex >= index) {
        setActiveIndex(Math.max(0, activeIndex - 1));
      }
    },
    [activeIndex, files.length, onTabClose],
  );

  // ── Open in external editor ───────────────────────────────────────────────

  const handleOpenExternal = useCallback(async () => {
    if (!activeFile) return;
    const editors = [preferredEditor, 'codium', 'code'];
    for (const editor of editors) {
      try {
        await openInEditor({ editor, path: activeFile.path });
        return;
      } catch {
        continue;
      }
    }
  }, [activeFile, preferredEditor]);

  // ── Global keyboard shortcuts ─────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'g') {
        e.preventDefault();
        setShowGoToLine((v) => !v);
      }
      if (mod && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setViewMode((v) => (v === 'diff' ? 'edit' : 'diff'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Container classes ─────────────────────────────────────────────────────

  const containerClass = modal
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'
    : 'relative flex flex-col h-full';

  const panelClass = expanded
    ? 'fixed inset-4 z-50 flex flex-col rounded-xl border border-[#30363d] bg-[#0d1117] shadow-2xl'
    : modal
      ? 'flex flex-col w-[90vw] max-w-5xl h-[80vh] rounded-xl border border-[#30363d] bg-[#0d1117] shadow-2xl'
      : 'flex flex-col h-full bg-[#0d1117]';

  // ── Diff view ─────────────────────────────────────────────────────────────

  if (diff && !showGoToLine) {
    const originalLang = detectLanguage(diff.original.path, diff.original.language);
    const modifiedLang = detectLanguage(diff.modified.path, diff.modified.language);

    return (
      <div className={containerClass}>
        {modal && <div className="absolute inset-0" onClick={onClose} />}
        <div className={panelClass}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[#21262d] shrink-0">
            <SplitSquareVertical className="w-4 h-4 text-[#d29922]" />
            <span className="text-xs font-semibold text-[#8b949e] tracking-wider uppercase">
              Diff: {diff.label ?? `${displayName(diff.original)} ↔ ${displayName(diff.modified)}`}
            </span>
            <div className="flex-1" />
            <button
              onClick={() => setViewMode('edit')}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[#1f2937] text-[#8b949e] hover:text-[#c9d1d9]"
            >
              <Code2 className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1 rounded hover:bg-[#1f2937] text-[#8b949e] hover:text-[#c9d1d9]"
            >
              {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            {onClose && (
              <button onClick={onClose} className="p-1 rounded hover:bg-[#1f2937] text-[#8b949e] hover:text-[#d73a49]">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Diff body */}
          <div className="flex-1 min-h-0">
            <DiffEditor
              height="100%"
              original={diff.original.content ?? `// Loading: ${diff.original.path}`}
              modified={diff.modified.content ?? `// Loading: ${diff.modified.path}`}
              language={modifiedLang}
              originalLanguage={originalLang}
              onMount={handleDiffMount}
              loading={
                <div className="flex items-center justify-center h-full text-[#8b949e]">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-sm">Loading diff…</span>
                </div>
              }
              options={{
                fontSize: 13,
                fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
                lineNumbers: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                renderSideBySide: true,
                smoothScrolling: true,
                padding: { top: 8 },
                overviewRulerBorder: false,
                overviewRulerLanes: 0,
              }}
            />
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-3 px-4 py-1.5 border-t border-[#21262d] shrink-0 text-[10px] text-[#484f58]">
            <span className="uppercase">{modifiedLang}</span>
            <span className="text-[#d29922]">Diff View</span>
            <div className="flex-1" />
            <span className="text-[#3fb950]">+ {displayName(diff.modified)}</span>
            <span className="text-[#f85149]">− {displayName(diff.original)}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={containerClass}>
      {/* Backdrop for modal */}
      {modal && <div className="absolute inset-0" onClick={onClose} />}

      <div className={panelClass}>
        {/* ── Header bar ─────────────────────────────────────────────────── */}
        <div className="relative flex items-center gap-2 px-4 py-2 border-b border-[#21262d] shrink-0">
          <Code2 className="w-4 h-4 text-[#58a6ff]" />
          <span className="text-xs font-semibold text-[#8b949e] tracking-wider uppercase">
            {t.codeEditor.title}
          </span>

          {/* File tabs */}
          <div className="flex items-center gap-0 ml-2 overflow-x-auto">
            {files.map((f, i) => (
              <button
                key={f.path}
                onClick={() => setActiveIndex(i)}
                className={`
                  group flex items-center gap-1.5 px-3 py-1 text-xs border-b-2 transition-colors shrink-0
                  ${i === activeIndex
                    ? 'border-[#58a6ff] text-[#c9d1d9]'
                    : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9] hover:border-[#30363d]'
                  }
                `}
              >
                <FileText className="w-3 h-3" />
                {displayName(f)}
                {dirty[i] && <span className="w-1.5 h-1.5 rounded-full bg-[#d29922]" />}
                {files.length > 1 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTab(i, f.path);
                    }}
                    className="ml-0.5 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-[#d73a4933] text-[#8b949e] hover:text-[#d73a49]"
                    title="Close tab"
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Go-to-line popover */}
          {showGoToLine && (
            <GoToLinePopover
              editor={editorRef.current}
              onClose={() => setShowGoToLine(false)}
            />
          )}

          {/* Actions */}
          <div className="flex items-center gap-1">
            {loading && <Loader2 className="w-4 h-4 text-[#8b949e] animate-spin" />}

            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              title={`${t.codeEditor.saveShortcut} · Cmd+G go to line · Shift+Cmd+D toggle diff`}
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
              onClick={() => setShowGoToLine((v) => !v)}
              title="Go to line (⌘G)"
              className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[#1f2937] text-[#8b949e] hover:text-[#c9d1d9]"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              Line
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

        {(activeLoadError || saveError) && (
          <div className="border-b border-[#3a2a14] bg-[#2b2113] px-4 py-2 text-xs text-[#f0c36a]">
            {saveError || activeLoadError}
          </div>
        )}

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
                guides: {
                  bracketPairs: true,
                  indentation: true,
                },
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
          <span className="tabular-nums">{activeFile?.path ?? '—'}</span>
          <div className="flex-1" />
          {files.length > 1 && (
            <span>
              Tab {activeIndex + 1}/{files.length}
            </span>
          )}
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
