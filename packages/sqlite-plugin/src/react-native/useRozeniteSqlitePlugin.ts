import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useMemo, useRef } from 'react';
import { PLUGIN_ID, type SqliteEventMap } from '../shared/protocol';
import { normalizeSingleStatementSql, splitSqlStatements } from '../shared/sql';
import type {
  SqliteAdapter,
  SqliteExecuteStatementsError,
  SqliteQueryParams,
  SqliteStatementInput,
} from '../shared/types';
import { createSqliteDatabaseViews } from './sqlite-view';

export type RozeniteSqlitePluginOptions = {
  adapters: SqliteAdapter[];
};

const safeError = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const isExecuteStatementsError = (
  error: unknown,
): error is SqliteExecuteStatementsError =>
  error instanceof Error &&
  ('completedResults' in error || 'failedStatementIndex' in error);

export const useRozeniteSqlitePlugin = ({
  adapters,
}: RozeniteSqlitePluginOptions) => {
  const views = useMemo(() => createSqliteDatabaseViews(adapters), [adapters]);
  const client = useRozeniteDevToolsClient<SqliteEventMap>({
    pluginId: PLUGIN_ID,
  });
  const subscriptionsRef = useRef<Array<{ remove: () => void }>>([]);
  const databaseQueuesRef = useRef(new Map<string, Promise<void>>());

  useEffect(() => {
    if (!client) {
      return;
    }

    const enqueueDatabaseTask = async <T>(
      databaseId: string,
      task: () => Promise<T>,
    ): Promise<T> => {
      const queue =
        databaseQueuesRef.current.get(databaseId) ?? Promise.resolve();
      const next = queue.catch(() => undefined).then(task);

      databaseQueuesRef.current.set(
        databaseId,
        next.then(
          () => undefined,
          () => undefined,
        ),
      );

      return next;
    };

    const resolveDatabase = (databaseId: string) => {
      const database = views.find((view) => view.id === databaseId);

      if (!database) {
        throw new Error(`Unknown database "${databaseId}".`);
      }

      return database;
    };

    const executeStatements = async (
      databaseId: string,
      statements: SqliteStatementInput[],
    ) => {
      const database = resolveDatabase(databaseId);
      const normalizedStatements = statements.map(({ sql, params }) => ({
        sql: normalizeSingleStatementSql(sql),
        params,
      }));
      const results = await database.executeStatements(normalizedStatements);

      if (results.length !== normalizedStatements.length) {
        throw new Error(
          `Expected ${normalizedStatements.length} statement result(s), received ${results.length}.`,
        );
      }

      return {
        inputs: normalizedStatements,
        results,
      };
    };

    const executeSingleQuery = async (
      databaseId: string,
      sql: string,
      params?: SqliteQueryParams,
    ) => {
      const execution = await executeStatements(databaseId, [
        {
          sql,
          params,
        },
      ]);
      const result = execution.results[0];

      if (!result) {
        throw new Error('The query completed without a result payload.');
      }

      return result;
    };

    client.send('sqlite:ready', { timestamp: Date.now() });

    subscriptionsRef.current.push(
      client.onMessage('sqlite:list-databases', ({ requestId }) => {
        client.send('sqlite:list-databases:result', {
          requestId,
          databases: views.map(({ id, name, adapterId, adapterName }) => ({
            id,
            name,
            adapterId,
            adapterName,
          })),
        });
      }),
    );

    subscriptionsRef.current.push(
      client.onMessage(
        'sqlite:query',
        async ({ requestId, databaseId, sql, params }) => {
          try {
            const result = await enqueueDatabaseTask(databaseId, () =>
              executeSingleQuery(databaseId, sql, params),
            );

            client.send('sqlite:query:result', {
              requestId,
              databaseId,
              result,
            });
          } catch (error) {
            client.send('sqlite:query:result', {
              requestId,
              databaseId,
              error: safeError(error),
            });
          }
        },
      ),
    );

    subscriptionsRef.current.push(
      client.onMessage(
        'sqlite:execute-script',
        async ({ requestId, databaseId, sql }) => {
          try {
            const result = await enqueueDatabaseTask(databaseId, async () => {
              const statementSegments = splitSqlStatements(sql);

              if (statementSegments.length === 0) {
                throw new Error('Query cannot be empty.');
              }

              const statementInputs = statementSegments.map((statement) => ({
                sql: statement.text,
              }));

              try {
                const execution = await executeStatements(
                  databaseId,
                  statementInputs,
                );

                return {
                  statements: statementSegments.map((statement, index) => ({
                    index,
                    start: statement.start,
                    end: statement.end,
                    input: execution.inputs[index],
                    execution: {
                      input: execution.inputs[index],
                      result: execution.results[index],
                    },
                  })),
                  totalStatementCount: statementSegments.length,
                  failedStatementIndex: null,
                };
              } catch (error) {
                if (!isExecuteStatementsError(error)) {
                  throw error;
                }

                const failedStatementIndex = Math.max(
                  0,
                  Math.min(
                    typeof error.failedStatementIndex === 'number'
                      ? error.failedStatementIndex
                      : (error.completedResults?.length ?? 0),
                    statementSegments.length - 1,
                  ),
                );
                const completedResults = (error.completedResults ?? []).slice(
                  0,
                  failedStatementIndex,
                );
                const completedStatements = completedResults.map(
                  (queryResult, index) => ({
                    index,
                    start: statementSegments[index].start,
                    end: statementSegments[index].end,
                    input: statementInputs[index],
                    execution: {
                      input: statementInputs[index],
                      result: queryResult,
                    },
                  }),
                );

                return {
                  statements: [
                    ...completedStatements,
                    {
                      index: failedStatementIndex,
                      start: statementSegments[failedStatementIndex].start,
                      end: statementSegments[failedStatementIndex].end,
                      input: statementInputs[failedStatementIndex],
                      error: safeError(error),
                    },
                  ],
                  totalStatementCount: statementSegments.length,
                  failedStatementIndex,
                };
              }
            });

            client.send('sqlite:execute-script:result', {
              requestId,
              databaseId,
              result,
            });
          } catch (error) {
            client.send('sqlite:execute-script:result', {
              requestId,
              databaseId,
              error: safeError(error),
            });
          }
        },
      ),
    );

    return () => {
      subscriptionsRef.current.forEach((subscription) => subscription.remove());
      subscriptionsRef.current = [];
      databaseQueuesRef.current.clear();
    };
  }, [client, views]);

  return client;
};
