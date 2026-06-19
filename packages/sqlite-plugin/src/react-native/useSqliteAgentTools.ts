import { useCallback } from 'react';
import { useRozenitePluginAgentTool, type AgentTool } from '@rozenite/agent-bridge';
import { formatSqliteError } from '../shared/bridge-values';
import { normalizeSingleStatementSql, splitSqlStatements } from '../shared/sql';
import type { SqliteExecuteStatementsError } from '../shared/types';
import type { SqliteDatabaseView } from './sqlite-view';

type ExecuteSqlInput = {
  databaseId: string;
  sql: string;
};

const pluginId = '@rozenite/sqlite-plugin';

const listDatabasesTool: AgentTool = {
  name: 'list-databases',
  description: 'List all registered SQLite databases.',
  inputSchema: { type: 'object', properties: {} },
};

const executeSqlTool: AgentTool = {
  name: 'execute-sql',
  description:
    'Execute one or more SQL statements against a database. Supports SELECT, INSERT, UPDATE, DELETE, PRAGMA, DDL, and multi-statement scripts. Returns per-statement results including rows, columns, and metadata. Statements are executed in order and stop on first error.',
  inputSchema: {
    type: 'object',
    properties: {
      databaseId: {
        type: 'string',
        description: 'Database ID from list-databases.',
      },
      sql: {
        type: 'string',
        description:
          'SQL to execute. May contain multiple semicolon-separated statements.',
      },
    },
    required: ['databaseId', 'sql'],
  },
};

const isExecuteStatementsError = (
  error: unknown,
): error is SqliteExecuteStatementsError =>
  error instanceof Error &&
  ('completedResults' in error || 'failedStatementIndex' in error);

export const useSqliteAgentTools = (views: SqliteDatabaseView[]) => {
  const resolveDatabase = useCallback(
    (databaseId: string) => {
      const database = views.find((view) => view.id === databaseId);

      if (!database) {
        const available = views.map((v) => v.id).join(', ');
        throw new Error(
          `Unknown databaseId "${databaseId}". Available: ${available || '(none)'}`,
        );
      }

      return database;
    },
    [views],
  );

  useRozenitePluginAgentTool({
    pluginId,
    tool: listDatabasesTool,
    handler: () => ({
      databases: views.map(({ id, name, adapterId, adapterName }) => ({
        id,
        name,
        adapterId,
        adapterName,
      })),
    }),
  });

  useRozenitePluginAgentTool<ExecuteSqlInput>({
    pluginId,
    tool: executeSqlTool,
    handler: async ({ databaseId, sql }) => {
      const database = resolveDatabase(databaseId);
      const statementSegments = splitSqlStatements(sql);

      if (statementSegments.length === 0) {
        throw new Error('SQL cannot be empty.');
      }

      const statementInputs = statementSegments.map((segment) => ({
        sql: normalizeSingleStatementSql(segment.text),
      }));

      try {
        const results = await database.executeStatements(statementInputs);

        return {
          databaseId,
          totalStatementCount: statementSegments.length,
          failedStatementIndex: null,
          statements: statementSegments.map((_, index) => {
            const result = results[index]!;
            return {
              index,
              sql: statementInputs[index]!.sql,
              rows: result.rows,
              columns: result.columns,
              metadata: result.metadata,
            };
          }),
        };
      } catch (error) {
        if (!isExecuteStatementsError(error)) {
          throw new Error(formatSqliteError(error));
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

        return {
          databaseId,
          totalStatementCount: statementSegments.length,
          failedStatementIndex,
          statements: [
            ...completedResults.map((result, index) => ({
              index,
              sql: statementInputs[index]!.sql,
              rows: result.rows,
              columns: result.columns,
              metadata: result.metadata,
            })),
            {
              index: failedStatementIndex,
              sql: statementInputs[failedStatementIndex]!.sql,
              error: formatSqliteError(error),
            },
          ],
        };
      }
    },
  });
};
