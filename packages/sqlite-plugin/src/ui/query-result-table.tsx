import { useMemo, useState, type ReactNode } from 'react';
import type { CellContext, ColumnDef, OnChangeFn } from '@tanstack/react-table';
import type { SqliteQueryResult } from '../shared/types';
import { formatDuration, formatNumber } from './utils';
import {
  getMetadataBadgeClassName,
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

const joinClassNames = (
  ...classNames: Array<string | false | null | undefined>
) => classNames.filter(Boolean).join(' ');

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
            <div className="sqlite-cell-value">
              <span className="sqlite-cell-preview">
                {getValuePreview(value)}
              </span>
              <span className="sqlite-cell-kind">{getValueKind(value)}</span>
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
        <div className="sqlite-inline-metadata">
          <span
            className={joinClassNames(
              'sqlite-badge',
              getMetadataBadgeClassName(metadata),
            )}
          >
            {metadata.statementType}
          </span>
          <span className="sqlite-inline-stat sqlite-tabular">
            {formatNumber(metadata.rowCount)} rows
          </span>
          <span className="sqlite-inline-stat sqlite-tabular">
            {formatNumber(metadata.changes)} changes
          </span>
          <span className="sqlite-inline-stat sqlite-tabular">
            last insert {formatNumber(metadata.lastInsertRowId)}
          </span>
          <span className="sqlite-inline-stat sqlite-tabular">
            {formatDuration(metadata.durationMs)}
          </span>
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
