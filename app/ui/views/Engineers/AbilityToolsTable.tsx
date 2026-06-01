'use client';

// @table-classification: basic
// @table-reason: Tools × capabilities matrix with dynamic capability columns that can overflow
//   horizontally; a selection/navigation surface embedded under a parent WorkstationFrame.
// @table-waivers: search, freeze, resize, sort, hidden, shared-primitive — currently a bare
//   getCoreRowModel table; mandatory controls not yet implemented. Declared debt, follow-up.

/**
 * Ability / Tools sheet — one row per engineer, capability assignment focus.
 *
 * Columns mirror the five capability kinds (eyes / voice-tts / voice-stt /
 * hands / recording) from the F23 schema-v7 catalog. Each cell either shows
 * the resolved candidate label or an em-dash placeholder when unassigned.
 *
 * Rows that share an id with `selectedRoleId` are highlighted so the user
 * keeps context with the open slide-in detail sheet.
 */

import React, { useMemo } from 'react';
import { ChevronRight, FolderLock, Users2 } from 'lucide-react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import type {
  CapabilityCandidate,
  CapabilityKind,
  EngineerRole,
  RoleCapability,
} from '../../../../lib/types';
import type { CapabilityCatalog } from '../../../../lib/storage/capabilities';
import { CAPABILITY_KINDS, CAPABILITY_LABELS, slugColor } from './shared';

interface AbilityToolsTableProps {
  roles: EngineerRole[];
  capabilityCatalog: CapabilityCatalog;
  selectedRoleId: string | null;
  onRowClick: (role: EngineerRole) => void;
}

const columnHelper = createColumnHelper<EngineerRole>();

function findCandidate(
  catalog: CapabilityCatalog,
  id: string,
): CapabilityCandidate | undefined {
  return catalog.candidates.find((c) => c.id === id);
}

function CapabilityCell({
  role,
  kind,
  catalog,
}: {
  role: EngineerRole;
  kind: CapabilityKind;
  catalog: CapabilityCatalog;
}) {
  const assignment: RoleCapability | undefined = role.capabilities?.find((c) => c.kind === kind);
  if (!assignment) {
    return <span className="text-xs text-stone-500">—</span>;
  }
  const candidate = findCandidate(catalog, assignment.candidateId);
  const usable = candidate?.state === 'passed';
  const labelText = candidate?.label ?? assignment.candidateId;
  const stateCls = usable
    ? 'border-violet-300/35 bg-violet-500/10 text-violet-100/90'
    : 'border-amber-300/35 bg-amber-500/10 text-amber-100/90';
  const stateTitle = usable
    ? `Active candidate · ${candidate?.state ?? 'unknown'}`
    : `Candidate not passed · ${candidate?.state ?? 'missing in catalog'}`;
  return (
    <span
      className={`inline-flex max-w-[180px] truncate border px-2 py-0.5 text-[10px] ${stateCls}`}
      title={`${labelText}\n${stateTitle}`}
    >
      {labelText}
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

export function AbilityToolsTable({
  roles,
  capabilityCatalog,
  selectedRoleId,
  onRowClick,
}: AbilityToolsTableProps) {
  const columns = useMemo(() => {
    const cols = [
      columnHelper.accessor((row) => row.slug, {
        id: 'col-slug',
        header: 'Slug',
        cell: (info) => (
          <span
            className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${slugColor(info.getValue())}`}
          >
            {info.getValue() || '—'}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.name, {
        id: 'col-name',
        header: 'Name',
        cell: (info) => <span className="font-medium text-stone-100">{info.getValue()}</span>,
      }),
      ...CAPABILITY_KINDS.map((kind) =>
        columnHelper.display({
          id: `col-cap-${kind}`,
          header: CAPABILITY_LABELS[kind],
          cell: ({ row }) => (
            <CapabilityCell role={row.original} kind={kind} catalog={capabilityCatalog} />
          ),
        }),
      ),
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
    ];
    return cols;
  }, [capabilityCatalog]);

  const table = useReactTable({
    data: roles,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 border-b border-stone-200/12 bg-[rgb(var(--pm-panel))]">
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
                No engineer roles yet — add one in the AI Engineers sheet first.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
