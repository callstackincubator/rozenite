import { Chip, Surface } from '@rozenite/ui';
import { useMemo, useState, type ReactNode } from 'react';
import type { CellContext, ColumnDef, OnChangeFn } from '@tanstack/react-table';
import type { SqliteQueryResult } from '../shared/types';
import { formatDuration, formatNumber } from './utils';
import {
  getMetadataChipColor,
  getValueKind,
  getValuePreview,
} from './value-utils';
import { CellDetailDrawer } from './cell-detail-drawer';
import { SqliteDataTable } from './sqlite-data-table';

type QueryResultTableProps = {
  tableId: string;
  result: SqliteQueryResult | null;
  columnOrder: string[];
  onColumnOrderChange: OnChangeFn<string[]>;
  emptyTitle: string;
  emptyDescription: string;
  loading?: boolean;
  showMetadata?: boolean;
  tableClassName?: string;
  shellClassName?: string;
  scrollContainerClassName?: string;
  rowNumberOffset?: number;
  columnMeta?: Record<
    string,
    {
      type?: string | null;
      isPrimaryKey?: boolean;
      isForeignKey?: boolean;
    }
  >;
  hiddenColumnIds?: string[];
  rowActions?: {
    columnId: string;
    header: string;
    cell: (row: Record<string, unknown>, rowIndex: number) => ReactNode;
  };
};

type DrawerPayload = {
  title: string;
  value: Record<string, unknown>;
} | null;

const RESULT_STAT_CLASS_NAME =
  'sqlite-tabular inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted';

const getColumnHeaderTitle = (
  column: string,
  meta?: {
    type?: string | null;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
  },
) => {
  const details = [
    meta?.type,
    meta?.isPrimaryKey ? 'PK' : null,
    !meta?.isPrimaryKey && meta?.isForeignKey ? 'FK' : null,
  ].filter(Boolean);

  return details.length > 0 ? `${column} (${details.join(', ')})` : column;
};

export const QueryResultTable = ({
  tableId,
  result,
  columnOrder,
  onColumnOrderChange,
  emptyTitle,
  emptyDescription,
  loading = false,
  showMetadata = true,
  tableClassName,
  shellClassName,
  scrollContainerClassName,
  rowNumberOffset = 0,
  columnMeta,
  hiddenColumnIds = [],
  rowActions,
}: QueryResultTableProps) => {
  const [drawerPayload, setDrawerPayload] = useState<DrawerPayload>(null);

  const columns = useMemo(() => result?.columns ?? [], [result]);
  const rows = result?.rows ?? [];
  const metadata = result?.metadata ?? null;
  const visibleColumns = useMemo(
    () => columns.filter((column) => !hiddenColumnIds.includes(column)),
    [columns, hiddenColumnIds],
  );

  const handleInspectRow = (row: Record<string, unknown>, rowIndex: number) => {
    setDrawerPayload({
      title: `Row ${rowNumberOffset + rowIndex + 1}`,
      value: Object.fromEntries(
        visibleColumns.map((column) => [column, row[column]]),
      ),
    });
  };

  const tableColumns = useMemo<ColumnDef<Record<string, unknown>, unknown>[]>(
    () => [
      ...visibleColumns.map((column) => ({
        id: column,
        header: () => (
          <span title={getColumnHeaderTitle(column, columnMeta?.[column])}>
            {column}
          </span>
        ),
        accessorFn: (row: Record<string, unknown>) => row[column],
        cell: ({ row }: CellContext<Record<string, unknown>, unknown>) => {
          const value = row.original[column];

          return (
            <div className="grid min-w-0 w-full gap-1 text-left">
              <span className="truncate text-foreground">
                {getValuePreview(value)}
              </span>
              <span className="text-[0.72rem] uppercase tracking-[0.08em] text-muted">
                {getValueKind(value)}
              </span>
            </div>
          );
        },
      })),
      ...(rowActions
        ? [
            {
              id: rowActions.columnId,
              header: rowActions.header,
              enableResizing: false,
              size: 112,
              minSize: 112,
              maxSize: 140,
              cell: ({ row }) => rowActions.cell(row.original, row.index),
            } satisfies ColumnDef<Record<string, unknown>, unknown>,
          ]
        : []),
    ],
    [columnMeta, rowActions, visibleColumns],
  );

  return (
    <>
      {showMetadata && metadata ? (
        <div className="flex min-w-0 flex-wrap gap-2 px-3 pt-3">
          <Chip
            color={getMetadataChipColor(metadata)}
            size="sm"
            variant="soft"
          >
            {metadata.statementType}
          </Chip>
          <Surface className={RESULT_STAT_CLASS_NAME} variant="secondary">
            {formatNumber(metadata.rowCount)} rows
          </Surface>
          <Surface className={RESULT_STAT_CLASS_NAME} variant="secondary">
            {formatNumber(metadata.changes)} changes
          </Surface>
          <Surface className={RESULT_STAT_CLASS_NAME} variant="secondary">
            last insert {formatNumber(metadata.lastInsertRowId)}
          </Surface>
          <Surface className={RESULT_STAT_CLASS_NAME} variant="secondary">
            {formatDuration(metadata.durationMs)}
          </Surface>
        </div>
      ) : null}

      <SqliteDataTable
        tableId={tableId}
        data={rows}
        columns={tableColumns}
        columnOrder={columnOrder}
        onColumnOrderChange={onColumnOrderChange}
        loading={loading}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        shellClassName={shellClassName}
        scrollContainerClassName={scrollContainerClassName}
        tableClassName={tableClassName}
        showRowNumbers
        rowNumberOffset={rowNumberOffset}
        onRowClick={handleInspectRow}
        getRowAriaLabel={(_, rowIndex) =>
          `Inspect row ${rowNumberOffset + rowIndex + 1}`
        }
      />

      <CellDetailDrawer
        isOpen={!!drawerPayload}
        onClose={() => setDrawerPayload(null)}
        title={drawerPayload?.title ?? 'Row'}
        value={drawerPayload?.value}
      />
    </>
  );
};
