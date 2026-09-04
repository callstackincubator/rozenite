import { createExpoSqliteAdapter } from '@rozenite/sqlite-plugin';
import {
  analyticsDatabase,
  appDatabase,
  binaryDatabase,
  testingDatabase,
} from '../src/app/sqlite-plugin-databases';

// Split out of src/app/sqlite-plugin-databases.ts: the database handles and
// their seed data are real app resources and stay in app code; building the
// Rozenite adapter on top of them is dev-only.
export const sqlitePluginAdapters = [
  createExpoSqliteAdapter({
    adapterId: 'expo-sqlite',
    adapterName: 'Expo SQLite',
    databases: {
      app: {
        name: 'rozenite-app.db',
        database: appDatabase,
      },
      analytics: {
        name: 'rozenite-analytics.db',
        database: analyticsDatabase,
      },
      testing: {
        name: 'rozenite-testing.db',
        database: testingDatabase,
      },
      binary: {
        name: 'rozenite-binary.db',
        database: binaryDatabase,
      },
    },
  }),
];
