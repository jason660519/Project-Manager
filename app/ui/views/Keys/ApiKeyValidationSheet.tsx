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
import { Upload } from 'lucide-react';

import { PROVIDERS, type ProviderSpec } from '../../../../lib/keys/registry';
import { loadProviderSecret } from '../../../../lib/keys/keychain';
import { listLlmProviders } from '../../../../lib/keys/llmProviders';
import {
  loadAllProviderMetadata,
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

function deriveStatus(hasKey: boolean, validationStatus?: 'ok' | 'fail'): KeysRowStatus {
  if (!hasKey) return 'not_set';
  if (validationStatus === 'ok') return 'verified';
  if (validationStatus === 'fail') return 'failed';
  return 'configured';
}

function staticModelsFor(providerId: string): string[] {
  return listLlmProviders().find((p) => p.id === providerId)?.availableModels ?? [];
}

interface ApiKeyValidationSheetProps {
  isTauri: boolean;
  projectRoot?: string;
}

export function ApiKeyValidationSheet({ isTauri: _isTauri, projectRoot }: ApiKeyValidationSheetProps) {
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [metadata, setMetadata] = useState<ProviderMetadataMap>({});
  const [loaded, setLoaded] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [showImport, setShowImport] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<ProviderSpec | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderSpec | null>(null);

  // Load every provider's secret + metadata in parallel whenever
  // `reloadToken` changes (save/clear/validate/import all bump it).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        PROVIDERS.map(async (p) => {
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
  }, [reloadToken]);

  // Build the table rows. AI providers come first so the most-used cases
  // sit at the top; integrations appear below in their existing order.
  const rows = useMemo<KeysRowData[]>(() => {
    const ordered = [
      ...PROVIDERS.filter((p) => p.category === 'ai'),
      ...PROVIDERS.filter((p) => p.category === 'integration'),
    ];
    return ordered.map((provider) => {
      const value = secrets[provider.id] ?? '';
      const hasKey = value.length > 0;
      const meta = metadata[provider.id];
      const dynamicModels = meta?.status === 'ok' ? meta.dynamicModels ?? [] : [];
      const models = dynamicModels.length > 0 ? dynamicModels : staticModelsFor(provider.id);

      return {
        provider,
        hasKey,
        maskedKey: maskKey(value),
        status: deriveStatus(hasKey, meta?.status),
        models,
        modelsAreDynamic: dynamicModels.length > 0,
        lastValidatedAt: meta?.lastValidatedAt ?? null,
        errorReason: meta?.status === 'fail' ? meta.errorReason ?? null : null,
      };
    });
  }, [secrets, metadata]);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-400">
          Manage your API keys. Click a row to edit, validate, or revoke.
        </p>
        <button
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-1.5 border border-stone-200/22 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-stone-200 hover:bg-stone-200/8 transition-colors"
        >
          <Upload size={12} /> Import from .env
        </button>
      </div>

      {loaded ? (
        <KeysProviderTable rows={rows} onRowClick={setSelectedProvider} />
      ) : (
        <div className="border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72 px-4 py-8 text-center text-xs text-stone-500">
          Loading providers…
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
