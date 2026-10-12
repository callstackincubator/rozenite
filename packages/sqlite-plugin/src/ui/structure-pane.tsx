import {
  Alert,
  Badge,
  DataTable,
  DescriptionList,
  IconButton,
  Tabs,
  Text,
  type DataTableColumn,
} from '@rozenite/ui';
import { KeyRound, RefreshCw, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type {
  SqliteColumnInfo,
  SqliteEntity,
  SqliteForeignKeyInfo,
  SqliteIndexInfo,
} from './sqlite-introspection';
import { getPrimaryKeyColumns } from './sqlite-row-mutations';

export type StructureSection = 'columns' | 'keys' | 'indexes';

export type StructureState = {
  columns: SqliteColumnInfo[];
  foreignKeys: SqliteForeignKeyInfo[];
  indexes: Array<SqliteIndexInfo & { columns: string[] }>;
};

type StructureColumnRow = {
  name: string;
  type: string;
  nullable: string;
  defaultValue: string;
  primaryKey: string;
  foreignKey: string;
  extra: string;
};

type StructureIndexRow = {
  indexName: string;
  columns: string;
  unique: string;
  type: string;
};

type StructurePaneProps = {
  entity: SqliteEntity;
  state: StructureState;
  section: StructureSection;
  loading: boolean;
  error: string | null;
  onSectionChange: (section: StructureSection) => void;
  onRefresh: () => void;
  onDrop: () => void;
};

const COLUMN_RESIZING = { defaultSize: 220, minSize: 120 };

const SECTIONS: Array<[StructureSection, string]> = [
  ['columns', 'Columns'],
  ['keys', 'Keys'],
  ['indexes', 'Indexes'],
];

const mono = (value: string) => <span className="font-mono text-xs">{value}</span>;

const columnTableColumns: DataTableColumn<StructureColumnRow>[] = [
  {
    id: 'name',
    header: 'Name',
    accessorKey: 'name',
    enableSorting: false,
    cell: ({ row }) => mono(row.original.name),
  },
  {
    id: 'type',
    header: 'Type',
    accessorKey: 'type',
    enableSorting: false,
    cell: ({ row }) => mono(row.original.type),
  },
  {
    id: 'nullable',
    header: 'Nullable',
    accessorKey: 'nullable',
    enableSorting: false,
    cell: ({ row }) => mono(row.original.nullable),
  },
  {
    id: 'defaultValue',
    header: 'Default',
    accessorKey: 'defaultValue',
    enableSorting: false,
    cell: ({ row }) => mono(row.original.defaultValue),
  },
  {
    id: 'primaryKey',
    header: 'PK',
    accessorKey: 'primaryKey',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.primaryKey === '—' ? (
        <span className="text-faint">—</span>
      ) : (
        <Badge tone="neutral" variant="soft">
          {row.original.primaryKey}
        </Badge>
      ),
  },
  {
    id: 'foreignKey',
    header: 'FK',
    accessorKey: 'foreignKey',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.foreignKey === '—' ? (
        <span className="text-faint">—</span>
      ) : (
        <Badge tone="info" variant="soft">
          FK
        </Badge>
      ),
  },
  {
    id: 'extra',
    header: 'Extra',
    accessorKey: 'extra',
    enableSorting: false,
    cell: ({ row }) => mono(row.original.extra),
  },
];

const indexTableColumns: DataTableColumn<StructureIndexRow>[] = [
  {
    id: 'indexName',
    header: 'Index Name',
    accessorKey: 'indexName',
    enableSorting: false,
    cell: ({ row }) => mono(row.original.indexName),
  },
  {
    id: 'columns',
    header: 'Columns',
    accessorKey: 'columns',
    enableSorting: false,
    cell: ({ row }) => mono(row.original.columns),
  },
  {
    id: 'unique',
    header: 'Unique',
    accessorKey: 'unique',
    enableSorting: false,
    cell: ({ row }) => mono(row.original.unique),
  },
  {
    id: 'type',
    header: 'Type',
    accessorKey: 'type',
    enableSorting: false,
    cell: ({ row }) => mono(row.original.type),
  },
];

export const StructurePane = ({
  entity,
  state,
  section,
  loading,
  error,
  onSectionChange,
  onRefresh,
  onDrop,
}: StructurePaneProps) => {
  const dropLabel = entity.type === 'view' ? 'Drop view' : 'Drop table';

  const columnRows = useMemo<StructureColumnRow[]>(
    () =>
      state.columns.map((column) => ({
        name: column.name,
        type: column.type || '—',
        nullable: column.notNull ? 'No' : 'Yes',
        defaultValue: column.defaultValue ?? '—',
        primaryKey: column.primaryKeyOrder > 0 ? `PK ${column.primaryKeyOrder}` : '—',
        foreignKey: state.foreignKeys.some((foreignKey) => foreignKey.from === column.name)
          ? 'Yes'
          : '—',
        extra: column.hidden > 0 ? `Hidden ${column.hidden}` : '—',
      })),
    [state.columns, state.foreignKeys],
  );

  const indexRows = useMemo<StructureIndexRow[]>(
    () =>
      state.indexes.map((index) => ({
        indexName: index.name,
        columns: index.columns.join(', ') || '—',
        unique: index.unique ? 'Yes' : 'No',
        type: `${index.origin.toUpperCase()}${index.partial ? ' · Partial' : ''}`,
      })),
    [state.indexes],
  );

  const primaryKeyColumns = useMemo(() => getPrimaryKeyColumns(state.columns), [state.columns]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-2 py-1.5">
        <Tabs value={section} onValueChange={(value) => onSectionChange(value as StructureSection)}>
          <Tabs.List size="sm" aria-label="Structure sections">
            {SECTIONS.map(([key, label]) => (
              <Tabs.Tab key={key} value={key} size="sm">
                {label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        <div className="flex items-center gap-1">
          <IconButton
            label="Refresh structure"
            size="sm"
            tone="neutral"
            variant="ghost"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
          </IconButton>
          <IconButton label={dropLabel} size="sm" tone="danger" variant="ghost" onClick={onDrop}>
            <Trash2 />
          </IconButton>
        </div>
      </div>

      {error ? (
        <Alert tone="danger" className="m-2" aria-live="polite">
          <Alert.Title>Structure Load Failed</Alert.Title>
          <Alert.Description>{error}</Alert.Description>
        </Alert>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {section === 'columns' ? (
          <DataTable
            ariaLabel="Columns"
            columnResizing={COLUMN_RESIZING}
            columns={columnTableColumns}
            data={columnRows}
            loading={loading}
            emptyMessage="This table or view does not expose columns."
          />
        ) : section === 'keys' ? (
          loading ? (
            <Text variant="caption" className="block p-4">
              Loading…
            </Text>
          ) : (
            <DescriptionList className="p-4">
              <DescriptionList.Item label="Primary key">
                {primaryKeyColumns.length === 0 ? (
                  <Text variant="caption">No primary key defined.</Text>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {primaryKeyColumns.map((column) => (
                      <Badge
                        key={column.name}
                        tone="neutral"
                        variant="outline"
                        size="lg"
                        className="gap-1 normal-case tracking-normal"
                      >
                        <KeyRound className="h-3 w-3" aria-hidden="true" />
                        {column.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </DescriptionList.Item>

              <DescriptionList.Item label="Foreign keys">
                {state.foreignKeys.length === 0 ? (
                  <Text variant="caption">No foreign keys defined.</Text>
                ) : (
                  <div className="flex flex-col gap-3">
                    {state.foreignKeys.map((foreignKey) => (
                      <div
                        key={`${foreignKey.id}-${foreignKey.seq}`}
                        className="flex items-start justify-between gap-3 border border-border bg-muted/40 p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-xs break-all">
                            {foreignKey.from} → {foreignKey.table}
                            {foreignKey.to ? `.${foreignKey.to}` : ''}
                          </p>
                          <Text variant="caption">
                            Update {foreignKey.onUpdate} · Delete {foreignKey.onDelete}
                          </Text>
                        </div>
                        <Badge tone="neutral" variant="soft">
                          Match {foreignKey.match}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </DescriptionList.Item>
            </DescriptionList>
          )
        ) : (
          <DataTable
            ariaLabel="Indexes"
            columnResizing={COLUMN_RESIZING}
            columns={indexTableColumns}
            data={indexRows}
            loading={loading}
            emptyMessage="This table or view does not define indexes."
          />
        )}
      </div>
    </div>
  );
};
