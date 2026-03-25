import * as SQLite from 'expo-sqlite';
import { createExpoSqliteAdapter } from '@rozenite/sqlite-plugin';

const appDatabase = SQLite.openDatabaseSync('rozenite-app.db');
const analyticsDatabase = SQLite.openDatabaseSync('rozenite-analytics.db');

const initializeAppDatabase = () => {
  appDatabase.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY NOT NULL,
      owner_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      metadata TEXT,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS wide_demo (
      id INTEGER PRIMARY KEY NOT NULL,
      col_01 TEXT NOT NULL,
      col_02 TEXT NOT NULL,
      col_03 INTEGER NOT NULL,
      col_04 REAL NOT NULL,
      col_05 TEXT NOT NULL,
      col_06 TEXT NOT NULL,
      col_07 INTEGER NOT NULL,
      col_08 TEXT NOT NULL,
      col_09 TEXT NOT NULL,
      col_10 REAL NOT NULL,
      col_11 TEXT NOT NULL,
      col_12 TEXT NOT NULL,
      col_13 INTEGER NOT NULL,
      col_14 TEXT NOT NULL,
      col_15 TEXT NOT NULL,
      col_16 REAL NOT NULL,
      col_17 TEXT NOT NULL,
      col_18 INTEGER NOT NULL,
      col_19 TEXT NOT NULL,
      col_20 TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
    CREATE VIEW IF NOT EXISTS active_projects AS
      SELECT
        projects.id,
        projects.title,
        projects.status,
        users.name AS owner_name
      FROM projects
      JOIN users ON users.id = projects.owner_id
      WHERE projects.status != 'archived';
  `);

  const userCount =
    appDatabase.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM users',
    )?.count ?? 0;
  const wideDemoCount =
    appDatabase.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM wide_demo',
    )?.count ?? 0;

  if (userCount === 0) {
    appDatabase.execSync(`
      INSERT INTO users (name, email, is_active, created_at) VALUES
        ('Ada Lovelace', 'ada@rozenite.dev', 1, '2026-03-01T09:00:00.000Z'),
        ('Grace Hopper', 'grace@rozenite.dev', 1, '2026-03-03T15:30:00.000Z'),
        ('Margaret Hamilton', 'margaret@rozenite.dev', 0, '2026-03-05T12:15:00.000Z');

      INSERT INTO projects (owner_id, title, status, metadata) VALUES
        (1, 'Command center redesign', 'active', '{"priority":"high","milestone":"spring"}'),
        (2, 'SQLite explorer v1', 'active', '{"queries":12,"lastEditor":"grace"}'),
        (3, 'Legacy import cleanup', 'archived', '{"archivedBy":"ops"}');
    `);
  }

  if (wideDemoCount === 0) {
    appDatabase.execSync(`
      INSERT INTO wide_demo (
        col_01, col_02, col_03, col_04, col_05,
        col_06, col_07, col_08, col_09, col_10,
        col_11, col_12, col_13, col_14, col_15,
        col_16, col_17, col_18, col_19, col_20
      ) VALUES (
        'Alpha', 'Beta', 3, 4.5, 'Gamma',
        'Delta', 7, 'Epsilon', 'Zeta', 10.25,
        'Eta', 'Theta', 13, 'Iota', 'Kappa',
        16.75, 'Lambda', 18, 'Mu', 'Nu'
      );
    `);
  }
};

const initializeAnalyticsDatabase = () => {
  analyticsDatabase.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS query_metrics (
      id INTEGER PRIMARY KEY NOT NULL,
      screen_name TEXT NOT NULL,
      avg_duration_ms REAL NOT NULL,
      sample_count INTEGER NOT NULL,
      collected_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feature_flags (
      key TEXT PRIMARY KEY NOT NULL,
      enabled INTEGER NOT NULL,
      rollout REAL NOT NULL,
      owners TEXT NOT NULL
    );
  `);

  const metricsCount =
    analyticsDatabase.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM query_metrics',
    )?.count ?? 0;

  if (metricsCount === 0) {
    analyticsDatabase.execSync(`
      INSERT INTO query_metrics (screen_name, avg_duration_ms, sample_count, collected_at) VALUES
        ('Landing', 4.8, 42, '2026-03-10T10:00:00.000Z'),
        ('StoragePlugin', 12.6, 18, '2026-03-10T10:05:00.000Z'),
        ('SqlitePlugin', 8.1, 27, '2026-03-10T10:10:00.000Z');

      INSERT INTO feature_flags (key, enabled, rollout, owners) VALUES
        ('sqlite-plugin-v1', 1, 1.0, '["devtools","platform"]'),
        ('schema-foreign-keys', 1, 0.5, '["data"]'),
        ('query-script-mode', 0, 0.0, '["future"]');
    `);
  }
};

initializeAppDatabase();
initializeAnalyticsDatabase();

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
    },
  }),
];
