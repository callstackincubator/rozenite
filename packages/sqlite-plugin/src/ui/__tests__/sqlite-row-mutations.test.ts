import { describe, expect, it } from 'vitest';
import type { SqliteEntity } from '../sqlite-introspection';
import {
  SQLITE_HIDDEN_ROWID_COLUMN_ID,
  buildRowDeleteMutation,
  buildRowUpdateMutation,
  getAvailableRowIdIdentifier,
  getCompatibleValueKinds,
  getEditableColumns,
  getPrimaryKeyColumns,
  getRowMutationDescriptor,
} from '../sqlite-row-mutations';

const buildEntity = (sql: string): SqliteEntity => ({
  schemaName: 'main',
  name: 'projects',
  type: 'table',
  sql,
});

describe('sqlite row mutation helpers', () => {
  it('extracts primary-key columns in SQLite order', () => {
    expect(
      getPrimaryKeyColumns([
        {
          cid: 0,
          name: 'name',
          type: 'TEXT',
          notNull: true,
          defaultValue: null,
          primaryKeyOrder: 2,
          hidden: 0,
        },
        {
          cid: 1,
          name: 'id',
          type: 'INTEGER',
          notNull: true,
          defaultValue: null,
          primaryKeyOrder: 1,
          hidden: 0,
        },
      ]).map((column) => column.name),
    ).toEqual(['id', 'name']);
  });

  it('keeps only non-hidden, non-primary columns editable', () => {
    expect(
      getEditableColumns([
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
          name: 'title',
          type: 'TEXT',
          notNull: false,
          defaultValue: null,
          primaryKeyOrder: 0,
          hidden: 0,
        },
        {
          cid: 2,
          name: 'generated_value',
          type: 'TEXT',
          notNull: false,
          defaultValue: null,
          primaryKeyOrder: 0,
          hidden: 2,
        },
      ]).map((column) => column.name),
    ).toEqual(['title']);
  });

  it('falls back to a usable rowid alias for tables without a primary key', () => {
    const columns = [
      {
        cid: 0,
        name: 'rowid',
        type: 'INTEGER',
        notNull: false,
        defaultValue: null,
        primaryKeyOrder: 0,
        hidden: 0,
      },
      {
        cid: 1,
        name: 'title',
        type: 'TEXT',
        notNull: false,
        defaultValue: null,
        primaryKeyOrder: 0,
        hidden: 0,
      },
    ];

    expect(getAvailableRowIdIdentifier(columns)).toBe('_rowid_');
    expect(
      getRowMutationDescriptor(
        buildEntity('CREATE TABLE projects(rowid INTEGER, title TEXT)'),
        columns,
      ),
    ).toEqual({
      mode: 'rowid',
      rowIdIdentifier: '_rowid_',
    });
  });

  it('limits editable kinds to text-compatible inputs for TEXT columns', () => {
    expect(
      getCompatibleValueKinds(
        {
          cid: 0,
          name: 'title',
          type: 'TEXT',
          notNull: false,
          defaultValue: null,
          primaryKeyOrder: 0,
          hidden: 0,
        },
        'alpha',
      ),
    ).toEqual(['text']);
  });

  it('limits editable kinds to numeric-compatible inputs for numeric columns', () => {
    expect(
      getCompatibleValueKinds(
        {
          cid: 0,
          name: 'progress',
          type: 'INTEGER',
          notNull: false,
          defaultValue: null,
          primaryKeyOrder: 0,
          hidden: 0,
        },
        1,
      ),
    ).toEqual(['number']);
  });

  it('limits editable kinds to boolean-compatible inputs for BOOLEAN columns', () => {
    expect(
      getCompatibleValueKinds(
        {
          cid: 0,
          name: 'enabled',
          type: 'BOOLEAN',
          notNull: false,
          defaultValue: null,
          primaryKeyOrder: 0,
          hidden: 0,
        },
        true,
      ),
    ).toEqual(['boolean']);
  });

  it('disables row mutations for WITHOUT ROWID tables that lack a primary key', () => {
    expect(
      getRowMutationDescriptor(
        buildEntity(
          'CREATE TABLE projects(title TEXT, slug TEXT) WITHOUT ROWID',
        ),
        [
          {
            cid: 0,
            name: 'title',
            type: 'TEXT',
            notNull: false,
            defaultValue: null,
            primaryKeyOrder: 0,
            hidden: 0,
          },
        ],
      ),
    ).toBeNull();
  });

  it('builds an UPDATE statement that matches by primary key', () => {
    expect(
      buildRowUpdateMutation({
        entity: buildEntity(
          'CREATE TABLE projects(id INTEGER PRIMARY KEY, title TEXT, archived INTEGER)',
        ),
        columns: [
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
            name: 'title',
            type: 'TEXT',
            notNull: false,
            defaultValue: null,
            primaryKeyOrder: 0,
            hidden: 0,
          },
          {
            cid: 2,
            name: 'archived',
            type: 'INTEGER',
            notNull: false,
            defaultValue: null,
            primaryKeyOrder: 0,
            hidden: 0,
          },
        ],
        row: {
          id: 7,
          title: 'Before',
          archived: 0,
        },
        descriptor: {
          mode: 'primary-key',
          primaryKeyColumns: [
            {
              cid: 0,
              name: 'id',
              type: 'INTEGER',
              notNull: true,
              defaultValue: null,
              primaryKeyOrder: 1,
              hidden: 0,
            },
          ],
        },
        nextValues: {
          title: 'After',
          archived: 1,
        },
      }),
    ).toEqual({
      sql: 'UPDATE "main"."projects" SET "title" = ?, "archived" = ? WHERE "id" = ?',
      params: ['After', 1, 7],
    });
  });

  it('builds a DELETE statement that matches by composite primary key', () => {
    expect(
      buildRowDeleteMutation({
        entity: buildEntity(
          'CREATE TABLE projects(tenant_id INTEGER, slug TEXT, PRIMARY KEY (tenant_id, slug))',
        ),
        row: {
          tenant_id: 42,
          slug: 'alpha',
        },
        descriptor: {
          mode: 'primary-key',
          primaryKeyColumns: [
            {
              cid: 0,
              name: 'tenant_id',
              type: 'INTEGER',
              notNull: true,
              defaultValue: null,
              primaryKeyOrder: 1,
              hidden: 0,
            },
            {
              cid: 1,
              name: 'slug',
              type: 'TEXT',
              notNull: true,
              defaultValue: null,
              primaryKeyOrder: 2,
              hidden: 0,
            },
          ],
        },
      }),
    ).toEqual({
      sql: 'DELETE FROM "main"."projects" WHERE "tenant_id" = ? AND "slug" = ?',
      params: [42, 'alpha'],
    });
  });

  it('builds rowid-backed mutations for tables without primary keys', () => {
    expect(
      buildRowDeleteMutation({
        entity: buildEntity('CREATE TABLE projects(title TEXT)'),
        row: {
          title: 'Draft',
          [SQLITE_HIDDEN_ROWID_COLUMN_ID]: 13,
        },
        descriptor: {
          mode: 'rowid',
          rowIdIdentifier: 'rowid',
        },
      }),
    ).toEqual({
      sql: 'DELETE FROM "main"."projects" WHERE rowid = ?',
      params: [13],
    });
  });
});
