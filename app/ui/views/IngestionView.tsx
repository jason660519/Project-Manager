'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, FileInput, Upload, X } from 'lucide-react';
import { Feature, FeatureStatus, ProjectConfig } from '../../../lib/types';

interface IngestionViewProps {
  project: ProjectConfig;
  onImportFeatures: (features: Feature[]) => void;
}

type Phase = 'idle' | 'processing' | 'review' | 'done';

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

export function IngestionView({ project, onImportFeatures }: IngestionViewProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [draftFeatures, setDraftFeatures] = useState<Feature[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  const processFile = (file: File) => {
    const allowed = ['.docx', '.xlsx', '.md'];
    if (!allowed.some((ext) => file.name.endsWith(ext))) {
      alert('Only .docx, .xlsx, .md files are supported.');
      return;
    }
    setFileName(file.name);
    setPhase('processing');
    setTimeout(
      () => {
        setDraftFeatures(mockFeaturesFromFile(file.name));
        setPhase('review');
      },
      isTauri ? 2000 : 900,
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleConfirm = () => {
    onImportFeatures(draftFeatures);
    setPhase('done');
    setTimeout(() => {
      setPhase('idle');
      setFileName('');
      setDraftFeatures([]);
    }, 2000);
  };

  const reset = () => {
    setPhase('idle');
    setFileName('');
    setDraftFeatures([]);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">
          Spec Ingestion
        </h1>
        <p className="mt-1 text-xs text-stone-400">
          Drop a spec file to parse and generate feature drafts via AI.{' '}
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
            onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
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
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-stone-600 border-t-emerald-400" />
          <p className="text-sm text-stone-200">Parsing {fileName}…</p>
          <p className="mt-2 text-xs text-stone-500">
            {isTauri ? 'Running AI ingestion pipeline' : 'Simulating ingestion (dev mode)'}
          </p>
        </div>
      )}

      {/* Review */}
      {phase === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 border border-stone-200/18 bg-[#071d1a]/72 px-4 py-3">
            <FileInput size={16} className="text-amber-100" />
            <span className="text-sm text-stone-200">{fileName}</span>
            <button onClick={reset} className="ml-auto text-stone-400 hover:text-stone-100">
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
