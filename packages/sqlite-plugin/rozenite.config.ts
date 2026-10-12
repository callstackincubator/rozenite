/*
 * Dev host fixtures for `rozenite dev`.
 *
 * The SQLite panel is request/response driven: it asks the device for databases and runs SQL
 * through `sqlite:query` and `sqlite:execute-script`. The "Mock device" flow plays the device.
 * It answers those requests from a small in-memory database set (two databases, several
 * tables and a view, varied column types, enough rows to page) and understands just enough
 * SQL for the panel's own introspection, browsing and row mutations, plus simple
 * `SELECT ... FROM ... [WHERE] [ORDER BY] [LIMIT]` statements typed into the editor. Anything
 * else fails with an SQL error, which is also how the error state is exercised.
 */

type DevFlowMessage = { type: string; payload: unknown };

type DevFlowContext = {
  signal: AbortSignal;
  send: (type: string, payload: unknown) => void;
  onMessage: (
    matcher: { type?: string; direction?: 'in' | 'out' },
    listener: (message: DevFlowMessage) => void,
  ) => { remove: () => void };
};

type Value = string | number | null | number[];
type Row = Record<string, Value>;

type ColumnSpec = {
  name: string;
  type: string;
  notNull?: boolean;
  defaultValue?: string;
  pk?: number;
};

type IndexSpec = { name: string; unique: boolean; origin: 'c' | 'u' | 'pk'; columns: string[] };

type ForeignKeySpec = { from: string; table: string; to: string };

type Entity = {
  name: string;
  type: 'table' | 'view';
  sql: string;
  columns: ColumnSpec[];
  foreignKeys: ForeignKeySpec[];
  indexes: IndexSpec[];
  rows: Row[];
  /** Views read through another entity. */
  derive?: (database: MockDatabase) => Row[];
};

type MockDatabase = {
  id: string;
  name: string;
  file: string;
  entities: Entity[];
};

class SqlError extends Error {}

const LATENCY_MS = 40;

// --- Deterministic fixture data ---------------------------------------------------------------

const createRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const pick = <T>(random: () => number, items: T[]): T => items[Math.floor(random() * items.length)];

