'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { LlmProviderId } from '../../../../lib/keys/llmProviders';
import type { KeysTab } from '../../../../lib/keys/sheetSlugs';
import {
  loadAllProviderMetadata,
  loadValidatedModelSupportSummary,
  subscribeProviderMetadataChanges,
  type ProviderMetadataMap,
  type ValidatedModelSupportSummary,
} from '../../../../lib/keys/providerMetadata';
import { listLlmProviders } from '../../../../lib/keys/llmProviders';

// Re-export slug helpers + KeysTab so existing imports from this module keep
// working. The constants themselves live in a server-safe module so
// `generateStaticParams` can spread them under RSC.
export {
  KEYS_SHEET_SLUGS,
  DEFAULT_KEYS_SHEET_SLUG,
  isKeysSheetSlug,
  keysSheetSlugToTab,
  keysTabToSheetSlug,
} from '../../../../lib/keys/sheetSlugs';
export type { KeysSheetSlug, KeysTab } from '../../../../lib/keys/sheetSlugs';

interface ArenaState {
  systemPrompt: string;
  userPrompt: string;
  selectedModels: { provider: LlmProviderId; model: string }[];
  temperature: number;
}

interface VlmArenaState extends ArenaState {
  imageDataUrl: string | null;
  imageDetail: 'auto' | 'low' | 'high';
}

interface KeysContextType {
  activeTab: KeysTab;
  setActiveTab: (tab: KeysTab) => void;

  llmState: ArenaState;
  setLlmState: React.Dispatch<React.SetStateAction<ArenaState>>;

  vlmState: VlmArenaState;
  setVlmState: React.Dispatch<React.SetStateAction<VlmArenaState>>;

  providerMetadata: ProviderMetadataMap;
  validatedModelSupport: ValidatedModelSupportSummary | null;
  validatedLlmProviders: ReadonlyArray<{
    id: LlmProviderId;
    label: string;
    availableModels: string[];
    defaultModel?: string;
  }>;
}

const defaultLlmState: ArenaState = {
  systemPrompt: 'You are a helpful AI assistant. Respond clearly and concisely.',
  userPrompt: 'Explain how a neural network works in simple terms.',
  selectedModels: [],
  temperature: 0.7,
};

const defaultVlmState: VlmArenaState = {
  systemPrompt: 'You are a helpful AI vision assistant. Describe what you see accurately.',
  userPrompt: 'What is happening in this image?',
  selectedModels: [],
  temperature: 0.4,
  imageDataUrl: null,
  imageDetail: 'auto',
};

const KeysContext = createContext<KeysContextType | null>(null);

export function KeysProvider({
  children,
  initialTab = 'api_key_validation',
}: {
  children: ReactNode;
  initialTab?: KeysTab;
}) {
  const [activeTab, setActiveTab] = useState<KeysTab>(initialTab);
  const [llmState, setLlmState] = useState<ArenaState>(defaultLlmState);
  const [vlmState, setVlmState] = useState<VlmArenaState>(defaultVlmState);
  const [providerMetadata, setProviderMetadata] = useState<ProviderMetadataMap>(() =>
    loadAllProviderMetadata(),
  );
  const [validatedModelSupport, setValidatedModelSupport] = useState<ValidatedModelSupportSummary | null>(
    () => loadValidatedModelSupportSummary(),
  );

  useEffect(() => {
    return subscribeProviderMetadataChanges(() => {
      setProviderMetadata(loadAllProviderMetadata());
      setValidatedModelSupport(loadValidatedModelSupportSummary());
    });
  }, []);

  const validatedLlmProviders = useMemo(() => {
    const all = listLlmProviders();
    return all
      .map((provider) => {
        const meta = providerMetadata[provider.id];
        if (meta?.status !== 'ok') return null;
        const models = meta.dynamicModels?.filter(Boolean) ?? [];
        const deduped = Array.from(new Set(models));
        if (deduped.length === 0) return null;
        return {
          id: provider.id,
          label: provider.label,
          availableModels: deduped,
          defaultModel: provider.defaultModel,
        };
      })
      .filter((p) => p !== null);
  }, [providerMetadata]);

  return (
    <KeysContext.Provider
      value={{
        activeTab,
        setActiveTab,
        llmState,
        setLlmState,
        vlmState,
        setVlmState,
        providerMetadata,
        validatedModelSupport,
        validatedLlmProviders,
      }}
    >
      {children}
    </KeysContext.Provider>
  );
}

export function useKeysContext() {
  const ctx = useContext(KeysContext);
  if (!ctx) {
    throw new Error('useKeysContext must be used within a KeysProvider');
  }
  return ctx;
}
