![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin for inspecting SQLite databases in React Native DevTools.

The SQLite Plugin provides a query-first inspector for registered SQLite databases. It ships with an `expo-sqlite` adapter and supports custom adapters for any SQLite-like library that can execute ordered SQL statements and return normalized metadata for each statement.

![SQLite Plugin](https://rozenite.dev/sqlite-plugin.png)

## Installation

```bash
npm install @rozenite/sqlite-plugin
```

Optional peer for the built-in Expo adapter:

```bash
npm install expo-sqlite
```

## Usage

Wire the plugin up in `rozenite.dev.tsx`. Nothing here is reachable in production, so there's no need
for an `__DEV__` guard of your own:

```ts title="rozenite.dev.tsx"
import * as SQLite from 'expo-sqlite';
import {
  createExpoSqliteAdapter,
  useRozeniteSqlitePlugin,
} from '@rozenite/sqlite-plugin';

const adapters = [
  createExpoSqliteAdapter({
    adapterName: 'Expo SQLite',
    databases: {
      app: {
        name: 'app.db',
        database: SQLite.openDatabaseSync('app.db'),
      },
      analytics: {
        name: 'analytics.db',
        database: SQLite.openDatabaseSync('analytics.db'),
      },
    },
  }),
];

export default function RozeniteDevTools() {
  useRozeniteSqlitePlugin({ adapters });
  return null;
}
```

## Custom adapters

You can support any SQLite-like library by normalizing its statement execution API:

```ts title="rozenite.dev.tsx"
import { createSqliteAdapter } from '@rozenite/sqlite-plugin';

const adapters = [
  createSqliteAdapter({
    adapterName: 'My SQLite Driver',
    databases: {
      main: {
        name: 'main.db',
        executeStatements: async (statements) => {
          const results = [];

          for (const statement of statements) {
            const result = await driver.query(statement.sql, statement.params);

            results.push({
              rows: result.rows,
              columns: result.columns,
              metadata: {
                statementType: result.statementType,
                rowCount: result.rows.length,
                changes: result.changes,
                lastInsertRowId: result.lastInsertRowId,
                durationMs: result.durationMs,
              },
            });
          }

          return results;
        },
      },
    },
  }),
];
```

## Notes

- Register adapters from `rozenite.dev.tsx`. Nothing imported from there reaches a production bundle, so there's no separate `__DEV__` guard to write.
- The SQL editor executes multi-statement scripts in order and stops on the first error.
- Custom adapters receive the full ordered statement array for scripts. To preserve per-statement failure details, throw an error enriched with `completedResults` and `failedStatementIndex`.
- Explicit `BEGIN`, `COMMIT`, and `ROLLBACK` statements are preserved as written. The plugin does not wrap scripts in an implicit transaction.
- The UI derives tables, schema, and browse views from SQL and `PRAGMA` queries.
- Database display names are shown in the panel; opaque IDs are generated internally.
