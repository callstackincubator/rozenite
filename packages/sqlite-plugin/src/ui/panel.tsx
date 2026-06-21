import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  Button,
  Card,
  Chip,
  ListBox,
  PluginHeader,
  PluginTheme,
  SearchField,
  Select,
  Surface,
  Tabs,
} from '@rozenite/ui';
import type { CompletionSource } from '@codemirror/autocomplete';
import type { ColumnDef, Updater } from '@tanstack/react-table';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Download,
  FileCode2,
  FolderTree,
  KeyRound,
  Pencil,
  Play,
  RefreshCw,
  Table2,
  TerminalSquare,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { PLUGIN_ID, type SqliteEventMap } from '../shared/protocol';
import {
  getStatementAtCursor,
  normalizeSingleStatementSql,
  splitSqlStatements,
} from '../shared/sql';
import type {
  SqliteDatabaseInfo,
  SqliteQueryResult,
  SqliteScriptResult,
  SqliteScriptStatementResult,
} from '../shared/types';
import {
  buildBrowseEntitySql,
  buildEntityCountSql,
  buildForeignKeySql,
  buildIndexInfoSql,
  buildIndexListSql,
  buildListEntitiesSql,
  buildTableXInfoSql,
  LIST_SCHEMAS_SQL,
  parseColumns,
  parseCount,
  parseEntities,
  parseForeignKeys,
  parseIndexColumns,
  parseIndexes,
  parseSchemas,
  type SqliteColumnInfo,
  type SqliteEntity,
  type SqliteForeignKeyInfo,
  type SqliteIndexInfo,
  type SqliteSchema,
} from './sqlite-introspection';
import { QueryResultTable } from './query-result-table';
import { SqliteRowDeleteModal } from './sqlite-row-delete-modal';
import { SqliteDataTable } from './sqlite-data-table';
import { SqliteRowEditModal } from './sqlite-row-edit-modal';
import { SqlEditor, type SqlEditorHandle } from './sql-editor';
import {
  buildSqlCompletionSchema,
  createSqlColumnCompletions,
  createSqlEditorColumnCache,
  extractSqlEditorAliases,
  formatSqlScript,
  getDefaultSqlCompletionSchema,
  getSqlEditorCachedColumns,
  getSqlEditorColumnCompletionRequest,
  resolveSqlEditorEntityReference,
  setSqlEditorCachedColumns,
  syncSqlEditorColumnCacheDatabase,
} from './sql-editor-utils';
import { useSqliteRequests } from './use-sqlite-requests';
import {
  SQLITE_HIDDEN_ROWID_COLUMN_ID,
  SQLITE_ROW_ACTIONS_COLUMN_ID,
  buildRowDeleteMutation,
  buildRowUpdateMutation,
  getEditableColumns,
  getPrimaryKeyColumns,
  getRowMutationDescriptor,
  type SqliteRowMutationDescriptor,
} from './sqlite-row-mutations';
import {
  SQLITE_ROW_NUMBER_COLUMN_ID,
  areColumnOrdersEqual,
  buildEntityTableId,
  buildQueryTableId,
  getDefaultTableColumnOrder,
  resolveTableColumnOrderUpdate,
} from './sqlite-table-column-order';
import {
  copyToClipboard,
  downloadTextFile,
  formatNumber,
  slugifyFileName,
} from './utils';
import { getResultSummary, getScriptResultSummary } from './value-utils';
import './globals.css';

type ActiveTab = 'query' | 'data' | 'structure';
type StructureSection = 'columns' | 'keys' | 'indexes';