const FIRST_NAMES = ['Ada', 'Grace', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Radia'];
const LAST_NAMES = ['Lovelace', 'Hopper', 'Torvalds', 'Hamilton', 'Ritchie', 'Liskov', 'Thompson'];
const LONG_BIO =
  'Writes compilers for fun and keeps a running log of every outage she has ever been paged for. ' +
  'Prefers long walks, short functions, and migrations that can be rolled back. '.repeat(3);

const buildUsers = (): Row[] => {
  const random = createRandom(7);
  return Array.from({ length: 137 }, (_, index) => {
    const id = index + 1;
    const first = pick(random, FIRST_NAMES);
    const last = pick(random, LAST_NAMES);
    return {
      id,
      name: `${first} ${last}`,
      email: `${first}.${last}${id}@example.com`.toLowerCase(),
      age: random() < 0.1 ? null : 19 + Math.floor(random() * 50),
      balance: Math.round(random() * 250000) / 100,
      is_active: random() < 0.8 ? 1 : 0,
      avatar: id % 5 === 0 ? [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13] : null,
      preferences: JSON.stringify({
        theme: pick(random, ['dark', 'light', 'system']),
        notifications: { email: random() < 0.5, push: random() < 0.7 },
        locale: pick(random, ['en-US', 'pl-PL', 'de-DE']),
        tags: ['beta', id % 3 === 0 ? 'vip' : 'standard'],
      }),
      bio:
        id % 7 === 0 ? LONG_BIO : id % 4 === 0 ? null : `${first} joined in 20${10 + (id % 14)}.`,
      created_at: `2024-${String(1 + (id % 12)).padStart(2, '0')}-${String(1 + (id % 27)).padStart(2, '0')}T09:${String(id % 60).padStart(2, '0')}:00Z`,
    };
  });
};

const buildOrders = (): Row[] => {
  const random = createRandom(11);
  return Array.from({ length: 64 }, (_, index) => ({
    id: 1000 + index,
    user_id: 1 + Math.floor(random() * 137),
    total: Math.round(random() * 90000) / 100,
    status: pick(random, ['pending', 'paid', 'shipped', 'refunded']),
    notes: random() < 0.3 ? 'Leave at the front door.\nCall on arrival.' : null,
    placed_at: `2025-0${1 + (index % 9)}-1${index % 9}T12:00:00Z`,
  }));
};

const buildEvents = (): Row[] => {
  const random = createRandom(23);
  return Array.from({ length: 220 }, (_, index) => ({
    id: index + 1,
    name: pick(random, ['screen_view', 'tap', 'purchase', 'app_open', 'error']),
    payload: JSON.stringify({ screen: pick(random, ['Home', 'Cart', 'Profile']), ms: index * 3 }),
    ts: 1735689600000 + index * 61000,
  }));
};

const userColumns: ColumnSpec[] = [
  { name: 'id', type: 'INTEGER', notNull: true, pk: 1 },
  { name: 'name', type: 'TEXT', notNull: true },
  { name: 'email', type: 'TEXT', notNull: true },
  { name: 'age', type: 'INTEGER' },
  { name: 'balance', type: 'REAL', notNull: true, defaultValue: '0' },
  { name: 'is_active', type: 'INTEGER', notNull: true, defaultValue: '1' },
  { name: 'avatar', type: 'BLOB' },
  { name: 'preferences', type: 'TEXT' },
  { name: 'bio', type: 'TEXT' },
  { name: 'created_at', type: 'TEXT', notNull: true },
];

const createMockDatabases = (): MockDatabase[] => {
  const users = buildUsers();

  const appDatabase: MockDatabase = {
    id: 'expo-sqlite:app.db',
    name: 'app.db',
    file: '/data/user/0/dev.rozenite.playground/databases/app.db',
    entities: [
      {
        name: 'users',
        type: 'table',
        sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, age INTEGER, balance REAL NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, avatar BLOB, preferences TEXT, bio TEXT, created_at TEXT NOT NULL)',
        columns: userColumns,
        foreignKeys: [],
        indexes: [
          { name: 'sqlite_autoindex_users_1', unique: true, origin: 'u', columns: ['email'] },
          { name: 'idx_users_created_at', unique: false, origin: 'c', columns: ['created_at'] },
        ],
        rows: users,
      },
      {
        name: 'orders',
        type: 'table',
        sql: 'CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, total REAL NOT NULL, status TEXT NOT NULL, notes TEXT, placed_at TEXT NOT NULL)',
        columns: [
          { name: 'id', type: 'INTEGER', notNull: true, pk: 1 },
          { name: 'user_id', type: 'INTEGER', notNull: true },
          { name: 'total', type: 'REAL', notNull: true },
          { name: 'status', type: 'TEXT', notNull: true },
          { name: 'notes', type: 'TEXT' },
          { name: 'placed_at', type: 'TEXT', notNull: true },
        ],
        foreignKeys: [{ from: 'user_id', table: 'users', to: 'id' }],
        indexes: [{ name: 'idx_orders_user', unique: false, origin: 'c', columns: ['user_id'] }],
        rows: buildOrders(),
      },
      {
        name: 'settings',
        type: 'table',
        sql: 'CREATE TABLE settings (key TEXT, value TEXT)',
        columns: [
          { name: 'key', type: 'TEXT' },
          { name: 'value', type: 'TEXT' },
        ],
        foreignKeys: [],
        indexes: [],
        rows: [
          { key: 'schema_version', value: '14' },
          { key: 'last_sync', value: '2025-09-14T08:12:44Z' },
          { key: 'feature_flags', value: '{"newCheckout":true,"darkMode":false}' },
        ],
      },
      {
        name: 'audit_log',
        type: 'table',
        sql: 'CREATE TABLE audit_log (id INTEGER PRIMARY KEY, action TEXT NOT NULL, at TEXT NOT NULL)',
        columns: [
          { name: 'id', type: 'INTEGER', notNull: true, pk: 1 },
          { name: 'action', type: 'TEXT', notNull: true },
          { name: 'at', type: 'TEXT', notNull: true },
        ],
        foreignKeys: [],
        indexes: [],
        rows: [],
      },
      {
        name: 'active_users',
        type: 'view',
        sql: 'CREATE VIEW active_users AS SELECT id, name, email FROM users WHERE is_active = 1',
        columns: [
          { name: 'id', type: 'INTEGER' },
          { name: 'name', type: 'TEXT' },
          { name: 'email', type: 'TEXT' },
        ],
        foreignKeys: [],
        indexes: [],
        rows: [],
        derive: (database) =>
          (database.entities.find((entity) => entity.name === 'users')?.rows ?? [])
            .filter((row) => row.is_active === 1)
            .map(({ id, name, email }) => ({ id, name, email })),
      },
    ],
  };

  const analyticsDatabase: MockDatabase = {
    id: 'expo-sqlite:analytics.db',
    name: 'analytics.db',
    file: '/data/user/0/dev.rozenite.playground/databases/analytics.db',
    entities: [
      {
        name: 'events',
        type: 'table',
        sql: 'CREATE TABLE events (id INTEGER PRIMARY KEY, name TEXT NOT NULL, payload TEXT, ts INTEGER NOT NULL)',
        columns: [
          { name: 'id', type: 'INTEGER', notNull: true, pk: 1 },
          { name: 'name', type: 'TEXT', notNull: true },
          { name: 'payload', type: 'TEXT' },
          { name: 'ts', type: 'INTEGER', notNull: true },
        ],
        foreignKeys: [],
        indexes: [{ name: 'idx_events_name', unique: false, origin: 'c', columns: ['name'] }],
        rows: buildEvents(),
      },
      {
        name: 'sessions',
        type: 'table',
        sql: 'CREATE TABLE sessions (id TEXT PRIMARY KEY, started_at INTEGER NOT NULL, duration_ms REAL)',
        columns: [
          { name: 'id', type: 'TEXT', pk: 1 },
          { name: 'started_at', type: 'INTEGER', notNull: true },
          { name: 'duration_ms', type: 'REAL' },
        ],
        foreignKeys: [],
        indexes: [
          { name: 'sqlite_autoindex_sessions_1', unique: true, origin: 'pk', columns: ['id'] },
        ],
        rows: [
          { id: 'a1f3-92bc', started_at: 1735689600000, duration_ms: 18342.5 },
          { id: 'b7c0-11de', started_at: 1735693200000, duration_ms: 902.25 },
          { id: 'c9d2-5e44', started_at: 1735696800000, duration_ms: null },
        ],
      },
      {
        name: 'event_counts',
        type: 'view',
        sql: 'CREATE VIEW event_counts AS SELECT name, COUNT(*) AS total FROM events GROUP BY name',
        columns: [
          { name: 'name', type: 'TEXT' },
          { name: 'total', type: 'INTEGER' },
        ],
        foreignKeys: [],
        indexes: [],
        rows: [],
        derive: (database) => {
          const counts = new Map<string, number>();
          for (const row of database.entities.find((entity) => entity.name === 'events')?.rows ??
            []) {
            counts.set(String(row.name), (counts.get(String(row.name)) ?? 0) + 1);
          }
          return [...counts.entries()].map(([name, total]) => ({ name, total }));
        },
      },
    ],
  };

  return [appDatabase, analyticsDatabase];
};

