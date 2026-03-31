import * as SQLite from 'expo-sqlite';
import { createExpoSqliteAdapter } from '@rozenite/sqlite-plugin';

const appDatabase = SQLite.openDatabaseSync('rozenite-app.db');
const analyticsDatabase = SQLite.openDatabaseSync('rozenite-analytics.db');
const testingDatabase = SQLite.openDatabaseSync('rozenite-testing.db');
const binaryDatabase = SQLite.openDatabaseSync('rozenite-binary.db');
const TESTING_ROWS_COUNT = 500;
const BINARY_ASSET_ROWS_COUNT = 3;
const BINARY_PACKET_ROWS_COUNT = 3;

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

const buildTestingRowsSeedSql = () => {
  const categories = ['alpha', 'beta', 'gamma', 'delta'];
  const statuses = ['queued', 'running', 'done', 'failed'];

  const values = Array.from({ length: TESTING_ROWS_COUNT }, (_, index) => {
    const rowNumber = index + 1;
    const category = categories[index % categories.length];
    const status = statuses[index % statuses.length];
    const score = ((rowNumber * 17) % 1000) + 0.25;
    const createdAt = new Date(
      Date.UTC(2026, 2, (index % 28) + 1, 8 + (index % 9), (index * 7) % 60),
    ).toISOString();
    const notes = `Seed row ${rowNumber} for SQLite plugin testing`;

    return `(${rowNumber}, 'Record ${rowNumber}', '${category}', '${status}', ${score.toFixed(2)}, '${createdAt}', '${notes}')`;
  }).join(',\n        ');

  return `
    DELETE FROM test_rows;
    INSERT INTO test_rows (
      id,
      label,
      category,
      status,
      score,
      created_at,
      notes
    ) VALUES
        ${values};
  `;
};

const initializeTestingDatabase = () => {
  testingDatabase.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS test_rows (
      id INTEGER PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      score REAL NOT NULL,
      created_at TEXT NOT NULL,
      notes TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_test_rows_category ON test_rows(category);
    CREATE INDEX IF NOT EXISTS idx_test_rows_status ON test_rows(status);
  `);

  const testRowCount =
    testingDatabase.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM test_rows',
    )?.count ?? 0;

  if (testRowCount !== TESTING_ROWS_COUNT) {
    testingDatabase.execSync(buildTestingRowsSeedSql());
  }
};

const initializeBinaryDatabase = () => {
  binaryDatabase.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS binary_assets (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_bytes BLOB NOT NULL,
      checksum BLOB NOT NULL,
      preview_bytes BLOB,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS packet_captures (
      id INTEGER PRIMARY KEY NOT NULL,
      source TEXT NOT NULL,
      transport TEXT NOT NULL,
      flags INTEGER NOT NULL,
      payload BLOB NOT NULL,
      trailer BLOB,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_packet_captures_source ON packet_captures(source);
  `);

  const binaryAssetCount =
    binaryDatabase.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM binary_assets',
    )?.count ?? 0;
  const packetCaptureCount =
    binaryDatabase.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM packet_captures',
    )?.count ?? 0;

  if (binaryAssetCount !== BINARY_ASSET_ROWS_COUNT) {
    binaryDatabase.execSync(`
      DELETE FROM binary_assets;
      INSERT INTO binary_assets (
        id,
        name,
        mime_type,
        file_bytes,
        checksum,
        preview_bytes,
        created_at
      ) VALUES
        (
          1,
          'logo-mark.png',
          'image/png',
          X'89504E470D0A1A0A0000000D49484452000000100000001008060000001F',
          X'5A17C0DE',
          X'89504E470D0A1A0A0000000D',
          '2026-03-12T09:15:00.000Z'
        ),
        (
          2,
          'hero-photo.jpg',
          'image/jpeg',
          X'FFD8FFE000104A46494600010101006000600000FFDB00430008060607060508',
          X'0BADF00D',
          X'FFD8FFE000104A4649460001',
          '2026-03-12T09:20:00.000Z'
        ),
        (
          3,
          'app-shell.sqlite',
          'application/octet-stream',
          X'53514C69746520666F726D617420330010000101004020200000000200000004',
          X'DEADBEEF',
          NULL,
          '2026-03-12T09:25:00.000Z'
        );
    `);
  }

  if (packetCaptureCount !== BINARY_PACKET_ROWS_COUNT) {
    binaryDatabase.execSync(`
      DELETE FROM packet_captures;
      INSERT INTO packet_captures (
        id,
        source,
        transport,
        flags,
        payload,
        trailer,
        created_at
      ) VALUES
        (
          1,
          'device-sync',
          'udp',
          3,
          X'0102030405060708090A0B0C0D0E0F10',
          X'FEEDFACE',
          '2026-03-12T10:00:00.000Z'
        ),
        (
          2,
          'metrics-stream',
          'websocket',
          5,
          X'7B226576656E74223A2270657266222C2276616C7565223A34327D',
          X'0000FFFF',
          '2026-03-12T10:05:00.000Z'
        ),
        (
          3,
          'screen-share',
          'tcp',
          1,
          X'CAFEBABE000102030405060708090A0B0C0D0E0F',
          NULL,
          '2026-03-12T10:10:00.000Z'
        );
    `);
  }
};

initializeAppDatabase();
initializeAnalyticsDatabase();
initializeTestingDatabase();
initializeBinaryDatabase();

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
