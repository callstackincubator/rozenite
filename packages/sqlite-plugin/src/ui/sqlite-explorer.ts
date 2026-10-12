import type { SqliteEntity, SqliteSchema } from './sqlite-introspection';

export type ExplorerState = {
  schemas: SqliteSchema[];
  entities: SqliteEntity[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
};

export const DEFAULT_EXPLORER_STATE: ExplorerState = {
  schemas: [],
  entities: [],
  loading: false,
  error: null,
  loaded: false,
};

export const getEntityKey = (databaseId: string, schemaName: string, entityName: string) =>
  JSON.stringify([databaseId, schemaName, entityName]);

export const getSchemaKey = (databaseId: string, schemaName: string) =>
  JSON.stringify([databaseId, schemaName]);

export type ExplorerGroup = {
  schema: SqliteSchema;
  tables: SqliteEntity[];
  views: SqliteEntity[];
  visible: boolean;
};

/**
 * Groups a database's entities by schema, split into tables and views, keeping only what
 * matches the sidebar filter. A schema whose own name matches stays visible even when none of
 * its entities do.
 */
export const buildExplorerGroups = (
  schemas: SqliteSchema[],
  entities: SqliteEntity[],
  objectSearch: string,
): ExplorerGroup[] => {
  const term = objectSearch.trim().toLowerCase();

  return schemas
    .map((schema) => {
      const schemaEntities = entities.filter((entity) => entity.schemaName === schema.name);
      const filteredEntities = term
        ? schemaEntities.filter((entity) =>
            `${entity.name} ${entity.type} ${schema.name}`.toLowerCase().includes(term),
          )
        : schemaEntities;
      const tables = filteredEntities.filter((entity) => entity.type === 'table');
      const views = filteredEntities.filter((entity) => entity.type === 'view');
      const visible =
        term.length === 0 ||
        schema.name.toLowerCase().includes(term) ||
        filteredEntities.length > 0;

      return {
        schema,
        tables,
        views,
        visible,
      };
    })
    .filter((group) => group.visible);
};
