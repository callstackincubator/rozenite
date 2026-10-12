import {
  Alert,
  EmptyState,
  IconButton,
  NestedList,
  RozeniteLoader,
  ScrollArea,
  SearchField,
  Sidebar,
  Text,
} from '@rozenite/ui';
import { Database, FileCode2, FolderTree, RefreshCw, Table2, Trash2 } from 'lucide-react';
import type { Ref } from 'react';
import type { SqliteDatabaseInfo } from '../shared/types';
import type { SqliteEntity } from './sqlite-introspection';
import {
  DEFAULT_EXPLORER_STATE,
  buildExplorerGroups,
  getEntityKey,
  getSchemaKey,
  type ExplorerState,
} from './sqlite-explorer';

type ExplorerSidebarProps = {
  databases: SqliteDatabaseInfo[];
  databaseLoading: boolean;
  databaseError: string | null;
  explorerStateByDatabase: Record<string, ExplorerState>;
  expandedDatabaseIds: string[];
  expandedSchemaKeys: string[];
  selectedDatabase: SqliteDatabaseInfo | null;
  selectedEntityKey: string | null;
  objectSearch: string;
  searchRef: Ref<HTMLInputElement>;
  refreshing: boolean;
  canDropAll: boolean;
  onObjectSearchChange: (value: string) => void;
  onRefresh: () => void;
  onDropAll: () => void;
  onDatabaseClick: (databaseId: string) => void;
  onDatabaseDoubleClick: (databaseId: string) => void;
  onDatabaseExpandedChange: (databaseId: string, expanded: boolean) => void;
  onSchemaExpandedChange: (schemaKey: string, expanded: boolean) => void;
  onEntityClick: (databaseId: string, entity: SqliteEntity) => void;
};

const GroupLabel = ({ children }: { children: string }) => (
  <Text variant="label" className="block pt-2 pb-1 pl-11 text-[10px]">
    {children}
  </Text>
);

const TreeNote = ({ children }: { children: string }) => (
  <Text variant="caption" className="block py-2 pl-11 text-faint">
    {children}
  </Text>
);

export const ExplorerSidebar = ({
  databases,
  databaseLoading,
  databaseError,
  explorerStateByDatabase,
  expandedDatabaseIds,
  expandedSchemaKeys,
  selectedDatabase,
  selectedEntityKey,
  objectSearch,
  searchRef,
  refreshing,
  canDropAll,
  onObjectSearchChange,
  onRefresh,
  onDropAll,
  onDatabaseClick,
  onDatabaseDoubleClick,
  onDatabaseExpandedChange,
  onSchemaExpandedChange,
  onEntityClick,
}: ExplorerSidebarProps) => {
  const dropAllLabel = selectedDatabase
    ? `Drop all objects in ${selectedDatabase.name}`
    : 'Drop all objects';

  const renderEntity = (databaseId: string, entity: SqliteEntity) => (
    <NestedList.Item
      key={`${databaseId}-${entity.schemaName}-${entity.name}`}
      label={entity.name}
      leading={entity.type === 'view' ? <FileCode2 /> : <Table2 />}
      selected={getEntityKey(databaseId, entity.schemaName, entity.name) === selectedEntityKey}
      onClick={() => onEntityClick(databaseId, entity)}
    />
  );

  const renderDatabaseContent = (database: SqliteDatabaseInfo) => {
    const explorerState = explorerStateByDatabase[database.id] ?? DEFAULT_EXPLORER_STATE;

    if (explorerState.loading || !explorerState.loaded) {
      return <TreeNote>Loading…</TreeNote>;
    }

    if (explorerState.error) {
      return (
        <Alert tone="danger" className="mx-2 my-1" aria-live="polite">
          <Alert.Title>Explorer Load Failed</Alert.Title>
          <Alert.Description className="whitespace-normal">{explorerState.error}</Alert.Description>
        </Alert>
      );
    }

    const groups = buildExplorerGroups(explorerState.schemas, explorerState.entities, objectSearch);

    if (groups.length === 0) {
      return <TreeNote>No objects match this filter.</TreeNote>;
    }

    return groups.map(({ schema, tables, views }) => {
      const schemaKey = getSchemaKey(database.id, schema.name);

      return (
        <NestedList.Item
          key={`${database.id}-${schema.name}`}
          label={schema.name}
          leading={<FolderTree />}
          expanded={expandedSchemaKeys.includes(schemaKey)}
          onExpandedChange={(expanded) => onSchemaExpandedChange(schemaKey, expanded)}
        >
          {tables.length > 0 ? <GroupLabel>Tables</GroupLabel> : null}
          {tables.map((entity) => renderEntity(database.id, entity))}
          {views.length > 0 ? <GroupLabel>Views</GroupLabel> : null}
          {views.map((entity) => renderEntity(database.id, entity))}
          {tables.length === 0 && views.length === 0 ? (
            <TreeNote>No tables or views.</TreeNote>
          ) : null}
        </NestedList.Item>
      );
    });
  };

  return (
    <Sidebar className="w-full gap-0 overflow-hidden border-r-0 pb-0">
      <Sidebar.Header className="justify-between">
        <Text variant="label">Databases</Text>
        <div className="flex items-center gap-1">
          <IconButton
            label="Refresh databases"
            size="sm"
            tone="neutral"
            variant="ghost"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
          </IconButton>
          <IconButton
            label={dropAllLabel}
            size="sm"
            tone="danger"
            variant="ghost"
            onClick={onDropAll}
            disabled={!canDropAll}
          >
            <Trash2 />
          </IconButton>
        </div>
      </Sidebar.Header>

      <div className="shrink-0 border-b border-sidebar-border p-2">
        <SearchField
          ref={searchRef}
          aria-label="Filter databases, tables, and views"
          name="sidebarFilter"
          autoComplete="off"
          spellCheck={false}
          placeholder="Filter databases, tables, views…"
          value={objectSearch}
          onChange={(event) => onObjectSearchChange(event.target.value)}
          onClear={() => onObjectSearchChange('')}
        />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {databaseLoading && databases.length === 0 ? (
          <div className="flex justify-center p-6">
            <RozeniteLoader size={32} />
          </div>
        ) : databases.length === 0 ? (
          <EmptyState
            icon={Database}
            title={databaseError ? 'Could Not Load Databases' : 'No Databases Found'}
            description={
              databaseError ??
              'Expose a SQLite adapter in your app, then refresh to inspect it here.'
            }
          />
        ) : (
          <NestedList className="p-2">
            {databases.map((database) => (
              <NestedList.Item
                key={database.id}
                label={database.name}
                leading={<Database />}
                expanded={expandedDatabaseIds.includes(database.id)}
                onExpandedChange={(expanded) => onDatabaseExpandedChange(database.id, expanded)}
                onClick={() => onDatabaseClick(database.id)}
                onDoubleClick={() => onDatabaseDoubleClick(database.id)}
              >
                {renderDatabaseContent(database)}
              </NestedList.Item>
            ))}
          </NestedList>
        )}
      </ScrollArea>
    </Sidebar>
  );
};
