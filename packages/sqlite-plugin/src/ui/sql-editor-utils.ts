import type { Completion } from '@codemirror/autocomplete';
import type { SQLNamespace } from '@codemirror/lang-sql';
import { format } from 'sql-formatter';
import { quoteSqlIdentifier } from '../shared/sql';
import type {
  SqliteColumnInfo,
  SqliteEntity,
  SqliteSchema,
} from './sqlite-introspection';

export type SqlEditorColumnCacheState = {
  databaseId: string | null;
  entries: Record<string, SqliteColumnInfo[]>;
};

export type SqlEditorColumnCompletionRequest = {
  schemaName: string | null;
  entityName: string;
  from: number;
  to: number;
};

type SqlEditorAliasLookup = Record<
  string,
  {
    schemaName: string | null;
    entityName: string;
  }
>;

const SQL_IDENTIFIER_PATTERN =
  '"(?:[^"]|"")+"|`(?:[^`]|``)+`|\\[[^\\]]+\\]|[A-Za-z_][\\w$]*';

const bareIdentifierPattern = /^[A-Za-z_][\w$]*$/;
const trailingIdentifierPattern = /[A-Za-z_][\w$]*$/;
const entityMemberPattern = new RegExp(
  `(${SQL_IDENTIFIER_PATTERN})\\s*\\.\\s*(${SQL_IDENTIFIER_PATTERN})\\s*\\.\\s*$`,
);
const singleMemberPattern = new RegExp(
  `(${SQL_IDENTIFIER_PATTERN})\\s*\\.\\s*$`,
);
const aliasPattern = new RegExp(
  `\\b(?:FROM|JOIN|UPDATE|INTO)\\s+(?:(?:(${SQL_IDENTIFIER_PATTERN})\\s*\\.\\s*)?(${SQL_IDENTIFIER_PATTERN}))(?:\\s+(?:AS\\s+)?(${SQL_IDENTIFIER_PATTERN}))?`,
  'gi',
);

const normalizeIdentifier = (identifier: string) => identifier.toLowerCase();

const unquoteIdentifier = (identifier: string) => {
  if (identifier.startsWith('"') && identifier.endsWith('"')) {
    return identifier.slice(1, -1).replace(/""/g, '"');
  }

  if (identifier.startsWith('`') && identifier.endsWith('`')) {
    return identifier.slice(1, -1).replace(/``/g, '`');
  }

  if (identifier.startsWith('[') && identifier.endsWith(']')) {
    return identifier.slice(1, -1).replace(/]]/g, ']');
  }

  return identifier;
};

const getIdentifierInsertText = (identifier: string) =>
  bareIdentifierPattern.test(identifier)
    ? identifier
    : quoteSqlIdentifier(identifier);

const getColumnDetail = (column: SqliteColumnInfo) => {
  const parts = [column.type].filter(Boolean);

  if (column.primaryKeyOrder > 0) {
    parts.push('PK');
  }

  if (column.notNull) {
    parts.push('NOT NULL');
  }

  if (column.hidden > 0) {
    parts.push('HIDDEN');
  }

  return parts.join(' · ');
};

export const createSqlEditorColumnCache = (
  databaseId: string | null = null,
): SqlEditorColumnCacheState => ({
  databaseId,
  entries: {},
});

export const syncSqlEditorColumnCacheDatabase = (
  state: SqlEditorColumnCacheState,
  databaseId: string | null,
) =>
  state.databaseId === databaseId
    ? state
    : createSqlEditorColumnCache(databaseId);

export const getSqlEditorColumnCacheKey = (
  databaseId: string,
  schemaName: string,
  entityName: string,
) => JSON.stringify([databaseId, schemaName, entityName]);

export const getSqlEditorCachedColumns = (
  state: SqlEditorColumnCacheState,
  databaseId: string,
  schemaName: string,
  entityName: string,
) =>
  state.entries[getSqlEditorColumnCacheKey(databaseId, schemaName, entityName)];

export const setSqlEditorCachedColumns = (
  state: SqlEditorColumnCacheState,
  databaseId: string,
  schemaName: string,
  entityName: string,
  columns: SqliteColumnInfo[],
): SqlEditorColumnCacheState => {
  const nextState = syncSqlEditorColumnCacheDatabase(state, databaseId);

  return {
    databaseId: nextState.databaseId,
    entries: {
      ...nextState.entries,
      [getSqlEditorColumnCacheKey(databaseId, schemaName, entityName)]: columns,
    },
  };
};

export const formatSqlScript = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  return format(trimmed, {
    language: 'sqlite',
    keywordCase: 'upper',
    linesBetweenQueries: 1,
    tabWidth: 2,
  }).trim();
};

