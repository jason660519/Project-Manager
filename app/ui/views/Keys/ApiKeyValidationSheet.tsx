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
import { Upload, X } from 'lucide-react';

import { PROVIDERS, type ProviderSpec } from '../../../../lib/keys/registry';
import { useI18n } from '../../../../lib/i18n';
import { loadProviderSecret } from '../../../../lib/keys/keychain';
import { getLlmProvider, listLlmProviders, type LlmProviderId } from '../../../../lib/keys/llmProviders';
import {
  getModelListState,
  loadAllProviderMetadata,
  mergeCuratedAndDynamicModels,
  maskKey,
  type ProviderMetadataMap,
} from '../../../../lib/keys/providerMetadata';
import { setProviderActiveInOrder, loadProviderOrder, type ProviderOrderEntry } from '../../../../lib/keys/providerOrder';
import { uuidv5 } from '../../../../lib/aiSdks/uuid';
import { OAuthDeviceModal } from '../_components/OAuthDeviceModal';
import { EnvImportModal } from '../_components/EnvImportModal';
import {
  KeysProviderTable,
  type KeysRowData,
  type KeysRowStatus,
} from './KeysProviderTable';
import { KeysProviderDetailSheet } from './KeysProviderDetailSheet';
import {
  clearProviderKey,
  getProviderApiContract,
  revalidateStoredKey,
  saveAndValidateKey,
} from '../../../../lib/keys/validation';

const CUSTOM_PROVIDER_STORAGE_KEY = 'projectManager.keys.apiKeyValidation.customProviders.v1';
const ROW_PREFS_STORAGE_KEY = 'projectManager.keys.apiKeyValidation.rowPrefs.v1';
const LS_PREFIX = 'projectManager-key:';
const KEYS_PROVIDER_ID_NAMESPACE = '2476dd60-7397-4c29-9be1-a95c20444eb2';

interface ApiKeyRowPrefs {
  version: 2;
  order: string[];
  hiddenBuiltInIds: string[];
  activeById: Record<string, boolean>;
}

interface CustomProviderRecord extends ProviderSpec {
  uuid: string;
  active: boolean;
}

interface AddProviderDraft {
  label: string;
  providerId: string;
  keyVarName: string;
  apiKeyUrl: string;
  usageUrl: string;
  developerDocsUrl: string;
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

function normalizeProviderId(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || `custom-provider-${Date.now()}`;
}

function normalizeEnvVarName(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || 'CUSTOM_PROVIDER_API_KEY';
}

function providerRowUuid(providerId: string) {
  return uuidv5(`keys-provider:${providerId}`, KEYS_PROVIDER_ID_NAMESPACE);
}

function createPersistedUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return uuidv5(`custom-provider:${Date.now()}:${Math.random()}`, KEYS_PROVIDER_ID_NAMESPACE);
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

function normalizeCustomProviderRecord(value: unknown): CustomProviderRecord | null {
  const spec = normalizeProviderSpec(value);
  if (!spec) return null;
  const source = value as Record<string, unknown>;
  return {
    ...spec,
    uuid: typeof source.uuid === 'string' && source.uuid.trim()
      ? source.uuid
      : createPersistedUuid(),
    active: typeof source.active === 'boolean' ? source.active : true,
  };
}

function defaultRowPrefs(): ApiKeyRowPrefs {
  return {
    version: 2,
    order: [
      ...PROVIDERS.filter((p) => p.category === 'ai').map((p) => p.id),
      ...PROVIDERS.filter((p) => p.category === 'integration').map((p) => p.id),
    ],
    hiddenBuiltInIds: [],
    activeById: {},
  };
}

function readStoredCustomProviders(): CustomProviderRecord[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_PROVIDER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeCustomProviderRecord(item))
      .filter((item): item is CustomProviderRecord => item !== null);
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
      version: 2,
      order: Array.isArray(parsed.order)
        ? parsed.order.filter((id): id is string => typeof id === 'string')
        : fallback.order,
      hiddenBuiltInIds: Array.isArray(parsed.hiddenBuiltInIds)
        ? parsed.hiddenBuiltInIds.filter((id): id is string => typeof id === 'string')
        : [],
      activeById: parsed.activeById && typeof parsed.activeById === 'object' && !Array.isArray(parsed.activeById)
        ? Object.fromEntries(
          Object.entries(parsed.activeById).filter((entry): entry is [string, boolean] => (
            typeof entry[0] === 'string' && typeof entry[1] === 'boolean'
          )),
        )
        : {},
    };
  } catch {
    return fallback;
  }
}