// --- A tiny SQL engine, just enough for the panel ---------------------------------------------

const IDENTIFIER = '(?:"(?:[^"]|"")+"|\\w+)';
const unquote = (identifier: string) =>
  identifier.startsWith('"') ? identifier.slice(1, -1).replace(/""/g, '"') : identifier;

const getRowId = (entity: Entity, row: Row, index: number): Value => {
  const pk = entity.columns.find((column) => column.pk === 1 && entity.columns.length > 0);
  return pk && pk.type === 'INTEGER' ? row[pk.name] : index + 1;
};

const resolveEntity = (database: MockDatabase, reference: string) => {
  const parts = reference.match(new RegExp(IDENTIFIER, 'g')) ?? [];
  const name = unquote(parts[parts.length - 1] ?? '');
  const entity = database.entities.find(
    (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
  );
  if (!entity) {
    throw new SqlError(`no such table: ${name}`);
  }
  return entity;
};

const getEntityRows = (database: MockDatabase, entity: Entity) =>
  entity.derive ? entity.derive(database) : entity.rows;

const result = (
  statementType: string,
  columns: string[],
  rows: Row[],
  extra: { changes?: number | null } = {},
) => ({
  rows,
  columns,
  metadata: {
    statementType,
    rowCount: rows.length,
    changes: extra.changes ?? null,
    lastInsertRowId: null,
    durationMs: Math.round((0.4 + Math.random() * 2.4) * 100) / 100,
  },
});

const parseLiteral = (raw: string): Value => {
  const text = raw.trim();
  if (/^'.*'$/s.test(text)) return text.slice(1, -1).replace(/''/g, "'");
  if (/^null$/i.test(text)) return null;
  if (text !== '' && !Number.isNaN(Number(text))) return Number(text);
  throw new SqlError(`near "${text.slice(0, 24)}": syntax error`);
};

const compare = (left: Value, operator: string, right: Value) => {
  if (operator.toUpperCase() === 'LIKE') {
    const pattern = String(right)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/%/g, '.*')
      .replace(/_/g, '.');
    return new RegExp(`^${pattern}$`, 'i').test(String(left ?? ''));
  }
  if (left === null || right === null) {
    return operator === '='
      ? left === right
      : operator === '!=' || operator === '<>'
        ? left !== right
        : false;
  }
  const a = typeof left === 'number' && typeof right === 'number' ? left : String(left);
  const b = typeof left === 'number' && typeof right === 'number' ? right : String(right);
  switch (operator) {
    case '=':
      return a === b;
    case '!=':
    case '<>':
      return a !== b;
    case '<':
      return a < b;
    case '<=':
      return a <= b;
    case '>':
      return a > b;
    case '>=':
      return a >= b;
    default:
      return false;
  }
};

