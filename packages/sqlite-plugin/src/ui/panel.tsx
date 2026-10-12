import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type { CompletionSource } from '@codemirror/autocomplete';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  IconButton,
  PluginShell,
  SearchField,
  Select,
  Split,
  Tabs,
  Text,
  Toolbar,
  useToast,
} from '@rozenite/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Database,
  Download,
  FolderTree,
  Pencil,
  Play,
  RefreshCw,
  Table2,
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
  type SqliteEntity,
} from './sqlite-introspection';
import { QueryResultTable } from './query-result-table';
import { SqliteRowDeleteModal } from './sqlite-row-delete-modal';
import { SqliteDropModal, type SqliteDropModalTarget } from './sqlite-drop-modal';
import {
  buildDropAllEntitiesSql,
  buildDropEntitySql,
  buildSetForeignKeysSql,
  isForeignKeysEnabled,
  SQLITE_READ_FOREIGN_KEYS_SQL,
} from './sqlite-drop-mutations';
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
  buildRowDeleteMutation,
  buildRowUpdateMutation,
  getEditableColumns,
  getRowMutationDescriptor,
  type SqliteRowMutationDescriptor,
} from './sqlite-row-mutations';
import { ExplorerSidebar } from './explorer-sidebar';
import {
  DEFAULT_EXPLORER_STATE,
  getEntityKey,
  getSchemaKey,
  type ExplorerState,
} from './sqlite-explorer';
import { StructurePane, type StructureSection, type StructureState } from './structure-pane';
import { copyToClipboard, downloadTextFile, formatNumber, slugifyFileName } from './utils';
import { handleWorkspaceShortcut } from './workspace-shortcuts';
import { getResultSummary, getScriptResultSummary } from './value-utils';
import './globals.css';

type ActiveTab = 'query' | 'data' | 'structure';
type ActiveRowMutationState = {
  row: Record<string, unknown>;
  rowIndex: number;
} | null;

/**
 * The drop dialog operates on the target captured when it opened, so that a
 * mid-dialog explorer reload cannot repoint it at a different object.
 */
type ActiveDropState = {
  databaseId: string;
  target: SqliteDropModalTarget;
} | null;

const DEFAULT_QUERY = 'SELECT name, type FROM sqlite_schema ORDER BY type, name';
const DEFAULT_QUERY_LIMIT = 100;
const DEFAULT_PAGE_SIZE = 50;
const HIDDEN_BROWSE_COLUMNS = [SQLITE_HIDDEN_ROWID_COLUMN_ID];
const DEFAULT_DROP_TARGET: SqliteDropModalTarget = {
  kind: 'entity',
  entityType: 'table',
  qualifiedName: '',
  confirmationValue: '',
  sql: '',
};

const safeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const getLineNumberAtPosition = (value: string, position: number) =>
  value.slice(0, Math.max(0, position)).split('\n').length;

const buildGeneratedSelect = (entity: SqliteEntity | null, rowLimit: number) => {
  if (!entity) {
    return DEFAULT_QUERY;
  }

  return buildBrowseEntitySql(entity.schemaName, entity.name, Math.max(1, Math.floor(rowLimit)), 0);
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
    ...result.rows.map((row) => result.columns.map((column) => escapeCell(row[column])).join(',')),
  ].join('\n');
};

const getDefaultSelectedQueryStatementIndex = (execution: SqliteScriptResult | null) => {
  if (!execution || execution.statements.length === 0) {
    return null;
  }

  return (
    execution.failedStatementIndex ??
    execution.statements[execution.statements.length - 1]?.index ??
    null
  );
};

const getStatementQueryResult = (statement: SqliteScriptStatementResult | null) =>
  statement?.execution?.result ?? null;

