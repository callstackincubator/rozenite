import { describe, expect, it, vi } from 'vitest';
import { createExpoSqliteAdapter } from '../expo-sqlite';

describe('createExpoSqliteAdapter', () => {
  it('executes statement arrays sequentially and preserves result order', async () => {
    const database = {
      getAllAsync: vi.fn(async () => [{ id: 1, name: 'Ada' }]),
      runAsync: vi.fn(async () => ({ changes: 1, lastInsertRowId: 7 })),
    };

    const adapter = createExpoSqliteAdapter({
      database,
      databaseName: 'main.db',
    });
    const [mainDatabase] = adapter.databases;

    const results = await mainDatabase.executeStatements([
      { sql: 'SELECT id, name FROM users;' },
      { sql: "INSERT INTO users(name) VALUES('Grace');" },
    ]);

    expect(database.getAllAsync).toHaveBeenCalledWith(
      'SELECT id, name FROM users',
    );
    expect(database.runAsync).toHaveBeenCalledWith(
      "INSERT INTO users(name) VALUES('Grace')",
    );
    expect(results).toHaveLength(2);
    expect(results[0]?.metadata.statementType).toBe('select');
    expect(results[1]?.metadata.statementType).toBe('insert');
    expect(results[1]?.metadata.lastInsertRowId).toBe(7);
  });

  it('allows explicit transaction statements to run as normal statements', async () => {
    const database = {
      getAllAsync: vi.fn(),
      runAsync: vi.fn(async () => ({ changes: 0, lastInsertRowId: 0 })),
    };

    const adapter = createExpoSqliteAdapter({
      database,
      databaseName: 'main.db',
    });
    const [mainDatabase] = adapter.databases;

    const results = await mainDatabase.executeStatements([
      { sql: 'BEGIN;' },
      { sql: 'ROLLBACK;' },
    ]);

    expect(database.runAsync).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(database.runAsync).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(results.map((result) => result.metadata.statementType)).toEqual([
      'other',
      'other',
    ]);
  });

  it('throws batch execution metadata when a later statement fails', async () => {
    const database = {
      getAllAsync: vi.fn(async () => [{ id: 1 }]),
      runAsync: vi.fn(async (sql: string) => {
        if (sql === "INSERT INTO logs(message) VALUES('boom')") {
          throw new Error('constraint failed');
        }

        return { changes: 1, lastInsertRowId: 1 };
      }),
    };

    const adapter = createExpoSqliteAdapter({
      database,
      databaseName: 'main.db',
    });
    const [mainDatabase] = adapter.databases;

    await expect(
      mainDatabase.executeStatements([
        { sql: 'SELECT id FROM users;' },
        { sql: "INSERT INTO logs(message) VALUES('boom');" },
      ]),
    ).rejects.toMatchObject({
      message: 'constraint failed',
      failedStatementIndex: 1,
      completedResults: [
        {
          metadata: {
            statementType: 'select',
          },
        },
      ],
    });
  });
});
