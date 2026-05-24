'use client';

import React, { useEffect, useState } from 'react';
import { KeysProvider, useKeysContext, type KeysTab } from './Keys/KeysContext';
import { ApiConfigSheet } from './Keys/ApiConfigSheet';
import { LlmArenaSheet } from './Keys/LlmArenaSheet';
import { VlmArenaSheet } from './Keys/VlmArenaSheet';
import { WorkstationFrame } from '../../../components/layout/WorkstationFrame';
import {
  BottomSheetTabs,
  type SheetTabItem,
} from '../../../components/sheets/BottomSheetTabs';

const KEY_TABS: ReadonlyArray<SheetTabItem<KeysTab>> = [
  { key: 'api_config', label: 'API Config' },
  { key: 'llm_arena', label: 'LLM Arena' },
  { key: 'vlm_arena', label: 'VLM Arena' },
];

function KeysViewContent({ projectRoot }: { projectRoot?: string }) {
  const { activeTab, setActiveTab } = useKeysContext();
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    const tauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    setIsTauri(tauri);
  }, []);

  return (
    <WorkstationFrame
      className="mx-auto w-full max-w-7xl"
      header={
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">Keys</h1>
      }
      panelClassName="border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72"
      scrollChildren={false}
      bottomTabs={
        <BottomSheetTabs tabs={KEY_TABS} activeKey={activeTab} onSelect={setActiveTab} />
      }
    >
      {/* Mounted in parallel + display toggled so per-tab state is preserved */}
      <div className={activeTab === 'api_config' ? 'h-full overflow-auto p-4' : 'hidden'}>
        <ApiConfigSheet isTauri={isTauri} projectRoot={projectRoot} />
      </div>
      <div className={activeTab === 'llm_arena' ? 'h-full overflow-hidden p-4' : 'hidden'}>
        <LlmArenaSheet />
      </div>
      <div className={activeTab === 'vlm_arena' ? 'h-full overflow-hidden p-4' : 'hidden'}>
        <VlmArenaSheet />
      </div>
    </WorkstationFrame>
  );
}

export function KeysView({ projectRoot }: { projectRoot?: string }) {
  return (
    <KeysProvider>
      <KeysViewContent projectRoot={projectRoot} />
    </KeysProvider>
  );
}
