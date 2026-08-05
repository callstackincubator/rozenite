import { quoteSqlIdentifier } from '../shared/sql';
import type { SqliteEntity } from './sqlite-introspection';

export type SqliteDropTarget = Pick<
  SqliteEntity,
  'schemaName' | 'name' | 'type'
>;

const buildQualifiedEntityName = (schemaName: string, entityName: string) =>
  `${quoteSqlIdentifier(schemaName)}.${quoteSqlIdentifier(entityName)}`;

/**
 * Builds a single `DROP TABLE` / `DROP VIEW` statement for the given entity.
 * Identifiers are quoted (never parameterized, since SQLite does not support
 * parameter binding for identifiers), so this is the only place that needs to
 * get quoting right.
 */
export const buildDropEntitySql = (entity: SqliteDropTarget): string => {
  const keyword = entity.type === 'view' ? 'VIEW' : 'TABLE';
  return `DROP ${keyword} ${buildQualifiedEntityName(entity.schemaName, entity.name)}`;
};

/**
 * Orders entities so that views are dropped before tables, preserving the
 * relative order within each group. This keeps a view that references a
 * table from ever being left dangling mid-sweep.
 */
export const orderEntitiesForDrop = (
  entities: SqliteDropTarget[],
): SqliteDropTarget[] => [
  ...entities.filter((entity) => entity.type === 'view'),
  ...entities.filter((entity) => entity.type === 'table'),
];

/**
 * Builds the full drop-everything script for a database sweep: every view,
 * then every table, each as its own statement. Returns an empty string when
 * there is nothing to drop.
 */
export const buildDropAllEntitiesSql = (entities: SqliteDropTarget[]): string =>
  orderEntitiesForDrop(entities)
    .map((entity) => `${buildDropEntitySql(entity)};`)
    .join('\n');

export const SQLITE_READ_FOREIGN_KEYS_SQL = 'PRAGMA foreign_keys';

/**
 * `PRAGMA foreign_keys` is per-connection and not parameterizable; the value
 * is always a literal 0/1 keyword, never user input, so this is safe to
 * inline directly.
 */
export const buildSetForeignKeysSql = (enabled: boolean): string =>
  `PRAGMA foreign_keys = ${enabled ? 'ON' : 'OFF'}`;

export const isForeignKeysEnabled = (
  rows: Record<string, unknown>[],
): boolean => {
  const rawValue = rows[0]?.foreign_keys;
  return Number(rawValue) === 1;
};
