'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText, Loader2, RefreshCw, Upload, X } from 'lucide-react';
import { parseEnvText } from '../../../../lib/keys/envParser';
import { detectProviders, type DetectedKey } from '../../../../lib/keys/detectProviders';
import { saveProviderSecret } from '../../../../lib/keys/keychain';
import { revalidateStoredKey } from '../../../../lib/keys/validation';
import { formatValidationFailure } from '../../../../lib/keys/providerMetadata';
import { scanEnvFiles, type EnvFileInfo } from '../../../../lib/bridge';

interface EnvImportModalProps {
  /** Project Manager root — when provided, the modal offers a "Scan PM root" tab. */
  projectRoot?: string;
  onClose: () => void;
  onImported: (count: number) => void;
}

type Tab = 'paste' | 'scan';

function isMissingProjectRootError(message: string): boolean {
  return /^Project root does not exist:/i.test(message);
}

export function EnvImportModal({
  projectRoot,
  onClose,
  onImported,
}: EnvImportModalProps) {
  const initialTab: Tab = projectRoot ? 'scan' : 'paste';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pasteText, setPasteText] = useState('');
  const [scanFiles, setScanFiles] = useState<EnvFileInfo[]>([]);
  const [scanSelectedPath, setScanSelectedPath] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [missingProjectRoot, setMissingProjectRoot] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeValidation, setActiveValidation] = useState<{ index: number; total: number; label: string } | null>(null);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<{ ok: string[]; fail: string[] } | null>(null);

  const runProjectScan = useCallback(async () => {
    if (!projectRoot) return;
    setScanning(true);
    setScanError('');
    setMissingProjectRoot(false);
    setScanFiles([]);
    setScanSelectedPath('');
    try {
      const files = await scanEnvFiles(projectRoot);
      setScanFiles(files);
      if (files.length > 0) {
        setScanSelectedPath(files[0].path);
      } else {
        setScanError('No .env files found in the Project Manager root.');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setMissingProjectRoot(isMissingProjectRootError(message));
      setScanError(message);
    } finally {
      setScanning(false);
    }
  }, [projectRoot]);

  useEffect(() => {
    if (!saving) {
      setElapsedSeconds(0);
      setActiveValidation(null);
      return;
    }
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => window.clearInterval(interval);
  }, [saving]);

  // Auto-scan on open when a project root is supplied.
  useEffect(() => {
    void runProjectScan();
  }, [runProjectScan]);

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
    setImportResult(null);
    try {
      const ok: string[] = [];
      const fail: string[] = [];
      for (const [index, d] of toSave.entries()) {
        setActiveValidation({ index: index + 1, total: toSave.length, label: d.provider.label });
        await saveProviderSecret(d.provider, d.value);
        const result = await revalidateStoredKey(d.provider);
        if (result.ok) {
          ok.push(`${d.envKey} (${result.models.length} models)`);
        } else {
          fail.push(`${d.envKey}: ${formatValidationFailure(result.errorReason)}`);
        }
      }
      setImportResult({ ok, fail });
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

  const availableProviderSummary = useMemo(() => {
    const names = detected.map((d) => d.provider.label);
    if (names.length <= 6) return names.join(', ');
    return `${names.slice(0, 6).join(', ')} +${names.length - 6} more`;
  }, [detected]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Import .env"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col border border-stone-200/20 bg-[rgb(var(--pm-panel))]">
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
              Scan PM root
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
              className="border border-dashed border-stone-200/22 bg-[rgb(var(--pm-input))] p-2"
            >
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste .env content here, or drag a file onto this box.

ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GITHUB_TOKEN=github_token_..."
                rows={8}
                className="block w-full resize-y bg-transparent font-mono text-[12px] text-stone-100 outline-none placeholder:text-stone-600"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500">
                    Project Manager scan
                  </div>
                  {projectRoot && (
                    <div
                      className="mt-1 truncate font-mono text-[11px] text-stone-500"
                      title={projectRoot}
                    >
                      {projectRoot}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void runProjectScan()}
                  disabled={scanning || !projectRoot}
                  className="inline-flex shrink-0 items-center gap-1.5 border border-stone-200/22 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-stone-200 hover:bg-stone-200/8 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {scanning ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  Rescan
                </button>
              </div>

              {scanning ? (
                <div className="flex items-center gap-2 border border-stone-200/15 bg-stone-200/5 px-3 py-3 text-sm text-stone-400">
                  <Loader2 size={14} className="animate-spin" /> Scanning project root…
                </div>
              ) : scanError ? (
                <div className="border border-stone-200/15 bg-stone-200/5 px-3 py-3">
                  <p className="text-sm text-stone-300">
                    {missingProjectRoot
                      ? 'The Project Manager root is not available on this machine.'
                      : scanError}
                  </p>
                  <p className="mt-1 text-[11px] text-stone-500">
                    {missingProjectRoot
                      ? 'Start Project Manager from its repo folder, or switch to Paste / drop to import a file directly.'
                      : 'Use Rescan after adding a top-level .env file to the Project Manager root, or switch to Paste / drop.'}
                  </p>
                </div>
              ) : detected.length > 0 ? (
                <div className="border border-emerald-300/25 bg-emerald-300/5 px-3 py-3">
                  <p className="text-sm text-stone-100">
                    Detected .env credentials for {detected.length} provider{detected.length === 1 ? '' : 's'}.
                  </p>
                  <p className="mt-1 text-[11px] text-stone-400">
                    Available providers: {availableProviderSummary}. Review the selected providers, then import and validate.
                  </p>
                </div>
              ) : (
                <div className="border border-amber-300/25 bg-amber-300/5 px-3 py-3">
                  <p className="text-sm text-stone-100">
                    Found .env file, but no supported provider keys were detected.
                  </p>
                  <p className="mt-1 text-[11px] text-stone-500">
                    PM looks for variables named ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, GITHUB_TOKEN, and other registered provider keys.
                  </p>
                </div>
              )}

              {scanFiles.length > 0 && (
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
            </div>
          )}

          {(tab === 'paste' || detected.length > 0) && (
            <DetectionPreview
              detected={detected}
              selected={selected}
              onToggle={(id) => setSelected((s) => ({ ...s, [id]: !s[id] }))}
            />
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-stone-200/12 px-5 py-3">
          <div className="min-w-0 flex-1">
            {error && <span className="text-[11px] text-red-400">{error}</span>}
            {saving && (
              <span className="inline-flex items-center gap-2 text-[11px] text-amber-100">
                <Loader2 size={12} className="animate-spin" />
                {activeValidation
                  ? `Validating ${activeValidation.index}/${activeValidation.total}: ${activeValidation.label}`
                  : 'Preparing validation'}
                <span className="font-mono text-stone-500">{elapsedSeconds}s</span>
              </span>
            )}
            {importResult && !error && !saving && (
              <span className="block truncate text-[11px] text-stone-400">
                {importResult.ok.length > 0 ? `Validated: ${importResult.ok.join(', ')}` : ''}
                {importResult.fail.length > 0
                  ? `${importResult.ok.length > 0 ? ' · ' : ''}Failed: ${importResult.fail.join('; ')}`
                  : ''}
              </span>
            )}
          </div>
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
            className="inline-flex min-w-[190px] items-center justify-center gap-2 bg-stone-100 px-4 py-1.5 text-sm font-medium text-[rgb(var(--pm-panel))] hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Validating {elapsedSeconds}s
              </>
            ) : (
              `Import & validate ${selectedCount}`
            )}
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
