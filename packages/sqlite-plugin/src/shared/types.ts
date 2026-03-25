export type SqliteStatementType =
  | 'select'
  | 'insert'
  | 'update'
  | 'delete'
  | 'pragma'
  | 'create'
  | 'alter'
  | 'drop'
  | 'explain'
  | 'with'
  | 'other';

export type SqliteQueryParams = unknown[] | Record<string, unknown>;

export type SqliteStatementInput = {
  sql: string;
  params?: SqliteQueryParams;
};

export type SqliteQueryMetadata = {
  statementType: SqliteStatementType;
  rowCount: number;
  changes: number | null;
  lastInsertRowId: number | null;
  durationMs: number;
};

export type SqliteQueryResult = {
  rows: Record<string, unknown>[];
  columns: string[];
  metadata: SqliteQueryMetadata;
};

export type SqliteStatementExecutionResult = {
  input: SqliteStatementInput;
  result: SqliteQueryResult;
};

export type SqliteScriptStatementResult = {
  index: number;
  start: number;
  end: number;
  input: SqliteStatementInput;
  execution?: SqliteStatementExecutionResult;
  error?: string;
};

export type SqliteScriptResult = {
  statements: SqliteScriptStatementResult[];
  totalStatementCount: number;
  failedStatementIndex: number | null;
};

export type SqliteExecuteStatementsRunner = (
  statements: SqliteStatementInput[],
) => Promise<SqliteQueryResult[]>;

export type SqliteExecuteStatementsError = Error & {
  completedResults?: SqliteQueryResult[];
  failedStatementIndex?: number;
};

export type SqliteDatabaseNode = {
  id: string;
  name: string;
  executeStatements: SqliteExecuteStatementsRunner;
};

export type SqliteAdapter = {
  id: string;
  name: string;
  databases: SqliteDatabaseNode[];
};

export type SqliteDatabaseInfo = {
  id: string;
  name: string;
  adapterId: string;
  adapterName: string;
};
