import type {
  SqliteAdapter,
  SqliteDatabaseNode,
  SqliteExecuteStatementsRunner,
} from '../../shared/types';

type SqliteDatabaseConfig = {
  name?: string;
  executeStatements: SqliteExecuteStatementsRunner;
};

type SingleDatabaseOptions = {
  database: SqliteExecuteStatementsRunner | SqliteDatabaseConfig;
  adapterId?: string;
  adapterName?: string;
  databaseName?: string;
};

type MultiDatabaseOptions = {
  databases: Record<
    string,
    SqliteExecuteStatementsRunner | SqliteDatabaseConfig
  >;
  adapterId?: string;
  adapterName?: string;
};

export type CreateSqliteAdapterOptions =
  | SingleDatabaseOptions
  | MultiDatabaseOptions;

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'database';

const createDatabaseId = (adapterId: string, seed: string, index: number) =>
  `${adapterId}__${slugify(seed)}__${index.toString(36)}`;

const resolveDatabaseConfig = (
  config: SqliteExecuteStatementsRunner | SqliteDatabaseConfig,
) => (typeof config === 'function' ? { executeStatements: config } : config);

const toDatabaseNode = (
  adapterId: string,
  databaseKey: string,
  config: SqliteExecuteStatementsRunner | SqliteDatabaseConfig,
  index: number,
  fallbackName?: string,
): SqliteDatabaseNode => {
  const resolved = resolveDatabaseConfig(config);
  const name = resolved.name ?? fallbackName ?? databaseKey;

  return {
    id: createDatabaseId(adapterId, `${databaseKey}-${name}`, index),
    name,
    executeStatements: resolved.executeStatements,
  };
};

export const createSqliteAdapter = (
  options: CreateSqliteAdapterOptions,
): SqliteAdapter => {
  const { adapterId = 'sqlite', adapterName = 'SQLite' } = options;

  const databases =
    'databases' in options
      ? Object.entries(options.databases).map(([key, config], index) =>
          toDatabaseNode(adapterId, key, config, index),
        )
      : [
          toDatabaseNode(
            adapterId,
            options.databaseName ?? 'default',
            options.database,
            0,
            options.databaseName ?? 'Default Database',
          ),
        ];

  return {
    id: adapterId,
    name: adapterName,
    databases,
  };
};
