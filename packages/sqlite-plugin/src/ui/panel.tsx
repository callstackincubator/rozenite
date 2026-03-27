import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type { CompletionSource } from '@codemirror/autocomplete';
import type { ColumnDef, Updater } from '@tanstack/react-table';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
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
  Search,
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
import {
  getResultSummary,
  getScriptResultSummary,
} from './value-utils';
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

const toneButtonClassName =
  'sqlite-button inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium';

const secondaryButtonClassName = `${toneButtonClassName} sqlite-button-secondary`;
const ghostButtonClassName = `${toneButtonClassName} sqlite-button-ghost`;
const iconButtonClassName =
  'sqlite-icon-button inline-flex h-10 w-10 items-center justify-center rounded-xl';
const primaryIconButtonClassName = `${iconButtonClassName} sqlite-button-primary`;
const secondaryIconButtonClassName = `${iconButtonClassName} sqlite-button-secondary`;
const ghostIconButtonClassName = `${iconButtonClassName} sqlite-button-ghost`;

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
    <div className="sqlite-empty-state">
      <div className="sqlite-empty-state-icon">
        <Icon aria-hidden="true" className="h-6 w-6" />
      </div>
      <div className="max-w-md space-y-2 text-center">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </div>
  );
};

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
  const [editorSplit, setEditorSplit] = useState(50);
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

  const selectedQueryStatementValue = selectedQueryStatement?.index ?? '';

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
      if (!selectedDatabaseId || !selectedEntity || !editingRow || !rowMutationDescriptor) {
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
    if (!selectedDatabaseId || !selectedEntity || !deletingRow || !rowMutationDescriptor) {
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

  const queryTabHeader = (
    <div className="sqlite-subtoolbar">
      <div className="sqlite-subtoolbar-group">
        <button
          type="button"
          className={primaryIconButtonClassName}
          onClick={() => void handleRun()}
          disabled={!selectedDatabaseId || queryLoading || !queryInput.trim()}
          aria-label="Run all statements"
          title="Run all statements"
        >
          <Play aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div className="sqlite-subtoolbar-group">
        <button
          type="button"
          className={secondaryIconButtonClassName}
          onClick={handleFormatQuery}
          disabled={!queryInput.trim()}
          aria-label="Format SQL"
          title="Format SQL"
        >
          <Wand2 aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={secondaryIconButtonClassName}
          onClick={handleSaveQuery}
          disabled={!queryInput.trim()}
          aria-label="Save query"
          title="Save query"
        >
          <Download aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={ghostIconButtonClassName}
          onClick={() => {
            setQueryInput('');
            setQueryExecution(null);
            setSelectedQueryStatementIndex(null);
            setQueryError(null);
            setQueryErrorLine(null);
            setQueryMessage('Cleared the query editor.');
            queueMicrotask(() => editorRef.current?.focus());
          }}
          disabled={!queryInput && !queryExecution && !queryError}
          aria-label="Clear query"
          title="Clear query"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
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
    <div ref={querySplitRef} className="sqlite-query-layout">
      <section
        className="sqlite-query-editor-pane"
        style={{ flex: `0 0 ${editorSplit}%` }}
      >
        {queryTabHeader}
        <div className="sqlite-editor-frame">
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
        className="sqlite-view-splitter"
        onPointerDown={handleQuerySplitResizeStart}
      />

      <section className="sqlite-query-results-pane">
        <div className="sqlite-results-header sqlite-query-results-header">
          <div className="sqlite-toolbar-actions sqlite-query-results-header-main">
            {!queryExecution ? (
              <span className="sqlite-helper-text">
                Run SQL to inspect per-statement results.
              </span>
            ) : null}

            {queryExecution && queryExecution.statements.length > 1 ? (
              <div className="sqlite-query-statement-switcher">
                <select
                  id="sqlite-query-statement-select"
                  aria-label="Selected query statement result"
                  name="queryStatementResult"
                  autoComplete="off"
                  className="sqlite-select"
                  value={selectedQueryStatementValue}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    setSelectedQueryStatementIndex(Number(event.target.value));
                  }}
                >
                  {queryExecution.statements.map((statement) => {
                    return (
                      <option key={statement.index} value={statement.index}>
                        {getStatementSelectorLabel(statement)}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : null}
          </div>

          <div className="sqlite-toolbar-actions ml-auto sqlite-query-results-header-actions">
            <div className="sqlite-field sqlite-field-inline">
              <label htmlFor="sqlite-query-limit">Row Limit</label>
              <select
                id="sqlite-query-limit"
                aria-label="Default query row limit"
                name="queryLimit"
                autoComplete="off"
                className="sqlite-select"
                value={queryRowLimit}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                  setQueryRowLimit(Number(event.target.value));
                }}
              >
                {[25, 50, 100, 250, 500].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className={secondaryIconButtonClassName}
              onClick={handleCopyResults}
              disabled={!activeQueryResult}
              aria-label="Copy results"
              title="Copy results"
            >
              <Copy aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={secondaryIconButtonClassName}
              onClick={handleExportResults}
              disabled={!activeQueryResult}
              aria-label="Export results"
              title="Export results"
            >
              <Download aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {queryError ? (
          <div className="sqlite-inline-error" aria-live="polite">
            <div>
              <p className="font-medium text-rose-100">
                {(queryExecution?.totalStatementCount ??
                  queryStatements.length) > 1
                  ? 'Script Error'
                  : 'SQL Error'}
              </p>
              <p className="mt-1 text-sm text-rose-100/90">{queryError}</p>
              {queryErrorLine ? (
                <p className="mt-1 text-xs text-rose-100/70">
                  Approximate location: line {formatNumber(queryErrorLine)}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className={ghostButtonClassName}
              onClick={handleCopyError}
            >
              <Copy aria-hidden="true" className="h-4 w-4" />
              Copy Error
            </button>
          </div>
        ) : null}

        <div className="sqlite-results-panel">
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
            scrollContainerClassName="min-h-0 sqlite-results-scroll-flush"
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
    </div>
  );

  const dataRowActions = canMutateRows
    ? {
        columnId: SQLITE_ROW_ACTIONS_COLUMN_ID,
        header: 'Actions',
        cell: (row: Record<string, unknown>, rowIndex: number) => {
          const rowNumber = browseOffset + rowIndex + 1;

          return (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className={secondaryIconButtonClassName}
                disabled={editableColumns.length === 0}
                aria-label={`Edit row ${rowNumber}`}
                title={
                  editableColumns.length === 0
                    ? 'No editable columns'
                    : `Edit row ${rowNumber}`
                }
                onClick={(event) => {
                  event.stopPropagation();
                  setDeletingRow(null);
                  setEditingRow({
                    row,
                    rowIndex,
                  });
                }}
              >
                <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className={secondaryIconButtonClassName}
                aria-label={`Delete row ${rowNumber}`}
                title={`Delete row ${rowNumber}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setEditingRow(null);
                  setDeletingRow({
                    row,
                    rowIndex,
                  });
                }}
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
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
    <div className="sqlite-content-stack">
      <header className="sqlite-object-header">
        <div className="sqlite-toolbar-actions sqlite-subtoolbar-group-grow">
          <div className="sqlite-field sqlite-field-grow">
            <label htmlFor="sqlite-data-search" className="sr-only">
              Search current result
            </label>
            <div className="sqlite-input-with-icon">
              <Search aria-hidden="true" className="h-4 w-4" />
              <input
                id="sqlite-data-search"
                type="text"
                name="dataSearch"
                autoComplete="off"
                spellCheck={false}
                value={dataSearch}
                onChange={(event) => setDataSearch(event.target.value)}
                placeholder="Filter visible rows…"
                className="sqlite-input"
              />
            </div>
          </div>
          {dataSearch.trim() ? (
            <button
              type="button"
              className="sqlite-chip"
              onClick={() => setDataSearch('')}
            >
              contains {dataSearch}
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="sqlite-toolbar-actions">
          <button
            type="button"
            className={secondaryIconButtonClassName}
            onClick={() => void loadBrowse()}
            disabled={browseLoading || !isQueryableEntity(selectedEntity)}
            aria-label="Refresh data"
            title="Refresh data"
          >
            <RefreshCw
              aria-hidden="true"
              className={joinClassNames(
                'h-4 w-4',
                browseLoading && 'animate-spin',
              )}
            />
          </button>
        </div>
      </header>

      {browseError ? (
        <div className="sqlite-inline-error" aria-live="polite">
          <div>
            <p className="font-medium text-rose-100">Data Load Failed</p>
            <p className="mt-1 text-sm text-rose-100/90">{browseError}</p>
          </div>
        </div>
      ) : null}

      <div className="sqlite-results-panel flex-1">
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
          scrollContainerClassName="min-h-0 sqlite-results-scroll-flush"
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

      <footer className="sqlite-status-footer">
        <div className="sqlite-status-cluster sqlite-tabular">
          <span>Page {currentDataPage > 0 ? currentDataPage : '—'}</span>
          <span>
            Rows{' '}
            {dataPageStart > 0
              ? `${formatNumber(dataPageStart)}–${formatNumber(dataPageEnd)}`
              : '—'}
          </span>
          <span>Total {formatNumber(entityRowCount)}</span>
          <span>Visible {formatNumber(filteredBrowseRows.length)}</span>
        </div>
        <div className="sqlite-toolbar-actions">
          <div className="sqlite-field sqlite-field-inline">
            <label htmlFor="sqlite-data-page-size">Page Size</label>
            <select
              id="sqlite-data-page-size"
              aria-label="Data page size"
              name="dataPageSize"
              autoComplete="off"
              className="sqlite-select"
              value={browsePageSize}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                setBrowsePageSize(Number(event.target.value));
                setBrowseOffset(0);
              }}
            >
              {[25, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() =>
              setBrowseOffset((current) =>
                Math.max(0, current - browsePageSize),
              )
            }
            disabled={browseLoading || !canBrowseBackward}
          >
            Previous
          </button>
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() =>
              setBrowseOffset((current) => current + browsePageSize)
            }
            disabled={browseLoading || !canBrowseForward}
          >
            Next
          </button>
          <span className="sqlite-badge sqlite-badge-neutral sqlite-tabular">
            {totalDataPages > 0
              ? `${currentDataPage}/${totalDataPages}`
              : '0/0'}
          </span>
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
    <div className="sqlite-content-stack">
      <header className="sqlite-object-header">
        <div
          className="sqlite-section-tabs"
          role="tablist"
          aria-label="Structure sections"
        >
          {(
            [
              ['columns', 'Columns'],
              ['keys', 'Keys'],
              ['indexes', 'Indexes'],
            ] as Array<[StructureSection, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={structureSection === key}
              className={joinClassNames(
                'sqlite-section-tab',
                structureSection === key && 'is-active',
              )}
              onClick={() => setStructureSection(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="sqlite-toolbar-actions">
          <button
            type="button"
            className={secondaryIconButtonClassName}
            onClick={() => void loadStructure()}
            disabled={structureLoading}
            aria-label="Refresh structure"
            title="Refresh structure"
          >
            <RefreshCw
              aria-hidden="true"
              className={joinClassNames(
                'h-4 w-4',
                structureLoading && 'animate-spin',
              )}
            />
          </button>
        </div>
      </header>

      {structureError ? (
        <div className="sqlite-inline-error" aria-live="polite">
          <div>
            <p className="font-medium text-rose-100">Structure Load Failed</p>
            <p className="mt-1 text-sm text-rose-100/90">{structureError}</p>
          </div>
        </div>
      ) : null}

      <div
        className={joinClassNames(
          'sqlite-structure-panel',
          (structureSection === 'columns' || structureSection === 'indexes') &&
            'sqlite-structure-panel-flush',
        )}
      >
        {structureSection === 'columns' ? (
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
            shellClassName="sqlite-metadata-table-wrap sqlite-metadata-table-wrap-flush"
            scrollContainerClassName="p-0"
            tableClassName="sqlite-metadata-table"
          />
        ) : structureSection === 'keys' ? (
          structureLoading ? (
            <div className="sqlite-structure-skeleton" aria-live="polite">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="sqlite-structure-skeleton-row" />
              ))}
            </div>
          ) : (
            <div className="sqlite-structure-grid">
              <section className="sqlite-detail-card">
                <header className="mb-3">
                  <h3 className="sqlite-detail-card-title">Primary Key</h3>
                </header>
                {primaryKeyColumns.length === 0 ? (
                  <p className="sqlite-helper-text">No primary key defined.</p>
                ) : (
                  <div className="sqlite-chip-row">
                    {primaryKeyColumns
                      .sort(
                        (left, right) =>
                          left.primaryKeyOrder - right.primaryKeyOrder,
                      )
                      .map((column) => (
                        <span
                          key={column.name}
                          className="sqlite-chip sqlite-chip-static"
                        >
                          <KeyRound
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                          />
                          {column.name}
                        </span>
                      ))}
                  </div>
                )}
              </section>

              <section className="sqlite-detail-card">
                <header className="mb-3">
                  <h3 className="sqlite-detail-card-title">Foreign Keys</h3>
                </header>
                {structureState.foreignKeys.length === 0 ? (
                  <p className="sqlite-helper-text">No foreign keys defined.</p>
                ) : (
                  <div className="space-y-3">
                    {structureState.foreignKeys.map((foreignKey) => (
                      <div
                        key={`${foreignKey.id}-${foreignKey.seq}`}
                        className="sqlite-key-row"
                      >
                        <div>
                          <p className="font-medium text-white">
                            {foreignKey.from} → {foreignKey.table}
                            {foreignKey.to ? `.${foreignKey.to}` : ''}
                          </p>
                          <p className="sqlite-helper-text">
                            Update {foreignKey.onUpdate} · Delete{' '}
                            {foreignKey.onDelete}
                          </p>
                        </div>
                        <span className="sqlite-badge sqlite-badge-neutral">
                          Match {foreignKey.match}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )
        ) : (
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
            shellClassName="sqlite-metadata-table-wrap sqlite-metadata-table-wrap-flush"
            scrollContainerClassName="p-0"
            tableClassName="sqlite-metadata-table"
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="sqlite-app-shell">
      <a href="#sqlite-main-content" className="sqlite-skip-link">
        Skip To Workspace
      </a>
      <div className="sqlite-app-body">
        <aside
          ref={sidebarRef}
          className="sqlite-sidebar-wrap"
          style={{ width: sidebarWidth }}
        >
          <section className="sqlite-sidebar-panel">
            <header className="sqlite-sidebar-header">
              <div className="sqlite-toolbar-actions">
                <h1 className="sqlite-section-title">Databases</h1>
              </div>
              <div className="sqlite-toolbar-actions">
                <button
                  type="button"
                  className={iconButtonClassName}
                  aria-label="Refresh databases"
                  title="Refresh databases"
                  onClick={() => void refreshWorkspace()}
                  disabled={databaseLoading || entityLoading}
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={joinClassNames(
                      'h-4 w-4',
                      (databaseLoading || entityLoading) && 'animate-spin',
                    )}
                  />
                </button>
              </div>
            </header>

            <div className="sqlite-sidebar-toolbar">
              <label htmlFor="sqlite-sidebar-filter" className="sr-only">
                Filter databases, tables, and views
              </label>
              <div className="sqlite-input-with-icon">
                <Search aria-hidden="true" className="h-4 w-4" />
                <input
                  id="sqlite-sidebar-filter"
                  type="text"
                  name="sidebarFilter"
                  autoComplete="off"
                  spellCheck={false}
                  value={objectSearch}
                  onChange={(event) => setObjectSearch(event.target.value)}
                  placeholder="Filter databases, tables, views…"
                  className="sqlite-input"
                />
              </div>
            </div>

            <div className="sqlite-sidebar-scroll">
              {databaseLoading && databases.length === 0 ? (
                <div className="sqlite-sidebar-skeleton" aria-live="polite">
                  {Array.from({ length: 6 }, (_, index) => (
                    <div key={index} className="sqlite-sidebar-skeleton-row" />
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
                <div className="sqlite-connection-list">
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
                      <div key={database.id} className="sqlite-connection-card">
                        <button
                          type="button"
                          className="sqlite-connection-row"
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
                          <div className="sqlite-tree-shell">
                            {databaseExplorerState.loading ||
                            !databaseExplorerState.loaded ? (
                              <div
                                className="sqlite-sidebar-skeleton"
                                aria-live="polite"
                              >
                                {Array.from({ length: 4 }, (_, index) => (
                                  <div
                                    key={index}
                                    className="sqlite-sidebar-skeleton-row"
                                  />
                                ))}
                              </div>
                            ) : databaseExplorerState.error ? (
                              <div
                                className="sqlite-inline-error"
                                aria-live="polite"
                              >
                                <div>
                                  <p className="font-medium text-rose-100">
                                    Explorer Load Failed
                                  </p>
                                  <p className="mt-1 text-sm text-rose-100/90">
                                    {databaseExplorerState.error}
                                  </p>
                                </div>
                              </div>
                            ) : databaseExplorerGroups.length === 0 ? (
                              <div className="sqlite-tree-empty">
                                No objects match this filter.
                              </div>
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
                                      className="sqlite-schema-group"
                                    >
                                      <button
                                        type="button"
                                        className="sqlite-schema-row"
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
                                        <div className="sqlite-schema-content">
                                          {tables.length > 0 ? (
                                            <div className="sqlite-object-section">
                                              <p className="sqlite-object-section-title">
                                                Tables
                                              </p>
                                              <div className="sqlite-object-list">
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
                                                        'sqlite-object-row',
                                                        isSelected &&
                                                          'is-active',
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
                                            <div className="sqlite-object-section">
                                              <p className="sqlite-object-section-title">
                                                Views
                                              </p>
                                              <div className="sqlite-object-list">
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
                                                        'sqlite-object-row',
                                                        isSelected &&
                                                          'is-active',
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
            className="sqlite-sidebar-resizer"
            onPointerDown={handleSidebarResizeStart}
          />
        </aside>

        <main id="sqlite-main-content" className="sqlite-workspace">
          <section className="sqlite-workspace-panel">
            <div className="sqlite-workspace-content">
              <div className="sqlite-main-stack">
                <div
                  className="sqlite-workspace-tabs sqlite-main-tabs"
                  role="tablist"
                  aria-label="Workspace tabs"
                >
                  {(
                    [
                      ['query', 'Query'],
                      ['data', 'Data'],
                      ['structure', 'Structure'],
                    ] as Array<[ActiveTab, string]>
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab}
                      className={joinClassNames(
                        'sqlite-workspace-tab',
                        activeTab === tab && 'is-active',
                      )}
                      onClick={() => setActiveTab(tab)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="sqlite-main-pane">
                  {activeTab === 'query'
                    ? queryPane
                    : activeTab === 'data'
                      ? dataPane
                      : structurePane}
                </div>
              </div>
            </div>
          </section>
        </main>

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
      </div>
    </div>
  );
}
