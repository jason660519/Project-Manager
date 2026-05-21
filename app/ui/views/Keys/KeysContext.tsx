'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { LlmProviderId } from '../../../../lib/keys/llmProviders';

export type KeysTab = 'api_config' | 'llm_arena' | 'vlm_arena';

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

export function KeysProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<KeysTab>('api_config');
  const [llmState, setLlmState] = useState<ArenaState>(defaultLlmState);
  const [vlmState, setVlmState] = useState<VlmArenaState>(defaultVlmState);

  return (
    <KeysContext.Provider
      value={{
        activeTab,
        setActiveTab,
        llmState,
        setLlmState,
        vlmState,
        setVlmState,
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
