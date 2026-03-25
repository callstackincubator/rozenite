import type {
  SqliteDatabaseInfo,
  SqliteQueryParams,
  SqliteQueryResult,
  SqliteScriptResult,
} from './types';

export const PLUGIN_ID = '@rozenite/sqlite-plugin';

export type SqliteEventMap = {
  'sqlite:ready': { timestamp: number };
  'sqlite:list-databases': { requestId: string };
  'sqlite:list-databases:result': {
    requestId: string;
    databases: SqliteDatabaseInfo[];
    error?: string;
  };
  'sqlite:query': {
    requestId: string;
    databaseId: string;
    sql: string;
    params?: SqliteQueryParams;
  };
  'sqlite:query:result': {
    requestId: string;
    databaseId: string;
    result?: SqliteQueryResult;
    error?: string;
  };
  'sqlite:execute-script': {
    requestId: string;
    databaseId: string;
    sql: string;
  };
  'sqlite:execute-script:result': {
    requestId: string;
    databaseId: string;
    result?: SqliteScriptResult;
    error?: string;
  };
};
