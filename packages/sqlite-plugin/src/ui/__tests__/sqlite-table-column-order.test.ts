import { describe, expect, it } from 'vitest';
import {
  SQLITE_ROW_NUMBER_COLUMN_ID,
  buildEntityTableId,
  buildQueryTableId,
  getDefaultTableColumnOrder,
  normalizeTableColumnOrder,
  reorderTableColumnOrder,
  resolveTableColumnOrderUpdate,
} from '../sqlite-table-column-order';

describe('sqlite table column order helpers', () => {
  it('returns the default order when no stored state exists', () => {
    expect(getDefaultTableColumnOrder(['name', 'type', 'nullable'])).toEqual([
      'name',
      'type',
      'nullable',
    ]);
  });

  it('keeps fixed leading columns in front while pruning stale ids', () => {
    expect(
      normalizeTableColumnOrder({
        columnIds: [SQLITE_ROW_NUMBER_COLUMN_ID, 'name', 'type'],
        fixedLeadingColumnIds: [SQLITE_ROW_NUMBER_COLUMN_ID],
        storedColumnOrder: [
          'type',
          SQLITE_ROW_NUMBER_COLUMN_ID,
          'stale',
          'name',
          'type',
        ],
      }),
    ).toEqual([SQLITE_ROW_NUMBER_COLUMN_ID, 'type', 'name']);
  });

  it('appends newly visible columns after the stored order', () => {
    expect(
      normalizeTableColumnOrder({
        columnIds: [SQLITE_ROW_NUMBER_COLUMN_ID, 'name', 'type', 'extra'],
        fixedLeadingColumnIds: [SQLITE_ROW_NUMBER_COLUMN_ID],
        storedColumnOrder: [SQLITE_ROW_NUMBER_COLUMN_ID, 'type', 'name'],
      }),
    ).toEqual([SQLITE_ROW_NUMBER_COLUMN_ID, 'type', 'name', 'extra']);
  });

  it('reorders only movable columns', () => {
    expect(
      reorderTableColumnOrder({
        columnIds: [SQLITE_ROW_NUMBER_COLUMN_ID, 'name', 'type', 'extra'],
        fixedLeadingColumnIds: [SQLITE_ROW_NUMBER_COLUMN_ID],
        storedColumnOrder: [
          SQLITE_ROW_NUMBER_COLUMN_ID,
          'name',
          'type',
          'extra',
        ],
        activeColumnId: 'extra',
        overColumnId: 'name',
      }),
    ).toEqual([SQLITE_ROW_NUMBER_COLUMN_ID, 'extra', 'name', 'type']);
  });

  it('normalizes updater-based changes before storing them', () => {
    expect(
      resolveTableColumnOrderUpdate({
        columnIds: [SQLITE_ROW_NUMBER_COLUMN_ID, 'name', 'type', 'extra'],
        fixedLeadingColumnIds: [SQLITE_ROW_NUMBER_COLUMN_ID],
        storedColumnOrder: [SQLITE_ROW_NUMBER_COLUMN_ID, 'name', 'type'],
        nextColumnOrder: (current) => ['type', ...current],
      }),
    ).toEqual([SQLITE_ROW_NUMBER_COLUMN_ID, 'type', 'name', 'extra']);
  });

  it('builds stable table ids for entity and query surfaces', () => {
    expect(buildEntityTableId('data', 'db-1', 'main', 'users')).toBe(
      'data:db-1:main:users',
    );
    expect(buildQueryTableId('db-1', ['id', 'name'])).toBe(
      'query:db-1:["id","name"]',
    );
  });
});
