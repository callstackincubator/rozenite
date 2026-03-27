import { escapeSqlString, quoteSqlIdentifier } from '../shared/sql';
import type { SqliteQueryResult } from '../shared/types';

export type SqliteEntityType = 'table' | 'view';

export type SqliteSchema = {
  seq: number;
  name: string;
  file: string | null;
};

export type SqliteEntity = {
  schemaName: string;
  name: string;
  type: SqliteEntityType;
  sql: string | null;
};

export type SqliteColumnInfo = {
  cid: number;
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
  primaryKeyOrder: number;
  hidden: number;
};

export type SqliteForeignKeyInfo = {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string | null;
  onUpdate: string;
  onDelete: string;
  match: string;
};

export type SqliteIndexInfo = {
  seq: number;
  name: string;
  unique: boolean;
  origin: string;
  partial: boolean;
};

export type SqliteIndexColumnInfo = {
  seqno: number;
  cid: number;
  name: string;
};

const buildQualifiedEntityName = (schemaName: string, entityName: string) =>
  `${quoteSqlIdentifier(schemaName)}.${quoteSqlIdentifier(entityName)}`;

const buildPragmaPrefix = (schemaName: string) =>
  `${quoteSqlIdentifier(schemaName)}.`;

const asString = (value: unknown) =>
  typeof value === 'string' ? value : String(value ?? '');
const asNullableString = (value: unknown) =>
  value == null ? null : String(value);
const asNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const LIST_SCHEMAS_SQL = 'PRAGMA database_list';

export const buildListEntitiesSql = (schemaName: string) => `
SELECT
  name,
  type,
  sql
FROM ${quoteSqlIdentifier(schemaName)}.sqlite_schema
WHERE type IN ('table', 'view')
  AND name NOT LIKE 'sqlite_%'
ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name COLLATE NOCASE
`;

export const buildBrowseEntitySql = (
  schemaName: string,
  entityName: string,
  limit: number,
  offset: number,
  rowIdIdentifier?: string | null,
) =>
  `SELECT ${
    rowIdIdentifier
      ? `${rowIdIdentifier} AS "__sqlite-hidden-rowid__", `
      : ''
  }* FROM ${buildQualifiedEntityName(schemaName, entityName)} LIMIT ${Math.max(1, Math.floor(limit))} OFFSET ${Math.max(0, Math.floor(offset))}`;

export const buildEntityCountSql = (schemaName: string, entityName: string) =>
  `SELECT COUNT(*) AS count FROM ${buildQualifiedEntityName(schemaName, entityName)}`;

export const buildCreateSqlLookup = (
  schemaName: string,
  entityName: string,
) => `
SELECT sql
FROM ${quoteSqlIdentifier(schemaName)}.sqlite_schema
WHERE type IN ('table', 'view')
  AND name = ${escapeSqlString(entityName)}
LIMIT 1
`;

export const buildTableXInfoSql = (schemaName: string, entityName: string) =>
  `PRAGMA ${buildPragmaPrefix(schemaName)}table_xinfo(${escapeSqlString(entityName)})`;

export const buildForeignKeySql = (schemaName: string, entityName: string) =>
  `PRAGMA ${buildPragmaPrefix(schemaName)}foreign_key_list(${escapeSqlString(entityName)})`;

export const buildIndexListSql = (schemaName: string, entityName: string) =>
  `PRAGMA ${buildPragmaPrefix(schemaName)}index_list(${escapeSqlString(entityName)})`;

export const buildIndexInfoSql = (schemaName: string, indexName: string) =>
  `PRAGMA ${buildPragmaPrefix(schemaName)}index_info(${escapeSqlString(indexName)})`;

export const parseSchemas = (result: SqliteQueryResult): SqliteSchema[] =>
  result.rows
    .map((row) => ({
      seq: asNumber(row.seq),
      name: asString(row.name),
      file: asNullableString(row.file),
    }))
    .filter((schema) => !!schema.name);

export const parseEntities = (
  result: SqliteQueryResult,
  schemaName: string,
): SqliteEntity[] =>
  result.rows
    .map((row) => ({
      schemaName,
      name: asString(row.name),
      type: (asString(row.type) === 'view'
        ? 'view'
        : 'table') as SqliteEntityType,
      sql: asNullableString(row.sql),
    }))
    .filter((entity) => !!entity.name);

export const parseColumns = (result: SqliteQueryResult): SqliteColumnInfo[] =>
  result.rows.map((row) => ({
    cid: asNumber(row.cid),
    name: asString(row.name),
    type: asString(row.type),
    notNull: asNumber(row.notnull) === 1,
    defaultValue: asNullableString(row.dflt_value),
    primaryKeyOrder: asNumber(row.pk),
    hidden: asNumber(row.hidden),
  }));

export const parseForeignKeys = (
  result: SqliteQueryResult,
): SqliteForeignKeyInfo[] =>
  result.rows.map((row) => ({
    id: asNumber(row.id),
    seq: asNumber(row.seq),
    table: asString(row.table),
    from: asString(row.from),
    to: asNullableString(row.to),
    onUpdate: asString(row.on_update),
    onDelete: asString(row.on_delete),
    match: asString(row.match),
  }));

export const parseIndexes = (result: SqliteQueryResult): SqliteIndexInfo[] =>
  result.rows.map((row) => ({
    seq: asNumber(row.seq),
    name: asString(row.name),
    unique: asNumber(row.unique) === 1,
    origin: asString(row.origin),
    partial: asNumber(row.partial) === 1,
  }));

export const parseIndexColumns = (
  result: SqliteQueryResult,
): SqliteIndexColumnInfo[] =>
  result.rows
    .map((row) => ({
      seqno: asNumber(row.seqno),
      cid: asNumber(row.cid),
      name: asString(row.name),
    }))
    .filter((column) => !!column.name);

export const parseCount = (result: SqliteQueryResult) =>
  asNumber(result.rows[0]?.count);