function createCustomProvider(draft: AddProviderDraft, usedIds: Set<string>): CustomProviderRecord {
  const id = uniqueProviderId(draft.providerId || draft.label, usedIds);
  const keyVarName = normalizeEnvVarName(draft.keyVarName);
  return {
    uuid: createPersistedUuid(),
    id,
    active: true,
    label: draft.label.trim() || id,
    category: 'ai',
    placeholder: 'Paste API key',
    keychainKey: `custom-provider-${id}`,
    lsKey: `${LS_PREFIX}${id}`,
    docUrl: draft.apiKeyUrl.trim() || 'https://example.com',
    apiKeyUrl: draft.apiKeyUrl.trim() || 'https://example.com',
    usageUrl: draft.usageUrl.trim() || 'https://example.com',
    developerDocsUrl: draft.developerDocsUrl.trim() || 'https://example.com',
    envVarNames: [keyVarName],
    supportedMethods: ['apiKey'],
  };
}

interface ApiKeyValidationSheetProps {
  isTauri: boolean;
  projectRoot?: string;
}

function defaultAddProviderDraft(count: number): AddProviderDraft {
  const name = `Custom Provider ${count + 1}`;
  return {
    label: name,
    providerId: normalizeProviderId(name),
    keyVarName: `CUSTOM_PROVIDER_${count + 1}_API_KEY`,
    apiKeyUrl: 'https://example.com',
    usageUrl: 'https://example.com',
    developerDocsUrl: 'https://example.com',
  };
}

