'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileInput, Upload, X } from 'lucide-react';
import { Feature, FeatureStatus, ProjectConfig } from '../../../lib/types';
import { parseMarkdown } from '../../../lib/ingestion/parseMarkdown';
import { callAnthropic } from '../../../lib/bridge';

interface IngestionViewProps {
  project: ProjectConfig;
  onImportFeatures: (features: Feature[]) => void;
}

type Phase = 'idle' | 'processing' | 'review' | 'done';

/** Fallback when file type is unsupported or AI is unavailable. */
function mockFeaturesFromFile(fileName: string): Feature[] {
  const baseName = fileName.replace(/\.(docx|xlsx|md)$/i, '');
  const id = `IMP-${Date.now().toString(36).toUpperCase().slice(-5)}`;
  const displayName = baseName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return [
    {
      id,
      name: displayName,
      category: 'Imported',
      status: 'todo' as FeatureStatus,
      progress: 0,
      paths: { spec: `docs/features/${baseName}.md` },
      notes: `Auto-imported from ${fileName}`,
    },
  ];
}

/**
 * Use the Anthropic API (Tauri only) to generate feature stubs for a
 * DOCX/XLSX file whose binary content cannot be parsed directly in JS.
 * The AI receives the filename + file size and generates plausible stubs.
 */
async function parseWithAI(file: File, apiKey: string): Promise<Feature[]> {
  const sizeKb = (file.size / 1024).toFixed(1);
  const resp = await callAnthropic({
    apiKey,
    maxTokens: 1024,
    messages: [
      {
        role: 'user',
        content:
          `A developer uploaded a spec document named "${file.name}" (${sizeKb} KB). ` +
          'Generate 3–5 software feature requirement stubs that would plausibly appear in ' +
          'such a document. Return ONLY a valid JSON array — no markdown fences, no extra text — ' +
          'with this structure:\n' +
          '[{"name": "...", "category": "...", "status": "todo", "notes": "..."}]\n' +
          'Valid status values: "todo", "in_progress", "done", "on_hold".',
      },
    ],
  });

  const parsed = JSON.parse(resp.content) as Array<{
    name: string;
    category?: string;
    status?: string;
    notes?: string;
  }>;

  return parsed.map((item, i) => ({
    id: `IMP-${Date.now().toString(36).toUpperCase().slice(-4)}${i.toString(36).toUpperCase()}`,
    name: item.name,
    category: item.category ?? 'Imported',
    status: (item.status ?? 'todo') as FeatureStatus,
    progress: 0,
    paths: {},
    notes: item.notes,
  }));
}