const filterRows = (rows: Row[], where: string | undefined, params: Value[] = []) => {
  if (!where) return rows;
  let paramIndex = 0;
  const conditions = where.split(/\s+and\s+/i).map((condition) => {
    const match = condition
      .trim()
      .match(new RegExp(`^(${IDENTIFIER})\\s*(=|!=|<>|<=|>=|<|>|LIKE)\\s*(.+)$`, 'is'));
    if (!match) throw new SqlError(`near "${condition.trim().slice(0, 24)}": syntax error`);
    const column = unquote(match[1]);
    const value = match[3].trim() === '?' ? (params[paramIndex++] ?? null) : parseLiteral(match[3]);
    return { column, operator: match[2], value };
  });
  return rows.filter((row) =>
    conditions.every(({ column, operator, value }) => {
      if (!(column in row)) throw new SqlError(`no such column: ${column}`);
      return compare(row[column], operator, value);
    }),
  );
};

const runSelect = (database: MockDatabase, sql: string, params: Value[]) => {
  const match = sql.match(
    new RegExp(
      `^select\\s+(.+?)\\s+from\\s+(${IDENTIFIER}(?:\\.${IDENTIFIER})?)(?:\\s+where\\s+(.+?))?(?:\\s+order\\s+by\\s+(${IDENTIFIER})(?:\\s+(asc|desc))?)?(?:\\s+limit\\s+(\\d+)(?:\\s+offset\\s+(\\d+))?)?$`,
      'is',
    ),
  );
  if (!match) {
    const word = sql.match(/^\s*(\w+)/)?.[1] ?? sql.slice(0, 12);
    throw new SqlError(`near "${word}": syntax error`);
  }

  const [, selectList, reference, where, orderBy, direction, limit, offset] = match;
  const entity = resolveEntity(database, reference);
  const entityRows = getEntityRows(database, entity);
  let rows = filterRows(
    entityRows.map((row, index) => ({ ...row, __rowid: getRowId(entity, row, index) })),
    where,
    params,
  );

  if (/^count\(\*\)/i.test(selectList.trim())) {
    const alias = selectList.match(/\bas\s+(\w+)/i)?.[1] ?? 'count(*)';
    return result('select', [alias], [{ [alias]: rows.length }]);
  }

  if (orderBy) {
    const column = unquote(orderBy);
    if (!entity.columns.some((candidate) => candidate.name === column)) {
      throw new SqlError(`no such column: ${column}`);
    }
    const factor = direction?.toLowerCase() === 'desc' ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const left = a[column];
      const right = b[column];
      if (left === right) return 0;
      if (left === null) return -1 * factor;
      if (right === null) return 1 * factor;
      return (left < right ? -1 : 1) * factor;
    });
  }

  const start = offset ? Number(offset) : 0;
  rows = rows.slice(start, limit ? start + Number(limit) : undefined);

  const projections = selectList.split(',').flatMap((item) => {
    const text = item.trim();
    if (text === '*') {
      return entity.columns.map((column) => ({ source: column.name, alias: column.name }));
    }
    const aliased = text.match(new RegExp(`^(${IDENTIFIER})(?:\\s+as\\s+(${IDENTIFIER}))?$`, 'i'));
    if (!aliased) throw new SqlError(`near "${text.slice(0, 24)}": syntax error`);
    const source = unquote(aliased[1]);
    const rowIdentifier = /^(rowid|_rowid_|oid)$/i.test(source);
    if (!rowIdentifier && !entity.columns.some((column) => column.name === source)) {
      throw new SqlError(`no such column: ${source}`);
    }
    return [
      {
        source: rowIdentifier ? '__rowid' : source,
        alias: aliased[2] ? unquote(aliased[2]) : source,
      },
    ];
  });

  return result(
    'select',
    projections.map((projection) => projection.alias),
    rows.map((row) =>
      Object.fromEntries(projections.map(({ source, alias }) => [alias, row[source]])),
    ),
  );
};

