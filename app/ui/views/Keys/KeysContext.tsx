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
import type {
  CodingCandidateRow,
  CodingCandidateState,
} from '../../../../lib/keys/codingCandidates';
import {
  loadAllProviderMetadata,
  loadValidatedModelSupportSummary,
  mergeCuratedAndDynamicModels,
  subscribeProviderMetadataChanges,
  type ProviderMetadataMap,
  type ValidatedModelSupportSummary,
} from '../../../../lib/keys/providerMetadata';
import { listLlmProviders } from '../../../../lib/keys/llmProviders';
import {
  loadProviderOrder,
  subscribeProviderOrderChanges,
  type ProviderOrderEntry,
} from '../../../../lib/keys/providerOrder';
import {
  LLM_ARENA_EVALUATION_CONFIG,
  sanitizeLlmArenaNumber,
  type LlmArenaScoringProfile,
} from './LlmArenaEvaluation';

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
  maxTokens: number;
  timeoutMs: number;
  sampleCount: number;
  scoringProfile: LlmArenaScoringProfile;
}

interface VlmArenaState extends ArenaState {
  imageDataUrl: string | null;
  imageDetail: 'auto' | 'low' | 'high';
}

interface PersistedKeysState {
  version: 1;
  activeTab: KeysTab;
  llmState: ArenaState;
  vlmState: VlmArenaState;
  codingState: CodingCandidateState;
}

interface KeysContextType {
  activeTab: KeysTab;
  setActiveTab: (tab: KeysTab) => void;

  llmState: ArenaState;
  setLlmState: React.Dispatch<React.SetStateAction<ArenaState>>;

  vlmState: VlmArenaState;
  setVlmState: React.Dispatch<React.SetStateAction<VlmArenaState>>;

  codingState: CodingCandidateState;
  setCodingState: React.Dispatch<React.SetStateAction<CodingCandidateState>>;

  providerMetadata: ProviderMetadataMap;
  validatedModelSupport: ValidatedModelSupportSummary | null;
  validatedLlmProviders: ReadonlyArray<{
    id: LlmProviderId;
    label: string;
    availableModels: string[];
    defaultModel?: string;
  }>;
}

const DEFAULT_LLM_USER_PROMPT = '你是哪一家公司的哪一個模型？';
const LEGACY_DEFAULT_LLM_USER_PROMPTS = new Set([
  'Explain how a neural network works in simple terms.',
]);

const defaultLlmState: ArenaState = {
  systemPrompt: 'You are a helpful AI assistant. Respond clearly and concisely.',
  userPrompt: DEFAULT_LLM_USER_PROMPT,
  selectedModels: [],
  temperature: LLM_ARENA_EVALUATION_CONFIG.defaultTemperature,
  maxTokens: LLM_ARENA_EVALUATION_CONFIG.defaultMaxTokens,
  timeoutMs: LLM_ARENA_EVALUATION_CONFIG.defaultTimeoutMs,
  sampleCount: LLM_ARENA_EVALUATION_CONFIG.defaultSampleCount,
  scoringProfile: 'balanced_default',
};

const defaultVlmState: VlmArenaState = {
  systemPrompt: 'You are a helpful AI vision assistant. Describe what you see accurately.',
  userPrompt: 'What is happening in this image?',
  selectedModels: [],
  temperature: 0.4,
  maxTokens: LLM_ARENA_EVALUATION_CONFIG.defaultMaxTokens,
  timeoutMs: LLM_ARENA_EVALUATION_CONFIG.defaultTimeoutMs,
  sampleCount: LLM_ARENA_EVALUATION_CONFIG.defaultSampleCount,
  scoringProfile: 'balanced_default',
  imageDataUrl: null,
  imageDetail: 'auto',
};

const defaultCodingState: CodingCandidateState = {
  rows: [],
};

const MAX_CODING_CANDIDATES = 20;

const KEYS_STATE_STORAGE_KEY = 'projectManager:keys-state:v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeArenaState(value: unknown, fallback: ArenaState): ArenaState {
  if (!isRecord(value)) return fallback;
  const rawModels = Array.isArray(value.selectedModels) ? value.selectedModels : [];
  const selectedModels = rawModels
    .map((item) => {
      if (!isRecord(item)) return null;
      const provider = typeof item.provider === 'string' ? (item.provider as LlmProviderId) : null;
      const model = typeof item.model === 'string' ? item.model : null;
      if (!provider || !model) return null;
      return { provider, model };
    })
    .filter((item): item is { provider: LlmProviderId; model: string } => item !== null)
    .slice(0, 10);
  return {
    systemPrompt: typeof value.systemPrompt === 'string' ? value.systemPrompt : fallback.systemPrompt,
    userPrompt: typeof value.userPrompt === 'string' ? value.userPrompt : fallback.userPrompt,
    selectedModels,
    temperature:
      typeof value.temperature === 'number' && Number.isFinite(value.temperature)
        ? value.temperature
        : fallback.temperature,
    maxTokens: sanitizeLlmArenaNumber(
      value.maxTokens,
      fallback.maxTokens,
      LLM_ARENA_EVALUATION_CONFIG.minMaxTokens,
      LLM_ARENA_EVALUATION_CONFIG.maxMaxTokens,
    ),
    timeoutMs: sanitizeLlmArenaNumber(
      value.timeoutMs,
      fallback.timeoutMs,
      LLM_ARENA_EVALUATION_CONFIG.minTimeoutMs,
      LLM_ARENA_EVALUATION_CONFIG.maxTimeoutMs,
    ),
    sampleCount: Math.round(
      sanitizeLlmArenaNumber(
        value.sampleCount,
        fallback.sampleCount,
        LLM_ARENA_EVALUATION_CONFIG.minSampleCount,
        LLM_ARENA_EVALUATION_CONFIG.maxSampleCount,
      ),
    ),
    scoringProfile:
      value.scoringProfile === 'quality_first' ||
      value.scoringProfile === 'balanced_default' ||
      value.scoringProfile === 'cost_latency_first'
        ? value.scoringProfile
        : fallback.scoringProfile,
  };
}

