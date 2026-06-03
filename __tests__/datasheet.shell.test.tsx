import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';
import {
  applyFreezeColumnCount,
  DataTableShell,
  getFrozenColumnLayout,
} from '../components/table/datasheet';

interface Row {
  id: string;
  provider: string;
}

const columnHelper = createColumnHelper<Row>();

function ShellFixture() {
  const data = React.useMemo<Row[]>(() => [{ id: '1', provider: 'OpenAI' }], []);
  const columns = React.useMemo<ColumnDef<Row, string>[]>(
    () => [
      columnHelper.accessor('id', {
        id: 'col-id',
        header: 'UUID',
        cell: (info) => info.getValue(),
        size: 80,
      }),
      columnHelper.accessor('provider', {
        id: 'col-provider',
        header: 'Provider',
        cell: (info) => info.getValue(),
        size: 160,
      }),
    ],
    [],
  );
  const table = useReactTable({
    data,
    columns,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
  });
  const frozen = getFrozenColumnLayout(table, ['col-id']);

  return (
    <DataTableShell
      table={table}
      frozen={frozen}
      emptyText="No rows"
      filteredEmptyText="No matches"
      isFiltered={false}
    />
  );
}

describe('DataTableShell', () => {
  it('uses the shared resizable sheet layout safeguards', () => {
    render(<ShellFixture />);

    const table = screen.getByRole('table');
    expect(table).toHaveClass('table-fixed');
    expect(table.parentElement).toHaveClass('pm-scroll');
    expect(table.querySelector('thead')).toHaveClass('z-40');

    const idHeader = screen.getByText('UUID').closest('th');
    expect(idHeader).toHaveClass('overflow-hidden');
    expect(idHeader).toHaveClass('z-50');

    const idCell = screen.getByText('1').closest('td');
    expect(idCell).toHaveClass('overflow-hidden');
    expect(idCell).toHaveClass('z-20');
  });

  it('lets freeze-through shrink or expand the leftmost visible boundary', () => {
    const setFrozenColumnIds = vi.fn();
    const candidates = ['col-id', 'col-provider', 'col-status'];

    applyFreezeColumnCount(setFrozenColumnIds, candidates, 1);
    applyFreezeColumnCount(setFrozenColumnIds, candidates, 3);

    expect(setFrozenColumnIds).toHaveBeenNthCalledWith(1, ['col-id']);
    expect(setFrozenColumnIds).toHaveBeenNthCalledWith(2, [
      'col-id',
      'col-provider',
      'col-status',
    ]);
  });
});
