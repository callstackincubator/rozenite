import { useMemo, useState } from 'react';
import type { ColumnDef, OnChangeFn } from '@tanstack/react-table';
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
};

type DrawerPayload = {
  title: string;
  value: Record<string, unknown>;
} | null;

const joinClassNames = (
  ...classNames: Array<string | false | null | undefined>
) => classNames.filter(Boolean).join(' ');

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
}: QueryResultTableProps) => {
  const [drawerPayload, setDrawerPayload] = useState<DrawerPayload>(null);

  const columns = useMemo(() => result?.columns ?? [], [result]);
  const rows = result?.rows ?? [];
  const metadata = result?.metadata ?? null;

  const handleInspectRow = (row: Record<string, unknown>, rowIndex: number) => {
    setDrawerPayload({
      title: `Row ${rowNumberOffset + rowIndex + 1}`,
      value: row,
    });
  };

  const tableColumns = useMemo<ColumnDef<Record<string, unknown>, unknown>[]>(
    () =>
      columns.map((column) => ({
        id: column,
        header: () => (
          <div className="sqlite-results-heading">
            <span>{column}</span>
            {columnMeta?.[column]?.type ? (
              <span className="sqlite-results-heading-meta">
                {columnMeta[column]?.type}
                {columnMeta[column]?.isPrimaryKey ? ' PK' : ''}
                {!columnMeta[column]?.isPrimaryKey &&
                columnMeta[column]?.isForeignKey
                  ? ' FK'
                  : ''}
              </span>
            ) : null}
          </div>
        ),
        accessorFn: (row) => row[column],
        cell: ({ row }) => {
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
    [columnMeta, columns],
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
        shellClassName={joinClassNames(tableClassName, shellClassName)}
        scrollContainerClassName={scrollContainerClassName}
        tableClassName="sqlite-results-table"
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
