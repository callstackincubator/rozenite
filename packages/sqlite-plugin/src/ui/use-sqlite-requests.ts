import { useCallback, useEffect, useRef } from 'react';
import type { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type { SqliteEventMap } from '../shared/protocol';
import type {
  SqliteDatabaseInfo,
  SqliteQueryParams,
  SqliteQueryResult,
  SqliteScriptResult,
} from '../shared/types';
import { newRequestId, withTimeout } from './utils';

type PendingListResolver = (
  payload: SqliteEventMap['sqlite:list-databases:result'],
) => void;
type PendingQueryResolver = (
  payload: SqliteEventMap['sqlite:query:result'],
) => void;
type PendingScriptResolver = (
  payload: SqliteEventMap['sqlite:execute-script:result'],
) => void;

export const useSqliteRequests = (
  client: RozeniteDevToolsClient<SqliteEventMap> | null,
) => {
  const listResolversRef = useRef(new Map<string, PendingListResolver>());
  const queryResolversRef = useRef(new Map<string, PendingQueryResolver>());
  const scriptResolversRef = useRef(new Map<string, PendingScriptResolver>());

  useEffect(() => {
    if (!client) {
      return;
    }

    const listSubscription = client.onMessage(
      'sqlite:list-databases:result',
      (payload) => {
        const resolve = listResolversRef.current.get(payload.requestId);
        if (!resolve) {
          return;
        }

        listResolversRef.current.delete(payload.requestId);
        resolve(payload);
      },
    );

    const querySubscription = client.onMessage(
      'sqlite:query:result',
      (payload) => {
        const resolve = queryResolversRef.current.get(payload.requestId);
        if (!resolve) {
          return;
        }

        queryResolversRef.current.delete(payload.requestId);
        resolve(payload);
      },
    );

    const scriptSubscription = client.onMessage(
      'sqlite:execute-script:result',
      (payload) => {
        const resolve = scriptResolversRef.current.get(payload.requestId);
        if (!resolve) {
          return;
        }

        scriptResolversRef.current.delete(payload.requestId);
        resolve(payload);
      },
    );

    return () => {
      listSubscription.remove();
      querySubscription.remove();
      scriptSubscription.remove();
      listResolversRef.current.clear();
      queryResolversRef.current.clear();
      scriptResolversRef.current.clear();
    };
  }, [client]);

  const requestDatabases = useCallback(async (): Promise<
    SqliteDatabaseInfo[]
  > => {
    if (!client) {
      return [];
    }

    const requestId = newRequestId();
    const pending = new Promise<SqliteEventMap['sqlite:list-databases:result']>(
      (resolve) => {
        listResolversRef.current.set(requestId, resolve);
      },
    );

    client.send('sqlite:list-databases', { requestId });

    const response = await withTimeout(
      pending,
      8000,
      'Timeout fetching databases.',
    );

    if (response.error) {
      throw new Error(response.error);
    }

    return response.databases;
  }, [client]);

  const requestQuery = useCallback(
    async (input: {
      databaseId: string;
      sql: string;
      params?: SqliteQueryParams;
    }): Promise<SqliteQueryResult> => {
      if (!client) {
        throw new Error('Rozenite client is not connected.');
      }

      const requestId = newRequestId();
      const pending = new Promise<SqliteEventMap['sqlite:query:result']>(
        (resolve) => {
          queryResolversRef.current.set(requestId, resolve);
        },
      );

      client.send('sqlite:query', {
        requestId,
        databaseId: input.databaseId,
        sql: input.sql,
        params: input.params,
      });

      const response = await withTimeout(
        pending,
        15000,
        'Timeout executing SQL query.',
      );

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.result) {
        throw new Error('The query completed without a result payload.');
      }

      return response.result;
    },
    [client],
  );

  const requestScriptExecution = useCallback(
    async (input: {
      databaseId: string;
      sql: string;
    }): Promise<SqliteScriptResult> => {
      if (!client) {
        throw new Error('Rozenite client is not connected.');
      }

      const requestId = newRequestId();
      const pending = new Promise<
        SqliteEventMap['sqlite:execute-script:result']
      >((resolve) => {
        scriptResolversRef.current.set(requestId, resolve);
      });

      client.send('sqlite:execute-script', {
        requestId,
        databaseId: input.databaseId,
        sql: input.sql,
      });

      const response = await withTimeout(
        pending,
        30000,
        'Timeout executing SQL script.',
      );

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.result) {
        throw new Error('The script completed without a result payload.');
      }

      return response.result;
    },
    [client],
  );

  return {
    requestDatabases,
    requestQuery,
    requestScriptExecution,
  };
};