function sanitizeVlmState(value: unknown, fallback: VlmArenaState): VlmArenaState {
  if (!isRecord(value)) return fallback;
  const arena = sanitizeArenaState(value, fallback);
  return {
    ...arena,
    imageDataUrl: typeof value.imageDataUrl === 'string' ? value.imageDataUrl : null,
    imageDetail:
      value.imageDetail === 'auto' || value.imageDetail === 'low' || value.imageDetail === 'high'
        ? value.imageDetail
        : fallback.imageDetail,
  };
}

function sanitizeCodingState(value: unknown, fallback: CodingCandidateState): CodingCandidateState {
  if (!isRecord(value)) return fallback;
  const rawRows = Array.isArray(value.rows) ? value.rows : [];
  const rows = rawRows
    .map((item) => {
      if (!isRecord(item)) return null;
      const provider = typeof item.provider === 'string' ? (item.provider as LlmProviderId) : null;
      const model = typeof item.model === 'string' ? item.model : null;
      if (!provider || !model) return null;
      return {
        provider,
        model,
        note: typeof item.note === 'string' ? item.note : '',
        enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
      };
    })
    .filter((item): item is CodingCandidateRow => item !== null)
    .slice(0, MAX_CODING_CANDIDATES);
  return { rows };
}

function normalizeDefaultLlmUserPrompt(userPrompt: string): string {
  return LEGACY_DEFAULT_LLM_USER_PROMPTS.has(userPrompt) ? DEFAULT_LLM_USER_PROMPT : userPrompt;
}

function loadPersistedKeysState(): PersistedKeysState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEYS_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (parsed.version !== 1) return null;
    const activeTab = typeof parsed.activeTab === 'string' ? (parsed.activeTab as KeysTab) : 'api_key_validation';
    const llmState = sanitizeArenaState(parsed.llmState, defaultLlmState);
    return {
      version: 1,
      activeTab,
      llmState: {
        ...llmState,
        userPrompt: normalizeDefaultLlmUserPrompt(llmState.userPrompt),
      },
      vlmState: sanitizeVlmState(parsed.vlmState, defaultVlmState),
      codingState: sanitizeCodingState(parsed.codingState, defaultCodingState),
    };
  } catch {
    return null;
  }
}

const KeysContext = createContext<KeysContextType | null>(null);

export function KeysProvider({
  children,
  initialTab = 'api_key_validation',
}: {
  children: ReactNode;
  initialTab?: KeysTab;
}) {
  const persistedState = useMemo(() => loadPersistedKeysState(), []);
  const [activeTab, setActiveTab] = useState<KeysTab>(initialTab);
  const [llmState, setLlmState] = useState<ArenaState>(persistedState?.llmState ?? defaultLlmState);
  const [vlmState, setVlmState] = useState<VlmArenaState>(persistedState?.vlmState ?? defaultVlmState);
  const [codingState, setCodingState] = useState<CodingCandidateState>(
    persistedState?.codingState ?? defaultCodingState,
  );
  const [providerMetadata, setProviderMetadata] = useState<ProviderMetadataMap>(() =>
    loadAllProviderMetadata(),
  );
  const [validatedModelSupport, setValidatedModelSupport] = useState<ValidatedModelSupportSummary | null>(
    () => loadValidatedModelSupportSummary(),
  );
  const [providerOrder, setProviderOrder] = useState<ProviderOrderEntry[]>([]);

  useEffect(() => {
    return subscribeProviderMetadataChanges(() => {
      setProviderMetadata(loadAllProviderMetadata());
      setValidatedModelSupport(loadValidatedModelSupportSummary());
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshProviderOrder = () => {
      void loadProviderOrder().then((order) => {
        if (!cancelled) setProviderOrder(order);
      });
    };
    refreshProviderOrder();
    const unsubscribe = subscribeProviderOrderChanges(refreshProviderOrder);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload: PersistedKeysState = {
        version: 1,
        activeTab,
        llmState,
        vlmState,
        codingState,
      };
      window.localStorage.setItem(KEYS_STATE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore persistence failures (quota/private mode) without breaking UI.
    }
  }, [activeTab, llmState, vlmState, codingState]);

  const validatedLlmProviders = useMemo(() => {
    const all = listLlmProviders();
    const activeByProvider = new Map(providerOrder.map((entry) => [entry.provider, entry.enabled]));
    return all
      .map((provider) => {
        if (activeByProvider.get(provider.id) === false) return null;
        const meta = providerMetadata[provider.id];
        if (meta?.status !== 'ok') return null;
        const deduped = mergeCuratedAndDynamicModels(provider.availableModels, meta.dynamicModels);
        if (deduped.length === 0) return null;
        return {
          id: provider.id,
          label: provider.label,
          availableModels: deduped,
          defaultModel: provider.defaultModel,
        };
      })
      .filter((p) => p !== null);
  }, [providerMetadata, providerOrder]);

  return (
    <KeysContext.Provider
      value={{
        activeTab,
        setActiveTab,
        llmState,
        setLlmState,
        vlmState,
        setVlmState,
        codingState,
        setCodingState,
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