export function IngestionView({ project, onImportFeatures }: IngestionViewProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [draftFeatures, setDraftFeatures] = useState<Feature[]>([]);
  const [parseMethod, setParseMethod] = useState<'md' | 'ai' | 'mock'>('mock');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }, []);

  const processFile = async (file: File) => {
    const allowed = ['.docx', '.xlsx', '.md'];
    if (!allowed.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      alert('Only .docx, .xlsx, .md files are supported.');
      return;
    }

    setFileName(file.name);
    setPhase('processing');

    try {
      let drafts: Feature[];

      if (file.name.toLowerCase().endsWith('.md')) {
        // Real Markdown parsing — works in browser and Tauri
        const text = await file.text();
        drafts = parseMarkdown(text, file.name);
        setParseMethod('md');
      } else if (isTauri) {
        // DOCX / XLSX in Tauri — ask AI to generate plausible feature stubs
        const apiKey =
          typeof window !== 'undefined' ? (localStorage.getItem('devpilot-api-key') ?? '') : '';
        if (apiKey) {
          drafts = await parseWithAI(file, apiKey);
          setParseMethod('ai');
        } else {
          // Tauri but no API key yet → mock + hint
          await new Promise<void>((r) => setTimeout(r, 900));
          drafts = mockFeaturesFromFile(file.name);
          setParseMethod('mock');
        }
      } else {
        // Browser dev mode — always mock
        await new Promise<void>((r) => setTimeout(r, 900));
        drafts = mockFeaturesFromFile(file.name);
        setParseMethod('mock');
      }

      setDraftFeatures(drafts);
      setPhase('review');
    } catch (err) {
      console.error('[IngestionView] processFile error:', err);
      // Graceful fallback — show mock drafts so the review step is always reachable
      setDraftFeatures(mockFeaturesFromFile(file.name));
      setParseMethod('mock');
      setPhase('review');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void processFile(file);
  };

  const handleConfirm = () => {
    onImportFeatures(draftFeatures);
    setPhase('done');
    setTimeout(() => {
      setPhase('idle');
      setFileName('');
      setDraftFeatures([]);
      setParseMethod('mock');
    }, 2000);
  };

  const reset = () => {
    setPhase('idle');
    setFileName('');
    setDraftFeatures([]);
    setParseMethod('mock');
  };

  /** Human-readable description of how the drafts were generated. */
  const parseMethodLabel =
    parseMethod === 'md'
      ? 'Parsed from Markdown headings'
      : parseMethod === 'ai'
        ? 'Generated by AI (Claude) from filename'
        : isTauri
          ? 'Simulated — add API key in Settings for AI parsing'
          : 'Simulated (dev mode)';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">
          Spec Ingestion
        </h1>
        <p className="mt-1 text-xs text-stone-400">
          Drop a spec file to parse and generate feature drafts.{' '}
          {!isTauri && (
            <span className="text-amber-100/70">Dry-run mode — AI parsing simulated.</span>
          )}
        </p>
      </div>

      {/* Idle: Drop Zone */}
      {phase === 'idle' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex min-h-64 cursor-pointer flex-col items-center justify-center border-2 border-dashed transition-colors ${
            dragOver
              ? 'border-emerald-400/60 bg-emerald-950/30'
              : 'border-stone-200/20 bg-[#071d1a]/50 hover:border-stone-200/40 hover:bg-[#071d1a]/80'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.xlsx,.md"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void processFile(file);
            }}
          />
          <Upload className="mb-4 text-stone-400" size={36} />
          <p className="text-sm font-medium text-stone-200">Drop spec file here</p>
          <p className="mt-2 text-xs text-stone-500">Supports .docx · .xlsx · .md</p>
          <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-stone-500">
            or click to browse
          </p>
        </div>
      )}

      {/* Processing */}
      {phase === 'processing' && (
        <div className="flex min-h-64 flex-col items-center justify-center border border-stone-200/18 bg-[#071d1a]/72">
          <div className="mb-4 h-8 w-8 animate-spin border-2 border-stone-600 border-t-emerald-400" />
          <p className="text-sm text-stone-200">Parsing {fileName}…</p>
          <p className="mt-2 text-xs text-stone-500">
            {fileName.toLowerCase().endsWith('.md')
              ? 'Extracting features from Markdown headings'
              : isTauri
                ? 'Generating feature stubs via AI'
                : 'Simulating ingestion (dev mode)'}
          </p>
        </div>
      )}

      {/* Review */}
      {phase === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 border border-stone-200/18 bg-[#071d1a]/72 px-4 py-3">
            <FileInput size={16} className="text-amber-100" />
            <span className="text-sm text-stone-200">{fileName}</span>
            <span className="ml-auto mr-3 text-[10px] uppercase tracking-[0.14em] text-stone-500">
              {parseMethodLabel}
            </span>
            <button onClick={reset} className="text-stone-400 hover:text-stone-100">
              <X size={16} />
            </button>
          </div>

          <div className="border border-stone-200/18 bg-[#071d1a]/72">
            <div className="border-b border-stone-200/12 px-4 py-3">
              <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
                Generated Drafts ({draftFeatures.length})
              </h2>
              <p className="mt-1 text-xs text-stone-400">Review and edit before importing.</p>
            </div>
            <div className="divide-y divide-stone-200/10">
              {draftFeatures.map((feature, i) => (
                <div key={feature.id} className="space-y-2 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 font-mono text-xs text-stone-500">{feature.id}</span>
                    <div className="flex-1 space-y-2">
                      <input
                        value={feature.name}
                        onChange={(e) => {
                          const updated = [...draftFeatures];
                          updated[i] = { ...feature, name: e.target.value };
                          setDraftFeatures(updated);
                        }}
                        className="w-full border border-stone-200/20 bg-transparent px-2 py-1 text-sm text-stone-100 outline-none focus:ring-1 focus:ring-emerald-300/35"
                      />
                      <div className="flex gap-2">
                        <select
                          value={feature.status}
                          onChange={(e) => {
                            const updated = [...draftFeatures];
                            updated[i] = { ...feature, status: e.target.value as FeatureStatus };
                            setDraftFeatures(updated);
                          }}
                          className="border border-stone-200/20 bg-[#03100f] px-2 py-1 text-xs text-stone-200 outline-none"
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="done">Done</option>
                          <option value="on_hold">Blocked</option>
                        </select>
                        <input
                          value={feature.category}
                          onChange={(e) => {
                            const updated = [...draftFeatures];
                            updated[i] = { ...feature, category: e.target.value };
                            setDraftFeatures(updated);
                          }}
                          placeholder="Category"
                          className="flex-1 border border-stone-200/20 bg-transparent px-2 py-1 text-xs text-stone-400 outline-none focus:ring-1 focus:ring-emerald-300/35"
                        />
                      </div>
                      {feature.notes && (
                        <p className="text-[11px] text-stone-500">{feature.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={reset} className="px-4 py-2 text-sm text-stone-300 hover:bg-white/5">
              Discard
            </button>
            <button
              onClick={handleConfirm}
              className="bg-stone-100 px-4 py-2 text-sm font-medium text-[#071d1a] hover:bg-amber-100"
            >
              Import {draftFeatures.length} Feature{draftFeatures.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && (
        <div className="flex min-h-64 flex-col items-center justify-center border border-emerald-200/20 bg-emerald-950/20">
          <CheckCircle2 className="mb-4 text-emerald-400" size={36} />
          <p className="text-sm font-medium text-emerald-200">Features imported successfully</p>
          <p className="mt-2 text-xs text-stone-400">Returning to drop zone…</p>
        </div>
      )}

      {/* Target project info */}
      <div className="border border-stone-200/12 bg-[#071d1a]/40 p-4">
        <h3 className="mb-2 text-xs uppercase tracking-[0.16em] text-stone-400">Target Project</h3>
        <p className="text-sm font-medium text-stone-200">{project.name}</p>
        <p className="mt-1 truncate text-xs text-stone-500">{project.root}</p>
        {!isTauri && (
          <p className="mt-3 text-[11px] text-amber-100/60">
            Dev mode: features added to in-memory state only. In production they write to
            .dev-pilot.json via Tauri bridge.
          </p>
        )}
      </div>
    </div>
  );
}
