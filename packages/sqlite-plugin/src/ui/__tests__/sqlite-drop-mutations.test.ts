import { describe, expect, it } from 'vitest';
import {
  buildDropAllEntitiesSql,
  buildDropEntitySql,
  buildSetForeignKeysSql,
  isForeignKeysEnabled,
  orderEntitiesForDrop,
  SQLITE_READ_FOREIGN_KEYS_SQL,
  type SqliteDropTarget,
} from '../sqlite-drop-mutations';

describe('buildDropEntitySql', () => {
  it('builds a DROP TABLE statement for a table entity', () => {
    expect(
      buildDropEntitySql({
        schemaName: 'main',
        name: 'projects',
        type: 'table',
      }),
    ).toBe('DROP TABLE "main"."projects"');
  });

  it('builds a DROP VIEW statement for a view entity', () => {
    expect(
      buildDropEntitySql({
        schemaName: 'main',
        name: 'active_projects',
        type: 'view',
      }),
    ).toBe('DROP VIEW "main"."active_projects"');
  });

  it('quotes identifiers containing double quotes by doubling them', () => {
    expect(
      buildDropEntitySql({
        schemaName: 'main',
        name: 'weird"table',
        type: 'table',
      }),
    ).toBe('DROP TABLE "main"."weird""table"');
  });

  it('quotes identifiers containing dots so they are not read as separators', () => {
    expect(
      buildDropEntitySql({
        schemaName: 'main',
        name: 'schema.like.name',
        type: 'table',
      }),
    ).toBe('DROP TABLE "main"."schema.like.name"');
  });

  it('quotes schema names containing double quotes and dots as well', () => {
    expect(
      buildDropEntitySql({
        schemaName: 'weird"schema.name',
        name: 'projects',
        type: 'view',
      }),
    ).toBe('DROP VIEW "weird""schema.name"."projects"');
  });
});

describe('orderEntitiesForDrop', () => {
  it('moves all views before all tables while preserving relative order', () => {
    const entities: SqliteDropTarget[] = [
      { schemaName: 'main', name: 'a_table', type: 'table' },
      { schemaName: 'main', name: 'b_view', type: 'view' },
      { schemaName: 'main', name: 'c_table', type: 'table' },
      { schemaName: 'main', name: 'd_view', type: 'view' },
    ];

    expect(orderEntitiesForDrop(entities).map((entity) => entity.name)).toEqual([
      'b_view',
      'd_view',
      'a_table',
      'c_table',
    ]);
  });

  it('returns an empty array for an empty database', () => {
    expect(orderEntitiesForDrop([])).toEqual([]);
  });
});

describe('buildDropAllEntitiesSql', () => {
  it('emits DROP VIEW statements before DROP TABLE statements', () => {
    const entities: SqliteDropTarget[] = [
      { schemaName: 'main', name: 'projects', type: 'table' },
      { schemaName: 'main', name: 'active_projects', type: 'view' },
    ];

    expect(buildDropAllEntitiesSql(entities)).toBe(
      'DROP VIEW "main"."active_projects";\nDROP TABLE "main"."projects";',
    );
  });

  it('quotes every identifier in the generated script', () => {
    const entities: SqliteDropTarget[] = [
      { schemaName: 'main', name: 'weird"table', type: 'table' },
      { schemaName: 'main', name: 'schema.view', type: 'view' },
    ];

    expect(buildDropAllEntitiesSql(entities)).toBe(
      'DROP VIEW "main"."schema.view";\nDROP TABLE "main"."weird""table";',
    );
  });

  it('returns an empty string for an empty database', () => {
    expect(buildDropAllEntitiesSql([])).toBe('');
  });
});

describe('foreign key pragma helpers', () => {
  it('exposes the read-only pragma statement', () => {
    expect(SQLITE_READ_FOREIGN_KEYS_SQL).toBe('PRAGMA foreign_keys');
  });

  it('builds a statement enabling foreign keys', () => {
    expect(buildSetForeignKeysSql(true)).toBe('PRAGMA foreign_keys = ON');
  });

  it('builds a statement disabling foreign keys', () => {
    expect(buildSetForeignKeysSql(false)).toBe('PRAGMA foreign_keys = OFF');
  });

  it('treats a foreign_keys value of 1 as enabled', () => {
    expect(isForeignKeysEnabled([{ foreign_keys: 1 }])).toBe(true);
  });

  it('treats a foreign_keys value of 0 as disabled', () => {
    expect(isForeignKeysEnabled([{ foreign_keys: 0 }])).toBe(false);
  });

  it('treats an empty result set as disabled', () => {
    expect(isForeignKeysEnabled([])).toBe(false);
  });
});
