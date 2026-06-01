'use client';

/**
 * AI SDKs — per-provider tunable-parameter configuration. One bottom sheet tab
 * per LLM provider; each sheet is a wide editable table (id / provider / model /
 * type + one column per SDK parameter). Non-secret overrides persist to
 * `.project-manager/ai-sdks.json` (Tauri) or localStorage (browser dev).
 *
 * Composition mirrors KeysView: WorkstationFrame + reorderable BottomSheetTabs,
 * all sheets mounted in parallel with visibility toggled to preserve per-sheet
 * table state.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Boxes, Download, Lock, Unlock, Upload } from 'lucide-react';

import { WorkstationFrame } from '../../../components/layout/WorkstationFrame';
import { BottomSheetTabs, type SheetTabItem } from '../../../components/sheets/BottomSheetTabs';
import { listLlmProviders, type LlmProviderId } from '../../../lib/keys/llmProviders';
import { useI18n } from '../../../lib/i18n';
import {
  buildProviderModelCatalog,
  DEFAULT_MODEL_TYPES,
  getParamSpecs,
  type ParamValue,
} from '../../../lib/aiSdks/catalog';
import { modelRowId } from '../../../lib/aiSdks/uuid';
import {
  AI_SDKS_SCHEMA_VERSION,
  emptyAiSdksConfig,
  normalizeStoreDetailed,
  readAiSdksStore,
  validateParam,
  writeAiSdksStore,
  type AiSdksConfig,
} from '../../../lib/aiSdks/store';
import {
  AI_SDKS_SHEET_ORDER_STORAGE_KEY,
  DEFAULT_AI_SDKS_SHEET_SLUG,
  type AiSdksSheetSlug,
} from '../../../lib/aiSdks/sheetSlugs';
import { downloadTextFile } from './Keys/ArenaTableViewControls';
import { AiSdkProviderSheet } from './AiSdks/AiSdkProviderSheet';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Set of row ids (UUIDs) belonging to a provider — catalog models + custom rows. */
function providerRowIds(providerId: LlmProviderId, store: AiSdksConfig): Set<string> {
  const ids = new Set(buildProviderModelCatalog(providerId).map((e) => e.id));
  for (const m of store.customModels) if (m.providerId === providerId) ids.add(m.id);
  return ids;
}

function providerErrorCount(providerId: LlmProviderId, store: AiSdksConfig): number {
  const specByKey = new Map(getParamSpecs(providerId).map((s) => [s.key, s]));
  const ownIds = providerRowIds(providerId, store);
  let count = 0;
  for (const [id, override] of Object.entries(store.models)) {
    if (!ownIds.has(id)) continue;
    for (const [key, value] of Object.entries(override.params ?? {})) {
      const spec = specByKey.get(key);
      if (spec && !validateParam(spec, value).ok) count += 1;
    }
  }
  return count;
}

