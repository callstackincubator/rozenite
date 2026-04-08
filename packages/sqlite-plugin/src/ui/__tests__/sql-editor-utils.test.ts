import { describe, expect, it } from 'vitest';
import type {
  SqliteColumnInfo,
  SqliteEntity,
  SqliteSchema,
} from '../sqlite-introspection';
import {
  buildSqlCompletionSchema,
  createSqlEditorColumnCache,
  extractSqlEditorAliases,
  formatSqlScript,
  getSqlEditorColumnCompletionRequest,
  resolveSqlEditorEntityReference,
  setSqlEditorCachedColumns,
  syncSqlEditorColumnCacheDatabase,
} from '../sql-editor-utils';

const schemas: SqliteSchema[] = [
  {
    seq: 0,
    name: 'main',
    file: null,
  },
];

const entities: SqliteEntity[] = [
  {
    schemaName: 'main',
    name: 'projects',
    type: 'table',
    sql: 'CREATE TABLE projects(id INTEGER PRIMARY KEY, name TEXT)',
  },
];

const columns: SqliteColumnInfo[] = [
  {
    cid: 0,
    name: 'id',
    type: 'INTEGER',
    notNull: true,
    defaultValue: null,
    primaryKeyOrder: 1,
    hidden: 0,
  },
  {
    cid: 1,
    name: 'name',
    type: 'TEXT',
    notNull: false,
    defaultValue: null,
    primaryKeyOrder: 0,
    hidden: 0,
  },
];

describe('sql editor utilities', () => {
  it('formats SQLite SQL with uppercase keywords and multiline layout', () => {
    const formatted = formatSqlScript(
      'select id, name from projects where archived = 0 order by name',
    );

    expect(formatted).toContain('SELECT');
    expect(formatted).toContain('\nFROM\n  projects');
    expect(formatted).toContain('\nWHERE\n  archived = 0');
  });

  it('builds a completion schema from cached table columns', () => {
    const cache = setSqlEditorCachedColumns(
      createSqlEditorColumnCache('db-1'),
      'db-1',
      'main',
      'projects',
      columns,
    );
    const namespace = buildSqlCompletionSchema({
      columnCache: cache,
      databaseId: 'db-1',
      entities,
      schemas,
    }) as unknown as Record<
      string,
      {
        children: Record<
          string,
          {
            children: Array<{ label: string }>;
            self: { detail: string };
          }
        >;
      }
    >;

    expect(namespace.main.children.projects.self.detail).toBe('table');
    expect(namespace.main.children.projects.children).toEqual([
      expect.objectContaining({ label: 'id' }),
      expect.objectContaining({ label: 'name' }),
    ]);
  });

  it('resets cached columns when the selected database changes', () => {
    const initialCache = setSqlEditorCachedColumns(
      createSqlEditorColumnCache('db-1'),
      'db-1',
      'main',
      'projects',
      columns,
    );
    const nextCache = syncSqlEditorColumnCacheDatabase(initialCache, 'db-2');

    expect(nextCache.databaseId).toBe('db-2');
    expect(nextCache.entries).toEqual({});
  });

  it('resolves aliased table references for column completion', () => {
    const sql = 'SELECT * FROM main.projects AS p WHERE p.';
    const cursorPosition = sql.length;
    const request = getSqlEditorColumnCompletionRequest(sql, cursorPosition);

    expect(request).toEqual({
      schemaName: null,
      entityName: 'p',
      from: cursorPosition,
      to: cursorPosition,
    });

    const entity = resolveSqlEditorEntityReference({
      aliases: extractSqlEditorAliases(sql),
      entities,
      request: request!,
      selectedSchemaName: 'main',
    });

    expect(entity).toEqual(entities[0]);
  });
});