function AddProviderDialog({
  draft,
  existingIds,
  onChange,
  onCancel,
  onCreate,
}: {
  draft: AddProviderDraft;
  existingIds: Set<string>;
  onChange: (draft: AddProviderDraft) => void;
  onCancel: () => void;
  onCreate: () => void;
}) {
  const normalizedProviderId = normalizeProviderId(draft.providerId || draft.label);
  const normalizedKeyVarName = normalizeEnvVarName(draft.keyVarName);
  const duplicateId = existingIds.has(normalizedProviderId);
  const canCreate = draft.label.trim().length > 0 && normalizedKeyVarName.length > 0 && !duplicateId;
  const update = (patch: Partial<AddProviderDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="fixed inset-0 z-50 bg-black/45" onClick={onCancel}>
      <div
        className="ml-auto flex h-full w-full max-w-lg flex-col border-l border-stone-200/18 bg-[rgb(var(--pm-panel))] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200/12 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-stone-100">Add provider</h3>
            <p className="mt-0.5 text-[11px] text-stone-500">
              Set the provider identity and key variable name before the row is created.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-stone-500 transition-colors hover:text-stone-200"
            aria-label="Close add provider"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-auto px-4 py-4">
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-stone-400">Provider name</span>
            <input
              value={draft.label}
              onChange={(event) => update({ label: event.target.value })}
              className="w-full border border-stone-200/18 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-1 focus:ring-emerald-300/50"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-stone-400">Provider ID</span>
            <input
              value={draft.providerId}
              onChange={(event) => update({ providerId: event.target.value })}
              className="w-full border border-stone-200/18 bg-[rgb(var(--pm-input))] px-3 py-2 font-mono text-sm text-stone-100 outline-none focus:ring-1 focus:ring-emerald-300/50"
            />
            <p className={`mt-1 text-[11px] ${duplicateId ? 'text-rose-300' : 'text-stone-500'}`}>
              {duplicateId ? 'Provider ID already exists.' : `Will save as ${normalizedProviderId}`}
            </p>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-stone-400">Primary key variable name</span>
            <input
              value={draft.keyVarName}
              onChange={(event) => update({ keyVarName: event.target.value })}
              className="w-full border border-stone-200/18 bg-[rgb(var(--pm-input))] px-3 py-2 font-mono text-sm text-stone-100 outline-none focus:ring-1 focus:ring-emerald-300/50"
            />
            <p className="mt-1 text-[11px] text-stone-500">Will save as {normalizedKeyVarName}</p>
          </label>
          <div className="grid gap-3 sm:grid-cols-1">
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-stone-400">API key URL</span>
              <input
                value={draft.apiKeyUrl}
                onChange={(event) => update({ apiKeyUrl: event.target.value })}
                className="w-full border border-stone-200/18 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-1 focus:ring-emerald-300/50"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-stone-400">Usage URL</span>
              <input
                value={draft.usageUrl}
                onChange={(event) => update({ usageUrl: event.target.value })}
                className="w-full border border-stone-200/18 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-1 focus:ring-emerald-300/50"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-stone-400">Developer docs URL</span>
              <input
                value={draft.developerDocsUrl}
                onChange={(event) => update({ developerDocsUrl: event.target.value })}
                className="w-full border border-stone-200/18 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-1 focus:ring-emerald-300/50"
              />
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-stone-200/12 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="border border-stone-200/18 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-stone-300 hover:bg-stone-200/8"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={!canCreate}
            className="inline-flex min-w-[120px] items-center justify-center bg-stone-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--pm-panel))] hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create provider
          </button>
        </div>
      </div>
    </div>
  );
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
  const [customProviders, setCustomProviders] = useState<CustomProviderRecord[]>(() => readStoredCustomProviders());
  const [rowPrefs, setRowPrefs] = useState<ApiKeyRowPrefs>(() => readStoredRowPrefs());
  const [providerOrder, setProviderOrder] = useState<ProviderOrderEntry[]>([]);
  const [addProviderDraft, setAddProviderDraft] = useState<AddProviderDraft | null>(null);

  const [oauthProvider, setOauthProvider] = useState<ProviderSpec | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderSpec | null>(null);
  const [showEnvImport, setShowEnvImport] = useState(false);
  const [refreshingProviderIds, setRefreshingProviderIds] = useState<Set<string>>(() => new Set());
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
  const providerOrderActiveById = useMemo(() => new Map(providerOrder.map((entry) => [entry.provider, entry.enabled])), [providerOrder]);
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

  useEffect(() => {
    let cancelled = false;
    void loadProviderOrder().then((order) => {
      if (!cancelled) setProviderOrder(order);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

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
      const customRecord = customProviders.find((customProvider) => customProvider.id === provider.id);
      const activeOverride = rowPrefs.activeById[provider.id];
      const isKnownLlmProvider = getLlmProvider(provider.id as LlmProviderId) !== undefined;
      const active = customRecord
        ? customRecord.active
        : isKnownLlmProvider
          ? providerOrderActiveById.get(provider.id as LlmProviderId) !== false
          : activeOverride !== false;

      return {
        rowId: customRecord?.uuid ?? providerRowUuid(provider.id),
        provider,
        active,
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
  }, [customProviderIds, customProviders, metadata, providerOrderActiveById, rowPrefs.activeById, secrets, visibleProviders]);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);
  const openAddProvider = useCallback(() => {
    setAddProviderDraft(defaultAddProviderDraft(customProviders.length));
  }, [customProviders.length]);
  const createPendingProvider = useCallback(() => {
    if (!addProviderDraft) return;
    const usedIds = new Set(allProviders.map((provider) => provider.id));
    const next = createCustomProvider(addProviderDraft, usedIds);
    setCustomProviders((prev) => [...prev, next]);
    setRowPrefs((prev) => ({
      ...prev,
      order: [...prev.order, next.id],
      activeById: { ...prev.activeById, [next.id]: true },
    }));
    setSelectedProvider(next);
    setAddProviderDraft(null);
  }, [addProviderDraft, allProviders]);

  const patchCustomProvider = useCallback((providerId: string, patch: Partial<ProviderSpec>) => {
    const normalizedPatch: Partial<ProviderSpec> = {
      ...patch,
      envVarNames: patch.envVarNames?.map((name) => normalizeEnvVarName(name)),
    };
    setCustomProviders((prev) => prev.map((provider) => (
      provider.id === providerId
        ? normalizeCustomProviderRecord({ ...provider, ...normalizedPatch, id: provider.id }) ?? provider
        : provider
    )));
  }, []);

  const updateProviderActive = useCallback(async (provider: ProviderSpec, active: boolean) => {
    setRowPrefs((prev) => ({
      ...prev,
      activeById: { ...prev.activeById, [provider.id]: active },
    }));
    setCustomProviders((prev) => prev.map((customProvider) => (
      customProvider.id === provider.id ? { ...customProvider, active } : customProvider
    )));
    if (getLlmProvider(provider.id as LlmProviderId)) {
      await setProviderActiveInOrder(provider.id as LlmProviderId, active);
      const nextOrder = await loadProviderOrder();
      setProviderOrder(nextOrder);
    }
  }, []);

  const deleteProviderRow = useCallback(async (provider: ProviderSpec) => {
    await clearProviderKey(provider);
    setSelectedProvider((current) => (current?.id === provider.id ? null : current));
    setRefreshingProviderIds((prev) => {
      const next = new Set(prev);
      next.delete(provider.id);
      return next;
    });
    const isCustom = customProviderIds.has(provider.id);
    if (isCustom) {
      setCustomProviders((prev) => prev.filter((customProvider) => customProvider.id !== provider.id));
      setRowPrefs((prev) => {
        const { [provider.id]: _removed, ...activeById } = prev.activeById;
        return {
          ...prev,
          order: prev.order.filter((id) => id !== provider.id),
          activeById,
        };
      });
      refresh();
      return;
    }
    setRowPrefs((prev) => ({
      ...prev,
      hiddenBuiltInIds: Array.from(new Set([...prev.hiddenBuiltInIds, provider.id])),
      activeById: { ...prev.activeById, [provider.id]: false },
    }));
    if (getLlmProvider(provider.id as LlmProviderId)) {
      await setProviderActiveInOrder(provider.id as LlmProviderId, false);
      const nextOrder = await loadProviderOrder();
      setProviderOrder(nextOrder);
    }
    refresh();
  }, [customProviderIds, refresh]);

  const showAllRows = useCallback(() => {
    setRowPrefs((prev) => ({ ...prev, hiddenBuiltInIds: [] }));
  }, []);

  const restoreDefaultProviders = useCallback(() => {
    setRefreshModelsMessage(null);
    setOauthProvider(null);
    setSelectedProvider(null);
    setRefreshingProviderIds(new Set());
    setCustomProviders([]);
    setRowPrefs(defaultRowPrefs());
  }, []);

  const refreshProviderModels = useCallback(async (provider: ProviderSpec) => {
    if (refreshingProviderIds.has(provider.id)) return;
    const contract = getProviderApiContract(provider);
    if (!contract) {
      setRefreshModelsMessage(`${provider.label} does not support model refresh yet.`);
      return;
    }
    if (!secrets[provider.id]) {
      setRefreshModelsMessage(`${provider.label} has no configured key.`);
      return;
    }

    setRefreshingProviderIds((prev) => new Set(prev).add(provider.id));
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
      setRefreshingProviderIds((prev) => {
        const next = new Set(prev);
        next.delete(provider.id);
        return next;
      });
    }
  }, [refresh, refreshingProviderIds, secrets]);

  const updateProviderKey = useCallback(async (provider: ProviderSpec, apiKey: string) => {
    const result = await saveAndValidateKey(provider, apiKey);
    if (!result.ok) {
      throw new Error(result.errorReason ?? `${provider.label} validation failed`);
    }
    refresh();
  }, [refresh]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-none flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-stone-400">
          {t.keysValidation.intro}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEnvImport(true)}
            className="inline-flex items-center gap-1.5 border border-stone-200/22 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-stone-200 transition-colors hover:bg-stone-200/8"
            title="Scan or paste .env credentials and import matching provider keys"
          >
            <Upload size={12} />
            Import from .env
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
          onAddRow={openAddProvider}
          onRestoreDefaultProviders={restoreDefaultProviders}
          onPatchCustomProvider={patchCustomProvider}
          onUpdateProviderActive={updateProviderActive}
          onDeleteProvider={deleteProviderRow}
          onUpdateKey={updateProviderKey}
          onRefreshModels={(provider) => void refreshProviderModels(provider)}
          refreshingProviderIds={refreshingProviderIds}
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

      {showEnvImport && (
        <EnvImportModal
          projectRoot={projectRoot}
          onClose={() => setShowEnvImport(false)}
          onImported={() => {
            setShowEnvImport(false);
            refresh();
          }}
        />
      )}

      {addProviderDraft && (
        <AddProviderDialog
          draft={addProviderDraft}
          existingIds={new Set(allProviders.map((provider) => provider.id))}
          onChange={setAddProviderDraft}
          onCancel={() => setAddProviderDraft(null)}
          onCreate={createPendingProvider}
        />
      )}
    </div>
  );
}
