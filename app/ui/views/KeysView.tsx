'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Image, KeyRound } from 'lucide-react';
import {
  KeysProvider,
  useKeysContext,
  keysSheetSlugToTab,
  keysTabToSheetSlug,
  DEFAULT_KEYS_SHEET_SLUG,
  type KeysTab,
  type KeysSheetSlug,
} from './Keys/KeysContext';
import { ApiKeyValidationSheet } from './Keys/ApiKeyValidationSheet';
import { LlmArenaSheet } from './Keys/LlmArenaSheet';
import { VlmArenaSheet } from './Keys/VlmArenaSheet';
import { WorkstationFrame } from '../../../components/layout/WorkstationFrame';
import {
  BottomSheetTabs,
  type SheetTabItem,
} from '../../../components/sheets/BottomSheetTabs';

const KEYS_SHEET_ORDER_STORAGE_KEY = 'projectManager.keys.sheetOrder';

function KeysViewContent({
  projectRoot,
  initialSheet,
  onRebindProjectRoot,
}: {
  projectRoot?: string;
  initialSheet: KeysSheetSlug;
  onRebindProjectRoot?: () => Promise<void>;
}) {
  const router = useRouter();
  const { activeTab, setActiveTab, llmState, vlmState } = useKeysContext();
  const [isTauri, setIsTauri] = useState(false);
  const tabs: ReadonlyArray<SheetTabItem<KeysTab>> = [
    {
      key: 'api_key_validation',
      label: 'API Key Validation',
      icon: <KeyRound size={14} />,
      title: 'API Key Validation sheet',
    },
    {
      key: 'llm_arena',
      label: 'LLM Arena',
      icon: <Bot size={14} />,
      badge: llmState.selectedModels.length,
      title: 'LLM Arena model rows',
    },
    {
      key: 'vlm_arena',
      label: 'VLM Arena',
      icon: <Image size={14} />,
      badge: vlmState.selectedModels.length,
      title: 'VLM Arena model rows',
    },
  ];

  useEffect(() => {
    const tauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    setIsTauri(tauri);
  }, []);

  // Keep context in sync when the user navigates via browser back/forward or
  // when the route is loaded directly (e.g. `/keys/llm-arena`).
  useEffect(() => {
    const desired = keysSheetSlugToTab(initialSheet);
    if (desired !== activeTab) {
      setActiveTab(desired);
    }
  }, [initialSheet, activeTab, setActiveTab]);

  const handleTabSelect = (next: KeysTab) => {
    setActiveTab(next);
    router.push(`/keys/${keysTabToSheetSlug(next)}`);
  };

  return (
    <WorkstationFrame
      className="w-full"
      header={
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">Keys</h1>
      }
      panelClassName="border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72"
      scrollChildren={false}
      bottomTabs={
        <BottomSheetTabs
          tabs={tabs}
          activeKey={activeTab}
          onSelect={handleTabSelect}
          reorderable
          orderStorageKey={KEYS_SHEET_ORDER_STORAGE_KEY}
        />
      }
    >
      {/* Mounted in parallel + display toggled so per-tab state is preserved */}
      <div className={activeTab === 'api_key_validation' ? 'h-full overflow-auto p-4' : 'hidden'}>
        <ApiKeyValidationSheet
          isTauri={isTauri}
          projectRoot={projectRoot}
          onRebindProjectRoot={onRebindProjectRoot}
        />
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

export function KeysView({
  projectRoot,
  initialSheet,
  onRebindProjectRoot,
}: {
  projectRoot?: string;
  initialSheet?: KeysSheetSlug;
  onRebindProjectRoot?: () => Promise<void>;
}) {
  const resolvedSheet = initialSheet ?? DEFAULT_KEYS_SHEET_SLUG;
  return (
    <KeysProvider initialTab={keysSheetSlugToTab(resolvedSheet)}>
      <KeysViewContent
        projectRoot={projectRoot}
        initialSheet={resolvedSheet}
        onRebindProjectRoot={onRebindProjectRoot}
      />
    </KeysProvider>
  );
}