export function AiSdksView({
  projectRoot,
  initialSheet,
}: {
  projectRoot?: string;
  initialSheet?: AiSdksSheetSlug;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const copy = t.aiSdks;
  const providers = useMemo(() => listLlmProviders(), []);

  const [store, setStore] = useState<AiSdksConfig>(emptyAiSdksConfig);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Non-fatal import feedback (refused file / skipped entries), dismissible and
  // kept separate from loadError so it never offers the destructive recover action.
  const [notice, setNotice] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [activeTab, setActiveTab] = useState<AiSdksSheetSlug>(
    initialSheet ?? DEFAULT_AI_SDKS_SHEET_SLUG,
  );
  const skipSaveRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial load (and reload if projectRoot changes). Re-arm the save-skip flag
  // so the assignment from *this* load never triggers an immediate re-save.
  useEffect(() => {
    let cancelled = false;
    skipSaveRef.current = true;
    (async () => {
      try {
        const next = await readAiSdksStore(projectRoot);
        if (!cancelled) setStore(next);
      } catch (err) {
        // readAiSdksStore already prefixes with context (e.g. "Failed to read…").
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectRoot]);

  // Debounced auto-save (skips the first store assignment from load).
  useEffect(() => {
    if (!loaded) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    setSaveState('saving');
    const timer = setTimeout(async () => {
      try {
        await writeAiSdksStore(store, projectRoot);
        setSaveState('saved');
      } catch (err) {
        // Header already flags "Save failed"; the banner carries the detail.
        setSaveState('error');
        setLoadError(err instanceof Error ? err.message : String(err));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [store, loaded, projectRoot]);

  // Keep tab in sync with the route (e.g. direct nav to /ai-sdks/openai).
  useEffect(() => {
    if (initialSheet && initialSheet !== activeTab) setActiveTab(initialSheet);
  }, [initialSheet]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabSelect = (next: AiSdksSheetSlug) => {
    setActiveTab(next);
    router.push(`/ai-sdks/${next}`);
  };

  const categories = useMemo(
    () => Array.from(new Set([...DEFAULT_MODEL_TYPES, ...store.customCategories])),
    [store.customCategories],
  );

  // ── Mutations ───────────────────────────────────────────────────────────
  const setParam = useCallback((id: string, key: string, value: ParamValue) => {
    setStore((prev) => {
      const current = prev.models[id] ?? {};
      const params = { ...(current.params ?? {}) };
      if (value === null) delete params[key];
      else params[key] = value;
      const nextOverride = { ...current, params };
      if (Object.keys(params).length === 0) delete (nextOverride as { params?: unknown }).params;
      return { ...prev, models: { ...prev.models, [id]: nextOverride } };
    });
  }, []);

  const setModelType = useCallback((id: string, modelType: string) => {
    setStore((prev) => ({
      ...prev,
      models: { ...prev.models, [id]: { ...(prev.models[id] ?? {}), modelType } },
    }));
  }, []);

  // Candidate flag: when true the model joins the AI Assistant candidate list.
  const setCandidate = useCallback((id: string, candidate: boolean) => {
    setStore((prev) => {
      const next = { ...(prev.models[id] ?? {}) };
      if (candidate) next.candidate = true;
      else delete (next as { candidate?: boolean }).candidate;
      return { ...prev, models: { ...prev.models, [id]: next } };
    });
  }, []);

  const addModel = useCallback((providerId: LlmProviderId, model: string) => {
    setStore((prev) => {
      const id = modelRowId(providerId, model);
      if (prev.customModels.some((m) => m.id === id)) return prev;
      return { ...prev, customModels: [...prev.customModels, { id, providerId, model }] };
    });
  }, []);

  const addCategory = useCallback((category: string) => {
    setStore((prev) =>
      categoriesInclude(prev, category)
        ? prev
        : { ...prev, customCategories: [...prev.customCategories, category] },
    );
  }, []);

  const restoreProviderDefaults = useCallback((providerId: LlmProviderId) => {
    setStore((prev) => {
      const ownIds = providerRowIds(providerId, prev);
      const models = Object.fromEntries(
        Object.entries(prev.models).filter(([id]) => !ownIds.has(id)),
      );
      return { ...prev, models };
    });
  }, []);

  // ── Import / export ──────────────────────────────────────────────────────
  const handleExport = () => {
    downloadTextFile(
      'ai-sdks-config.json',
      JSON.stringify({ ...store, schemaVersion: AI_SDKS_SCHEMA_VERSION }, null, 2),
      'application/json;charset=utf-8',
    );
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const { store: incoming, report } = normalizeStoreDetailed(JSON.parse(text));
      // Refuse files we can't safely apply rather than overwrite live data with
      // an empty/mismatched store (zero silent failures).
      if (report.futureSchema) {
        setNotice(copy.importNewerVersion);
        return;
      }
      if (report.unrecognized) {
        setNotice(copy.importUnrecognized);
        return;
      }
      const merge = window.confirm(copy.importMergePrompt);
      setStore((prev) =>
        merge
          ? {
              schemaVersion: AI_SDKS_SCHEMA_VERSION,
              models: { ...prev.models, ...incoming.models },
              customModels: dedupeById([...prev.customModels, ...incoming.customModels]),
              customCategories: Array.from(new Set([...prev.customCategories, ...incoming.customCategories])),
            }
          : incoming,
      );
      const skipped =
        report.dropped.models + report.dropped.customModels + report.dropped.customCategories;
      // Surface skipped entries instead of dropping them silently.
      setNotice(skipped > 0 ? `${skipped} ${copy.importSkipped}` : null);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
  };

  const tabs: ReadonlyArray<SheetTabItem<AiSdksSheetSlug>> = useMemo(
    () =>
      providers.map((p) => {
        const errors = providerErrorCount(p.id, store);
        return {
          key: p.id,
          label: p.label,
          icon: <Boxes size={14} />,
          badge: errors > 0 ? `⚠ ${errors}` : undefined,
          activeClassName: errors > 0 ? 'bg-rose-600/80 text-white shadow-sm' : undefined,
          title: `${p.label} parameters`,
        };
      }),
    [providers, store],
  );

  const saveLabel =
    saveState === 'saving' ? copy.status.saving : saveState === 'error' ? copy.status.error : copy.status.saved;

  return (
    <WorkstationFrame
      className="w-full"
      header={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">{copy.title}</h1>
          <div className="flex items-center gap-2">
            {loaded && saveState !== 'idle' && (
              <span
                className={`text-[10px] uppercase tracking-[0.14em] ${
                  saveState === 'error' ? 'text-rose-300' : 'text-stone-500'
                }`}
              >
                {saveLabel}
              </span>
            )}
            <button
              type="button"
              onClick={() => setReadOnly((v) => !v)}
              title={readOnly ? copy.controls.edit : copy.controls.readOnly}
              className="inline-flex h-8 items-center gap-1.5 border border-stone-200/18 px-2.5 text-xs text-stone-200 hover:bg-white/[0.04]"
            >
              {readOnly ? <Lock size={13} className="text-amber-300" /> : <Unlock size={13} className="text-emerald-300" />}
              {readOnly ? copy.controls.edit : copy.controls.readOnly}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={readOnly}
              className="inline-flex h-8 items-center gap-1.5 border border-stone-200/18 px-2.5 text-xs text-stone-200 hover:bg-white/[0.04] disabled:opacity-50"
            >
              <Upload size={13} /> {copy.controls.import}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex h-8 items-center gap-1.5 border border-emerald-200/25 bg-emerald-100/10 px-2.5 text-xs text-emerald-100 hover:bg-emerald-100/18"
            >
              <Download size={13} /> {copy.controls.export}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>
      }
      panelClassName="border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72"
      scrollChildren={false}
      bottomTabs={
        <BottomSheetTabs
          tabs={tabs}
          activeKey={activeTab}
          onSelect={handleTabSelect}
          reorderable
          orderStorageKey={AI_SDKS_SHEET_ORDER_STORAGE_KEY}
          // 14 provider tabs overflow the strip; pm-scroll shows a persistent
          // horizontal scrollbar so all sheets are reachable (macOS/WKWebView
          // otherwise hides the overlay bar — looked like only ~8 existed).
          className="pm-scroll"
        />
      }
    >
      {loadError && (
        <div className="m-4 flex items-center justify-between gap-3 border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <span>{copy.loadError}: {loadError}</span>
          <button
            type="button"
            onClick={() => {
              setLoadError(null);
              setStore(emptyAiSdksConfig());
            }}
            className="shrink-0 border border-rose-300/40 px-2 py-1 text-rose-100 hover:bg-rose-400/15"
          >
            {copy.recoverDefaults}
          </button>
        </div>
      )}
      {notice && (
        <div className="m-4 flex items-center justify-between gap-3 border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 border border-amber-300/40 px-2 py-1 text-amber-50 hover:bg-amber-400/15"
          >
            {copy.detail.close}
          </button>
        </div>
      )}
      {providers.map((p) => (
        <div
          key={p.id}
          className={activeTab === p.id ? 'h-full min-h-0 overflow-hidden p-4' : 'hidden'}
        >
          <AiSdkProviderSheet
            providerId={p.id}
            store={store}
            categories={categories}
            readOnly={readOnly}
            copy={copy}
            onSetParam={setParam}
            onSetModelType={setModelType}
            onSetCandidate={setCandidate}
            onAddModel={(model) => addModel(p.id, model)}
            onAddCategory={addCategory}
            onRestoreProviderDefaults={() => restoreProviderDefaults(p.id)}
          />
        </div>
      ))}
    </WorkstationFrame>
  );
}

function categoriesInclude(store: AiSdksConfig, category: string): boolean {
  return (
    (DEFAULT_MODEL_TYPES as readonly string[]).includes(category) ||
    store.customCategories.includes(category)
  );
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}