export const buildSqlCompletionSchema = ({
  databaseId,
  schemas,
  entities,
  columnCache,
}: {
  databaseId: string | null;
  schemas: SqliteSchema[];
  entities: SqliteEntity[];
  columnCache: SqlEditorColumnCacheState;
}): SQLNamespace => {
  const groupedEntities = new Map<string, SqliteEntity[]>();

  for (const entity of entities) {
    const schemaEntities = groupedEntities.get(entity.schemaName) ?? [];
    schemaEntities.push(entity);
    groupedEntities.set(entity.schemaName, schemaEntities);
  }

  const namespace: Record<string, SQLNamespace> = {};

  for (const schema of schemas) {
    const schemaChildren: Record<string, SQLNamespace> = {};
    const schemaEntities = groupedEntities.get(schema.name) ?? [];

    for (const entity of schemaEntities) {
      const columns =
        databaseId == null
          ? []
          : (getSqlEditorCachedColumns(
              columnCache,
              databaseId,
              entity.schemaName,
              entity.name,
            ) ?? []);

      schemaChildren[entity.name] = {
        self: {
          label: entity.name,
          apply: getIdentifierInsertText(entity.name),
          detail: entity.type === 'view' ? 'view' : 'table',
          boost: entity.type === 'view' ? 90 : 100,
          type: entity.type === 'view' ? 'type' : 'class',
        },
        children: columns.map((column) => ({
          label: column.name,
          apply: getIdentifierInsertText(column.name),
          detail: getColumnDetail(column) || undefined,
          boost: column.primaryKeyOrder > 0 ? 80 : 70,
          type: 'property',
        })),
      };
    }

    namespace[schema.name] = {
      self: {
        label: schema.name,
        apply: getIdentifierInsertText(schema.name),
        detail: 'schema',
        boost: 10,
        type: 'namespace',
      },
      children: schemaChildren,
    };
  }

  return namespace;
};

export const getDefaultSqlCompletionSchema = (schemas: SqliteSchema[]) =>
  schemas.find((schema) => schema.name === 'main')?.name ?? schemas[0]?.name;

export const createSqlColumnCompletions = (columns: SqliteColumnInfo[]) =>
  columns.map(
    (column): Completion => ({
      label: column.name,
      apply: getIdentifierInsertText(column.name),
      detail: getColumnDetail(column) || undefined,
      type: 'property',
      boost: column.primaryKeyOrder > 0 ? 1 : 0,
    }),
  );

export const extractSqlEditorAliases = (
  sqlBeforeCursor: string,
): SqlEditorAliasLookup => {
  const aliases: SqlEditorAliasLookup = {};

  let match: RegExpExecArray | null;
  while ((match = aliasPattern.exec(sqlBeforeCursor)) !== null) {
    const schemaName = match[1] ? unquoteIdentifier(match[1]) : null;
    const entityName = unquoteIdentifier(match[2]);
    const alias = match[3] ? unquoteIdentifier(match[3]) : null;

    if (alias) {
      aliases[normalizeIdentifier(alias)] = { schemaName, entityName };
    }
  }

  return aliases;
};

export const getSqlEditorColumnCompletionRequest = (
  sql: string,
  cursorPosition: number,
): SqlEditorColumnCompletionRequest | null => {
  const beforeCursor = sql.slice(0, cursorPosition);
  const trailingIdentifier = beforeCursor.match(trailingIdentifierPattern)?.[0];
  const replacementLength = trailingIdentifier?.length ?? 0;
  const lookupPrefix = beforeCursor.slice(
    0,
    beforeCursor.length - replacementLength,
  );

  const qualifiedMatch = lookupPrefix.match(entityMemberPattern);
  if (qualifiedMatch) {
    return {
      schemaName: unquoteIdentifier(qualifiedMatch[1]),
      entityName: unquoteIdentifier(qualifiedMatch[2]),
      from: cursorPosition - replacementLength,
      to: cursorPosition,
    };
  }

  const memberMatch = lookupPrefix.match(singleMemberPattern);
  if (memberMatch) {
    return {
      schemaName: null,
      entityName: unquoteIdentifier(memberMatch[1]),
      from: cursorPosition - replacementLength,
      to: cursorPosition,
    };
  }

  return null;
};

export const resolveSqlEditorEntityReference = ({
  aliases,
  entities,
  request,
  selectedSchemaName,
}: {
  aliases: SqlEditorAliasLookup;
  entities: SqliteEntity[];
  request: SqlEditorColumnCompletionRequest;
  selectedSchemaName: string | null;
}): SqliteEntity | null => {
  const findExactEntity = (schemaName: string, entityName: string) =>
    entities.find(
      (entity) =>
        normalizeIdentifier(entity.schemaName) ===
          normalizeIdentifier(schemaName) &&
        normalizeIdentifier(entity.name) === normalizeIdentifier(entityName),
    ) ?? null;

  if (request.schemaName) {
    return findExactEntity(request.schemaName, request.entityName);
  }

  const aliasMatch = aliases[normalizeIdentifier(request.entityName)];
  if (aliasMatch) {
    if (aliasMatch.schemaName) {
      return findExactEntity(aliasMatch.schemaName, aliasMatch.entityName);
    }

    return (
      entities.find(
        (entity) =>
          normalizeIdentifier(entity.name) ===
          normalizeIdentifier(aliasMatch.entityName),
      ) ?? null
    );
  }

  const entityMatches = entities.filter(
    (entity) =>
      normalizeIdentifier(entity.name) ===
      normalizeIdentifier(request.entityName),
  );

  if (entityMatches.length === 0) {
    return null;
  }

  if (selectedSchemaName) {
    const schemaMatch = entityMatches.find(
      (entity) =>
        normalizeIdentifier(entity.schemaName) ===
        normalizeIdentifier(selectedSchemaName),
    );

    if (schemaMatch) {
      return schemaMatch;
    }
  }

  return (
    entityMatches.find(
      (entity) => normalizeIdentifier(entity.schemaName) === 'main',
    ) ?? entityMatches[0]
  );
};
