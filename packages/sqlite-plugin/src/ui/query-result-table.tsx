import { EmptyState, RozeniteLoader, Text, VirtualizedDataTable, cn } from '@rozenite/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState, type ReactNode } from 'react';
import type { SqliteQueryResult } from '../shared/types';
import { RowDetailDialog } from './row-detail-dialog';
import { formatNumber } from './utils';
import { getValueKind, getValuePreview } from './value-utils';

type ColumnMeta = {
  type?: string | null;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
};

type QueryResultTableProps = {
  ariaLabel: string;
  result: SqliteQueryResult | null;
  emptyTitle: string;
  emptyDescription: string;
  loading?: boolean;
  rowNumberOffset?: number;
  columnMeta?: Record<string, ColumnMeta>;
  hiddenColumnIds?: string[];
  rowActions?: {
    header: string;
    cell: (row: Record<string, unknown>, rowIndex: number) => ReactNode;
  };
};

type ResultRow = {
  /** Position within the loaded page or result, before the offset is applied. */
  index: number;
  values: Record<string, unknown>;
};

type DrawerPayload = {
  title: string;
  value: Record<string, unknown>;
} | null;

const getColumnHeaderTitle = (column: string, meta?: ColumnMeta) => {
  const details = [
    meta?.type,
    meta?.isPrimaryKey ? 'PK' : null,
    !meta?.isPrimaryKey && meta?.isForeignKey ? 'FK' : null,
  ].filter(Boolean);

  return details.length > 0 ? `${column} (${details.join(', ')})` : column;
};

export const QueryResultTable = ({
  ariaLabel,
  result,
  emptyTitle,
  emptyDescription,
  loading = false,
  rowNumberOffset = 0,
  columnMeta,
  hiddenColumnIds = [],
  rowActions,
}: QueryResultTableProps) => {
  const [drawerPayload, setDrawerPayload] = useState<DrawerPayload>(null);

  const visibleColumns = useMemo(
    () => (result?.columns ?? []).filter((column) => !hiddenColumnIds.includes(column)),
    [result?.columns, hiddenColumnIds],
  );
  const rows = useMemo<ResultRow[]>(
    () => (result?.rows ?? []).map((values, index) => ({ index, values })),
    [result?.rows],
  );

  const columns = useMemo<ColumnDef<ResultRow, unknown>[]>(() => {
    if (visibleColumns.length === 0) {
      return [];
    }

    const rowNumberColumn: ColumnDef<ResultRow, unknown> = {
      id: '__row-number__',
      header: '#',
      enableSorting: false,
      cell: ({ row }) => (
        <Text variant="numeric" className="text-faint">
          {formatNumber(rowNumberOffset + row.original.index + 1)}
        </Text>
      ),
    };

    // Actions sit next to the row number so they stay in reach on wide tables.
    const actionsColumn: ColumnDef<ResultRow, unknown>[] = rowActions
      ? [
          {
            id: '__row-actions__',
            header: rowActions.header,
            enableSorting: false,
            cell: ({ row }) => (
              <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                {rowActions.cell(row.original.values, row.original.index)}
              </div>
            ),
          },
        ]
      : [];

    const dataColumns = visibleColumns.map<ColumnDef<ResultRow, unknown>>((column) => ({
      id: column,
      // Column names are identifiers, so they keep their case.
      header: () => (
        <span
          className="tracking-normal normal-case"
          title={getColumnHeaderTitle(column, columnMeta?.[column])}
        >
          {column}
        </span>
      ),
      enableSorting: false,
      accessorFn: (row) => row.values[column],
      cell: ({ row }) => {
        const value = row.original.values[column];

        return (
          <div className="flex items-baseline gap-2">
            <span
              className={cn('max-w-md truncate font-mono text-xs', value === null && 'text-faint')}
            >
              {getValuePreview(value)}
            </span>
            <Text variant="label" className="shrink-0 text-[10px]">
              {getValueKind(value)}
            </Text>
          </div>
        );
      },
    }));

    return [rowNumberColumn, ...actionsColumn, ...dataColumns];
  }, [columnMeta, rowActions, rowNumberOffset, visibleColumns]);

  const handleInspectRow = (row: ResultRow) => {
    setDrawerPayload({
      title: `Row ${rowNumberOffset + row.index + 1}`,
      value: Object.fromEntries(visibleColumns.map((column) => [column, row.values[column]])),
    });
  };

  return (
    <>
      <VirtualizedDataTable
        ariaLabel={ariaLabel}
        columns={columns}
        data={loading || visibleColumns.length === 0 ? [] : rows}
        getRowId={(row) => String(row.index)}
        getRowTextValue={(row) => `Inspect row ${rowNumberOffset + row.index + 1}`}
        onRowClick={handleInspectRow}
        loading={loading}
        renderEmptyState={() =>
          loading ? (
            <div className="flex min-h-56 items-center justify-center">
              <RozeniteLoader size={32} />
            </div>
          ) : (
            <EmptyState title={emptyTitle} description={emptyDescription} className="min-h-56" />
          )
        }
        scrollClassName="h-full w-full overflow-auto"
        style={{ height: '100%' }}
      />

      <RowDetailDialog
        open={!!drawerPayload}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerPayload(null);
          }
        }}
        title={drawerPayload?.title ?? 'Row'}
        value={drawerPayload?.value}
      />
    </>
  );
};
