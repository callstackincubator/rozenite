import type { SqliteStatementType } from './types';

const isWhitespace = (char: string) => /\s/.test(char);

export const countSqlStatements = (sql: string) => {
  let count = 0;
  let hasToken = false;
  let i = 0;
  let mode:
    | 'single-quote'
    | 'double-quote'
    | 'backtick'
    | 'bracket'
    | 'line-comment'
    | 'block-comment'
    | null = null;

  while (i < sql.length) {
    const char = sql[i];
    const next = sql[i + 1];

    if (mode === 'line-comment') {
      if (char === '\n') {
        mode = null;
      }
      i += 1;
      continue;
    }

    if (mode === 'block-comment') {
      if (char === '*' && next === '/') {
        mode = null;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (mode === 'single-quote') {
      if (char === "'" && next === "'") {
        i += 2;
        continue;
      }
      if (char === "'") {
        mode = null;
      }
      i += 1;
      continue;
    }

    if (mode === 'double-quote') {
      if (char === '"' && next === '"') {
        i += 2;
        continue;
      }
      if (char === '"') {
        mode = null;
      }
      i += 1;
      continue;
    }

    if (mode === 'backtick') {
      if (char === '`' && next === '`') {
        i += 2;
        continue;
      }
      if (char === '`') {
        mode = null;
      }
      i += 1;
      continue;
    }

    if (mode === 'bracket') {
      if (char === ']' && next === ']') {
        i += 2;
        continue;
      }
      if (char === ']') {
        mode = null;
      }
      i += 1;
      continue;
    }

    if (char === '-' && next === '-') {
      mode = 'line-comment';
      i += 2;
      continue;
    }

    if (char === '/' && next === '*') {
      mode = 'block-comment';
      i += 2;
      continue;
    }

    if (char === "'") {
      mode = 'single-quote';
      hasToken = true;
      i += 1;
      continue;
    }

    if (char === '"') {
      mode = 'double-quote';
      hasToken = true;
      i += 1;
      continue;
    }

    if (char === '`') {
      mode = 'backtick';
      hasToken = true;
      i += 1;
      continue;
    }

    if (char === '[') {
      mode = 'bracket';
      hasToken = true;
      i += 1;
      continue;
    }

    if (char === ';') {
      if (hasToken) {
        count += 1;
        hasToken = false;
      }
      i += 1;
      continue;
    }

    if (!isWhitespace(char)) {
      hasToken = true;
    }

    i += 1;
  }

  if (hasToken) {
    count += 1;
  }

  return count;
};

export type SqlStatementSegment = {
  text: string;
  start: number;
  end: number;
};

export const splitSqlStatements = (sql: string): SqlStatementSegment[] => {
  const segments: SqlStatementSegment[] = [];
  let hasToken = false;
  let segmentStart = 0;
  let i = 0;
  let mode:
    | 'single-quote'
    | 'double-quote'
    | 'backtick'
    | 'bracket'
    | 'line-comment'
    | 'block-comment'
    | null = null;

  const pushSegment = (end: number) => {
    const text = sql.slice(segmentStart, end).trim();

    if (text) {
      segments.push({
        text,
        start: segmentStart,
        end,
      });
    }

    segmentStart = end + 1;
    hasToken = false;
  };

  while (i < sql.length) {
    const char = sql[i];
    const next = sql[i + 1];

    if (mode === 'line-comment') {
      if (char === '\n') {
        mode = null;
      }
      i += 1;
      continue;
    }

    if (mode === 'block-comment') {
      if (char === '*' && next === '/') {
        mode = null;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (mode === 'single-quote') {
      if (char === "'" && next === "'") {
        i += 2;
        continue;
      }
      if (char === "'") {
        mode = null;
      }
      i += 1;
      continue;
    }

    if (mode === 'double-quote') {
      if (char === '"' && next === '"') {
        i += 2;
        continue;
      }
      if (char === '"') {
        mode = null;
      }
      i += 1;
      continue;
    }

    if (mode === 'backtick') {
      if (char === '`' && next === '`') {
        i += 2;
        continue;
      }
      if (char === '`') {
        mode = null;
      }
      i += 1;
      continue;
    }

    if (mode === 'bracket') {
      if (char === ']' && next === ']') {
        i += 2;
        continue;
      }
      if (char === ']') {
        mode = null;
      }
      i += 1;
      continue;
    }

    if (char === '-' && next === '-') {
      mode = 'line-comment';
      i += 2;
      continue;
    }

    if (char === '/' && next === '*') {
      mode = 'block-comment';
      i += 2;
      continue;
    }

    if (char === "'") {
      mode = 'single-quote';
      hasToken = true;
      i += 1;
      continue;
    }

    if (char === '"') {
      mode = 'double-quote';
      hasToken = true;
      i += 1;
      continue;
    }

    if (char === '`') {
      mode = 'backtick';
      hasToken = true;
      i += 1;
      continue;
    }

    if (char === '[') {
      mode = 'bracket';
      hasToken = true;
      i += 1;
      continue;
    }

    if (char === ';') {
      if (hasToken) {
        pushSegment(i);
      } else {
        segmentStart = i + 1;
      }
      i += 1;
      continue;
    }

    if (!isWhitespace(char)) {
      hasToken = true;
    }

    i += 1;
  }

  if (hasToken) {
    pushSegment(sql.length);
  }

  return segments;
};

export const getStatementAtCursor = (sql: string, cursor: number) => {
  const segments = splitSqlStatements(sql);

  if (segments.length === 0) {
    return null;
  }

  const match = segments.find(
    (segment) => cursor >= segment.start && cursor <= segment.end + 1,
  );

  return match ?? segments[0];
};

export const normalizeSingleStatementSql = (sql: string) => {
  const statementCount = countSqlStatements(sql);

  if (statementCount === 0) {
    throw new Error('Query cannot be empty.');
  }

  if (statementCount > 1) {
    throw new Error('Only a single SQL statement is supported in v1.');
  }

  return sql.trim().replace(/;\s*$/, '').trim();
};

const readLeadingKeyword = (sql: string) => {
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    const next = sql[i + 1];

    if (isWhitespace(char)) {
      i += 1;
      continue;
    }

    if (char === '-' && next === '-') {
      i += 2;
      while (i < sql.length && sql[i] !== '\n') {
        i += 1;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) {
        i += 1;
      }
      i += 2;
      continue;
    }

    break;
  }

  const start = i;

  while (i < sql.length && /[A-Za-z]/.test(sql[i])) {
    i += 1;
  }

  return sql.slice(start, i).toLowerCase();
};

export const classifySqlStatement = (sql: string): SqliteStatementType => {
  const keyword = readLeadingKeyword(sql);

  if (
    keyword === 'select' ||
    keyword === 'insert' ||
    keyword === 'update' ||
    keyword === 'delete' ||
    keyword === 'pragma' ||
    keyword === 'create' ||
    keyword === 'alter' ||
    keyword === 'drop' ||
    keyword === 'explain' ||
    keyword === 'with'
  ) {
    return keyword;
  }

  return 'other';
};

export const statementReturnsRows = (statementType: SqliteStatementType) =>
  statementType === 'select' ||
  statementType === 'pragma' ||
  statementType === 'explain' ||
  statementType === 'with';

export const quoteSqlIdentifier = (identifier: string) =>
  `"${identifier.replace(/"/g, '""')}"`;

export const escapeSqlString = (value: string) =>
  `'${value.replace(/'/g, "''")}'`;
