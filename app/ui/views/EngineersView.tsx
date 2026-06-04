'use client';

/**
 * Engineers view — table + Excel-style bottom sheet layout.
 *
 * Two sheets share the same row set (one engineer per row):
 *   1. AI Engineers    — identity / model / fallback focus
 *   2. Ability / Tools — capability assignment (eyes, voice-tts, voice-stt,
 *      hands, recording) + working scope
 *
 * Row click opens the slide-in `EngineerDetailSheet` to edit the full role
 * config; the master form moved out of the inline left-list to keep the
 * table dense and the edit surface large.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Sparkles, Users2 } from 'lucide-react';

import { WorkstationFrame } from '../../../components/layout/WorkstationFrame';
import {
  BottomSheetTabs,
  type SheetTabItem,
} from '../../../components/sheets/BottomSheetTabs';
import { DEFAULT_ENGINEER_ROLES } from '../../../lib/defaults/engineerRoles';
import { listLlmProviders } from '../../../lib/keys/llmProviders';
import {
  loadCapabilityCatalog,
  type CapabilityCatalog,
} from '../../../lib/storage/capabilities';
import { listExposedSystemCliCommands } from '../../../lib/storage/system-cli';
import type { AnyAdapterConfig, EngineerRole } from '../../../lib/types';

import { AbilityToolsTable } from './Engineers/AbilityToolsTable';
import { AiEngineersTable } from './Engineers/AiEngineersTable';
import { EngineerDetailSheet } from './Engineers/EngineerDetailSheet';
import { DEFAULT_ENGINEERS_TAB, type EngineersTab, uid } from './Engineers/shared';

const ENGINEERS_SHEET_ORDER_STORAGE_KEY = 'projectManager.engineers.sheetOrder';

interface EngineersViewProps {
  roles: EngineerRole[];
  agents: AnyAdapterConfig[];
  onRolesChange: (roles: EngineerRole[]) => void;
  /** When true, omits the outer WorkstationFrame (for AI Assistants console embedding). */
  embedded?: boolean;
}

export function EngineersView({ roles, agents, onRolesChange, embedded = false }: EngineersViewProps) {
  const [activeTab, setActiveTab] = useState<EngineersTab>(DEFAULT_ENGINEERS_TAB);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [capabilityCatalog, setCapabilityCatalog] = useState<CapabilityCatalog>({
    schemaVersion: 1,
    candidates: [],
  });
  const [exposedCommands, setExposedCommands] = useState<string[]>([]);

  // Load + refresh the capability catalog and the globally exposed System CLI
  // allowlist so /integrations-hub state changes propagate when the user
  // returns to the Engineers view.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refresh = () => {
      setCapabilityCatalog(loadCapabilityCatalog());
      setExposedCommands(listExposedSystemCliCommands());
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const providers = useMemo(() => listLlmProviders(), []);

  const selectedRole = roles.find((r) => r.id === selectedId) ?? null;

  const handleAdd = () => {
    const newRole: EngineerRole = {
      id: uid(),
      name: 'New Role',
      slug: 'new-role',
      skills: [],
      commands: [],
      systemPrompt: '',
      referenceFiles: [],
    };
    onRolesChange([...roles, newRole]);
    setSelectedId(newRole.id);
  };

  const handleInitDefaults = () => {
    onRolesChange(DEFAULT_ENGINEER_ROLES);
    setSelectedId(DEFAULT_ENGINEER_ROLES[0]?.id ?? null);
  };

  const handleSave = (updated: EngineerRole) => {
    onRolesChange(roles.map((r) => (r.id === updated.id ? updated : r)));
  };

  const handleDelete = (id: string) => {
    const next = roles.filter((r) => r.id !== id);
    onRolesChange(next);
    if (selectedId === id) setSelectedId(null);
  };

  const handleRowClick = (role: EngineerRole) => {
    setSelectedId(role.id);
  };

  const TABS: ReadonlyArray<SheetTabItem<EngineersTab>> = [
    {
      key: 'ai_engineers',
      label: 'AI Engineers',
      icon: <Users2 size={14} />,
      badge: roles.length,
    },
    {
      key: 'ability_tools',
      label: 'Ability / Tools',
      icon: <Sparkles size={14} />,
    },
  ];

  const header = (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">
          AI Engineers
        </h1>
        <p className="mt-1 text-xs text-stone-400">
          One row per engineer role. Use the bottom sheets to switch between identity / model
          configuration and capability / tool assignment. Click any row to edit the role.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {roles.length === 0 && (
          <button
            onClick={handleInitDefaults}
            className="inline-flex items-center gap-1.5 border border-stone-200/18 px-3 py-1.5 text-xs text-stone-300 hover:bg-white/5"
          >
            Initialize 6 Defaults
          </button>
        )}
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 border border-emerald-200/25 bg-emerald-100/10 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-100/18"
        >
          <Plus size={12} />
          Add Role
        </button>
      </div>
    </div>
  );

  const bottomTabs = (
    <BottomSheetTabs
      tabs={TABS}
      activeKey={activeTab}
      onSelect={setActiveTab}
      reorderable
      orderStorageKey={ENGINEERS_SHEET_ORDER_STORAGE_KEY}
    />
  );

  const tables = (
    <>
      <div className={activeTab === 'ai_engineers' ? 'h-full' : 'hidden'}>
        <AiEngineersTable
          roles={roles}
          agents={agents}
          providers={providers}
          exposedCommands={exposedCommands}
          selectedRoleId={selectedId}
          onRowClick={handleRowClick}
        />
      </div>
      <div className={activeTab === 'ability_tools' ? 'h-full' : 'hidden'}>
        <AbilityToolsTable
          roles={roles}
          capabilityCatalog={capabilityCatalog}
          selectedRoleId={selectedId}
          onRowClick={handleRowClick}
        />
      </div>
    </>
  );

  return (
    <>
      {embedded ? (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="flex-none pb-4">{header}</div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72">
            <div className="min-h-0 flex-1 overflow-hidden">{tables}</div>
            <div className="flex-none">{bottomTabs}</div>
          </div>
        </div>
      ) : (
        <WorkstationFrame
          header={header}
          panelClassName="border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72"
          scrollChildren={false}
          bottomTabs={bottomTabs}
        >
          {tables}
        </WorkstationFrame>
      )}

      <EngineerDetailSheet
        role={selectedRole}
        agents={agents}
        onClose={() => setSelectedId(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </>
  );
}