const getStatementSelectorLabel = (statement: SqliteScriptStatementResult, maxLength = 72) => {
  const normalizedSql = statement.input.sql.replace(/\s+/g, ' ').replace(/;\s*$/, '').trim();

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

function SqlitePanelContent() {
  const toast = useToast();
  const client = useRozeniteDevToolsClient<SqliteEventMap>({
    pluginId: PLUGIN_ID,
  });
  const { requestDatabases, requestQuery, requestScriptExecution } = useSqliteRequests(client);

  const editorRef = useRef<SqlEditorHandle | null>(null);
  const objectSearchRef = useRef<HTMLInputElement | null>(null);
  const selectedDatabaseIdRef = useRef<string | null>(null);
  const selectedEntityKeyRef = useRef<string | null>(null);
  const browseRequestVersionRef = useRef(0);
  const structureRequestVersionRef = useRef(0);

  const [activeTab, setActiveTab] = useState<ActiveTab>('query');
  const [expandedDatabaseIds, setExpandedDatabaseIds] = useState<string[]>([]);
  const [expandedSchemaKeys, setExpandedSchemaKeys] = useState<string[]>([]);
  const [structureSection, setStructureSection] = useState<StructureSection>('columns');

  const [databases, setDatabases] = useState<SqliteDatabaseInfo[]>([]);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(null);
  const [explorerStateByDatabase, setExplorerStateByDatabase] = useState<
    Record<string, ExplorerState>
  >({});
  const [selectedEntityKey, setSelectedEntityKey] = useState<string | null>(null);

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
  const [browseResult, setBrowseResult] = useState<SqliteQueryResult | null>(null);
  const [entityRowCount, setEntityRowCount] = useState<number | null>(null);
  const [structureState, setStructureState] = useState<StructureState>({
    columns: [],
    foreignKeys: [],
    indexes: [],
  });

  const [queryInput, setQueryInput] = useState(DEFAULT_QUERY);
  const [queryExecution, setQueryExecution] = useState<SqliteScriptResult | null>(null);
  const [selectedQueryStatementIndex, setSelectedQueryStatementIndex] = useState<number | null>(
    null,
  );
  const [queryRowLimit, setQueryRowLimit] = useState(DEFAULT_QUERY_LIMIT);
  const [querySelection, setQuerySelection] = useState({ start: 0, end: 0 });
  const [, setQueryMessage] = useState('Ready.');
  const [queryErrorLine, setQueryErrorLine] = useState<number | null>(null);
  const [queryColumnCache, setQueryColumnCache] = useState(() => createSqlEditorColumnCache());
  const [editingRow, setEditingRow] = useState<ActiveRowMutationState>(null);
  const [deletingRow, setDeletingRow] = useState<ActiveRowMutationState>(null);
  const [activeDrop, setActiveDrop] = useState<ActiveDropState>(null);

  const [objectSearch, setObjectSearch] = useState('');
  const [dataSearch, setDataSearch] = useState('');

  const selectedDatabase = useMemo(
    () => databases.find((database) => database.id === selectedDatabaseId) ?? null,
    [databases, selectedDatabaseId],
  );

  const selectedExplorerState = useMemo(
    () =>
      (selectedDatabaseId ? explorerStateByDatabase[selectedDatabaseId] : null) ??
      DEFAULT_EXPLORER_STATE,
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
          getEntityKey(selectedDatabaseId, entity.schemaName, entity.name) === selectedEntityKey,
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

  const filteredBrowse = useMemo(() => {
    if (!browseResult) {
      return { rows: [], pageIndexes: [] };
    }

    const term = dataSearch.trim().toLowerCase();
    const searchableColumns = browseResult.columns.filter(
      (column) => column !== SQLITE_HIDDEN_ROWID_COLUMN_ID,
    );

    // `pageIndexes` remembers each kept row's place on the page, so row numbers and the row
    // dialogs keep counting from the page rather than from the filtered list.
    const pageIndexes = browseResult.rows.flatMap((row, index) =>
      !term ||
      searchableColumns.some((column) =>
        String(row[column] ?? '')
          .toLowerCase()
          .includes(term),
      )
        ? [index]
        : [],
    );

    return { rows: pageIndexes.map((index) => browseResult.rows[index]), pageIndexes };
  }, [browseResult, dataSearch]);
  const filteredBrowseRows = filteredBrowse.rows;

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
  const dataPageEnd = filteredBrowseRows.length > 0 ? browseOffset + filteredBrowseRows.length : 0;
  const canBrowseBackward = browseOffset > 0;
  const canBrowseForward = entityRowCount != null && browseOffset + browsePageSize < entityRowCount;
  const currentDataPage = selectedEntity ? Math.floor(browseOffset / browsePageSize) + 1 : 0;
  const totalDataPages =
    entityRowCount == null || entityRowCount === 0 ? 0 : Math.ceil(entityRowCount / browsePageSize);
  const editableColumns = useMemo(
    () => getEditableColumns(structureState.columns),
    [structureState.columns],
  );
  const rowMutationDescriptor = useMemo<SqliteRowMutationDescriptor | null>(
    () => getRowMutationDescriptor(selectedEntity, structureState.columns),
    [selectedEntity, structureState.columns],
  );
  const canMutateRows = rowMutationDescriptor != null;

  const queryStatements = useMemo(() => splitSqlStatements(queryInput), [queryInput]);

  const selectedQueryStatement = useMemo(() => {
    if (!queryExecution) {
      return null;
    }

    const nextIndex =
      selectedQueryStatementIndex ?? getDefaultSelectedQueryStatementIndex(queryExecution);

    if (nextIndex == null) {
      return null;
    }

    return queryExecution.statements.find((statement) => statement.index === nextIndex) ?? null;
  }, [queryExecution, selectedQueryStatementIndex]);

  const activeQueryResult = useMemo(
    () => getStatementQueryResult(selectedQueryStatement),
    [selectedQueryStatement],
  );

  const selectedQueryStatementValue = selectedQueryStatement?.index ?? '';

  const setEntitySelection = useCallback((databaseId: string, entity: SqliteEntity) => {
    setSelectedDatabaseId(databaseId);
    setSelectedEntityKey(getEntityKey(databaseId, entity.schemaName, entity.name));
  }, []);

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
        if (current && nextDatabases.some((database) => database.id === current)) {
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
          const nextKeys = nextSchemas.map((schema) => getSchemaKey(databaseId, schema.name));
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
            rowMutationDescriptor?.mode === 'rowid' ? rowMutationDescriptor.rowIdIdentifier : null,
          ),
        }),
        requestQuery({
          databaseId: selectedDatabaseId,
          sql: buildEntityCountSql(selectedEntity.schemaName, selectedEntity.name),
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
      const [columnsOutcome, foreignKeysOutcome, indexesOutcome] = await Promise.allSettled([
        requestQuery({
          databaseId: selectedDatabaseId,
          sql: buildTableXInfoSql(selectedEntity.schemaName, selectedEntity.name),
        }),
        requestQuery({
          databaseId: selectedDatabaseId,
          sql: buildForeignKeySql(selectedEntity.schemaName, selectedEntity.name),
        }),
        requestQuery({
          databaseId: selectedDatabaseId,
          sql: buildIndexListSql(selectedEntity.schemaName, selectedEntity.name),
        }),
      ]);

      const columns =
        columnsOutcome.status === 'fulfilled' ? parseColumns(columnsOutcome.value) : [];
      const foreignKeys =
        foreignKeysOutcome.status === 'fulfilled' ? parseForeignKeys(foreignKeysOutcome.value) : [];
      const indexes =
        indexesOutcome.status === 'fulfilled' ? parseIndexes(indexesOutcome.value) : [];

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
    await Promise.all(nextDatabases.map((database) => loadExplorer(database.id)));
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

  const handleOpenDropEntity = useCallback(() => {
    if (!selectedDatabaseId || !selectedEntity) {
      return;
    }

    setActiveDrop({
      databaseId: selectedDatabaseId,
      target: {
        kind: 'entity',
        entityType: selectedEntity.type,
        qualifiedName: `${selectedEntity.schemaName}.${selectedEntity.name}`,
        confirmationValue: selectedEntity.name,
        sql: `${buildDropEntitySql(selectedEntity)};`,
      },
    });
  }, [selectedDatabaseId, selectedEntity]);

  const handleOpenDropAllEntities = useCallback(() => {
    if (!selectedDatabaseId || !selectedDatabase) {
      return;
    }

    const tableCount = entities.filter((entity) => entity.type === 'table').length;
    const viewCount = entities.filter((entity) => entity.type === 'view').length;

    setActiveDrop({
      databaseId: selectedDatabaseId,
      target: {
        kind: 'database',
        databaseName: selectedDatabase.name,
        confirmationValue: selectedDatabase.name,
        tableCount,
        viewCount,
        sql: buildDropAllEntitiesSql(entities),
      },
    });
  }, [entities, selectedDatabase, selectedDatabaseId]);

  const dropSelectedEntity = useCallback(
    async (databaseId: string, sql: string) => {
      await requestQuery({ databaseId, sql });
    },
    [requestQuery],
  );

  const dropAllEntities = useCallback(
    async (databaseId: string, sql: string) => {
      // Dropping a parent table before its children fails while foreign key
      // enforcement is on, so turn it off for the sweep. The pragma is
      // per-connection and that connection belongs to the running app, so the
      // original value has to be restored on every path out of here.
      const foreignKeysResult = await requestQuery({
        databaseId,
        sql: SQLITE_READ_FOREIGN_KEYS_SQL,
      });
      const foreignKeysWereEnabled = isForeignKeysEnabled(foreignKeysResult.rows);

      if (foreignKeysWereEnabled) {
        await requestQuery({
          databaseId,
          sql: buildSetForeignKeysSql(false),
        });
      }

      let dropError: unknown = null;

      try {
        const scriptResult = await requestScriptExecution({
          databaseId,
          sql,
        });

        if (scriptResult.failedStatementIndex != null) {
          const failedStatement = scriptResult.statements.find(
            (statement) => statement.index === scriptResult.failedStatementIndex,
          );
          throw new Error(failedStatement?.error ?? 'Script execution failed.');
        }
      } catch (error) {
        dropError = error;
      }

      if (foreignKeysWereEnabled) {
        try {
          await requestQuery({
            databaseId,
            sql: buildSetForeignKeysSql(true),
          });
        } catch (restoreError) {
          // The drop error, if any, takes priority: it's the reason the user
          // is looking at this modal. Only surface the restore failure when
          // the drop itself succeeded, since that's a new, silent problem.
          if (!dropError) {
            throw restoreError instanceof Error ? restoreError : new Error(String(restoreError));
          }
        }
      }

      if (dropError) {
        throw dropError instanceof Error ? dropError : new Error(String(dropError));
      }
    },
    [requestQuery, requestScriptExecution],
  );

  const handleConfirmDrop = useCallback(async () => {
    if (!activeDrop) {
      throw new Error('The drop target is no longer available.');
    }

    // Execute the target captured when the dialog opened rather than the
    // current selection: an app reload can fire `sqlite:ready` mid-dialog,
    // which reloads the explorer and may move the selection elsewhere. The
    // user confirmed by typing this object's name, so this is the object that
    // has to be dropped.
    const { databaseId, target } = activeDrop;

    if (!target.sql) {
      throw new Error('There is nothing to drop.');
    }

    if (target.kind === 'entity') {
      await dropSelectedEntity(databaseId, target.sql);
    } else {
      await dropAllEntities(databaseId, target.sql);
    }

    setActiveDrop(null);
    setSelectedEntityKey(null);
    await refreshExplorerData();
  }, [activeDrop, dropAllEntities, dropSelectedEntity, refreshExplorerData]);

  const getActiveStatement = useCallback(() => {
    const cursorPosition = editorRef.current?.getSelection().start ?? querySelection.start;
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
                (statement) => statement.index === execution.failedStatementIndex,
              ) ?? null);

        setQueryExecution(execution);
        setSelectedQueryStatementIndex(getDefaultSelectedQueryStatementIndex(execution));

        if (failedStatement?.error) {
          setQueryError(failedStatement.error);
          setQueryErrorLine(getLineNumberAtPosition(queryInput, failedStatement.start));
        }

        setQueryMessage(getScriptResultSummary(execution) ?? 'Script execution completed.');

        if (hasMutatingStatements(execution)) {
          await refreshWorkspace();
        }
      } catch (error) {
        setQueryExecution(null);
        setSelectedQueryStatementIndex(null);
        setQueryError(safeError(error));
        setQueryErrorLine(getLineNumberAtPosition(queryInput, querySelection.start));
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
      await runSingleStatement(getActiveStatement(), 'Running current statement');
    } catch (error) {
      setQueryError(safeError(error));
      setQueryErrorLine(getLineNumberAtPosition(queryInput, querySelection.start));
    }
  }, [getActiveStatement, queryInput, querySelection.start, runSingleStatement]);

  const handleSaveQuery = useCallback(() => {
    const fileName = `${slugifyFileName(selectedEntity?.name ?? 'query')}.sql`;
    downloadTextFile(fileName, queryInput);
    setQueryMessage(`Saved ${fileName}.`);
    toast.add({ title: `Saved ${fileName}` });
  }, [queryInput, selectedEntity?.name, toast]);

  const handleExportResults = useCallback(async () => {
    const csv = buildCsv(activeQueryResult);
    if (!csv) {
      return;
    }

    const fileName = `${slugifyFileName(selectedEntity?.name ?? 'query-results')}.csv`;
    downloadTextFile(fileName, csv);
    setQueryMessage(`Exported ${fileName}.`);
    toast.add({ title: `Exported ${fileName}` });
  }, [activeQueryResult, selectedEntity?.name, toast]);

  const copyWithToast = useCallback(
    async (text: string, successTitle: string) => {
      let copied = false;

      try {
        copied = await copyToClipboard(text);
      } catch {
        copied = false;
      }

      toast.add(
        copied
          ? { title: successTitle }
          : { title: 'Could not copy to the clipboard', type: 'error' },
      );

      return copied;
    },
    [toast],
  );

  const handleCopyResults = useCallback(async () => {
    if (!activeQueryResult) {
      return;
    }

    if (
      await copyWithToast(
        JSON.stringify(activeQueryResult.rows, null, 2),
        'Copied result rows as JSON',
      )
    ) {
      setQueryMessage('Copied result rows as JSON.');
    }
  }, [activeQueryResult, copyWithToast]);

  const handleCopyError = useCallback(async () => {
    if (!queryError) {
      return;
    }

    if (await copyWithToast(queryError, 'Copied SQL error')) {
      setQueryMessage('Copied SQL error.');
    }
  }, [copyWithToast, queryError]);

  const handleFormatQuery = useCallback(() => {
    try {
      const formatted = formatSqlScript(queryInput);
      setQueryInput(formatted);
      setQueryError(null);
      setQueryErrorLine(null);
      setQueryMessage(formatted ? 'Formatted query.' : 'Cleared query formatting.');
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
        setSqlEditorCachedColumns(current, selectedDatabaseId, schemaName, entityName, columns),
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

      const aliases = extractSqlEditorAliases(context.state.doc.sliceString(0, context.pos));
      const entity = resolveSqlEditorEntityReference({
        aliases,
        entities,
        request,
        selectedSchemaName: selectedEntity?.schemaName ?? defaultCompletionSchemaName ?? null,
      });
      if (!entity) {
        return null;
      }

      const columns = await ensureQueryEntityColumns(entity.schemaName, entity.name);
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
    [defaultCompletionSchemaName, ensureQueryEntityColumns, entities, selectedEntity?.schemaName],
  );

  useEffect(() => {
    void refreshExplorerData();
  }, [refreshExplorerData]);

  useEffect(() => {
    if (!selectedDatabaseId || selectedExplorerState.loading || !selectedExplorerState.loaded) {
      return;
    }

    setSelectedEntityKey((current) => {
      if (
        current &&
        selectedExplorerState.entities.some(
          (entity) => getEntityKey(selectedDatabaseId, entity.schemaName, entity.name) === current,
        )
      ) {
        return current;
      }

      const fallbackEntity = selectedExplorerState.entities[0];
      return fallbackEntity
        ? getEntityKey(selectedDatabaseId, fallbackEntity.schemaName, fallbackEntity.name)
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
    setQueryColumnCache((current) => syncSqlEditorColumnCacheDatabase(current, selectedDatabaseId));
  }, [selectedDatabaseId]);

  useEffect(() => {
    if (!selectedDatabaseId || !selectedEntity || structureLoading || structureError) {
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
    const handleKeyDown = (event: globalThis.KeyboardEvent) =>
      handleWorkspaceShortcut(event, {
        activeTab,
        focusObjectSearch: () => objectSearchRef.current?.focus(),
        saveQuery: handleSaveQuery,
      });

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

  const handleClearQuery = useCallback(() => {
    setQueryInput('');
    setQueryExecution(null);
    setSelectedQueryStatementIndex(null);
    setQueryError(null);
    setQueryErrorLine(null);
    setQueryMessage('Cleared the query editor.');
    queueMicrotask(() => editorRef.current?.focus());
  }, []);

  const hasEditableColumns = editableColumns.length > 0;
  const dataRowActions = useMemo(
    () =>
      canMutateRows
        ? {
            header: 'Actions',
            cell: (row: Record<string, unknown>, rowIndex: number) => {
              const rowNumber = browseOffset + rowIndex + 1;

              return (
                <>
                  <IconButton
                    label={hasEditableColumns ? `Edit row ${rowNumber}` : 'No editable columns'}
                    size="sm"
                    tone="neutral"
                    variant="ghost"
                    disabled={!hasEditableColumns}
                    aria-label={`Edit row ${rowNumber}`}
                    onClick={() => {
                      setDeletingRow(null);
                      setEditingRow({ row, rowIndex });
                    }}
                  >
                    <Pencil />
                  </IconButton>
                  <IconButton
                    label={`Delete row ${rowNumber}`}
                    size="sm"
                    tone="danger"
                    variant="ghost"
                    onClick={() => {
                      setEditingRow(null);
                      setDeletingRow({ row, rowIndex });
                    }}
                  >
                    <Trash2 />
                  </IconButton>
                </>
              );
            },
          }
        : undefined,
    [browseOffset, canMutateRows, hasEditableColumns],
  );

  const queryPane = !selectedDatabase ? (
    <EmptyState
      icon={Database}
      title="Select A Database"
      description="Choose a database in the sidebar to run SQL."
    />
  ) : (
    <Split direction="vertical" autoSaveId="sqlite-query">
      <Split.Pane defaultSize={50} minSize={20}>
        <div className="flex h-full min-h-0 flex-col">
          <Toolbar>
            <Toolbar.Button
              onClick={() => void handleRun()}
              disabled={!selectedDatabaseId || queryLoading || !queryInput.trim()}
              aria-label="Run all statements"
              title="Run all statements"
              className="bg-primary px-2 text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground"
            >
              <Play className="h-3.5 w-3.5" />
              Run
            </Toolbar.Button>
            <Toolbar.Separator />
            <Toolbar.Group>
              <Toolbar.Button
                onClick={handleFormatQuery}
                disabled={!queryInput.trim()}
                aria-label="Format SQL"
                title="Format SQL"
                className="w-6 px-0"
              >
                <Wand2 className="h-3.5 w-3.5" />
              </Toolbar.Button>
              <Toolbar.Button
                onClick={handleSaveQuery}
                disabled={!queryInput.trim()}
                aria-label="Save query"
                title="Save query"
                className="w-6 px-0"
              >
                <Download className="h-3.5 w-3.5" />
              </Toolbar.Button>
            </Toolbar.Group>
            <Toolbar.Button
              onClick={handleClearQuery}
              disabled={!queryInput && !queryExecution && !queryError}
              aria-label="Clear query"
              title="Clear query"
              className="ml-auto w-6 px-0"
            >
              <X className="h-3.5 w-3.5" />
            </Toolbar.Button>
          </Toolbar>
          <div className="min-h-0 flex-1">
            <SqlEditor
              ref={editorRef}
              ariaLabel="SQL query editor"
              completionSchema={editorCompletionSchema}
              completionSource={editorCompletionSource}
              defaultSchema={selectedEntity?.schemaName ?? defaultCompletionSchemaName}
              defaultTable={
                cachedSelectedEntityColumns.length > 0 ? selectedEntity?.name : undefined
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
        </div>
      </Split.Pane>

      <Split.Handle />

      <Split.Pane minSize={15}>
        <div className="flex h-full min-h-0 flex-col">
          <Toolbar>
            {!queryExecution ? (
              <Text variant="caption" className="px-1 text-faint">
                Run SQL to inspect per-statement results.
              </Text>
            ) : null}

            {queryExecution && queryExecution.statements.length > 1 ? (
              <Select
                value={String(selectedQueryStatementValue)}
                onValueChange={(value) => setSelectedQueryStatementIndex(Number(value))}
              >
                <Select.Trigger
                  size="sm"
                  className="min-w-32 max-w-xl shrink font-mono text-xs"
                  aria-label="Selected query statement result"
                >
                  <Select.Value>
                    {(value: string) => {
                      const statement = queryExecution.statements.find(
                        (candidate) => String(candidate.index) === value,
                      );
                      return statement ? getStatementSelectorLabel(statement) : value;
                    }}
                  </Select.Value>
                </Select.Trigger>
                <Select.Content className="max-w-xl">
                  {queryExecution.statements.map((statement) => (
                    <Select.Item
                      key={statement.index}
                      value={String(statement.index)}
                      className="font-mono text-xs"
                    >
                      {getStatementSelectorLabel(statement)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            ) : null}

            <div className="ml-auto flex shrink-0 items-center gap-1">
              <Text variant="label" className="pr-1 whitespace-nowrap">
                Row Limit
              </Text>
              <Select
                value={queryRowLimit}
                onValueChange={(value) => setQueryRowLimit(Number(value))}
              >
                <Select.Trigger size="sm" className="w-20" aria-label="Default query row limit">
                  <Select.Value>{(value: number) => String(value)}</Select.Value>
                </Select.Trigger>
                <Select.Content>
                  {[25, 50, 100, 250, 500].map((value) => (
                    <Select.Item key={value} value={value}>
                      {value}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
              <Toolbar.Button
                onClick={() => void handleCopyResults()}
                disabled={!activeQueryResult}
                aria-label="Copy results"
                title="Copy results"
                className="w-6 px-0"
              >
                <Copy className="h-3.5 w-3.5" />
              </Toolbar.Button>
              <Toolbar.Button
                onClick={handleExportResults}
                disabled={!activeQueryResult}
                aria-label="Export results"
                title="Export results"
                className="w-6 px-0"
              >
                <Download className="h-3.5 w-3.5" />
              </Toolbar.Button>
            </div>
          </Toolbar>

          {queryError ? (
            <Alert tone="danger" className="m-2 shrink-0" aria-live="polite">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Alert.Title>
                    {(queryExecution?.totalStatementCount ?? queryStatements.length) > 1
                      ? 'Script Error'
                      : 'SQL Error'}
                  </Alert.Title>
                  <Alert.Description className="font-mono text-xs break-words text-danger">
                    {queryError}
                  </Alert.Description>
                  {queryErrorLine ? (
                    <Alert.Description className="text-xs">
                      Approximate location: line {formatNumber(queryErrorLine)}
                    </Alert.Description>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  tone="neutral"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => void handleCopyError()}
                >
                  <Copy aria-hidden="true" />
                  Copy Error
                </Button>
              </div>
            </Alert>
          ) : null}

          <div className="min-h-0 flex-1">
            <QueryResultTable
              ariaLabel="Query results"
              result={activeQueryResult}
              loading={queryLoading}
              emptyTitle={selectedQueryStatement?.error ? 'Statement Failed' : 'No Results'}
              emptyDescription={
                selectedQueryStatement?.error
                  ? 'Select another statement to inspect its rows, or fix the error and run again.'
                  : 'Run SQL to see rows here.'
              }
            />
          </div>
        </div>
      </Split.Pane>
    </Split>
  );

  const dataPane = !selectedDatabase ? (
    <EmptyState
      icon={Database}
      title="Select A Database"
      description="Choose a database in the sidebar to browse rows."
    />
  ) : !selectedEntity ? (
    <EmptyState
      icon={Table2}
      title="Select A Table"
      description="Choose a table in the sidebar to view its rows."
    />
  ) : (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar>
        <div className="min-w-40 flex-1">
          <SearchField
            aria-label="Search current result"
            name="dataSearch"
            autoComplete="off"
            spellCheck={false}
            placeholder="Filter visible rows…"
            value={dataSearch}
            onChange={(event) => setDataSearch(event.target.value)}
            onClear={() => setDataSearch('')}
          />
        </div>
        <Toolbar.Button
          onClick={() => void loadBrowse()}
          disabled={browseLoading || !isQueryableEntity(selectedEntity)}
          aria-label="Refresh data"
          title="Refresh data"
          className="w-6 px-0"
        >
          <RefreshCw className={browseLoading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
        </Toolbar.Button>
      </Toolbar>

      {browseError ? (
        <Alert tone="danger" className="m-2 shrink-0" aria-live="polite">
          <Alert.Title>Data Load Failed</Alert.Title>
          <Alert.Description className="font-mono text-xs break-words text-danger">
            {browseError}
          </Alert.Description>
        </Alert>
      ) : null}

      <div className="min-h-0 flex-1">
        <QueryResultTable
          ariaLabel={`Rows of ${selectedEntity.name}`}
          result={filteredBrowseResult}
          loading={browseLoading}
          emptyTitle="No Rows On This Page"
          emptyDescription="This page does not contain rows."
          rowNumberOffset={browseOffset}
          columnMeta={structureColumnMeta}
          hiddenColumnIds={HIDDEN_BROWSE_COLUMNS}
          rowIndexes={filteredBrowse.pageIndexes}
          rowActions={dataRowActions}
        />
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Text variant="numeric" className="text-muted-foreground">
            Page {currentDataPage > 0 ? currentDataPage : '—'}
          </Text>
          <Text variant="numeric" className="text-muted-foreground">
            Rows{' '}
            {dataPageStart > 0
              ? `${formatNumber(dataPageStart)}–${formatNumber(dataPageEnd)}`
              : '—'}
          </Text>
          <Text variant="numeric" className="text-muted-foreground">
            Total {formatNumber(entityRowCount)}
          </Text>
          <Text variant="numeric" className="text-muted-foreground">
            Visible {formatNumber(filteredBrowseRows.length)}
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Text variant="label" className="whitespace-nowrap">
            Page Size
          </Text>
          <Select
            value={browsePageSize}
            onValueChange={(value) => {
              setBrowsePageSize(Number(value));
              setBrowseOffset(0);
            }}
          >
            <Select.Trigger size="sm" className="w-20" aria-label="Data page size">
              <Select.Value>{(value: number) => String(value)}</Select.Value>
            </Select.Trigger>
            <Select.Content>
              {[25, 50, 100].map((value) => (
                <Select.Item key={value} value={value}>
                  {value}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Button
            size="sm"
            tone="neutral"
            variant="outline"
            onClick={() => setBrowseOffset((current) => Math.max(0, current - browsePageSize))}
            disabled={browseLoading || !canBrowseBackward}
          >
            Previous
          </Button>
          <Button
            size="sm"
            tone="neutral"
            variant="outline"
            onClick={() => setBrowseOffset((current) => current + browsePageSize)}
            disabled={browseLoading || !canBrowseForward}
          >
            Next
          </Button>
          <Badge tone="neutral" variant="soft">
            {totalDataPages > 0 ? `${currentDataPage}/${totalDataPages}` : '0/0'}
          </Badge>
        </div>
      </footer>
    </div>
  );

  const structurePane = !selectedDatabase ? (
    <EmptyState
      icon={Database}
      title="Select A Database"
      description="Choose a database in the sidebar to inspect schema metadata."
    />
  ) : !selectedEntity ? (
    <EmptyState
      icon={FolderTree}
      title="Select A Table"
      description="Choose a table or view in the sidebar to inspect it."
    />
  ) : (
    <StructurePane
      entity={selectedEntity}
      state={structureState}
      section={structureSection}
      loading={structureLoading}
      error={structureError}
      onSectionChange={setStructureSection}
      onRefresh={() => void loadStructure()}
      onDrop={handleOpenDropEntity}
    />
  );

  return (
    <>
      <PluginShell.Body className="overflow-hidden">
        <Split direction="horizontal" autoSaveId="sqlite">
          <Split.Pane defaultSize="300px" minSize="240px" maxSize="420px">
            <ExplorerSidebar
              databases={databases}
              databaseLoading={databaseLoading}
              databaseError={databaseError}
              explorerStateByDatabase={explorerStateByDatabase}
              expandedDatabaseIds={expandedDatabaseIds}
              expandedSchemaKeys={expandedSchemaKeys}
              selectedDatabase={selectedDatabase}
              selectedEntityKey={selectedEntityKey}
              objectSearch={objectSearch}
              searchRef={objectSearchRef}
              refreshing={databaseLoading || entityLoading}
              canDropAll={
                !!selectedDatabaseId && entities.length > 0 && !databaseLoading && !entityLoading
              }
              onObjectSearchChange={setObjectSearch}
              onRefresh={() => void refreshWorkspace()}
              onDropAll={handleOpenDropAllEntities}
              onDatabaseClick={setSelectedDatabaseId}
              onDatabaseDoubleClick={(databaseId) => {
                setSelectedDatabaseId(databaseId);
                setActiveTab('query');
              }}
              onDatabaseExpandedChange={(databaseId, expanded) =>
                setExpandedDatabaseIds((current) =>
                  expanded
                    ? [...current.filter((id) => id !== databaseId), databaseId]
                    : current.filter((id) => id !== databaseId),
                )
              }
              onSchemaExpandedChange={(schemaKey, expanded) =>
                setExpandedSchemaKeys((current) =>
                  expanded
                    ? [...current.filter((key) => key !== schemaKey), schemaKey]
                    : current.filter((key) => key !== schemaKey),
                )
              }
              onEntityClick={(databaseId, entity) => {
                setEntitySelection(databaseId, entity);
                setActiveTab(entity.type === 'view' ? 'structure' : 'data');
              }}
            />
          </Split.Pane>

          <Split.Handle />

          <Split.Pane>
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as ActiveTab)}
              className="flex h-full min-h-0 flex-col"
            >
              <div className="flex shrink-0 items-center border-b border-border bg-card px-2 py-1.5">
                <Tabs.List aria-label="Workspace tabs">
                  <Tabs.Tab value="query">Query</Tabs.Tab>
                  <Tabs.Tab value="data">Data</Tabs.Tab>
                  <Tabs.Tab value="structure">Structure</Tabs.Tab>
                </Tabs.List>
              </div>
              <Tabs.Panel value="query" keepMounted className="flex min-h-0 flex-col">
                {queryPane}
              </Tabs.Panel>
              <Tabs.Panel value="data" className="flex min-h-0 flex-col">
                {dataPane}
              </Tabs.Panel>
              <Tabs.Panel value="structure" className="flex min-h-0 flex-col">
                {structurePane}
              </Tabs.Panel>
            </Tabs>
          </Split.Pane>
        </Split>
      </PluginShell.Body>

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

      <SqliteDropModal
        isOpen={!!activeDrop}
        target={activeDrop?.target ?? DEFAULT_DROP_TARGET}
        onClose={() => setActiveDrop(null)}
        onConfirm={handleConfirmDrop}
      />
    </>
  );
}

export default function SqlitePanel() {
  return (
    <PluginShell>
      <SqlitePanelContent />
    </PluginShell>
  );
}
