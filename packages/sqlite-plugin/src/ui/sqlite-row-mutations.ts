import { quoteSqlIdentifier } from '../shared/sql';
import type { SqliteQueryParams } from '../shared/types';
import type { SqliteColumnInfo, SqliteEntity } from './sqlite-introspection';

export const SQLITE_HIDDEN_ROWID_COLUMN_ID = '__sqlite-hidden-rowid__';
export const SQLITE_ROW_ACTIONS_COLUMN_ID = '__sqlite-row-actions__';

const SQLITE_ROWID_IDENTIFIERS = ['rowid', '_rowid_', 'oid'] as const;

export type SqliteRowIdIdentifier =
  (typeof SQLITE_ROWID_IDENTIFIERS)[number];

export type SqliteEditableValueKind =
  | 'text'
  | 'number'
  | 'boolean'
  | 'blob-ish'
  | 'json';

export type SqliteRowMutationDescriptor =
  | {
      mode: 'primary-key';
      primaryKeyColumns: SqliteColumnInfo[];
    }
  | {
      mode: 'rowid';
      rowIdIdentifier: SqliteRowIdIdentifier;
    };

type BuildRowUpdateMutationInput = {
  entity: SqliteEntity;
  columns: SqliteColumnInfo[];
  row: Record<string, unknown>;
  descriptor: SqliteRowMutationDescriptor;
  nextValues: Record<string, unknown>;
};

type BuildRowDeleteMutationInput = {
  entity: SqliteEntity;
  row: Record<string, unknown>;
  descriptor: SqliteRowMutationDescriptor;
};

type SqliteMutationResult = {
  sql: string;
  params: SqliteQueryParams;
};

const buildQualifiedEntityName = (schemaName: string, entityName: string) =>
  `${quoteSqlIdentifier(schemaName)}.${quoteSqlIdentifier(entityName)}`;

const isWithoutRowIdEntity = (entity: SqliteEntity) =>
  /\bwithout\s+rowid\b/i.test(entity.sql ?? '');

export const getPrimaryKeyColumns = (columns: SqliteColumnInfo[]) =>
  columns
    .filter((column) => column.primaryKeyOrder > 0)
    .sort((left, right) => left.primaryKeyOrder - right.primaryKeyOrder);

export const getEditableColumns = (columns: SqliteColumnInfo[]) =>
  columns.filter((column) => column.primaryKeyOrder === 0 && column.hidden === 0);

const getNormalizedColumnType = (column: SqliteColumnInfo) =>
  column.type.trim().toLowerCase();

const inferValueKindFromRuntimeValue = (
  value: unknown,
): SqliteEditableValueKind => {
  if (typeof value === 'number') {
    return 'number';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (Array.isArray(value)) {
    return value.every((item) => typeof item === 'number') ? 'blob-ish' : 'json';
  }

  if (value && typeof value === 'object') {
    return 'json';
  }

  return 'text';
};

export const getCompatibleValueKinds = (
  column: SqliteColumnInfo,
  value: unknown,
): SqliteEditableValueKind[] => {
  const normalizedType = getNormalizedColumnType(column);

  if (normalizedType.includes('json')) {
    return ['json'];
  }

  if (normalizedType.includes('blob')) {
    return ['blob-ish'];
  }

  if (normalizedType.includes('bool')) {
    return ['boolean'];
  }

  if (
    normalizedType.includes('int') ||
    normalizedType.includes('real') ||
    normalizedType.includes('floa') ||
    normalizedType.includes('doub') ||
    normalizedType.includes('num') ||
    normalizedType.includes('dec')
  ) {
    return ['number'];
  }

  if (
    normalizedType.includes('char') ||
    normalizedType.includes('clob') ||
    normalizedType.includes('text') ||
    normalizedType.includes('varchar') ||
    normalizedType.includes('string')
  ) {
    return ['text'];
  }

  return [inferValueKindFromRuntimeValue(value)];
};

export const canColumnBeNull = (column: SqliteColumnInfo) => !column.notNull;

export const getAvailableRowIdIdentifier = (
  columns: SqliteColumnInfo[],
): SqliteRowIdIdentifier | null => {
  const lowerCaseColumnNames = new Set(
    columns.map((column) => column.name.toLowerCase()),
  );

  return (
    SQLITE_ROWID_IDENTIFIERS.find(
      (identifier) => !lowerCaseColumnNames.has(identifier),
    ) ?? null
  );
};

export const getRowMutationDescriptor = (
  entity: SqliteEntity | null,
  columns: SqliteColumnInfo[],
): SqliteRowMutationDescriptor | null => {
  if (!entity || entity.type !== 'table' || columns.length === 0) {
    return null;
  }

  const primaryKeyColumns = getPrimaryKeyColumns(columns);
  if (primaryKeyColumns.length > 0) {
    return {
      mode: 'primary-key',
      primaryKeyColumns,
    };
  }

  if (isWithoutRowIdEntity(entity)) {
    return null;
  }

  const rowIdIdentifier = getAvailableRowIdIdentifier(columns);
  if (!rowIdIdentifier) {
    return null;
  }

  return {
    mode: 'rowid',
    rowIdIdentifier,
  };
};

const buildWhereClause = (
  row: Record<string, unknown>,
  descriptor: SqliteRowMutationDescriptor,
) => {
  if (descriptor.mode === 'primary-key') {
    const params = descriptor.primaryKeyColumns.map((column) => row[column.name]);
    const clause = descriptor.primaryKeyColumns
      .map((column) => `${quoteSqlIdentifier(column.name)} = ?`)
      .join(' AND ');

    return {
      clause,
      params,
    };
  }

  return {
    clause: `${descriptor.rowIdIdentifier} = ?`,
    params: [row[SQLITE_HIDDEN_ROWID_COLUMN_ID]],
  };
};

export const buildRowUpdateMutation = ({
  entity,
  columns,
  row,
  descriptor,
  nextValues,
}: BuildRowUpdateMutationInput): SqliteMutationResult => {
  const updateColumnNames = getEditableColumns(columns)
    .map((column) => column.name)
    .filter((columnName) =>
      Object.prototype.hasOwnProperty.call(nextValues, columnName),
    );

  if (updateColumnNames.length === 0) {
    throw new Error('No editable columns are available for this row.');
  }

  const assignments = updateColumnNames.map(
    (columnName) => `${quoteSqlIdentifier(columnName)} = ?`,
  );
  const assignmentParams = updateColumnNames.map(
    (columnName) => nextValues[columnName],
  );
  const where = buildWhereClause(row, descriptor);

  return {
    sql: `UPDATE ${buildQualifiedEntityName(entity.schemaName, entity.name)} SET ${assignments.join(', ')} WHERE ${where.clause}`,
    params: [...assignmentParams, ...where.params],
  };
};

export const buildRowDeleteMutation = ({
  entity,
  row,
  descriptor,
}: BuildRowDeleteMutationInput): SqliteMutationResult => {
  const where = buildWhereClause(row, descriptor);

  return {
    sql: `DELETE FROM ${buildQualifiedEntityName(entity.schemaName, entity.name)} WHERE ${where.clause}`,
    params: where.params,
  };
};