const runPragma = (database: MockDatabase, sql: string) => {
  if (/^pragma\s+database_list/i.test(sql)) {
    return result(
      'pragma',
      ['seq', 'name', 'file'],
      [{ seq: 0, name: 'main', file: database.file }],
    );
  }
  if (/^pragma\s+foreign_keys\s*=/i.test(sql)) {
    return result('pragma', [], []);
  }
  if (/^pragma\s+foreign_keys/i.test(sql)) {
    return result('pragma', ['foreign_keys'], [{ foreign_keys: 1 }]);
  }

  const match = sql.match(/^pragma\s+(?:"[^"]+"\.)?(\w+)\('((?:[^']|'')+)'\)/i);
  if (!match) throw new SqlError(`near "${sql.slice(0, 20)}": syntax error`);
  const [, pragma, argument] = match;

  if (pragma === 'index_info') {
    const index = database.entities
      .flatMap((entity) => entity.indexes)
      .find((candidate) => candidate.name === argument);
    const entity = database.entities.find((candidate) =>
      candidate.indexes.some((i) => i.name === argument),
    );
    return result(
      'pragma',
      ['seqno', 'cid', 'name'],
      (index?.columns ?? []).map((name, seqno) => ({
        seqno,
        cid: entity?.columns.findIndex((column) => column.name === name) ?? seqno,
        name,
      })),
    );
  }

  const entity = database.entities.find((candidate) => candidate.name === argument);
  if (!entity) return result('pragma', [], []);

  if (pragma === 'table_xinfo') {
    return result(
      'pragma',
      ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk', 'hidden'],
      entity.columns.map((column, cid) => ({
        cid,
        name: column.name,
        type: column.type,
        notnull: column.notNull ? 1 : 0,
        dflt_value: column.defaultValue ?? null,
        pk: column.pk ?? 0,
        hidden: 0,
      })),
    );
  }
  if (pragma === 'foreign_key_list') {
    return result(
      'pragma',
      ['id', 'seq', 'table', 'from', 'to', 'on_update', 'on_delete', 'match'],
      entity.foreignKeys.map((foreignKey, id) => ({
        id,
        seq: 0,
        table: foreignKey.table,
        from: foreignKey.from,
        to: foreignKey.to,
        on_update: 'NO ACTION',
        on_delete: 'CASCADE',
        match: 'NONE',
      })),
    );
  }
  if (pragma === 'index_list') {
    return result(
      'pragma',
      ['seq', 'name', 'unique', 'origin', 'partial'],
      entity.indexes.map((index, seq) => ({
        seq,
        name: index.name,
        unique: index.unique ? 1 : 0,
        origin: index.origin,
        partial: 0,
      })),
    );
  }
  throw new SqlError(`unsupported pragma: ${pragma}`);
};

const runMutation = (database: MockDatabase, sql: string, params: Value[]) => {
  const drop = sql.match(
    new RegExp(
      `^drop\\s+(table|view)\\s+(?:if\\s+exists\\s+)?(${IDENTIFIER}(?:\\.${IDENTIFIER})?)`,
      'i',
    ),
  );
  if (drop) {
    const entity = resolveEntity(database, drop[2]);
    database.entities = database.entities.filter((candidate) => candidate !== entity);
    return result('drop', [], [], { changes: 0 });
  }

  const del = sql.match(
    new RegExp(
      `^delete\\s+from\\s+(${IDENTIFIER}(?:\\.${IDENTIFIER})?)(?:\\s+where\\s+(.+))?$`,
      'is',
    ),
  );
  if (del) {
    const entity = resolveEntity(database, del[1]);
    const doomed = new Set(
      filterRows(
        entity.rows.map((row, index) => ({
          ...row,
          rowid: getRowId(entity, row, index),
          __row: row as unknown as Value,
        })),
        del[2],
        params,
      ).map((row) => row.__row as unknown as Row),
    );
    entity.rows = entity.rows.filter((row) => !doomed.has(row));
    return result('delete', [], [], { changes: doomed.size });
  }

  const update = sql.match(
    new RegExp(
      `^update\\s+(${IDENTIFIER}(?:\\.${IDENTIFIER})?)\\s+set\\s+(.+?)(?:\\s+where\\s+(.+))?$`,
      'is',
    ),
  );
  if (update) {
    const entity = resolveEntity(database, update[1]);
    const assignments = update[2].split(',').map((assignment) => {
      const match = assignment.trim().match(new RegExp(`^(${IDENTIFIER})\\s*=\\s*\\?$`));
      if (!match) throw new SqlError(`near "${assignment.trim().slice(0, 24)}": syntax error`);
      return unquote(match[1]);
    });
    const values = params.slice(0, assignments.length);
    const matches = new Set(
      filterRows(
        entity.rows.map((row, index) => ({
          ...row,
          rowid: getRowId(entity, row, index),
          __row: row as unknown as Value,
        })),
        update[3],
        params.slice(assignments.length),
      ).map((row) => row.__row as unknown as Row),
    );
    matches.forEach((row) => assignments.forEach((column, index) => (row[column] = values[index])));
    return result('update', [], [], { changes: matches.size });
  }

  const word = sql.match(/^\s*(\w+)/)?.[1] ?? sql.slice(0, 12);
  throw new SqlError(`near "${word}": syntax error`);
};

const runStatement = (database: MockDatabase, rawSql: string, params: Value[] = []) => {
  const sql = rawSql.trim().replace(/;\s*$/, '');

  if (/\bsqlite_schema\b/i.test(sql) && /^select/i.test(sql)) {
    const lookup = sql.match(/name\s*=\s*'((?:[^']|'')+)'/i);
    const entities = database.entities.filter((entity) => !lookup || entity.name === lookup[1]);
    if (/^select\s+name\s*,\s*type\s+from/i.test(sql)) {
      return result(
        'select',
        ['name', 'type'],
        entities
          .map((entity) => ({ name: entity.name, type: entity.type }))
          .sort(
            (a, b) =>
              String(a.type).localeCompare(String(b.type)) ||
              String(a.name).localeCompare(String(b.name)),
          ),
      );
    }
    if (/^select\s+sql\s+from/i.test(sql)) {
      return result(
        'select',
        ['sql'],
        entities.map((entity) => ({ sql: entity.sql })),
      );
    }
    return result(
      'select',
      ['name', 'type', 'sql'],
      [...entities]
        .sort((a, b) =>
          a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'table' ? -1 : 1,
        )
        .map((entity) => ({ name: entity.name, type: entity.type, sql: entity.sql })),
    );
  }

  if (/^pragma/i.test(sql)) return runPragma(database, sql);
  if (/^select/i.test(sql)) return runSelect(database, sql, params);
  return runMutation(database, sql, params);
};

