import type {
  SqliteAdapter,
  SqliteDatabaseInfo,
  SqliteStatementInput,
} from '../shared/types';

export type SqliteDatabaseView = SqliteDatabaseInfo & {
  executeStatements: (
    statements: SqliteStatementInput[],
  ) => ReturnType<SqliteAdapter['databases'][number]['executeStatements']>;
};

export const createSqliteDatabaseViews = (
  adapters: SqliteAdapter[],
): SqliteDatabaseView[] =>
  adapters.flatMap((adapter) =>
    adapter.databases.map((database) => ({
      id: database.id,
      name: database.name,
      adapterId: adapter.id,
      adapterName: adapter.name,
      executeStatements: database.executeStatements,
    })),
  );
