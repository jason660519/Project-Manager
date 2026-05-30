'use client';

/**
 * Tab body for the Keys page's "API Key Validation" tab.
 *
 * Renders a single TanStack table of every provider PM knows about, with
 * status, model count, and last-validated columns. Clicking a row opens the
 * `KeysProviderDetailSheet` (right slide-out) for the full edit + validate
 * workflow. The `.env` import and OAuth device-flow modals are still owned
 * here — they apply across providers and don't belong inside a single sheet.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Upload } from 'lucide-react';

import { PROVIDERS, type ProviderSpec } from '../../../../lib/keys/registry';
import { useI18n } from '../../../../lib/i18n';
import { loadProviderSecret } from '../../../../lib/keys/keychain';
import { listLlmProviders } from '../../../../lib/keys/llmProviders';
import {
  getModelListState,
  loadAllProviderMetadata,
  mergeCuratedAndDynamicModels,
  maskKey,
  type ProviderMetadataMap,
} from '../../../../lib/keys/providerMetadata';
import { EnvImportModal } from '../_components/EnvImportModal';
import { OAuthDeviceModal } from '../_components/OAuthDeviceModal';
import {
  KeysProviderTable,
  type KeysRowData,
  type KeysRowStatus,
} from './KeysProviderTable';
import { KeysProviderDetailSheet } from './KeysProviderDetailSheet';
import {
  getProviderApiContract,
  revalidateStoredKey,
} from '../../../../lib/keys/validation';

const CUSTOM_PROVIDER_STORAGE_KEY = 'projectManager.keys.apiKeyValidation.customProviders.v1';
const ROW_PREFS_STORAGE_KEY = 'projectManager.keys.apiKeyValidation.rowPrefs.v1';
const LS_PREFIX = 'projectManager-key:';

interface ApiKeyRowPrefs {
  version: 1;
  order: string[];
  hiddenBuiltInIds: string[];
}

function deriveStatus(hasKey: boolean, validationStatus?: 'ok' | 'fail'): KeysRowStatus {
  if (!hasKey) return 'not_set';
  if (validationStatus === 'ok') return 'verified';
  if (validationStatus === 'fail') return 'failed';
  return 'configured';
}

function staticModelsFor(providerId: string): string[] {
  return listLlmProviders().find((p) => p.id === providerId)?.availableModels ?? [];
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function defaultRowPrefs(): ApiKeyRowPrefs {
  return {
    version: 1,
    order: [
      ...PROVIDERS.filter((p) => p.category === 'ai').map((p) => p.id),
      ...PROVIDERS.filter((p) => p.category === 'integration').map((p) => p.id),
    ],
    hiddenBuiltInIds: [],
  };
}

function readStoredCustomProviders(): ProviderSpec[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_PROVIDER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeProviderSpec(item))
      .filter((item): item is ProviderSpec => item !== null);
  } catch {
    return [];
  }
}

function readStoredRowPrefs(): ApiKeyRowPrefs {
  const fallback = defaultRowPrefs();
  if (!canUseLocalStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(ROW_PREFS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ApiKeyRowPrefs>;
    return {
      version: 1,
      order: Array.isArray(parsed.order)
        ? parsed.order.filter((id): id is string => typeof id === 'string')
        : fallback.order,
      hiddenBuiltInIds: Array.isArray(parsed.hiddenBuiltInIds)
        ? parsed.hiddenBuiltInIds.filter((id): id is string => typeof id === 'string')
        : [],
    };
  } catch {
    return fallback;
  }
}

function normalizeProviderId(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || `custom-provider-${Date.now()}`;
}

function uniqueProviderId(base: string, usedIds: Set<string>) {
  let candidate = normalizeProviderId(base);
  let index = 2;
  while (usedIds.has(candidate)) {
    candidate = `${normalizeProviderId(base)}-${index}`;
    index += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function createCustomProvider(label: string, usedIds: Set<string>): ProviderSpec {
  const id = uniqueProviderId(label, usedIds);
  return {
    id,
    label,
    category: 'ai',
    placeholder: 'Paste API key',
    keychainKey: `custom-provider-${id}`,
    lsKey: `${LS_PREFIX}${id}`,
    docUrl: 'https://example.com',
    apiKeyUrl: 'https://example.com',
    usageUrl: 'https://example.com',
    developerDocsUrl: 'https://example.com',
    envVarNames: [],
    supportedMethods: ['apiKey'],
  };
}

function normalizeProviderSpec(value: unknown): ProviderSpec | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const id = typeof source.id === 'string' ? normalizeProviderId(source.id) : '';
  const label = typeof source.label === 'string' && source.label.trim() ? source.label.trim() : id;
  if (!id || !label) return null;
  const apiKeyUrl = typeof source.apiKeyUrl === 'string'
    ? source.apiKeyUrl
    : typeof source.docUrl === 'string'
      ? source.docUrl
      : 'https://example.com';
  const usageUrl = typeof source.usageUrl === 'string' ? source.usageUrl : 'https://example.com';
  const developerDocsUrl = typeof source.developerDocsUrl === 'string'
    ? source.developerDocsUrl
    : typeof source.docUrl === 'string'
      ? source.docUrl
      : 'https://example.com';
  return {
    id,
    label,
    category: source.category === 'integration' ? 'integration' : 'ai',
    placeholder: typeof source.placeholder === 'string' ? source.placeholder : 'Paste API key',
    keychainKey: typeof source.keychainKey === 'string' ? source.keychainKey : `custom-provider-${id}`,
    lsKey: typeof source.lsKey === 'string' ? source.lsKey : `${LS_PREFIX}${id}`,
    docUrl: typeof source.docUrl === 'string' ? source.docUrl : apiKeyUrl,
    apiKeyUrl,
    usageUrl,
    developerDocsUrl,
    envVarNames: Array.isArray(source.envVarNames)
      ? source.envVarNames.filter((item): item is string => typeof item === 'string')
      : [],
    supportedMethods: ['apiKey'],
  };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseProviderRowsFromText(text: string, usedIds: Set<string>): ProviderSpec[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => normalizeProviderSpec(item))
        .filter((item): item is ProviderSpec => item !== null)
        .map((item) => {
          const id = uniqueProviderId(item.id, usedIds);
          return {
            ...item,
            id,
            keychainKey: `custom-provider-${id}`,
            lsKey: `${LS_PREFIX}${id}`,
          };
        });
    }
  } catch {
    // Fall through to CSV parsing.
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const hasHeader = headers.includes('label') || headers.includes('api_key_url');
  const rows = lines.slice(hasHeader ? 1 : 0);
  return rows.map((line, index) => {
    const cells = parseCsvLine(line);
    const get = (name: string, fallbackIndex: number) => {
      const headerIndex = headers.indexOf(name);
      return cells[hasHeader && headerIndex >= 0 ? headerIndex : fallbackIndex] ?? '';
    };
    const label = get('label', 1) || get('provider', 0) || `Custom Provider ${index + 1}`;
    const id = uniqueProviderId(get('id', 0) || label, usedIds);
    const apiKeyUrl = get('api_key_url', 3) || get('apiKeyUrl', 3) || 'https://example.com';
    return {
      id,
      label,
      category: get('category', 2) === 'integration' ? 'integration' : 'ai',
      placeholder: 'Paste API key',
      keychainKey: `custom-provider-${id}`,
      lsKey: `${LS_PREFIX}${id}`,
      docUrl: apiKeyUrl,
      apiKeyUrl,
      usageUrl: get('usage_url', 4) || 'https://example.com',
      developerDocsUrl: get('developer_docs_url', 5) || 'https://example.com',
      envVarNames: [],
      supportedMethods: ['apiKey'],
    } satisfies ProviderSpec;
  });
}

interface ApiKeyValidationSheetProps {
  isTauri: boolean;
  projectRoot?: string;
}

export function ApiKeyValidationSheet({
  isTauri: _isTauri,
  projectRoot,
}: ApiKeyValidationSheetProps) {
  const { t } = useI18n();
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [metadata, setMetadata] = useState<ProviderMetadataMap>({});
  const [loaded, setLoaded] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [customProviders, setCustomProviders] = useState<ProviderSpec[]>(() => readStoredCustomProviders());
  const [rowPrefs, setRowPrefs] = useState<ApiKeyRowPrefs>(() => readStoredRowPrefs());

  const [showImport, setShowImport] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<ProviderSpec | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderSpec | null>(null);
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [refreshModelsMessage, setRefreshModelsMessage] = useState<string | null>(null);

  const builtInProviders = useMemo(
    () => [
      ...PROVIDERS.filter((p) => p.category === 'ai'),
      ...PROVIDERS.filter((p) => p.category === 'integration'),
    ],
    [],
  );
  const builtInIds = useMemo(() => new Set(builtInProviders.map((provider) => provider.id)), [builtInProviders]);
  const customProviderIds = useMemo(() => new Set(customProviders.map((provider) => provider.id)), [customProviders]);
  const allProviders = useMemo(
    () => [...builtInProviders, ...customProviders],
    [builtInProviders, customProviders],
  );
  const visibleProviders = useMemo(() => {
    const byId = new Map(allProviders.map((provider) => [provider.id, provider]));
    const hiddenBuiltIns = new Set(rowPrefs.hiddenBuiltInIds);
    const orderedIds = [
      ...rowPrefs.order.filter((id) => byId.has(id)),
      ...allProviders.map((provider) => provider.id).filter((id) => !rowPrefs.order.includes(id)),
    ];
    return orderedIds
      .map((id) => byId.get(id))
      .filter((provider): provider is ProviderSpec => Boolean(provider))
      .filter((provider) => !builtInIds.has(provider.id) || !hiddenBuiltIns.has(provider.id));
  }, [allProviders, builtInIds, rowPrefs]);

  useEffect(() => {
    if (!canUseLocalStorage()) return;
    window.localStorage.setItem(CUSTOM_PROVIDER_STORAGE_KEY, JSON.stringify(customProviders));
  }, [customProviders]);

  useEffect(() => {
    if (!canUseLocalStorage()) return;
    window.localStorage.setItem(ROW_PREFS_STORAGE_KEY, JSON.stringify(rowPrefs));
  }, [rowPrefs]);

  // Load every provider's secret + metadata in parallel whenever
  // `reloadToken` changes (save/clear/validate/import all bump it).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        allProviders.map(async (p) => {
          try {
            const v = await loadProviderSecret(p);
            return [p.id, v] as const;
          } catch {
            return [p.id, ''] as const;
          }
        }),
      );
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const [id, v] of entries) map[id] = v;
      setSecrets(map);
      setMetadata(loadAllProviderMetadata());
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [allProviders, reloadToken]);

  useEffect(() => {
    if (!selectedProvider) return;
    const next = allProviders.find((provider) => provider.id === selectedProvider.id);
    if (!next) {
      setSelectedProvider(null);
      return;
    }
    if (next !== selectedProvider) setSelectedProvider(next);
  }, [allProviders, selectedProvider]);

  // Build the table rows. AI providers come first so the most-used cases
  // sit at the top; integrations appear below in their existing order.
  const rows = useMemo<KeysRowData[]>(() => {
    return visibleProviders.map((provider) => {
      const value = secrets[provider.id] ?? '';
      const hasKey = value.length > 0;
      const meta = metadata[provider.id];
      const dynamicModels = meta?.status === 'ok' ? meta.dynamicModels ?? [] : [];
      const staticModels = staticModelsFor(provider.id);
      const models = dynamicModels.length > 0
        ? mergeCuratedAndDynamicModels(staticModels, dynamicModels)
        : staticModels;
      const supportsModelRefresh = provider.category === 'ai' && getProviderApiContract(provider) !== null;

      return {
        provider,
        hasKey,
        maskedKey: maskKey(value),
        status: deriveStatus(hasKey, meta?.status),
        models,
        modelsAreDynamic: dynamicModels.length > 0,
        modelListState: getModelListState(meta),
        canRefreshModels: hasKey && supportsModelRefresh,
        lastValidatedAt: meta?.lastValidatedAt ?? null,
        errorReason: meta?.status === 'fail' ? meta.errorReason ?? null : null,
        isCustom: customProviderIds.has(provider.id),
      };
    });
  }, [customProviderIds, metadata, secrets, visibleProviders]);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);
  const moveRow = useCallback((providerId: string, direction: 'up' | 'down') => {
    const ids = visibleProviders.map((provider) => provider.id);
    const index = ids.indexOf(providerId);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const nextVisibleIds = [...ids];
    [nextVisibleIds[index], nextVisibleIds[target]] = [nextVisibleIds[target], nextVisibleIds[index]];
    const visibleSet = new Set(nextVisibleIds);
    const tail = allProviders.map((provider) => provider.id).filter((id) => !visibleSet.has(id));
    setRowPrefs((prev) => ({ ...prev, order: [...nextVisibleIds, ...tail] }));
  }, [allProviders, visibleProviders]);

  const addRow = useCallback(() => {
    const usedIds = new Set(allProviders.map((provider) => provider.id));
    const next = createCustomProvider(`Custom Provider ${customProviders.length + 1}`, usedIds);
    setCustomProviders((prev) => [...prev, next]);
    setRowPrefs((prev) => ({ ...prev, order: [...prev.order, next.id] }));
    setSelectedProvider(next);
  }, [allProviders, customProviders.length]);

  const deleteRow = useCallback((providerId: string) => {
    if (customProviderIds.has(providerId)) {
      setCustomProviders((prev) => prev.filter((provider) => provider.id !== providerId));
      setRowPrefs((prev) => ({ ...prev, order: prev.order.filter((id) => id !== providerId) }));
      if (selectedProvider?.id === providerId) setSelectedProvider(null);
      return;
    }
    if (!builtInIds.has(providerId)) return;
    setRowPrefs((prev) => ({
      ...prev,
      hiddenBuiltInIds: prev.hiddenBuiltInIds.includes(providerId)
        ? prev.hiddenBuiltInIds
        : [...prev.hiddenBuiltInIds, providerId],
    }));
    if (selectedProvider?.id === providerId) setSelectedProvider(null);
  }, [builtInIds, customProviderIds, selectedProvider]);

  const patchCustomProvider = useCallback((providerId: string, patch: Partial<ProviderSpec>) => {
    setCustomProviders((prev) => prev.map((provider) => (
      provider.id === providerId
        ? normalizeProviderSpec({ ...provider, ...patch, id: provider.id }) ?? provider
        : provider
    )));
  }, []);

  const importRows = useCallback((text: string) => {
    const usedIds = new Set(allProviders.map((provider) => provider.id));
    const imported = parseProviderRowsFromText(text, usedIds);
    if (imported.length === 0) return;
    setCustomProviders((prev) => [...prev, ...imported]);
    setRowPrefs((prev) => ({
      ...prev,
      order: [...prev.order, ...imported.map((provider) => provider.id)],
    }));
  }, [allProviders]);

  const showAllRows = useCallback(() => {
    setRowPrefs((prev) => ({ ...prev, hiddenBuiltInIds: [] }));
  }, []);

  const refreshProviderModels = useCallback(async (provider: ProviderSpec) => {
    const contract = getProviderApiContract(provider);
    if (!contract) {
      setRefreshModelsMessage(`${provider.label} does not support model refresh yet.`);
      return;
    }
    if (!secrets[provider.id]) {
      setRefreshModelsMessage(`${provider.label} has no configured key.`);
      return;
    }

    setRefreshingModels(true);
    setRefreshModelsMessage(null);
    try {
      const result = await revalidateStoredKey(provider);
      setRefreshModelsMessage(
        result.ok
          ? `${provider.label} model list refreshed.`
          : `${provider.label} model refresh failed: ${result.errorReason ?? 'Unknown error'}`,
      );
      refresh();
    } finally {
      setRefreshingModels(false);
    }
  }, [refresh, secrets]);

  const refreshModelsList = useCallback(async () => {
    if (refreshingModels) return;
    setRefreshingModels(true);
    setRefreshModelsMessage(null);
    const candidates = rows
      .filter((row) => (
        row.status === 'verified' &&
        row.canRefreshModels &&
        (row.modelListState.kind === 'catalogue' || row.modelListState.kind === 'stale')
      ))
      .map((row) => row.provider);

    if (candidates.length === 0) {
      setRefreshModelsMessage('No verified providers need a model refresh.');
      setRefreshingModels(false);
      return;
    }

    try {
      const results = await Promise.allSettled(candidates.map((provider) => revalidateStoredKey(provider)));
      const okCount = results.filter((result) => result.status === 'fulfilled' && result.value.ok).length;
      const failCount = results.length - okCount;
      setRefreshModelsMessage(
        failCount === 0
          ? `Models refreshed for ${okCount} provider${okCount === 1 ? '' : 's'}.`
          : `Models refreshed for ${okCount} provider${okCount === 1 ? '' : 's'}; ${failCount} failed.`,
      );
      refresh();
    } finally {
      setRefreshingModels(false);
    }
  }, [refresh, refreshingModels, rows]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-none flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-stone-400">
          {t.keysValidation.intro}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void refreshModelsList()}
            disabled={refreshingModels}
            className="inline-flex items-center gap-1.5 border border-stone-200/22 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-stone-200 hover:bg-stone-200/8 transition-colors disabled:cursor-not-allowed disabled:opacity-45"
            title="Refresh cached model lists for configured AI providers"
          >
            {refreshingModels ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Refresh Models list
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 border border-stone-200/22 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-stone-200 hover:bg-stone-200/8 transition-colors"
          >
            <Upload size={12} /> {t.keysValidation.importFromEnv}
          </button>
        </div>
      </div>
      {refreshModelsMessage && (
        <p className="flex-none text-[11px] text-stone-400">{refreshModelsMessage}</p>
      )}

      {loaded ? (
        <KeysProviderTable
          rows={rows}
          hiddenBuiltInCount={rowPrefs.hiddenBuiltInIds.length}
          copy={t.keysValidation.table}
          onRowClick={setSelectedProvider}
          onAddRow={addRow}
          onMoveRow={moveRow}
          onDeleteRow={deleteRow}
          onPatchCustomProvider={patchCustomProvider}
          onRefreshModels={(provider) => void refreshProviderModels(provider)}
          isRefreshingModels={refreshingModels}
          onImportRows={importRows}
          onShowAllRows={showAllRows}
        />
      ) : (
        <div className="flex-none border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72 px-4 py-8 text-center text-xs text-stone-500">
          {t.keysValidation.loadingProviders}
        </div>
      )}

      <KeysProviderDetailSheet
        provider={selectedProvider}
        onClose={() => setSelectedProvider(null)}
        onChanged={refresh}
        onOpenOAuth={(p) => {
          setSelectedProvider(null);
          setOauthProvider(p);
        }}
      />

      {showImport && (
        <EnvImportModal
          projectRoot={projectRoot}
          onClose={() => setShowImport(false)}
          onImported={(count) => {
            refresh();
            if (count > 0) window.setTimeout(() => setShowImport(false), 1500);
          }}
        />
      )}
      {oauthProvider && (
        <OAuthDeviceModal
          provider={oauthProvider}
          onClose={() => setOauthProvider(null)}
          onAuthorized={() => {
            setOauthProvider(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