type StructureState = {
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

type ExplorerState = {
  schemas: SqliteSchema[];
  entities: SqliteEntity[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
};

type ActiveRowMutationState = {
  row: Record<string, unknown>;
  rowIndex: number;
} | null;

const DEFAULT_QUERY =
  'SELECT name, type FROM sqlite_schema ORDER BY type, name';
const DEFAULT_QUERY_LIMIT = 100;
const DEFAULT_PAGE_SIZE = 50;
const MIN_EDITOR_HEIGHT = 180;
const MIN_RESULTS_HEIGHT = 120;
const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 420;
const DEFAULT_EXPLORER_STATE: ExplorerState = {
  schemas: [],
  entities: [],
  loading: false,
  error: null,
  loaded: false,
};

const joinClassNames = (
  ...classNames: Array<string | false | null | undefined>
) => classNames.filter(Boolean).join(' ');

const safeError = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const getEntityKey = (
  databaseId: string,
  schemaName: string,
  entityName: string,
) => JSON.stringify([databaseId, schemaName, entityName]);

const getSchemaKey = (databaseId: string, schemaName: string) =>
  JSON.stringify([databaseId, schemaName]);

const getLineNumberAtPosition = (value: string, position: number) =>
  value.slice(0, Math.max(0, position)).split('\n').length;

const buildGeneratedSelect = (
  entity: SqliteEntity | null,
  rowLimit: number,
) => {
  if (!entity) {
    return DEFAULT_QUERY;
  }

  return buildBrowseEntitySql(
    entity.schemaName,
    entity.name,
    Math.max(1, Math.floor(rowLimit)),
    0,
  );
};

const buildCsv = (result: SqliteQueryResult | null) => {
  if (!result || result.columns.length === 0) {
    return '';
  }

  const escapeCell = (value: unknown) => {
    const cell = value == null ? '' : String(value);
    const escaped = cell.replace(/"/g, '""');
    return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
  };

  return [
    result.columns.join(','),
    ...result.rows.map((row) =>
      result.columns.map((column) => escapeCell(row[column])).join(','),
    ),
  ].join('\n');
};

const getDefaultSelectedQueryStatementIndex = (
  execution: SqliteScriptResult | null,
) => {
  if (!execution || execution.statements.length === 0) {
    return null;
  }

  return (
    execution.failedStatementIndex ??
    execution.statements[execution.statements.length - 1]?.index ??
    null
  );
};

const getStatementQueryResult = (
  statement: SqliteScriptStatementResult | null,
) => statement?.execution?.result ?? null;

const getStatementSelectorLabel = (
  statement: SqliteScriptStatementResult,
  maxLength = 72,
) => {
  const normalizedSql = statement.input.sql
    .replace(/\s+/g, ' ')
    .replace(/;\s*$/, '')
    .trim();

  if (normalizedSql.length <= maxLength) {
    return `${formatNumber(statement.index + 1)}. ${normalizedSql}`;
  }

  return `${formatNumber(statement.index + 1)}. ${normalizedSql.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const isMutatingStatement = (result: SqliteQueryResult) =>
  !(
    result.metadata.statementType === 'select' ||
    result.metadata.statementType === 'pragma' ||
    result.metadata.statementType === 'with' ||
    result.metadata.statementType === 'explain'
  );

const hasMutatingStatements = (execution: SqliteScriptResult | null) =>
  execution?.statements.some((statement) => {
    const result = getStatementQueryResult(statement);
    return result ? isMutatingStatement(result) : false;
  }) ?? false;

const isQueryableEntity = (entity: SqliteEntity | null) => !!entity;

const buildExplorerGroups = (
  schemas: SqliteSchema[],
  entities: SqliteEntity[],
  objectSearch: string,
) => {
  const term = objectSearch.trim().toLowerCase();

  return schemas
    .map((schema) => {
      const schemaEntities = entities.filter(
        (entity) => entity.schemaName === schema.name,
      );
      const filteredEntities = term
        ? schemaEntities.filter((entity) =>
            `${entity.name} ${entity.type} ${schema.name}`
              .toLowerCase()
              .includes(term),
          )
        : schemaEntities;
      const tables = filteredEntities.filter(
        (entity) => entity.type === 'table',
      );
      const views = filteredEntities.filter((entity) => entity.type === 'view');
      const visible =
        term.length === 0 ||
        schema.name.toLowerCase().includes(term) ||
        filteredEntities.length > 0;

      return {
        schema,
        tables,
        views,
        visible,
      };
    })
    .filter((group) => group.visible);
};

type SelectOption = {
  id: string;
  label: string;
};

const SharedSelect = ({
  ariaLabel,
  className,
  isDisabled = false,
  options,
  placeholder,
  value,
  onChange,
}: {
  ariaLabel: string;
  className?: string;
  isDisabled?: boolean;
  options: SelectOption[];
  placeholder?: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) => (
  <Select
    aria-label={ariaLabel}
    className={className}
    isDisabled={isDisabled}
    onChange={(nextValue) =>
      onChange(nextValue == null ? null : String(nextValue))
    }
    placeholder={placeholder}
    value={value ?? ''}
    variant="secondary"
  >
    <Select.Trigger>
      <Select.Value />
      <Select.Indicator />
    </Select.Trigger>
    <Select.Popover>
      <ListBox aria-label={ariaLabel}>
        {options.map((option) => (
          <ListBox.Item
            key={option.id}
            id={option.id}
            textValue={option.label}
          >
            {option.label}
            <ListBox.ItemIndicator />
          </ListBox.Item>
        ))}
      </ListBox>
    </Select.Popover>
  </Select>
);

const InlineError = ({
  title,
  message,
  action,
  className,
}: {
  title: string;
  message: ReactNode;
  action?: ReactNode;
  className?: string;
}) => (
  <Surface
    aria-live="polite"
    className={joinClassNames(
      'mx-3 mt-3 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-danger',
      className,
    )}
    variant="secondary"
  >
    <div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-danger">{message}</p>
    </div>
    {action}
  </Surface>
);

const renderEmptyState = (
  title: string,
  description: string,
  icon: 'database' | 'table' | 'query' | 'structure',
) => {
  const Icon =
    icon === 'query'
      ? TerminalSquare
      : icon === 'structure'
        ? FolderTree
      : icon === 'table'
          ? Table2
          : Database;

  return (
    <Surface
      className="flex min-h-[16rem] flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/70 bg-surface-secondary/50 px-6 py-8 text-center"
      variant="secondary"
    >
      <div className="flex size-12 items-center justify-center rounded-xl border border-border/70 bg-surface-tertiary text-muted">
        <Icon aria-hidden="true" className="size-5" />
      </div>
      <div className="max-w-md space-y-2 text-center">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm leading-6 text-muted">{description}</p>
      </div>
    </Surface>
  );
};

const PANEL_CLASS_NAME =
  'flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden rounded-[1.4rem] border border-border/60 bg-surface';
const WORKSPACE_PANEL_CLASS_NAME =
  'relative flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden rounded-[1.4rem] border border-border/60 bg-surface';
const CONTENT_PANEL_CLASS_NAME =
  'flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden rounded-[1.2rem] border border-border/60 bg-surface';
const QUERY_SECTION_CLASS_NAME =
  'flex min-h-0 min-w-0 w-full flex-col overflow-hidden';
const QUERY_SECTION_HEADER_CLASS_NAME =
  'flex flex-wrap items-center justify-between gap-3 px-4 py-3';
const PANEL_HEADER_CLASS_NAME =
  'flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3';
const PANEL_SECTION_HEADER_CLASS_NAME =
  'flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3';
const INLINE_STAT_CLASS_NAME =
  'sqlite-tabular inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted';
const TREE_STACK_CLASS_NAME = 'grid min-w-0 gap-2';
const TREE_GROUP_CLASS_NAME = 'grid min-w-0 gap-1.5';
const TREE_BUTTON_CLASS_NAME =
  'flex w-full min-w-0 items-center gap-2 rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-left text-foreground transition-colors hover:bg-surface-secondary';
const TREE_ACTIVE_BUTTON_CLASS_NAME = 'border-accent/30 bg-accent/10';
const TREE_SECTION_TITLE_CLASS_NAME =
  'm-0 text-[0.72rem] uppercase tracking-[0.08em] text-muted';
const SKELETON_ROW_CLASS_NAME = 'h-12 animate-pulse rounded-2xl bg-surface-tertiary';
const STRUCTURE_SKELETON_ROW_CLASS_NAME =
  'h-[4.5rem] animate-pulse rounded-2xl bg-surface-tertiary';

const InlineStat = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <Surface
    className={joinClassNames(INLINE_STAT_CLASS_NAME, className)}
    variant="secondary"
  >
    {children}
  </Surface>
);

export default function SqlitePanel() {
  const client = useRozeniteDevToolsClient<SqliteEventMap>({
    pluginId: PLUGIN_ID,
  });
  const { requestDatabases, requestQuery, requestScriptExecution } =
    useSqliteRequests(client);

  const querySplitRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<SqlEditorHandle | null>(null);
  const objectSearchRef = useRef<HTMLInputElement | null>(null);
  const selectedDatabaseIdRef = useRef<string | null>(null);
  const selectedEntityKeyRef = useRef<string | null>(null);
  const browseRequestVersionRef = useRef(0);
  const structureRequestVersionRef = useRef(0);

  const [activeTab, setActiveTab] = useState<ActiveTab>('query');
  const [sidebarWidth, setSidebarWidth] = useState(304);
  const [editorSplit, setEditorSplit] = useState(60);
  const [expandedDatabaseIds, setExpandedDatabaseIds] = useState<string[]>([]);
  const [expandedSchemaKeys, setExpandedSchemaKeys] = useState<string[]>([]);
  const [structureSection, setStructureSection] =
    useState<StructureSection>('columns');

  const [databases, setDatabases] = useState<SqliteDatabaseInfo[]>([]);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(
    null,
  );
  const [explorerStateByDatabase, setExplorerStateByDatabase] = useState<
    Record<string, ExplorerState>
  >({});
  const [selectedEntityKey, setSelectedEntityKey] = useState<string | null>(
    null,
  );

  const [databaseLoading, setDatabaseLoading] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const [structureLoading, setStructureLoading] = useState(false);

  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [structureError, setStructureError] = useState<string | null>(null);

  const [browseOffset, setBrowseOffset] = useState(0);
  const [browsePageSize, setBrowsePageSize] = useState(DEFAULT_PAGE_SIZE);
  const [browseResult, setBrowseResult] = useState<SqliteQueryResult | null>(
    null,
  );
  const [entityRowCount, setEntityRowCount] = useState<number | null>(null);
  const [structureState, setStructureState] = useState<StructureState>({
    columns: [],
    foreignKeys: [],
    indexes: [],
  });

  const [queryInput, setQueryInput] = useState(DEFAULT_QUERY);
  const [queryExecution, setQueryExecution] =
    useState<SqliteScriptResult | null>(null);
  const [selectedQueryStatementIndex, setSelectedQueryStatementIndex] =
    useState<number | null>(null);
  const [queryRowLimit, setQueryRowLimit] = useState(DEFAULT_QUERY_LIMIT);
  const [querySelection, setQuerySelection] = useState({ start: 0, end: 0 });
  const [, setQueryMessage] = useState('Ready.');
  const [queryErrorLine, setQueryErrorLine] = useState<number | null>(null);
  const [queryColumnCache, setQueryColumnCache] = useState(() =>
    createSqlEditorColumnCache(),
  );
  const [tableColumnOrderById, setTableColumnOrderById] = useState<
    Record<string, string[]>
  >({});
  const [editingRow, setEditingRow] = useState<ActiveRowMutationState>(null);
  const [deletingRow, setDeletingRow] = useState<ActiveRowMutationState>(null);

  const [objectSearch, setObjectSearch] = useState('');
  const [dataSearch, setDataSearch] = useState('');

  const selectedDatabase = useMemo(
    () =>
      databases.find((database) => database.id === selectedDatabaseId) ?? null,
    [databases, selectedDatabaseId],
  );

  const selectedExplorerState = useMemo(
    () =>
      (selectedDatabaseId
        ? explorerStateByDatabase[selectedDatabaseId]
        : null) ?? DEFAULT_EXPLORER_STATE,
    [explorerStateByDatabase, selectedDatabaseId],
  );

  const schemas = selectedExplorerState.schemas;
  const entities = selectedExplorerState.entities;
  const entityLoading = selectedExplorerState.loading;

  const selectedEntity = useMemo(
    () =>
      entities.find(
        (entity) =>
          selectedDatabaseId != null &&
          getEntityKey(selectedDatabaseId, entity.schemaName, entity.name) ===
            selectedEntityKey,
      ) ?? null,
    [entities, selectedDatabaseId, selectedEntityKey],
  );

  useEffect(() => {
    selectedDatabaseIdRef.current = selectedDatabaseId;
  }, [selectedDatabaseId]);

  useEffect(() => {
    selectedEntityKeyRef.current = selectedEntityKey;
  }, [selectedEntityKey]);

  const structureColumnMeta = useMemo(
    () =>
      Object.fromEntries(
        structureState.columns.map((column) => [
          column.name,
          {
            type: column.type,
            isPrimaryKey: column.primaryKeyOrder > 0,
            isForeignKey: structureState.foreignKeys.some(
              (foreignKey) => foreignKey.from === column.name,
            ),
          },
        ]),
      ),
    [structureState.columns, structureState.foreignKeys],
  );

  const defaultCompletionSchemaName = useMemo(
    () => getDefaultSqlCompletionSchema(schemas),
    [schemas],
  );

  const cachedSelectedEntityColumns = useMemo(() => {
    if (!selectedDatabaseId || !selectedEntity) {
      return [];
    }

    return (
      getSqlEditorCachedColumns(
        queryColumnCache,
        selectedDatabaseId,
        selectedEntity.schemaName,
        selectedEntity.name,
      ) ?? []
    );
  }, [queryColumnCache, selectedDatabaseId, selectedEntity]);

  const editorCompletionSchema = useMemo(
    () =>
      buildSqlCompletionSchema({
        columnCache: queryColumnCache,
        databaseId: selectedDatabaseId,
        entities,
        schemas,
      }),
    [entities, queryColumnCache, schemas, selectedDatabaseId],
  );

  const filteredBrowseRows = useMemo(() => {
    if (!browseResult) {
      return [];
    }

    const term = dataSearch.trim().toLowerCase();
    const searchableColumns = browseResult.columns.filter(
      (column) => column !== SQLITE_HIDDEN_ROWID_COLUMN_ID,
    );

    if (!term) {
      return browseResult.rows;
    }

    return browseResult.rows.filter((row) =>
      searchableColumns.some((column) =>
        String(row[column] ?? '')
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [browseResult, dataSearch]);

  const filteredBrowseResult = useMemo(() => {
    if (!browseResult) {
      return null;
    }

    return {
      ...browseResult,
      rows: filteredBrowseRows,
      metadata: {
        ...browseResult.metadata,
        rowCount: filteredBrowseRows.length,
      },
    } satisfies SqliteQueryResult;
  }, [browseResult, filteredBrowseRows]);

  const dataPageStart = filteredBrowseRows.length > 0 ? browseOffset + 1 : 0;
  const dataPageEnd =
    filteredBrowseRows.length > 0
      ? browseOffset + filteredBrowseRows.length
      : 0;
  const canBrowseBackward = browseOffset > 0;
  const canBrowseForward =
    entityRowCount != null && browseOffset + browsePageSize < entityRowCount;
  const currentDataPage = selectedEntity
    ? Math.floor(browseOffset / browsePageSize) + 1
    : 0;
  const totalDataPages =
    entityRowCount == null || entityRowCount === 0
      ? 0
      : Math.ceil(entityRowCount / browsePageSize);
  const primaryKeyColumns = useMemo(
    () => getPrimaryKeyColumns(structureState.columns),
    [structureState.columns],
  );
  const editableColumns = useMemo(
    () => getEditableColumns(structureState.columns),
    [structureState.columns],
  );
  const rowMutationDescriptor = useMemo<SqliteRowMutationDescriptor | null>(
    () => getRowMutationDescriptor(selectedEntity, structureState.columns),
    [selectedEntity, structureState.columns],
  );
  const canMutateRows = rowMutationDescriptor != null;
  const visibleBrowseColumnIds = useMemo(
    () =>
      (filteredBrowseResult?.columns ?? []).filter(
        (column) => column !== SQLITE_HIDDEN_ROWID_COLUMN_ID,
      ),
    [filteredBrowseResult?.columns],
  );

  const structureColumnRows = useMemo<StructureColumnRow[]>(
    () =>
      structureState.columns.map((column) => ({
        name: column.name,
        type: column.type || '—',
        nullable: column.notNull ? 'No' : 'Yes',
        defaultValue: column.defaultValue ?? '—',
        primaryKey:
          column.primaryKeyOrder > 0 ? `PK ${column.primaryKeyOrder}` : '—',
        foreignKey: structureState.foreignKeys.some(
          (foreignKey) => foreignKey.from === column.name,
        )
          ? 'Yes'
          : '—',
        extra: column.hidden > 0 ? `Hidden ${column.hidden}` : '—',
      })),
    [structureState.columns, structureState.foreignKeys],
  );

  const structureIndexRows = useMemo<StructureIndexRow[]>(
    () =>
      structureState.indexes.map((index) => ({
        indexName: index.name,
        columns: index.columns.join(', ') || '—',
        unique: index.unique ? 'Yes' : 'No',
        type: `${index.origin.toUpperCase()}${index.partial ? ' · Partial' : ''}`,
      })),
    [structureState.indexes],
  );

  const structureColumnsTableColumns = useMemo<
    ColumnDef<StructureColumnRow, unknown>[]
  >(
    () => [
      { id: 'name', header: 'Name', accessorKey: 'name' },
      { id: 'type', header: 'Type', accessorKey: 'type' },
      { id: 'nullable', header: 'Nullable', accessorKey: 'nullable' },
      { id: 'defaultValue', header: 'Default', accessorKey: 'defaultValue' },
      { id: 'primaryKey', header: 'PK', accessorKey: 'primaryKey' },
      { id: 'foreignKey', header: 'FK', accessorKey: 'foreignKey' },
      { id: 'extra', header: 'Extra', accessorKey: 'extra' },
    ],
    [],
  );

  const structureIndexesTableColumns = useMemo<
    ColumnDef<StructureIndexRow, unknown>[]
  >(
    () => [
      { id: 'indexName', header: 'Index Name', accessorKey: 'indexName' },
      { id: 'columns', header: 'Columns', accessorKey: 'columns' },
      { id: 'unique', header: 'Unique', accessorKey: 'unique' },
      { id: 'type', header: 'Type', accessorKey: 'type' },
    ],
    [],
  );

  const queryStatements = useMemo(
    () => splitSqlStatements(queryInput),
    [queryInput],
  );

  const selectedQueryStatement = useMemo(() => {
    if (!queryExecution) {
      return null;
    }

    const nextIndex =
      selectedQueryStatementIndex ??
      getDefaultSelectedQueryStatementIndex(queryExecution);

    if (nextIndex == null) {
      return null;
    }

    return (
      queryExecution.statements.find(
        (statement) => statement.index === nextIndex,
      ) ?? null
    );
  }, [queryExecution, selectedQueryStatementIndex]);

  const activeQueryResult = useMemo(
    () => getStatementQueryResult(selectedQueryStatement),
    [selectedQueryStatement],
  );

  const selectedQueryStatementValue =
    selectedQueryStatement?.index != null
      ? String(selectedQueryStatement.index)
      : null;

  const queryTableId = useMemo(
    () =>
      buildQueryTableId(selectedDatabaseId, activeQueryResult?.columns ?? []),
    [activeQueryResult?.columns, selectedDatabaseId],
  );

  const dataTableId = useMemo(
    () =>
      buildEntityTableId(
        'data',
        selectedDatabaseId,
        selectedEntity?.schemaName ?? null,
        selectedEntity?.name ?? null,
      ),
    [selectedDatabaseId, selectedEntity?.name, selectedEntity?.schemaName],
  );

  const structureColumnsTableId = useMemo(
    () =>
      buildEntityTableId(
        'structure-columns',
        selectedDatabaseId,
        selectedEntity?.schemaName ?? null,
        selectedEntity?.name ?? null,
      ),
    [selectedDatabaseId, selectedEntity?.name, selectedEntity?.schemaName],
  );

  const structureIndexesTableId = useMemo(
    () =>
      buildEntityTableId(
        'structure-indexes',
        selectedDatabaseId,
        selectedEntity?.schemaName ?? null,
        selectedEntity?.name ?? null,
      ),
    [selectedDatabaseId, selectedEntity?.name, selectedEntity?.schemaName],
  );

  const getTableColumnOrder = useCallback(
    (
      tableId: string,
      columnIds: string[],
      fixedLeadingColumnIds: string[] = [],
    ) =>
      resolveTableColumnOrderUpdate({
        columnIds,
        fixedLeadingColumnIds,
        storedColumnOrder: tableColumnOrderById[tableId],
        nextColumnOrder: getDefaultTableColumnOrder(
          columnIds,
          fixedLeadingColumnIds,
        ),
      }),
    [tableColumnOrderById],
  );

  const setTableColumnOrder = useCallback(
    (
      tableId: string,
      columnIds: string[],
      nextColumnOrder: Updater<string[]>,
      fixedLeadingColumnIds: string[] = [],
    ) => {
      setTableColumnOrderById((current) => {
        const resolvedColumnOrder = resolveTableColumnOrderUpdate({
          columnIds,
          fixedLeadingColumnIds,
          storedColumnOrder: current[tableId],
          nextColumnOrder,
        });

        if (areColumnOrdersEqual(current[tableId] ?? [], resolvedColumnOrder)) {
          return current;
        }

        return {
          ...current,
          [tableId]: resolvedColumnOrder,
        };
      });
    },
    [],
  );

  const queryColumnIds = useMemo(
    () => [SQLITE_ROW_NUMBER_COLUMN_ID, ...(activeQueryResult?.columns ?? [])],
    [activeQueryResult?.columns],
  );
  const dataColumnIds = useMemo(
    () => [
      SQLITE_ROW_NUMBER_COLUMN_ID,
      ...visibleBrowseColumnIds,
      ...(canMutateRows ? [SQLITE_ROW_ACTIONS_COLUMN_ID] : []),
    ],
    [canMutateRows, visibleBrowseColumnIds],
  );
  const structureColumnsColumnIds = useMemo(
    () => structureColumnsTableColumns.map((column) => column.id as string),
    [structureColumnsTableColumns],
  );
  const structureIndexesColumnIds = useMemo(
    () => structureIndexesTableColumns.map((column) => column.id as string),
    [structureIndexesTableColumns],
  );

  const queryColumnOrder = useMemo(
    () =>
      getTableColumnOrder(queryTableId, queryColumnIds, [
        SQLITE_ROW_NUMBER_COLUMN_ID,
      ]),
    [getTableColumnOrder, queryColumnIds, queryTableId],
  );
  const dataColumnOrder = useMemo(
    () =>
      getTableColumnOrder(dataTableId, dataColumnIds, [
        SQLITE_ROW_NUMBER_COLUMN_ID,
      ]),
    [dataColumnIds, dataTableId, getTableColumnOrder],
  );
  const structureColumnsColumnOrder = useMemo(
    () =>
      getTableColumnOrder(structureColumnsTableId, structureColumnsColumnIds),
    [getTableColumnOrder, structureColumnsColumnIds, structureColumnsTableId],
  );
  const structureIndexesColumnOrder = useMemo(
    () =>
      getTableColumnOrder(structureIndexesTableId, structureIndexesColumnIds),
    [getTableColumnOrder, structureIndexesColumnIds, structureIndexesTableId],
  );

  const setEntitySelection = useCallback(
    (databaseId: string, entity: SqliteEntity) => {
      setSelectedDatabaseId(databaseId);
      setSelectedEntityKey(
        getEntityKey(databaseId, entity.schemaName, entity.name),
      );
    },
    [],
  );

  const loadDatabases = useCallback(async () => {
    setDatabaseLoading(true);
    setDatabaseError(null);

    try {
      const nextDatabases = await requestDatabases();
      setDatabases(nextDatabases);
      setExplorerStateByDatabase((current) =>
        Object.fromEntries(
          nextDatabases.map((database) => [
            database.id,
            current[database.id] ?? DEFAULT_EXPLORER_STATE,
          ]),
        ),
      );
      setExpandedDatabaseIds((current) => {
        const currentIds = current.filter((id) =>
          nextDatabases.some((database) => database.id === id),
        );
        const missingIds = nextDatabases
          .map((database) => database.id)
          .filter((id) => !currentIds.includes(id));

        return [...currentIds, ...missingIds];
      });
      setSelectedDatabaseId((current) => {
        if (
          current &&
          nextDatabases.some((database) => database.id === current)
        ) {
          return current;
        }

        return nextDatabases[0]?.id ?? null;
      });
      return nextDatabases;
    } catch (error) {
      setDatabaseError(safeError(error));
      setDatabases([]);
      setExplorerStateByDatabase({});
      setSelectedDatabaseId(null);
      return [];
    } finally {
      setDatabaseLoading(false);
    }
  }, [requestDatabases]);

  const loadExplorer = useCallback(
    async (databaseId: string) => {
      setExplorerStateByDatabase((current) => ({
        ...current,
        [databaseId]: {
          ...(current[databaseId] ?? DEFAULT_EXPLORER_STATE),
          loading: true,
          error: null,
        },
      }));

      try {
        const schemaResult = await requestQuery({
          databaseId,
          sql: LIST_SCHEMAS_SQL,
        });
        const nextSchemas = parseSchemas(schemaResult);
        const entityResults = await Promise.all(
          nextSchemas.map(async (schema) => ({
            schemaName: schema.name,
            result: await requestQuery({
              databaseId,
              sql: buildListEntitiesSql(schema.name),
            }),
          })),
        );
        const nextEntities = entityResults.flatMap(({ schemaName, result }) =>
          parseEntities(result, schemaName),
        );

        setExplorerStateByDatabase((current) => ({
          ...current,
          [databaseId]: {
            schemas: nextSchemas,
            entities: nextEntities,
            loading: false,
            error: null,
            loaded: true,
          },
        }));
        setExpandedSchemaKeys((current) => {
          const nextKeys = nextSchemas.map((schema) =>
            getSchemaKey(databaseId, schema.name),
          );
          return Array.from(new Set([...current, ...nextKeys]));
        });
      } catch (error) {
        setExplorerStateByDatabase((current) => ({
          ...current,
          [databaseId]: {
            schemas: [],
            entities: [],
            loading: false,
            error: safeError(error),
            loaded: true,
          },
        }));
      }
    },
    [requestQuery],
  );

  const loadBrowse = useCallback(async () => {
    const requestVersion = browseRequestVersionRef.current + 1;
    browseRequestVersionRef.current = requestVersion;

    if (!selectedDatabaseId || !selectedEntity) {
      setBrowseResult(null);
      setEntityRowCount(null);
      return;
    }

    const requestEntityKey = getEntityKey(
      selectedDatabaseId,
      selectedEntity.schemaName,
      selectedEntity.name,
    );

    setBrowseLoading(true);
    setBrowseError(null);

    try {
      const [result, countResult] = await Promise.all([
        requestQuery({
          databaseId: selectedDatabaseId,
          sql: buildBrowseEntitySql(
            selectedEntity.schemaName,
            selectedEntity.name,
            browsePageSize,
            browseOffset,
            rowMutationDescriptor?.mode === 'rowid'
              ? rowMutationDescriptor.rowIdIdentifier
              : null,
          ),
        }),
        requestQuery({
          databaseId: selectedDatabaseId,
          sql: buildEntityCountSql(
            selectedEntity.schemaName,
            selectedEntity.name,
          ),
        }),
      ]);

      if (
        browseRequestVersionRef.current !== requestVersion ||
        selectedDatabaseIdRef.current !== selectedDatabaseId ||
        selectedEntityKeyRef.current !== requestEntityKey
      ) {
        return;
      }

      setBrowseResult(result);
      setEntityRowCount(parseCount(countResult));
    } catch (error) {
      if (
        browseRequestVersionRef.current !== requestVersion ||
        selectedDatabaseIdRef.current !== selectedDatabaseId ||
        selectedEntityKeyRef.current !== requestEntityKey
      ) {
        return;
      }

      setBrowseError(safeError(error));
      setBrowseResult(null);
      setEntityRowCount(null);
    } finally {
      if (browseRequestVersionRef.current === requestVersion) {
        setBrowseLoading(false);
      }
    }
  }, [
    browseOffset,
    browsePageSize,
    requestQuery,
    rowMutationDescriptor,
    selectedDatabaseId,
    selectedEntity,
  ]);

  const loadStructure = useCallback(async () => {
    const requestVersion = structureRequestVersionRef.current + 1;
    structureRequestVersionRef.current = requestVersion;

    if (!selectedDatabaseId || !selectedEntity) {
      setStructureState({
        columns: [],
        foreignKeys: [],
        indexes: [],
      });
      return;
    }

    const requestEntityKey = getEntityKey(
      selectedDatabaseId,
      selectedEntity.schemaName,
      selectedEntity.name,
    );

    setStructureLoading(true);
    setStructureError(null);

    try {
      const [columnsOutcome, foreignKeysOutcome, indexesOutcome] =
        await Promise.allSettled([
          requestQuery({
            databaseId: selectedDatabaseId,
            sql: buildTableXInfoSql(
              selectedEntity.schemaName,
              selectedEntity.name,
            ),
          }),
          requestQuery({
            databaseId: selectedDatabaseId,
            sql: buildForeignKeySql(
              selectedEntity.schemaName,
              selectedEntity.name,
            ),
          }),
          requestQuery({
            databaseId: selectedDatabaseId,
            sql: buildIndexListSql(
              selectedEntity.schemaName,
              selectedEntity.name,
            ),
          }),
        ]);

      const columns =
        columnsOutcome.status === 'fulfilled'
          ? parseColumns(columnsOutcome.value)
          : [];
      const foreignKeys =
        foreignKeysOutcome.status === 'fulfilled'
          ? parseForeignKeys(foreignKeysOutcome.value)
          : [];
      const indexes =
        indexesOutcome.status === 'fulfilled'
          ? parseIndexes(indexesOutcome.value)
          : [];

      const enrichedIndexes = await Promise.all(
        indexes.map(async (index) => {
          try {
            const result = await requestQuery({
              databaseId: selectedDatabaseId,
              sql: buildIndexInfoSql(selectedEntity.schemaName, index.name),
            });

            return {
              ...index,
              columns: parseIndexColumns(result)
                .sort((left, right) => left.seqno - right.seqno)
                .map((column) => column.name),
            };
          } catch {
            return {
              ...index,
              columns: [],
            };
          }
        }),
      );

      if (
        structureRequestVersionRef.current !== requestVersion ||
        selectedDatabaseIdRef.current !== selectedDatabaseId ||
        selectedEntityKeyRef.current !== requestEntityKey
      ) {
        return;
      }

      setStructureState({
        columns,
        foreignKeys,
        indexes: enrichedIndexes,
      });
    } catch (error) {
      if (
        structureRequestVersionRef.current !== requestVersion ||
        selectedDatabaseIdRef.current !== selectedDatabaseId ||
        selectedEntityKeyRef.current !== requestEntityKey
      ) {
        return;
      }

      setStructureError(safeError(error));
      setStructureState({
        columns: [],
        foreignKeys: [],
        indexes: [],
      });
    } finally {
      if (structureRequestVersionRef.current === requestVersion) {
        setStructureLoading(false);
      }
    }
  }, [requestQuery, selectedDatabaseId, selectedEntity]);

  const refreshExplorerData = useCallback(async () => {
    const nextDatabases = await loadDatabases();
    await Promise.all(
      nextDatabases.map((database) => loadExplorer(database.id)),
    );
  }, [loadDatabases, loadExplorer]);

  const refreshWorkspace = useCallback(async () => {
    await refreshExplorerData();

    if (selectedEntity) {
      await Promise.all([loadBrowse(), loadStructure()]);
    }
  }, [loadBrowse, loadStructure, refreshExplorerData, selectedEntity]);

  const handleSaveRow = useCallback(
    async (nextValues: Record<string, unknown>) => {
      if (
        !selectedDatabaseId ||
        !selectedEntity ||
        !editingRow ||
        !rowMutationDescriptor
      ) {
        throw new Error('The selected row is no longer available.');
      }

      const mutation = buildRowUpdateMutation({
        entity: selectedEntity,
        columns: structureState.columns,
        row: editingRow.row,
        descriptor: rowMutationDescriptor,
        nextValues,
      });

      await requestQuery({
        databaseId: selectedDatabaseId,
        sql: mutation.sql,
        params: mutation.params,
      });
      await loadBrowse();
      setEditingRow(null);
    },
    [
      editingRow,
      loadBrowse,
      requestQuery,
      rowMutationDescriptor,
      selectedDatabaseId,
      selectedEntity,
      structureState.columns,
    ],
  );

  const handleDeleteRow = useCallback(async () => {
    if (
      !selectedDatabaseId ||
      !selectedEntity ||
      !deletingRow ||
      !rowMutationDescriptor
    ) {
      throw new Error('The selected row is no longer available.');
    }

    const mutation = buildRowDeleteMutation({
      entity: selectedEntity,
      row: deletingRow.row,
      descriptor: rowMutationDescriptor,
    });

    await requestQuery({
      databaseId: selectedDatabaseId,
      sql: mutation.sql,
      params: mutation.params,
    });
    await loadBrowse();
    setDeletingRow(null);
  }, [
    deletingRow,
    loadBrowse,
    requestQuery,
    rowMutationDescriptor,
    selectedDatabaseId,
    selectedEntity,
  ]);

  const getActiveStatement = useCallback(() => {
    const cursorPosition =
      editorRef.current?.getSelection().start ?? querySelection.start;
    const currentStatement = getStatementAtCursor(queryInput, cursorPosition);
    const start = currentStatement?.start ?? 0;
    const end = currentStatement?.end ?? queryInput.length;

    return {
      sql: normalizeSingleStatementSql(currentStatement?.text ?? queryInput),
      cursorPosition,
      start,
      end,
    };
  }, [queryInput, querySelection.start]);

  const runSingleStatement = useCallback(
    async (
      statement: {
        sql: string;
        cursorPosition: number;
        start: number;
        end: number;
      },
      label: string,
    ) => {
      if (!selectedDatabaseId) {
        return;
      }

      setQueryLoading(true);
      setQueryError(null);
      setQueryErrorLine(null);
      setQueryMessage(`${label}…`);

      try {
        const result = await requestQuery({
          databaseId: selectedDatabaseId,
          sql: statement.sql,
        });
        const execution: SqliteScriptResult = {
          statements: [
            {
              index: 0,
              start: statement.start,
              end: statement.end,
              input: { sql: statement.sql },
              execution: {
                input: { sql: statement.sql },
                result,
              },
            },
          ],
          totalStatementCount: 1,
          failedStatementIndex: null,
        };

        setQueryExecution(execution);
        setSelectedQueryStatementIndex(0);
        setQueryMessage(getResultSummary(result) ?? 'Statement completed.');

        if (isMutatingStatement(result)) {
          await refreshWorkspace();
        }
      } catch (error) {
        const errorMessage = safeError(error);

        setQueryExecution({
          statements: [
            {
              index: 0,
              start: statement.start,
              end: statement.end,
              input: { sql: statement.sql },
              error: errorMessage,
            },
          ],
          totalStatementCount: 1,
          failedStatementIndex: 0,
        });
        setSelectedQueryStatementIndex(0);
        setQueryError(errorMessage);
        setQueryErrorLine(getLineNumberAtPosition(queryInput, statement.start));
        setQueryMessage('Execution failed.');
      } finally {
        setQueryLoading(false);
        editorRef.current?.focus();
      }
    },
    [queryInput, refreshWorkspace, requestQuery, selectedDatabaseId],
  );

  const runScript = useCallback(
    async (sql: string, label: string) => {
      if (!selectedDatabaseId) {
        return;
      }

      setQueryLoading(true);
      setQueryError(null);
      setQueryErrorLine(null);
      setQueryMessage(`${label}…`);

      try {
        const execution = await requestScriptExecution({
          databaseId: selectedDatabaseId,
          sql,
        });
        const failedStatement =
          execution.failedStatementIndex == null
            ? null
            : (execution.statements.find(
                (statement) =>
                  statement.index === execution.failedStatementIndex,
              ) ?? null);

        setQueryExecution(execution);
        setSelectedQueryStatementIndex(
          getDefaultSelectedQueryStatementIndex(execution),
        );

        if (failedStatement?.error) {
          setQueryError(failedStatement.error);
          setQueryErrorLine(
            getLineNumberAtPosition(queryInput, failedStatement.start),
          );
        }

        setQueryMessage(
          getScriptResultSummary(execution) ?? 'Script execution completed.',
        );

        if (hasMutatingStatements(execution)) {
          await refreshWorkspace();
        }
      } catch (error) {
        setQueryExecution(null);
        setSelectedQueryStatementIndex(null);
        setQueryError(safeError(error));
        setQueryErrorLine(
          getLineNumberAtPosition(queryInput, querySelection.start),
        );
        setQueryMessage('Execution failed.');
      } finally {
        setQueryLoading(false);
        editorRef.current?.focus();
      }
    },
    [
      queryInput,
      querySelection.start,
      refreshWorkspace,
      requestScriptExecution,
      selectedDatabaseId,
    ],
  );

  const handleRun = useCallback(async () => {
    await runScript(queryInput, 'Running all statements');
  }, [queryInput, runScript]);

  const handleRunCurrentStatement = useCallback(async () => {
    try {
      await runSingleStatement(
        getActiveStatement(),
        'Running current statement',
      );
    } catch (error) {
      setQueryError(safeError(error));
      setQueryErrorLine(
        getLineNumberAtPosition(queryInput, querySelection.start),
      );
    }
  }, [
    getActiveStatement,
    queryInput,
    querySelection.start,
    runSingleStatement,
  ]);

  const handleSaveQuery = useCallback(() => {
    const fileName = `${slugifyFileName(selectedEntity?.name ?? 'query')}.sql`;
    downloadTextFile(fileName, queryInput);
    setQueryMessage(`Saved ${fileName}.`);
  }, [queryInput, selectedEntity?.name]);

  const handleExportResults = useCallback(async () => {
    const csv = buildCsv(activeQueryResult);
    if (!csv) {
      return;
    }

    const fileName = `${slugifyFileName(selectedEntity?.name ?? 'query-results')}.csv`;
    downloadTextFile(fileName, csv);
    setQueryMessage(`Exported ${fileName}.`);
  }, [activeQueryResult, selectedEntity?.name]);

  const handleCopyResults = useCallback(async () => {
    if (!activeQueryResult) {
      return;
    }

    await copyToClipboard(JSON.stringify(activeQueryResult.rows, null, 2));
    setQueryMessage('Copied result rows as JSON.');
  }, [activeQueryResult]);

  const handleCopyError = useCallback(async () => {
    if (!queryError) {
      return;
    }

    await copyToClipboard(queryError);
    setQueryMessage('Copied SQL error.');
  }, [queryError]);

  const handleFormatQuery = useCallback(() => {
    try {
      const formatted = formatSqlScript(queryInput);
      setQueryInput(formatted);
      setQueryError(null);
      setQueryErrorLine(null);
      setQueryMessage(
        formatted ? 'Formatted query.' : 'Cleared query formatting.',
      );
    } catch (error) {
      setQueryError(safeError(error));
      setQueryErrorLine(null);
      setQueryMessage('Formatting failed.');
    }
  }, [queryInput]);

  const ensureQueryEntityColumns = useCallback(
    async (schemaName: string, entityName: string) => {
      if (!selectedDatabaseId) {
        return [];
      }

      const cachedColumns = getSqlEditorCachedColumns(
        queryColumnCache,
        selectedDatabaseId,
        schemaName,
        entityName,
      );
      if (cachedColumns) {
        return cachedColumns;
      }

      const result = await requestQuery({
        databaseId: selectedDatabaseId,
        sql: buildTableXInfoSql(schemaName, entityName),
      });
      const columns = parseColumns(result);

      setQueryColumnCache((current) =>
        setSqlEditorCachedColumns(
          current,
          selectedDatabaseId,
          schemaName,
          entityName,
          columns,
        ),
      );

      return columns;
    },
    [queryColumnCache, requestQuery, selectedDatabaseId],
  );

  const editorCompletionSource = useCallback<CompletionSource>(
    async (context) => {
      const request = getSqlEditorColumnCompletionRequest(
        context.state.doc.toString(),
        context.pos,
      );
      if (!request) {
        return null;
      }

      const aliases = extractSqlEditorAliases(
        context.state.doc.sliceString(0, context.pos),
      );
      const entity = resolveSqlEditorEntityReference({
        aliases,
        entities,
        request,
        selectedSchemaName:
          selectedEntity?.schemaName ?? defaultCompletionSchemaName ?? null,
      });
      if (!entity) {
        return null;
      }

      const columns = await ensureQueryEntityColumns(
        entity.schemaName,
        entity.name,
      );
      if (context.aborted || columns.length === 0) {
        return null;
      }

      return {
        from: request.from,
        options: createSqlColumnCompletions(columns),
        to: request.to,
        validFor: /^[A-Za-z_][\w$]*$/,
      };
    },
    [
      defaultCompletionSchemaName,
      ensureQueryEntityColumns,
      entities,
      selectedEntity?.schemaName,
    ],
  );

  const handleSidebarResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const container = sidebarRef.current;
      if (!container) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);

      const startX = event.clientX;
      const startWidth = sidebarWidth;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = Math.min(
          MAX_SIDEBAR_WIDTH,
          Math.max(MIN_SIDEBAR_WIDTH, startWidth + moveEvent.clientX - startX),
        );
        setSidebarWidth(nextWidth);
      };

      const handlePointerUp = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [sidebarWidth],
  );

  const handleQuerySplitResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const container = querySplitRef.current;
      if (!container) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);

      const rect = container.getBoundingClientRect();
      const totalHeight = rect.height;
      const startHeight = (editorSplit / 100) * totalHeight;
      const startY = event.clientY;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;

      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextHeight = startHeight + moveEvent.clientY - startY;
        const boundedHeight = Math.max(
          MIN_EDITOR_HEIGHT,
          Math.min(totalHeight - MIN_RESULTS_HEIGHT, nextHeight),
        );
        setEditorSplit((boundedHeight / totalHeight) * 100);
      };

      const handlePointerUp = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [editorSplit],
  );

  useEffect(() => {
    void refreshExplorerData();
  }, [refreshExplorerData]);

  useEffect(() => {
    if (
      !selectedDatabaseId ||
      selectedExplorerState.loading ||
      !selectedExplorerState.loaded
    ) {
      return;
    }

    setSelectedEntityKey((current) => {
      if (
        current &&
        selectedExplorerState.entities.some(
          (entity) =>
            getEntityKey(selectedDatabaseId, entity.schemaName, entity.name) ===
            current,
        )
      ) {
        return current;
      }

      const fallbackEntity = selectedExplorerState.entities[0];
      return fallbackEntity
        ? getEntityKey(
            selectedDatabaseId,
            fallbackEntity.schemaName,
            fallbackEntity.name,
          )
        : null;
    });
  }, [
    selectedDatabaseId,
    selectedExplorerState.entities,
    selectedExplorerState.loaded,
    selectedExplorerState.loading,
  ]);

  useEffect(() => {
    if (!selectedEntityKey) {
      setBrowseOffset(0);
      setBrowseResult(null);
      setEntityRowCount(null);
      setEditingRow(null);
      setDeletingRow(null);
      setStructureState({
        columns: [],
        foreignKeys: [],
        indexes: [],
      });
      return;
    }

    setBrowseOffset(0);
    setEditingRow(null);
    setDeletingRow(null);
    void loadStructure();
  }, [loadStructure, selectedEntityKey]);

  useEffect(() => {
    if (!selectedEntityKey) {
      return;
    }

    void loadBrowse();
  }, [loadBrowse, selectedEntityKey]);

  useEffect(() => {
    setQueryColumnCache((current) =>
      syncSqlEditorColumnCacheDatabase(current, selectedDatabaseId),
    );
  }, [selectedDatabaseId]);

  useEffect(() => {
    if (
      !selectedDatabaseId ||
      !selectedEntity ||
      structureLoading ||
      structureError
    ) {
      return;
    }

    setQueryColumnCache((current) =>
      setSqlEditorCachedColumns(
        current,
        selectedDatabaseId,
        selectedEntity.schemaName,
        selectedEntity.name,
        structureState.columns,
      ),
    );
  }, [
    selectedDatabaseId,
    selectedEntity,
    structureError,
    structureLoading,
    structureState.columns,
  ]);

  useEffect(() => {
    if (!selectedEntity) {
      return;
    }

    setQueryInput((current) =>
      current.trim() === '' || current.trim() === DEFAULT_QUERY
        ? buildGeneratedSelect(selectedEntity, queryRowLimit)
        : current,
    );
  }, [queryRowLimit, selectedEntity]);

  useEffect(() => {
    if (!selectedDatabaseId) {
      setQueryExecution(null);
      setSelectedQueryStatementIndex(null);
      setQueryError(null);
      setQueryErrorLine(null);
      setBrowseResult(null);
      setBrowseError(null);
      setStructureError(null);
      return;
    }
  }, [selectedDatabaseId]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        objectSearchRef.current?.focus();
      }

      if (
        activeTab === 'query' &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 's'
      ) {
        event.preventDefault();
        handleSaveQuery();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, handleSaveQuery]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const readySubscription = client.onMessage('sqlite:ready', () => {
      void refreshExplorerData();
    });

    return () => readySubscription.remove();
  }, [client, refreshExplorerData]);

  const queryStatementOptions = useMemo(
    () =>
      (queryExecution?.statements ?? []).map((statement) => ({
        id: String(statement.index),
        label: getStatementSelectorLabel(statement),
      })),
    [queryExecution],
  );
  const queryLimitOptions = useMemo<SelectOption[]>(
    () => [25, 50, 100, 250, 500].map((value) => ({
      id: String(value),
      label: String(value),
    })),
    [],
  );
  const pageSizeOptions = useMemo<SelectOption[]>(
    () => [25, 50, 100].map((value) => ({
      id: String(value),
      label: String(value),
    })),
    [],
  );

  const queryTabHeader = (
    <div className={QUERY_SECTION_HEADER_CLASS_NAME}>
      <div className="flex items-center gap-2">
        <Button
          aria-label="Run all statements"
          isDisabled={!selectedDatabaseId || queryLoading || !queryInput.trim()}
          isIconOnly
          onPress={() => void handleRun()}
          size="sm"
          variant="primary"
        >
          <Play aria-hidden="true" className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          aria-label="Format SQL"
          isDisabled={!queryInput.trim()}
          isIconOnly
          onPress={handleFormatQuery}
          size="sm"
          variant="secondary"
        >
          <Wand2 aria-hidden="true" className="size-4" />
        </Button>
        <Button
          aria-label="Save query"
          isDisabled={!queryInput.trim()}
          isIconOnly
          onPress={handleSaveQuery}
          size="sm"
          variant="secondary"
        >
          <Download aria-hidden="true" className="size-4" />
        </Button>
        <Button
          aria-label="Clear query"
          isDisabled={!queryInput && !queryExecution && !queryError}
          isIconOnly
          onPress={() => {
            setQueryInput('');
            setQueryExecution(null);
            setSelectedQueryStatementIndex(null);
            setQueryError(null);
            setQueryErrorLine(null);
            setQueryMessage('Cleared the query editor.');
            queueMicrotask(() => editorRef.current?.focus());
          }}
          size="sm"
          variant="ghost"
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  );

  const queryPane = !selectedDatabase ? (
    renderEmptyState(
      'Select A Database',
      'Choose a database in the sidebar to run SQL.',
      'database',
    )
  ) : (
    <section
      ref={querySplitRef}
      className={joinClassNames(CONTENT_PANEL_CLASS_NAME, 'min-h-[32rem]')}
    >
      <section
        className={QUERY_SECTION_CLASS_NAME}
        style={{ flex: `0 0 ${editorSplit}%` }}
      >
        {queryTabHeader}
        <div className="flex min-h-0 min-w-0 flex-1 border-t border-border/60 bg-background">
          <SqlEditor
            ref={editorRef}
            ariaLabel="SQL query editor"
            completionSchema={editorCompletionSchema}
            completionSource={editorCompletionSource}
            defaultSchema={
              selectedEntity?.schemaName ?? defaultCompletionSchemaName
            }
            defaultTable={
              cachedSelectedEntityColumns.length > 0
                ? selectedEntity?.name
                : undefined
            }
            errorLine={queryErrorLine}
            onFormat={handleFormatQuery}
            onRun={() => void handleRun()}
            onRunCurrent={() => void handleRunCurrentStatement()}
            onSave={handleSaveQuery}
            onSelectionChange={setQuerySelection}
            onValueChange={setQueryInput}
            placeholderText={
              'Write SQL here…\nPress Cmd/Ctrl + Enter to run all statements.\nPress Shift + Cmd/Ctrl + Enter to run the current statement.\nUse autocomplete for tables and columns.'
            }
            value={queryInput}
          />
        </div>
      </section>

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize query editor and results"
        className="relative h-3 shrink-0 cursor-row-resize border-t border-border/40 bg-surface-secondary/20 before:absolute before:left-1/2 before:top-1/2 before:h-0.5 before:w-10 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-border/60 before:content-['']"
        onPointerDown={handleQuerySplitResizeStart}
      />

      <section
        className={joinClassNames(
          QUERY_SECTION_CLASS_NAME,
          'min-h-0 flex-1',
        )}
      >
        <div className={QUERY_SECTION_HEADER_CLASS_NAME}>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            {!queryExecution ? (
              <p className="truncate text-sm text-muted">
                Run SQL to inspect per-statement results.
              </p>
            ) : null}

            {queryExecution && queryExecution.statements.length > 1 ? (
              <div className="min-w-0 flex-1 basis-[22rem]">
                <SharedSelect
                  ariaLabel="Selected query statement result"
                  className="w-full"
                  onChange={(value) => {
                    setSelectedQueryStatementIndex(
                      value == null ? null : Number(value),
                    );
                  }}
                  options={queryStatementOptions}
                  value={selectedQueryStatementValue}
                />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
                Row Limit
              </span>
              <SharedSelect
                ariaLabel="Default query row limit"
                className="w-24"
                onChange={(value) => {
                  if (value != null) {
                    setQueryRowLimit(Number(value));
                  }
                }}
                options={queryLimitOptions}
                value={String(queryRowLimit)}
              />
            </div>
            <Button
              aria-label="Copy results"
              isDisabled={!activeQueryResult}
              isIconOnly
              onPress={() => void handleCopyResults()}
              size="sm"
              variant="secondary"
            >
              <Copy aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-label="Export results"
              isDisabled={!activeQueryResult}
              isIconOnly
              onPress={() => void handleExportResults()}
              size="sm"
              variant="secondary"
            >
              <Download aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>

        {queryError ? (
          <InlineError
            action={
              <Button onPress={() => void handleCopyError()} size="sm" variant="ghost">
                <Copy aria-hidden="true" className="size-4" />
                Copy Error
              </Button>
            }
            message={
              <>
                {queryError}
                {queryErrorLine ? (
                  <span className="mt-1 block text-xs text-danger">
                    Approximate location: line {formatNumber(queryErrorLine)}
                  </span>
                ) : null}
              </>
            }
            title={
              (queryExecution?.totalStatementCount ?? queryStatements.length) > 1
                ? 'Script Error'
                : 'SQL Error'
            }
          />
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          <QueryResultTable
            tableId={queryTableId}
            result={activeQueryResult}
            columnOrder={queryColumnOrder}
            onColumnOrderChange={(nextColumnOrder) =>
              setTableColumnOrder(
                queryTableId,
                queryColumnIds,
                nextColumnOrder,
                [SQLITE_ROW_NUMBER_COLUMN_ID],
              )
            }
            loading={queryLoading}
            showMetadata={false}
            shellClassName="h-full min-h-0"
            scrollContainerClassName="min-h-0 p-0"
            emptyTitle={
              selectedQueryStatement?.error ? 'Statement Failed' : 'No Results'
            }
            emptyDescription={
              selectedQueryStatement?.error
                ? 'Select another statement to inspect its rows, or fix the error and run again.'
                : 'Run SQL to see rows here.'
            }
          />
        </div>
      </section>
    </section>
  );

  const dataRowActions = canMutateRows
    ? {
        columnId: SQLITE_ROW_ACTIONS_COLUMN_ID,
        header: 'Actions',
        cell: (row: Record<string, unknown>, rowIndex: number) => {
          const rowNumber = browseOffset + rowIndex + 1;

          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                aria-label={`Edit row ${rowNumber}`}
                isDisabled={editableColumns.length === 0}
                isIconOnly
                onClick={(event) => event.stopPropagation()}
                onPress={() => {
                  setDeletingRow(null);
                  setEditingRow({
                    row,
                    rowIndex,
                  });
                }}
                size="sm"
                variant="ghost"
              >
                <Pencil aria-hidden="true" className="size-4" />
              </Button>
              <Button
                aria-label={`Delete row ${rowNumber}`}
                isIconOnly
                onClick={(event) => event.stopPropagation()}
                onPress={() => {
                  setEditingRow(null);
                  setDeletingRow({
                    row,
                    rowIndex,
                  });
                }}
                size="sm"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" className="size-4 text-danger" />
              </Button>
            </div>
          );
        },
      }
    : undefined;

  const dataPane = !selectedDatabase ? (
    renderEmptyState(
      'Select A Database',
      'Choose a database in the sidebar to browse rows.',
      'database',
    )
  ) : !selectedEntity ? (
    renderEmptyState(
      'Select A Table',
      'Choose a table in the sidebar to view its rows.',
      'table',
    )
  ) : (
    <div className={joinClassNames(CONTENT_PANEL_CLASS_NAME, 'h-full')}>
      <header className="border-b border-border/60 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <SearchField
              className="w-full max-w-xl"
              fullWidth
              name="dataSearch"
              onChange={setDataSearch}
              value={dataSearch}
            >
              <SearchField.Group className="w-full min-w-0">
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Filter visible rows…" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </div>

          <Button
            aria-label="Refresh data"
            isDisabled={browseLoading || !isQueryableEntity(selectedEntity)}
            isIconOnly
            onPress={() => void loadBrowse()}
            size="sm"
            variant="secondary"
          >
            <RefreshCw
              aria-hidden="true"
              className={joinClassNames(
                'size-4',
                browseLoading && 'animate-spin',
              )}
            />
          </Button>
        </div>

        {dataSearch.trim() ? (
          <div className="mt-3 border-t border-border/60 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-muted">
                Filter: contains
              </span>
              <Button
                onPress={() => setDataSearch('')}
                size="sm"
                variant="ghost"
              >
                Clear
                <X aria-hidden="true" className="size-4" />
              </Button>
            </div>
            <Surface
              className="mt-2 min-w-0 break-words rounded-xl border border-border/70 px-3 py-2 text-sm text-foreground"
              variant="secondary"
            >
              {dataSearch}
            </Surface>
          </div>
        ) : null}
      </header>

      {browseError ? (
        <InlineError message={browseError} title="Data Load Failed" />
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <QueryResultTable
          tableId={dataTableId}
          result={filteredBrowseResult}
          columnOrder={dataColumnOrder}
          onColumnOrderChange={(nextColumnOrder) =>
            setTableColumnOrder(dataTableId, dataColumnIds, nextColumnOrder, [
              SQLITE_ROW_NUMBER_COLUMN_ID,
            ])
          }
          loading={browseLoading}
          showMetadata={false}
          shellClassName="h-full min-h-0"
          scrollContainerClassName="min-h-0 p-0"
          emptyTitle={
            selectedEntity ? 'No Rows On This Page' : 'No Table Selected'
          }
          emptyDescription={
            selectedEntity
              ? 'This page does not contain rows.'
              : 'Select a table in the sidebar to view its data.'
          }
          rowNumberOffset={browseOffset}
          columnMeta={structureColumnMeta}
          hiddenColumnIds={[SQLITE_HIDDEN_ROWID_COLUMN_ID]}
          rowActions={dataRowActions}
        />
      </div>

      <footer
        className={joinClassNames(
          PANEL_HEADER_CLASS_NAME,
          'border-b-0 border-t',
        )}
      >
        <div className="flex min-w-0 flex-wrap gap-2">
          <InlineStat>
            Page {currentDataPage > 0 ? currentDataPage : '—'}
          </InlineStat>
          <InlineStat>
            Rows{' '}
            {dataPageStart > 0
              ? `${formatNumber(dataPageStart)}–${formatNumber(dataPageEnd)}`
              : '—'}
          </InlineStat>
          <InlineStat>
            Total {formatNumber(entityRowCount)}
          </InlineStat>
          <InlineStat>
            Visible {formatNumber(filteredBrowseRows.length)}
          </InlineStat>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
              Page Size
            </span>
            <SharedSelect
              ariaLabel="Data page size"
              className="w-24"
              onChange={(value) => {
                if (value != null) {
                  setBrowsePageSize(Number(value));
                  setBrowseOffset(0);
                }
              }}
              options={pageSizeOptions}
              value={String(browsePageSize)}
            />
          </div>
          <Button
            isDisabled={browseLoading || !canBrowseBackward}
            onPress={() =>
              setBrowseOffset((current) => Math.max(0, current - browsePageSize))
            }
            size="sm"
            variant="secondary"
          >
            Previous
          </Button>
          <Button
            isDisabled={browseLoading || !canBrowseForward}
            onPress={() =>
              setBrowseOffset((current) => current + browsePageSize)
            }
            size="sm"
            variant="secondary"
          >
            Next
          </Button>
          <InlineStat>
            {totalDataPages > 0 ? `${currentDataPage}/${totalDataPages}` : '0/0'}
          </InlineStat>
        </div>
      </footer>
    </div>
  );

  const structurePane = !selectedDatabase ? (
    renderEmptyState(
      'Select A Database',
      'Choose a database in the sidebar to inspect schema metadata.',
      'database',
    )
  ) : !selectedEntity ? (
    renderEmptyState(
      'Select A Table',
      'Choose a table or view in the sidebar to inspect it.',
      'structure',
    )
  ) : (
    <div className={joinClassNames(CONTENT_PANEL_CLASS_NAME, 'h-full')}>
      <header className={PANEL_HEADER_CLASS_NAME}>
        <div className="min-w-0 flex-1">
          <Tabs.Root
            className="min-w-0"
            onSelectionChange={(key) =>
              setStructureSection(String(key) as StructureSection)
            }
            selectedKey={structureSection}
          >
            <Tabs.ListContainer className="overflow-x-auto">
              <Tabs.List
                aria-label="Structure sections"
                className="w-fit min-w-max justify-start"
              >
                {(
                  [
                    ['columns', 'Columns'],
                    ['keys', 'Keys'],
                    ['indexes', 'Indexes'],
                  ] as Array<[StructureSection, string]>
                ).map(([key, label]) => (
                  <Tabs.Tab
                    className="w-auto shrink-0 whitespace-nowrap"
                    id={key}
                    key={key}
                  >
                    {label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs.Root>
        </div>

        <Button
          aria-label="Refresh structure"
          isDisabled={structureLoading}
          isIconOnly
          onPress={() => void loadStructure()}
          size="sm"
          variant="secondary"
        >
          <RefreshCw
            aria-hidden="true"
            className={joinClassNames(
              'size-4',
              structureLoading && 'animate-spin',
            )}
          />
        </Button>
      </header>

      {structureError ? (
        <InlineError message={structureError} title="Structure Load Failed" />
      ) : null}

      {structureSection === 'columns' ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          <SqliteDataTable
            tableId={structureColumnsTableId}
            data={structureColumnRows}
            columns={structureColumnsTableColumns}
            columnOrder={structureColumnsColumnOrder}
            onColumnOrderChange={(nextColumnOrder) =>
              setTableColumnOrder(
                structureColumnsTableId,
                structureColumnsColumnIds,
                nextColumnOrder,
              )
            }
            loading={structureLoading}
            emptyTitle="No Columns Found"
            emptyDescription="This table or view does not expose columns."
            shellClassName="p-0"
            scrollContainerClassName="p-0"
          />
        </div>
      ) : null}

      {structureSection === 'keys' ? (
        <div className="min-h-0 flex-1 overflow-auto bg-background p-4">
        {structureLoading ? (
          <div aria-live="polite" className="grid gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className={STRUCTURE_SKELETON_ROW_CLASS_NAME} />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <Card.Header>
                <Card.Title>Primary Key</Card.Title>
              </Card.Header>
              <Card.Content>
                {primaryKeyColumns.length === 0 ? (
                  <p className="text-sm text-muted">No primary key defined.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {primaryKeyColumns
                      .sort(
                        (left, right) =>
                          left.primaryKeyOrder - right.primaryKeyOrder,
                      )
                      .map((column) => (
                        <Chip
                          key={column.name}
                          size="sm"
                          variant="soft"
                        >
                          <KeyRound aria-hidden="true" className="size-3.5" />
                          {column.name}
                        </Chip>
                      ))}
                  </div>
                )}
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <Card.Title>Foreign Keys</Card.Title>
              </Card.Header>
              <Card.Content>
                {structureState.foreignKeys.length === 0 ? (
                  <p className="text-sm text-muted">No foreign keys defined.</p>
                ) : (
                  <div className="space-y-3">
                    {structureState.foreignKeys.map((foreignKey) => (
                      <Surface
                        key={`${foreignKey.id}-${foreignKey.seq}`}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/70 px-4 py-3"
                        variant="secondary"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {foreignKey.from} → {foreignKey.table}
                            {foreignKey.to ? `.${foreignKey.to}` : ''}
                          </p>
                          <p className="mt-1 text-sm text-muted">
                            Update {foreignKey.onUpdate} · Delete{' '}
                            {foreignKey.onDelete}
                          </p>
                        </div>
                        <Chip size="sm" variant="soft">
                          Match {foreignKey.match}
                        </Chip>
                      </Surface>
                    ))}
                  </div>
                )}
              </Card.Content>
            </Card>
          </div>
        )}
        </div>
      ) : null}

      {structureSection === 'indexes' ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          <SqliteDataTable
            tableId={structureIndexesTableId}
            data={structureIndexRows}
            columns={structureIndexesTableColumns}
            columnOrder={structureIndexesColumnOrder}
            onColumnOrderChange={(nextColumnOrder) =>
              setTableColumnOrder(
                structureIndexesTableId,
                structureIndexesColumnIds,
                nextColumnOrder,
              )
            }
            loading={structureLoading}
            emptyTitle="No Indexes Defined"
            emptyDescription="This table or view does not define indexes."
            shellClassName="p-0"
            scrollContainerClassName="p-0"
          />
        </div>
      ) : null}
    </div>
  );

  const headerSubtitle = selectedDatabase
    ? selectedEntity
      ? `${selectedDatabase.name} · ${selectedEntity.schemaName}.${selectedEntity.name}`
      : selectedDatabase.name
    : 'Query, browse, and edit SQLite data.';
  const sidebarStyle = {
    '--sqlite-sidebar-width': `${sidebarWidth}px`,
  } as CSSProperties;

  return (
    <PluginTheme
      className="flex h-screen flex-col bg-background text-foreground"
      defaultTheme="dark"
    >
      <a
        href="#sqlite-main-content"
        className="absolute left-4 top-[-3rem] z-50 rounded-full border border-border/80 bg-surface px-4 py-2.5 text-foreground opacity-0 transition-[top,opacity] duration-150 ease-out focus-visible:top-4 focus-visible:opacity-100"
      >
        Skip To Workspace
      </a>

      <PluginHeader
        subtitle={headerSubtitle}
        title="SQLite"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Chip className="shrink-0" size="sm" variant="secondary">
              {formatNumber(databases.length)}{' '}
              {databases.length === 1 ? 'database' : 'databases'}
            </Chip>
            {selectedDatabase ? (
              <Chip className="max-w-56 truncate" color="accent" size="sm" variant="soft">
                {selectedDatabase.name}
              </Chip>
            ) : null}
            <Button
              aria-label="Refresh SQLite explorer"
              isDisabled={databaseLoading || entityLoading}
              isIconOnly
              onPress={() => void refreshWorkspace()}
              size="sm"
              variant="secondary"
            >
              <RefreshCw
                aria-hidden="true"
                className={joinClassNames(
                  'size-4',
                  (databaseLoading || entityLoading) && 'animate-spin',
                )}
              />
            </Button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 lg:flex-row">
        <aside
          ref={sidebarRef}
          className="flex h-[min(28rem,42vh)] min-h-0 w-full min-w-0 max-w-none lg:h-full lg:min-w-72 lg:w-[var(--sqlite-sidebar-width)] lg:max-w-[min(28rem,48vw)]"
          style={sidebarStyle}
        >
          <section className={PANEL_CLASS_NAME}>
            <header className={PANEL_SECTION_HEADER_CLASS_NAME}>
              <h2 className="text-sm font-semibold text-foreground">Databases</h2>
              <InlineStat>
                {formatNumber(databases.length)}
              </InlineStat>
            </header>

            <div className="px-3 pb-2 pt-1">
              <SearchField
                className="w-full min-w-0"
                fullWidth
                name="sidebarFilter"
                onChange={setObjectSearch}
                value={objectSearch}
              >
                <SearchField.Group className="w-full min-w-0">
                  <SearchField.SearchIcon />
                  <SearchField.Input
                    className="min-w-0"
                    placeholder="Filter explorer items…"
                    ref={objectSearchRef}
                  />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3">
              {databaseLoading && databases.length === 0 ? (
                <div aria-live="polite" className="grid gap-3">
                  {Array.from({ length: 6 }, (_, index) => (
                    <div key={index} className={SKELETON_ROW_CLASS_NAME} />
                  ))}
                </div>
              ) : databases.length === 0 ? (
                renderEmptyState(
                  databaseError
                    ? 'Could Not Load Databases'
                    : 'No Databases Found',
                  databaseError ??
                    'Expose a SQLite adapter in your app, then refresh to inspect it here.',
                  'database',
                )
              ) : (
                <div className={TREE_STACK_CLASS_NAME}>
                  {databases.map((database) => {
                    const isExpanded = expandedDatabaseIds.includes(
                      database.id,
                    );
                    const databaseExplorerState =
                      explorerStateByDatabase[database.id] ??
                      DEFAULT_EXPLORER_STATE;
                    const databaseExplorerGroups = buildExplorerGroups(
                      databaseExplorerState.schemas,
                      databaseExplorerState.entities,
                      objectSearch,
                    );

                    return (
                      <div key={database.id} className={TREE_GROUP_CLASS_NAME}>
                        <button
                          type="button"
                          className={TREE_BUTTON_CLASS_NAME}
                          onClick={() => {
                            setSelectedDatabaseId(database.id);
                            setExpandedDatabaseIds((current) =>
                              current.includes(database.id)
                                ? current.filter((id) => id !== database.id)
                                : [...current, database.id],
                            );
                          }}
                          onDoubleClick={() => {
                            setSelectedDatabaseId(database.id);
                            setActiveTab('query');
                          }}
                        >
                          {isExpanded ? (
                            <ChevronDown
                              aria-hidden="true"
                              className="h-4 w-4 shrink-0"
                            />
                          ) : (
                            <ChevronRight
                              aria-hidden="true"
                              className="h-4 w-4 shrink-0"
                            />
                          )}
                          <Database
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0"
                          />
                          <span className="min-w-0 truncate font-medium">
                            {database.name}
                          </span>
                        </button>

                        {isExpanded ? (
                          <div className="grid min-w-0 gap-2 pl-2">
                            {databaseExplorerState.loading ||
                            !databaseExplorerState.loaded ? (
                              <div
                                aria-live="polite"
                                className="grid gap-3"
                              >
                                {Array.from({ length: 4 }, (_, index) => (
                                  <div
                                    key={index}
                                    className={SKELETON_ROW_CLASS_NAME}
                                  />
                                ))}
                              </div>
                            ) : databaseExplorerState.error ? (
                              <InlineError
                                className="mx-0 mt-0"
                                message={databaseExplorerState.error}
                                title="Explorer Load Failed"
                              />
                            ) : databaseExplorerGroups.length === 0 ? (
                              <Surface
                                className="rounded-xl border border-dashed border-border/70 px-3 py-3 text-xs uppercase tracking-[0.16em] text-muted"
                                variant="secondary"
                              >
                                No objects match this filter.
                              </Surface>
                            ) : (
                              databaseExplorerGroups.map(
                                ({ schema, tables, views }) => {
                                  const schemaKey = getSchemaKey(
                                    database.id,
                                    schema.name,
                                  );
                                  const isSchemaExpanded =
                                    expandedSchemaKeys.includes(schemaKey);

                                  return (
                                    <div
                                      key={`${database.id}-${schema.name}`}
                                      className={TREE_GROUP_CLASS_NAME}
                                    >
                                      <button
                                        type="button"
                                        className={TREE_BUTTON_CLASS_NAME}
                                        onClick={() => {
                                          setExpandedSchemaKeys((current) =>
                                            current.includes(schemaKey)
                                              ? current.filter(
                                                  (value) =>
                                                    value !== schemaKey,
                                                )
                                              : [...current, schemaKey],
                                          );
                                        }}
                                      >
                                        {isSchemaExpanded ? (
                                          <ChevronDown
                                            aria-hidden="true"
                                            className="h-4 w-4"
                                          />
                                        ) : (
                                          <ChevronRight
                                            aria-hidden="true"
                                            className="h-4 w-4"
                                          />
                                        )}
                                        <FolderTree
                                          aria-hidden="true"
                                          className="h-4 w-4"
                                        />
                                        <span className="min-w-0 flex-1 truncate">
                                          {schema.name}
                                        </span>
                                      </button>

                                      {isSchemaExpanded ? (
                                        <div className="grid min-w-0 gap-3 border-l border-border/70 pl-3">
                                          {tables.length > 0 ? (
                                            <div className={TREE_GROUP_CLASS_NAME}>
                                              <p className={TREE_SECTION_TITLE_CLASS_NAME}>
                                                Tables
                                              </p>
                                              <div className={TREE_STACK_CLASS_NAME}>
                                                {tables.map((entity) => {
                                                  const isSelected =
                                                    getEntityKey(
                                                      database.id,
                                                      entity.schemaName,
                                                      entity.name,
                                                    ) === selectedEntityKey;

                                                  return (
                                                    <button
                                                      key={`${database.id}-${entity.schemaName}-${entity.name}`}
                                                      type="button"
                                                      className={joinClassNames(
                                                        TREE_BUTTON_CLASS_NAME,
                                                        isSelected &&
                                                          TREE_ACTIVE_BUTTON_CLASS_NAME,
                                                      )}
                                                      onClick={() => {
                                                        setEntitySelection(
                                                          database.id,
                                                          entity,
                                                        );
                                                        setActiveTab('data');
                                                      }}
                                                    >
                                                      <Table2
                                                        aria-hidden="true"
                                                        className="h-4 w-4 shrink-0"
                                                      />
                                                      <span className="min-w-0 flex-1 truncate text-left">
                                                        {entity.name}
                                                      </span>
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          ) : null}

                                          {views.length > 0 ? (
                                            <div className={TREE_GROUP_CLASS_NAME}>
                                              <p className={TREE_SECTION_TITLE_CLASS_NAME}>
                                                Views
                                              </p>
                                              <div className={TREE_STACK_CLASS_NAME}>
                                                {views.map((entity) => {
                                                  const isSelected =
                                                    getEntityKey(
                                                      database.id,
                                                      entity.schemaName,
                                                      entity.name,
                                                    ) === selectedEntityKey;

                                                  return (
                                                    <button
                                                      key={`${database.id}-${entity.schemaName}-${entity.name}`}
                                                      type="button"
                                                      className={joinClassNames(
                                                        TREE_BUTTON_CLASS_NAME,
                                                        isSelected &&
                                                          TREE_ACTIVE_BUTTON_CLASS_NAME,
                                                      )}
                                                      onClick={() => {
                                                        setEntitySelection(
                                                          database.id,
                                                          entity,
                                                        );
                                                        setActiveTab(
                                                          'structure',
                                                        );
                                                      }}
                                                    >
                                                      <FileCode2
                                                        aria-hidden="true"
                                                        className="h-4 w-4 shrink-0"
                                                      />
                                                      <span className="min-w-0 flex-1 truncate text-left">
                                                        {entity.name}
                                                      </span>
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                },
                              )
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize database explorer"
            className="relative hidden w-2 shrink-0 cursor-col-resize lg:block before:absolute before:left-1/2 before:top-1/2 before:h-16 before:w-0.5 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-border before:content-[''] hover:before:bg-muted/70"
            onPointerDown={handleSidebarResizeStart}
          />
        </aside>

        <main id="sqlite-main-content" className="flex min-h-0 min-w-0 flex-1">
          <div className={WORKSPACE_PANEL_CLASS_NAME}>
            <div className="px-3 pt-3">
              <Tabs.Root
                className="shrink-0"
                onSelectionChange={(key) => setActiveTab(String(key) as ActiveTab)}
                selectedKey={activeTab}
              >
                <Tabs.ListContainer className="overflow-x-auto px-1">
                  <Tabs.List
                    aria-label="Workspace tabs"
                    className="w-fit min-w-max justify-start"
                  >
                    {(
                      [
                        ['query', 'Query'],
                        ['data', 'Data'],
                        ['structure', 'Structure'],
                      ] as Array<[ActiveTab, string]>
                    ).map(([tab, label]) => (
                      <Tabs.Tab
                        className="w-auto shrink-0 whitespace-nowrap"
                        id={tab}
                        key={tab}
                      >
                        {label}
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>
              </Tabs.Root>
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 px-3 pb-3 pt-2">
              {activeTab === 'query'
                ? queryPane
                : activeTab === 'data'
                  ? dataPane
                  : structurePane}
            </div>
          </div>
        </main>
      </div>

      <SqliteRowEditModal
        isOpen={!!editingRow && !!selectedEntity}
        rowNumber={browseOffset + (editingRow?.rowIndex ?? 0) + 1}
        entityName={selectedEntity?.name ?? 'row'}
        row={editingRow?.row ?? null}
        columns={structureState.columns}
        onClose={() => setEditingRow(null)}
        onSave={handleSaveRow}
      />

      <SqliteRowDeleteModal
        isOpen={!!deletingRow && !!selectedEntity}
        rowNumber={browseOffset + (deletingRow?.rowIndex ?? 0) + 1}
        entityName={selectedEntity?.name ?? 'row'}
        onClose={() => setDeletingRow(null)}
        onDelete={handleDeleteRow}
      />
    </PluginTheme>
  );
}
