import {
  classifySqlStatement,
  normalizeSingleStatementSql,
  statementReturnsRows,
} from '../../shared/sql';
import {
  decodeSqliteBridgeValue,
  formatSqliteError,
} from '../../shared/bridge-values';
import type {
  SqliteAdapter,
  SqliteExecuteStatementsError,
  SqliteExecuteStatementsRunner,
  SqliteStatementInput,
  SqliteQueryResult,
} from '../../shared/types';
import {
  createSqliteAdapter,
  type CreateSqliteAdapterOptions,
} from './generic';

export type ExpoSqliteLike = {
  getAllAsync: (...args: any[]) => Promise<Record<string, unknown>[]>;
  runAsync: (...args: any[]) => Promise<{
    changes: number;
    lastInsertRowId: number;
  }>;
};

type SingleDatabaseOptions = {
  database: ExpoSqliteLike | { database: ExpoSqliteLike; name?: string };
  adapterId?: string;
  adapterName?: string;
  databaseName?: string;
};

type MultiDatabaseOptions = {
  databases: Record<
    string,
    ExpoSqliteLike | { database: ExpoSqliteLike; name?: string }
  >;
  adapterId?: string;
  adapterName?: string;
};

export type CreateExpoSqliteAdapterOptions =
  | SingleDatabaseOptions
  | MultiDatabaseOptions;

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const safeError = (error: unknown) => formatSqliteError(error);

const createExecuteStatementsError = (
  message: string,
  options: {
    completedResults?: SqliteQueryResult[];
    failedStatementIndex?: number;
    cause?: unknown;
  } = {},
): SqliteExecuteStatementsError => Object.assign(new Error(message), options);

const toBridgeSafeValue = (value: unknown): unknown => {
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Array.from(value);
  }

  if (value instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(value));
  }

  if (Array.isArray(value)) {
    return value.map(toBridgeSafeValue);
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        toBridgeSafeValue(nestedValue),
      ]),
    );
  }

  return String(value);
};

const normalizeRows = (rows: Record<string, unknown>[]) =>
  rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        toBridgeSafeValue(value),
      ]),
    ),
  );

const executeSingleStatement = async (
  database: ExpoSqliteLike,
  { sql, params }: SqliteStatementInput,
): Promise<SqliteQueryResult> => {
  const normalizedSql = normalizeSingleStatementSql(sql);
  const statementType = classifySqlStatement(normalizedSql);
  const startedAt = now();
  const decodedParams =
    params === undefined ? undefined : decodeSqliteBridgeValue(params);

  if (statementReturnsRows(statementType)) {
    const rows = normalizeRows(
      decodedParams === undefined
        ? await database.getAllAsync(normalizedSql)
        : await database.getAllAsync(normalizedSql, decodedParams),
    );
    const durationMs = now() - startedAt;

    return {
      rows,
      columns: Object.keys(rows[0] ?? {}),
      metadata: {
        statementType,
        rowCount: rows.length,
        changes: null,
        lastInsertRowId: null,
        durationMs,
      },
    };
  }

  const result =
    decodedParams === undefined
      ? await database.runAsync(normalizedSql)
      : await database.runAsync(normalizedSql, decodedParams);
  const durationMs = now() - startedAt;

  return {
    rows: [],
    columns: [],
    metadata: {
      statementType,
      rowCount: 0,
      changes: typeof result.changes === 'number' ? result.changes : null,
      lastInsertRowId:
        typeof result.lastInsertRowId === 'number'
          ? result.lastInsertRowId
          : null,
      durationMs,
    },
  };
};

const createExpoExecuteStatementsRunner = (
  database: ExpoSqliteLike,
): SqliteExecuteStatementsRunner => {
  return async (statements) => {
    const results: SqliteQueryResult[] = [];

    for (let index = 0; index < statements.length; index += 1) {
      try {
        results.push(await executeSingleStatement(database, statements[index]));
      } catch (error) {
        throw createExecuteStatementsError(safeError(error), {
          completedResults: results,
          failedStatementIndex: index,
          cause: error,
        });
      }
    }

    return results;
  };
};

const resolveDatabaseConfig = (
  config: ExpoSqliteLike | { database: ExpoSqliteLike; name?: string },
) => ('database' in config ? config : { database: config });

export const createExpoSqliteAdapter = (
  options: CreateExpoSqliteAdapterOptions,
): SqliteAdapter => {
  const genericOptions: CreateSqliteAdapterOptions =
    'databases' in options
      ? {
          adapterId: options.adapterId ?? 'expo-sqlite',
          adapterName: options.adapterName ?? 'Expo SQLite',
          databases: Object.fromEntries(
            Object.entries(options.databases).map(([key, config]) => {
              const resolved = resolveDatabaseConfig(config);

              return [
                key,
                {
                  name: resolved.name ?? key,
                  executeStatements: createExpoExecuteStatementsRunner(
                    resolved.database,
                  ),
                },
              ];
            }),
          ),
        }
      : {
          adapterId: options.adapterId ?? 'expo-sqlite',
          adapterName: options.adapterName ?? 'Expo SQLite',
          databaseName: options.databaseName,
          database: (() => {
            const resolved = resolveDatabaseConfig(options.database);

            return {
              name: resolved.name ?? options.databaseName,
              executeStatements: createExpoExecuteStatementsRunner(
                resolved.database,
              ),
            };
          })(),
        };

  return createSqliteAdapter(genericOptions);
};
