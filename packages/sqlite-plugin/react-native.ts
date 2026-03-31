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

type CreateSqliteAdapter =
  typeof import('./src/react-native/adapters').createSqliteAdapter;
type CreateExpoSqliteAdapter =
  typeof import('./src/react-native/adapters').createExpoSqliteAdapter;

export let createSqliteAdapter: CreateSqliteAdapter;
export let createExpoSqliteAdapter: CreateExpoSqliteAdapter;
export let useRozeniteSqlitePlugin: typeof import('./src/react-native/useRozeniteSqlitePlugin').useRozeniteSqlitePlugin;

const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
  createSqliteAdapter =
    require('./src/react-native/adapters').createSqliteAdapter;
  createExpoSqliteAdapter =
    require('./src/react-native/adapters').createExpoSqliteAdapter;
  useRozeniteSqlitePlugin =
    require('./src/react-native/useRozeniteSqlitePlugin').useRozeniteSqlitePlugin;
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
}
