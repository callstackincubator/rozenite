import { describe, expect, it } from 'vitest';
import { buildExplorerGroups, getEntityKey, getSchemaKey } from '../sqlite-explorer';
import type { SqliteEntity, SqliteSchema } from '../sqlite-introspection';

const schemas: SqliteSchema[] = [
  { seq: 0, name: 'main', file: '/app.db' },
  { seq: 2, name: 'archive', file: '/archive.db' },
];

const entity = (
  schemaName: string,
  name: string,
  type: SqliteEntity['type'] = 'table',
): SqliteEntity => ({ schemaName, name, type, sql: null });

const entities = [
  entity('main', 'users'),
  entity('main', 'orders'),
  entity('main', 'active_users', 'view'),
  entity('archive', 'old_orders'),
];

describe('buildExplorerGroups', () => {
  it('splits each schema into tables and views', () => {
    const [main, archive] = buildExplorerGroups(schemas, entities, '');

    expect(main.tables.map((item) => item.name)).toEqual(['users', 'orders']);
    expect(main.views.map((item) => item.name)).toEqual(['active_users']);
    expect(archive.tables.map((item) => item.name)).toEqual(['old_orders']);
    expect(archive.views).toEqual([]);
  });

  it('filters entities by name, type or schema and hides schemas with no match', () => {
    const groups = buildExplorerGroups(schemas, entities, ' ORDERS ');

    expect(groups.map((group) => group.schema.name)).toEqual(['main', 'archive']);
    expect(groups[0].tables.map((item) => item.name)).toEqual(['orders']);
    expect(groups[0].views).toEqual([]);

    const onlyViews = buildExplorerGroups(schemas, entities, 'view');
    expect(onlyViews.map((group) => group.schema.name)).toEqual(['main']);
    expect(onlyViews[0].views.map((item) => item.name)).toEqual(['active_users']);
  });

  it('keeps a schema visible when only its own name matches', () => {
    const groups = buildExplorerGroups(schemas, entities, 'archive');

    expect(groups.map((group) => group.schema.name)).toEqual(['archive']);
    expect(groups[0].tables.map((item) => item.name)).toEqual(['old_orders']);

    const [emptyMatch] = buildExplorerGroups(schemas, [], 'main');
    expect(emptyMatch.schema.name).toBe('main');
    expect(emptyMatch.tables).toEqual([]);
  });

  it('returns nothing when no schema or entity matches', () => {
    expect(buildExplorerGroups(schemas, entities, 'nope')).toEqual([]);
  });
});

describe('explorer keys', () => {
  it('builds keys that do not collide across databases or schemas', () => {
    expect(getEntityKey('db:a', 'main', 'users')).not.toBe(getEntityKey('db:b', 'main', 'users'));
    expect(getEntityKey('a', 'b.c', 'd')).not.toBe(getEntityKey('a', 'b', 'c.d'));
    expect(getSchemaKey('a', 'main')).not.toBe(getSchemaKey('b', 'main'));
  });
});
