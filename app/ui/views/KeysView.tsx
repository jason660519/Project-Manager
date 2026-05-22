'use client';

import React, { useEffect, useState } from 'react';
import { KeysProvider, useKeysContext } from './Keys/KeysContext';
import { ApiConfigSheet } from './Keys/ApiConfigSheet';
import { LlmArenaSheet } from './Keys/LlmArenaSheet';
import { VlmArenaSheet } from './Keys/VlmArenaSheet';

function KeysViewContent() {
  const { activeTab, setActiveTab } = useKeysContext();
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    const tauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    setIsTauri(tauri);
  }, []);

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-6 border-b border-stone-200/10 pb-4">
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">Keys</h1>
        <div className="flex bg-stone-900/50 rounded-sm p-1 border border-stone-200/10">
          <button
            onClick={() => setActiveTab('api_config')}
            className={`px-4 py-1.5 text-xs font-medium uppercase tracking-[0.1em] transition-colors rounded-sm ${
              activeTab === 'api_config'
                ? 'bg-stone-800 text-emerald-400 shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            API Config
          </button>
          <button
            onClick={() => setActiveTab('llm_arena')}
            className={`px-4 py-1.5 text-xs font-medium uppercase tracking-[0.1em] transition-colors rounded-sm ${
              activeTab === 'llm_arena'
                ? 'bg-stone-800 text-emerald-400 shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            LLM Arena
          </button>
          <button
            onClick={() => setActiveTab('vlm_arena')}
            className={`px-4 py-1.5 text-xs font-medium uppercase tracking-[0.1em] transition-colors rounded-sm ${
              activeTab === 'vlm_arena'
                ? 'bg-stone-800 text-emerald-400 shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            VLM Arena
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {/* We use CSS display: none to keep components mounted and preserve internal states (like input fields not explicitly tracked in context if any, and for instantaneous tab switching) */}
        <div className={activeTab === 'api_config' ? 'block' : 'hidden'}>
          <ApiConfigSheet isTauri={isTauri} />
        </div>
        <div className={activeTab === 'llm_arena' ? 'block h-full' : 'hidden'}>
          <LlmArenaSheet />
        </div>
        <div className={activeTab === 'vlm_arena' ? 'block h-full' : 'hidden'}>
          <VlmArenaSheet />
        </div>
      </div>
    </div>
  );
}

export function KeysView() {
  return (
    <KeysProvider>
      <KeysViewContent />
    </KeysProvider>
  );
}
