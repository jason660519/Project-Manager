'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText, Loader2, Upload, X } from 'lucide-react';
import { parseEnvText } from '../../../../lib/keys/envParser';
import { detectProviders, type DetectedKey } from '../../../../lib/keys/detectProviders';
import { saveProviderSecret } from '../../../../lib/keys/keychain';
import { scanEnvFiles, type EnvFileInfo } from '../../../../lib/bridge';

interface EnvImportModalProps {
  /** Optional project root — when provided, the modal offers a "Scan project" tab. */
  projectRoot?: string;
  onClose: () => void;
  onImported: (count: number) => void;
}

type Tab = 'paste' | 'scan';

export function EnvImportModal({ projectRoot, onClose, onImported }: EnvImportModalProps) {
  const initialTab: Tab = projectRoot ? 'scan' : 'paste';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pasteText, setPasteText] = useState('');
  const [scanFiles, setScanFiles] = useState<EnvFileInfo[]>([]);
  const [scanSelectedPath, setScanSelectedPath] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Auto-scan on open when a project root is supplied.
  useEffect(() => {
    if (!projectRoot) return;
    setScanning(true);
    setScanError('');
    scanEnvFiles(projectRoot)
      .then((files) => {
        setScanFiles(files);
        if (files.length > 0) setScanSelectedPath(files[0].path);
        else setScanError('No .env files found in this project.');
      })
      .catch((e) => setScanError(e instanceof Error ? e.message : String(e)))
      .finally(() => setScanning(false));
  }, [projectRoot]);

  const sourceText = useMemo(() => {
    if (tab === 'paste') return pasteText;
    return scanFiles.find((f) => f.path === scanSelectedPath)?.content ?? '';
  }, [tab, pasteText, scanFiles, scanSelectedPath]);

  const detected: DetectedKey[] = useMemo(() => {
    if (!sourceText.trim()) return [];
    return detectProviders(parseEnvText(sourceText));
  }, [sourceText]);

  // Default-check every detected entry whenever the source changes.
  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const d of detected) next[d.provider.id] = d.status !== 'empty';
    setSelected(next);
  }, [detected]);

  const handleDrop = useCallback((ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    const file = ev.dataTransfer.files?.[0];
    if (!file) return;
    file.text().then(setPasteText).catch(() => setError('Cannot read dropped file.'));
  }, []);

  const handleImport = useCallback(async () => {
    const toSave = detected.filter((d) => selected[d.provider.id] && d.value);
    if (toSave.length === 0) return;
    setSaving(true);
    setError('');
    try {
      for (const d of toSave) {
        await saveProviderSecret(d.provider, d.value);
      }
      onImported(toSave.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [detected, selected, onImported]);

  const selectedCount = useMemo(
    () => detected.filter((d) => selected[d.provider.id]).length,
    [detected, selected],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Import .env"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col border border-stone-200/20 bg-[#071d1a]">
        <header className="flex items-center justify-between border-b border-stone-200/12 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <Upload size={15} className="text-amber-100" />
            <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
              Import from .env
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-200"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex border-b border-stone-200/12 px-5">
          {projectRoot && (
            <TabButton active={tab === 'scan'} onClick={() => setTab('scan')}>
              Scan project
            </TabButton>
          )}
          <TabButton active={tab === 'paste'} onClick={() => setTab('paste')}>
            Paste / drop
          </TabButton>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'paste' ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border border-dashed border-stone-200/22 bg-[#03100f] p-2"
            >
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste .env content here, or drag a file onto this box.

ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GITHUB_TOKEN=ghp_..."
                rows={8}
                className="block w-full resize-y bg-transparent font-mono text-[12px] text-stone-100 outline-none placeholder:text-stone-600"
              />
            </div>
          ) : scanning ? (
            <div className="flex items-center gap-2 text-sm text-stone-400">
              <Loader2 size={14} className="animate-spin" /> Scanning project root…
            </div>
          ) : scanError ? (
            <p className="text-sm text-stone-400">{scanError}</p>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500">
                Found {scanFiles.length} file{scanFiles.length === 1 ? '' : 's'}
              </div>
              <div className="space-y-1">
                {scanFiles.map((f) => (
                  <label
                    key={f.path}
                    className={`flex items-center gap-2 border px-2.5 py-2 text-sm cursor-pointer ${
                      scanSelectedPath === f.path
                        ? 'border-emerald-300/50 bg-emerald-300/5 text-stone-100'
                        : 'border-stone-200/15 text-stone-300 hover:border-stone-200/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="env-file"
                      checked={scanSelectedPath === f.path}
                      onChange={() => setScanSelectedPath(f.path)}
                      className="accent-emerald-400"
                    />
                    <FileText size={13} className="text-stone-500" />
                    <span className="font-mono text-xs">{f.name}</span>
                    <span className="ml-auto text-[10px] text-stone-500">
                      {f.content.length} chars
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <DetectionPreview
            detected={detected}
            selected={selected}
            onToggle={(id) => setSelected((s) => ({ ...s, [id]: !s[id] }))}
          />
        </div>

        <footer className="flex items-center gap-3 border-t border-stone-200/12 px-5 py-3">
          {error && <span className="text-[11px] text-red-400">{error}</span>}
          <span className="ml-auto text-[11px] text-stone-500">
            {selectedCount} of {detected.length} selected
          </span>
          <button
            onClick={onClose}
            className="border border-stone-200/22 px-4 py-1.5 text-sm text-stone-300 hover:bg-stone-200/8"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleImport()}
            disabled={selectedCount === 0 || saving}
            className="bg-stone-100 px-4 py-1.5 text-sm font-medium text-[#071d1a] hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Importing…' : `Import ${selectedCount}`}
          </button>
        </footer>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2.5 text-[11px] uppercase tracking-[0.16em] transition-colors ${
        active
          ? 'border-emerald-300/70 text-stone-100'
          : 'border-transparent text-stone-500 hover:text-stone-300'
      }`}
    >
      {children}
    </button>
  );
}

function DetectionPreview({
  detected,
  selected,
  onToggle,
}: {
  detected: DetectedKey[];
  selected: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  if (detected.length === 0) {
    return (
      <p className="mt-4 text-[11px] text-stone-500">
        No matching keys detected yet. PM looks for variables named ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, GITHUB_TOKEN, …
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-1">
      <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500">
        Detected ({detected.length})
      </div>
      {detected.map((d) => (
        <label
          key={d.provider.id}
          className="flex items-center gap-2.5 border border-stone-200/15 px-3 py-2 text-sm"
        >
          <input
            type="checkbox"
            checked={!!selected[d.provider.id]}
            onChange={() => onToggle(d.provider.id)}
            className="accent-emerald-400"
          />
          <span className="text-stone-100">{d.provider.label}</span>
          <span className="text-[10px] text-stone-500 font-mono">{d.envKey}</span>
          {d.status === 'pattern-mismatch' && (
            <span
              title="Value doesn't match the canonical pattern — import anyway if it's a sandbox or proxy key."
              className="ml-auto inline-flex items-center gap-1 border border-amber-300/35 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-amber-200"
            >
              <AlertTriangle size={10} /> unusual shape
            </span>
          )}
          {d.status === 'valid' && (
            <span className="ml-auto font-mono text-[10px] text-stone-500">
              {maskValue(d.value)}
            </span>
          )}
        </label>
      ))}
    </div>
  );
}

function maskValue(v: string): string {
  if (v.length <= 8) return '••••';
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}
