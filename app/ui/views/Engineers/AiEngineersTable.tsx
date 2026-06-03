'use client';

// @table-classification: simple
// @table-reason: Master-detail selection list of AI engineers (small fixed row set, no
//   horizontal overflow, click-to-select navigation rather than operational data analysis).
//   Per table-governance §1, Simple Tables need stable ids + row actions, not the full
//   Basic Table Sheet control set.

/**
 * AI Engineers sheet — one row per engineer role, identity / model focus.
 *
 * Sits inside the WorkstationFrame established by EngineersView. The parent
 * owns selection state and opens the slide-in detail sheet on row click.
 */

import React, { useMemo } from 'react';
import { Bot, ChevronRight, FolderLock, Users2 } from 'lucide-react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import type { AnyAdapterConfig, EngineerRole } from '../../../../lib/types';
import type { LlmProviderId, LlmProviderSpec } from '../../../../lib/keys/llmProviders';
import { slugColor } from './shared';

interface AiEngineersTableProps {
  roles: EngineerRole[];
  agents: AnyAdapterConfig[];
  providers: readonly LlmProviderSpec[];
  selectedRoleId: string | null;
  onRowClick: (role: EngineerRole) => void;
}

const columnHelper = createColumnHelper<EngineerRole>();

function SlugCell({ slug }: { slug: string }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${slugColor(slug)}`}
    >
      {slug || '—'}
    </span>
  );
}

function NameCell({ role }: { role: EngineerRole }) {
  return (
    <div className="min-w-0">
      <p className="font-medium text-stone-100">{role.name}</p>
      {role.skills.length > 0 && (
        <p className="mt-0.5 truncate text-[10px] text-stone-500" title={role.skills.join(', ')}>
          {role.skills.slice(0, 4).join(' · ')}
          {role.skills.length > 4 && (
            <span className="text-stone-600"> · +{role.skills.length - 4}</span>
          )}
        </p>
      )}
    </div>
  );
}

function ModelCell({
  role,
  providers,
}: {
  role: EngineerRole;
  providers: readonly LlmProviderSpec[];
}) {
  if (!role.primaryModel) {
    return <span className="text-xs text-stone-500">— Use dispatch default</span>;
  }
  const providerLabel =
    providers.find((p) => p.id === (role.primaryModel!.providerId as LlmProviderId))?.label ??
    role.primaryModel.providerId;
  const modelId = role.primaryModel.modelId;
  return (
    <div className="flex flex-col">
      <span className="text-xs text-stone-200">{providerLabel}</span>
      <span className="font-mono text-[10px] text-stone-500">{modelId || 'default'}</span>
    </div>
  );
}

function FallbackCell({ count }: { count: number }) {
  if (count === 0) return <span className="text-xs text-stone-500">—</span>;
  return (
    <span className="inline-flex items-center gap-1 border border-stone-200/18 px-1.5 py-0.5 font-mono text-[10px] text-stone-300">
      <Bot size={10} className="text-stone-500" />
      {count}
    </span>
  );
}

function ScopeCell({ role }: { role: EngineerRole }) {
  const scope = role.workingScope;
  if (!scope || scope.allowedPaths.length === 0) {
    return <span className="text-xs text-stone-500">—</span>;
  }
  const cls =
    scope.mode === 'strict'
      ? 'border-orange-300/35 text-orange-200/85'
      : 'border-emerald-300/35 text-emerald-200/85';
  return (
    <span
      className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${cls}`}
      title={scope.allowedPaths.join('\n')}
    >
      <FolderLock size={10} />
      {scope.mode} · {scope.allowedPaths.length}
    </span>
  );
}

function AgentCell({
  role,
  agents,
}: {
  role: EngineerRole;
  agents: AnyAdapterConfig[];
}) {
  if (!role.defaultAgentId) {
    return <span className="text-xs text-stone-500">—</span>;
  }
  const agent = agents.find((a) => a.id === role.defaultAgentId);
  return <span className="text-xs text-stone-300">{agent?.name ?? role.defaultAgentId}</span>;
}

export function AiEngineersTable({
  roles,
  agents,
  providers,
  selectedRoleId,
  onRowClick,
}: AiEngineersTableProps) {
  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => row.slug, {
        id: 'col-slug',
        header: 'Slug',
        cell: (info) => <SlugCell slug={info.getValue()} />,
      }),
      columnHelper.accessor((row) => row.name, {
        id: 'col-name',
        header: 'Name',
        cell: (info) => <NameCell role={info.row.original} />,
      }),
      columnHelper.display({
        id: 'col-agent',
        header: 'Default Agent',
        cell: ({ row }) => <AgentCell role={row.original} agents={agents} />,
      }),
      columnHelper.display({
        id: 'col-model',
        header: 'Primary Model',
        cell: ({ row }) => <ModelCell role={row.original} providers={providers} />,
      }),
      columnHelper.accessor((row) => row.modelFallbacks?.length ?? 0, {
        id: 'col-fallbacks',
        header: 'Fallbacks',
        cell: (info) => <FallbackCell count={info.getValue()} />,
      }),
      columnHelper.display({
        id: 'col-scope',
        header: 'Working Scope',
        cell: ({ row }) => <ScopeCell role={row.original} />,
      }),
      columnHelper.display({
        id: 'col-chevron',
        header: '',
        cell: () => <ChevronRight size={14} className="text-stone-600" />,
      }),
    ],
    [agents, providers],
  );

  const table = useReactTable({
    data: roles,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="pm-scroll h-full overflow-auto">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-40 border-b border-stone-200/12 bg-[rgb(var(--pm-panel))]">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const active = row.original.id === selectedRoleId;
            return (
              <tr
                key={row.id}
                onClick={() => onRowClick(row.original)}
                className={[
                  'cursor-pointer border-b border-stone-200/10 transition-colors',
                  active ? 'bg-emerald-950/40' : 'hover:bg-white/[0.045]',
                ].join(' ')}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle text-sm text-stone-300">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
          {roles.length === 0 && (
            <tr>
              <td
                colSpan={table.getVisibleLeafColumns().length}
                className="px-4 py-10 text-center text-xs text-stone-500"
              >
                <Users2 size={16} className="mx-auto mb-2 opacity-60" />
                No engineer roles yet. Use the toolbar to add one or initialize defaults.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
