export type {
  SqliteAdapter,
  SqliteDatabaseInfo,
  SqliteDatabaseNode,
  SqliteExecuteStatementsError,
  SqliteExecuteStatementsRunner,
  SqliteQueryMetadata,
  SqliteQueryParams,
  SqliteQueryResult,
  SqliteScriptResult,
  SqliteScriptStatementResult,
  SqliteStatementExecutionResult,
  SqliteStatementInput,
  SqliteStatementType,
} from './src/shared/types';
export type { CreateSqliteAdapterOptions } from './src/react-native/adapters/generic';
export type {
  CreateExpoSqliteAdapterOptions,
  ExpoSqliteLike,
} from './src/react-native/adapters/expo-sqlite';
export type { SqlStatementSegment } from './src/shared/sql';

type CreateSqliteAdapter =
  typeof import('./src/react-native/adapters').createSqliteAdapter;
type CreateExpoSqliteAdapter =
  typeof import('./src/react-native/adapters').createExpoSqliteAdapter;

export let createSqliteAdapter: CreateSqliteAdapter;
export let createExpoSqliteAdapter: CreateExpoSqliteAdapter;
export let useRozeniteSqlitePlugin: typeof import('./src/react-native/useRozeniteSqlitePlugin').useRozeniteSqlitePlugin;
export let classifySqlStatement: typeof import('./src/shared/sql').classifySqlStatement;
export let normalizeSingleStatementSql: typeof import('./src/shared/sql').normalizeSingleStatementSql;
export let splitSqlStatements: typeof import('./src/shared/sql').splitSqlStatements;
export let statementReturnsRows: typeof import('./src/shared/sql').statementReturnsRows;
export let decodeSqliteBridgeValue: typeof import('./src/shared/bridge-values').decodeSqliteBridgeValue;
export let formatSqliteError: typeof import('./src/shared/bridge-values').formatSqliteError;

const isDev = process.env.NODE_ENV !== 'production';
const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
  createSqliteAdapter =
    require('./src/react-native/adapters').createSqliteAdapter;
  createExpoSqliteAdapter =
    require('./src/react-native/adapters').createExpoSqliteAdapter;
  useRozeniteSqlitePlugin =
    require('./src/react-native/useRozeniteSqlitePlugin').useRozeniteSqlitePlugin;
  classifySqlStatement = require('./src/shared/sql').classifySqlStatement;
  normalizeSingleStatementSql =
    require('./src/shared/sql').normalizeSingleStatementSql;
  splitSqlStatements = require('./src/shared/sql').splitSqlStatements;
  statementReturnsRows = require('./src/shared/sql').statementReturnsRows;
  decodeSqliteBridgeValue =
    require('./src/shared/bridge-values').decodeSqliteBridgeValue;
  formatSqliteError = require('./src/shared/bridge-values').formatSqliteError;
} else {
  createSqliteAdapter = (options) => ({
    id: options.adapterId ?? 'sqlite',
    name: options.adapterName ?? 'SQLite',
    databases: [],
  });
  createExpoSqliteAdapter = (options) => ({
    id: options.adapterId ?? 'expo-sqlite',
    name: options.adapterName ?? 'Expo SQLite',
    databases: [],
  });
  useRozeniteSqlitePlugin = () => null;
  classifySqlStatement = () => 'other';
  normalizeSingleStatementSql = (sql) => sql;
  splitSqlStatements = () => [];
  statementReturnsRows = (_type): _type is never => false;
  decodeSqliteBridgeValue = (value) => value;
  formatSqliteError = () => 'Unknown SQLite error.';
}