// Statements split on `;` outside quotes, with the offsets `sqlite:execute-script` reports.
const splitScript = (script: string) => {
  const statements: Array<{ text: string; start: number; end: number }> = [];
  let start = 0;
  let quote: string | null = null;
  for (let index = 0; index <= script.length; index += 1) {
    const char = script[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === ';' || index === script.length) {
      const text = script.slice(start, index).trim();
      if (text) {
        const offset = script.indexOf(text, start);
        statements.push({ text, start: offset, end: offset + text.length });
      }
      start = index + 1;
    }
  }
  return statements;
};

// --- The device -------------------------------------------------------------------------------

type DeviceMode = 'normal' | 'empty' | 'error';

let mode: DeviceMode = 'normal';
let databases = createMockDatabases();

const resetDevice = (nextMode: DeviceMode) => {
  mode = nextMode;
  databases = createMockDatabases();
};

const toMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mockDeviceFlow = {
  name: 'Mock device (two databases)',
  autoRun: true,
  run: async ({ send, onMessage, signal }: DevFlowContext) => {
    const findDatabase = (databaseId: string) => {
      const database = databases.find((candidate) => candidate.id === databaseId);
      if (!database) throw new SqlError(`Unknown database "${databaseId}".`);
      return database;
    };

    onMessage({ type: 'sqlite:list-databases', direction: 'out' }, async (message) => {
      const { requestId } = message.payload as { requestId: string };
      await wait(LATENCY_MS);
      if (mode === 'error') {
        send('sqlite:list-databases:result', {
          requestId,
          databases: [],
          error:
            'The SQLite adapter is not registered. Pass an adapter to useRozeniteSqlitePlugin.',
        });
        return;
      }
      send('sqlite:list-databases:result', {
        requestId,
        databases:
          mode === 'empty'
            ? []
            : databases.map((database) => ({
                id: database.id,
                name: database.name,
                adapterId: 'expo-sqlite',
                adapterName: 'Expo SQLite',
              })),
      });
    });

    onMessage({ type: 'sqlite:query', direction: 'out' }, async (message) => {
      const { requestId, databaseId, sql, params } = message.payload as {
        requestId: string;
        databaseId: string;
        sql: string;
        params?: Value[];
      };
      await wait(LATENCY_MS);
      try {
        send('sqlite:query:result', {
          requestId,
          databaseId,
          result: runStatement(findDatabase(databaseId), sql, Array.isArray(params) ? params : []),
        });
      } catch (error) {
        send('sqlite:query:result', { requestId, databaseId, error: toMessage(error) });
      }
    });

    onMessage({ type: 'sqlite:execute-script', direction: 'out' }, async (message) => {
      const { requestId, databaseId, sql } = message.payload as {
        requestId: string;
        databaseId: string;
        sql: string;
      };
      await wait(LATENCY_MS * 2);
      try {
        const database = findDatabase(databaseId);
        const statements = splitScript(sql);
        if (statements.length === 0) throw new SqlError('Query cannot be empty.');

        const executed = [];
        let failedStatementIndex: number | null = null;
        for (const [index, statement] of statements.entries()) {
          const input = { sql: statement.text };
          try {
            executed.push({
              index,
              start: statement.start,
              end: statement.end,
              input,
              execution: { input, result: runStatement(database, statement.text) },
            });
          } catch (error) {
            executed.push({
              index,
              start: statement.start,
              end: statement.end,
              input,
              error: toMessage(error),
            });
            failedStatementIndex = index;
            break;
          }
        }

        send('sqlite:execute-script:result', {
          requestId,
          databaseId,
          result: {
            statements: executed,
            totalStatementCount: statements.length,
            failedStatementIndex,
          },
        });
      } catch (error) {
        send('sqlite:execute-script:result', { requestId, databaseId, error: toMessage(error) });
      }
    });

    send('sqlite:ready', { timestamp: Date.now() });

    // Keep answering until the preview reloads or the flow is stopped.
    await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve()));
    return { message: 'Mock device stopped.' };
  },
};

const stateFlow = (name: string, nextMode: DeviceMode, message: string) => ({
  name,
  run: ({ send }: DevFlowContext) => {
    resetDevice(nextMode);
    send('sqlite:ready', { timestamp: Date.now() });
    return { message, databases: nextMode === 'normal' ? databases.length : 0 };
  },
});

export default {
  integrations: ['react-native'],
  panels: [
    {
      name: 'SQLite',
      source: './src/ui/panel.tsx',
    },
  ],
  dev: {
    presets: [
      { name: 'App reloaded (sqlite:ready)', type: 'sqlite:ready', payload: { timestamp: 0 } },
    ],
    flows: [
      mockDeviceFlow,
      stateFlow(
        'Reset mock device data',
        'normal',
        'Restored both databases and told the panel the app reloaded.',
      ),
      stateFlow(
        'Mock device: no databases',
        'empty',
        'The device now reports no databases (empty state).',
      ),
      stateFlow(
        'Mock device: adapter error',
        'error',
        'The device now answers list-databases with an error.',
      ),
    ],
  },
};
