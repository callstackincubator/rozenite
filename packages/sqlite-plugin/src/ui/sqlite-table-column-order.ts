import type { Updater } from '@tanstack/react-table';

export const SQLITE_ROW_NUMBER_COLUMN_ID = '__sqlite-row-number__';

type NormalizeTableColumnOrderInput = {
  columnIds: string[];
  fixedLeadingColumnIds?: string[];
  storedColumnOrder?: string[] | null;
};

type ResolveTableColumnOrderUpdateInput = NormalizeTableColumnOrderInput & {
  nextColumnOrder: Updater<string[]>;
};

type ReorderTableColumnOrderInput = NormalizeTableColumnOrderInput & {
  activeColumnId: string;
  overColumnId: string;
};

const applyUpdater = <TValue>(
  updater: Updater<TValue>,
  currentValue: TValue,
): TValue =>
  typeof updater === 'function'
    ? (updater as (old: TValue) => TValue)(currentValue)
    : updater;

export const getDefaultTableColumnOrder = (
  columnIds: string[],
  fixedLeadingColumnIds: string[] = [],
) =>
  normalizeTableColumnOrder({
    columnIds,
    fixedLeadingColumnIds,
  });

export const normalizeTableColumnOrder = ({
  columnIds,
  fixedLeadingColumnIds = [],
  storedColumnOrder,
}: NormalizeTableColumnOrderInput) => {
  const availableColumnIds = new Set(columnIds);
  const seenColumnIds = new Set<string>();
  const normalizedOrder: string[] = [];

  for (const columnId of fixedLeadingColumnIds) {
    if (!availableColumnIds.has(columnId) || seenColumnIds.has(columnId)) {
      continue;
    }

    normalizedOrder.push(columnId);
    seenColumnIds.add(columnId);
  }

  for (const columnId of storedColumnOrder ?? []) {
    if (!availableColumnIds.has(columnId) || seenColumnIds.has(columnId)) {
      continue;
    }

    normalizedOrder.push(columnId);
    seenColumnIds.add(columnId);
  }

  for (const columnId of columnIds) {
    if (seenColumnIds.has(columnId)) {
      continue;
    }

    normalizedOrder.push(columnId);
    seenColumnIds.add(columnId);
  }

  return normalizedOrder;
};

export const reorderTableColumnOrder = ({
  columnIds,
  fixedLeadingColumnIds = [],
  storedColumnOrder = [],
  activeColumnId,
  overColumnId,
}: ReorderTableColumnOrderInput) => {
  const normalizedOrder = normalizeTableColumnOrder({
    columnIds,
    fixedLeadingColumnIds,
    storedColumnOrder,
  });
  const fixedColumnIds = new Set(fixedLeadingColumnIds);

  if (
    activeColumnId === overColumnId ||
    fixedColumnIds.has(activeColumnId) ||
    fixedColumnIds.has(overColumnId)
  ) {
    return normalizedOrder;
  }

  const movableColumnOrder = normalizedOrder.filter(
    (columnId) => !fixedColumnIds.has(columnId),
  );
  const activeIndex = movableColumnOrder.indexOf(activeColumnId);
  const overIndex = movableColumnOrder.indexOf(overColumnId);

  if (activeIndex === -1 || overIndex === -1) {
    return normalizedOrder;
  }

  const nextMovableOrder = [...movableColumnOrder];
  const [movedColumnId] = nextMovableOrder.splice(activeIndex, 1);
  nextMovableOrder.splice(overIndex, 0, movedColumnId);

  return [...fixedLeadingColumnIds, ...nextMovableOrder];
};

export const resolveTableColumnOrderUpdate = ({
  columnIds,
  fixedLeadingColumnIds = [],
  storedColumnOrder = [],
  nextColumnOrder,
}: ResolveTableColumnOrderUpdateInput) => {
  const normalizedCurrentOrder = normalizeTableColumnOrder({
    columnIds,
    fixedLeadingColumnIds,
    storedColumnOrder,
  });

  return normalizeTableColumnOrder({
    columnIds,
    fixedLeadingColumnIds,
    storedColumnOrder: applyUpdater(nextColumnOrder, normalizedCurrentOrder),
  });
};

export const areColumnOrdersEqual = (
  leftColumnOrder: string[],
  rightColumnOrder: string[],
) =>
  leftColumnOrder.length === rightColumnOrder.length &&
  leftColumnOrder.every(
    (columnId, columnIndex) => columnId === rightColumnOrder[columnIndex],
  );

export const buildEntityTableId = (
  scope: 'data' | 'structure-columns' | 'structure-indexes',
  databaseId: string | null,
  schemaName: string | null,
  entityName: string | null,
) =>
  `${scope}:${databaseId ?? 'unknown'}:${schemaName ?? 'unknown'}:${entityName ?? 'unknown'}`;

export const buildQueryTableId = (
  databaseId: string | null,
  columnIds: string[],
) => `query:${databaseId ?? 'unknown'}:${JSON.stringify(columnIds)}`;
