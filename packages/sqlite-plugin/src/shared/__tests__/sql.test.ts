import { describe, expect, it } from 'vitest';
import {
  getStatementAtCursor,
  normalizeSingleStatementSql,
  splitSqlStatements,
} from '../sql';

describe('SQL statement helpers', () => {
  it('finds the active statement when earlier statements contain comments and quoted semicolons', () => {
    const sql = [
      '-- setup comment;',
      "SELECT 'semi;colon' AS value;",
      "INSERT INTO logs(message) VALUES('done');",
    ].join('\n');
    const cursor = sql.indexOf('logs');

    expect(getStatementAtCursor(sql, cursor)?.text).toBe(
      "INSERT INTO logs(message) VALUES('done')",
    );
  });

  it('normalizes a single statement and removes the trailing semicolon', () => {
    expect(normalizeSingleStatementSql(' SELECT * FROM projects;  ')).toBe(
      'SELECT * FROM projects',
    );
  });

  it('rejects multiple statements', () => {
    expect(() =>
      normalizeSingleStatementSql('SELECT * FROM projects; DELETE FROM logs;'),
    ).toThrow('Only a single SQL statement is supported in v1.');
  });

  it('splits statements while preserving source offsets', () => {
    const sql = [
      '-- comment before first statement',
      'SELECT 1;',
      '',
      "INSERT INTO logs(message) VALUES('done');",
    ].join('\n');

    expect(splitSqlStatements(sql)).toEqual([
      {
        text: '-- comment before first statement\nSELECT 1',
        start: 0,
        end: sql.indexOf(';'),
      },
      {
        text: "INSERT INTO logs(message) VALUES('done')",
        start: 43,
        end: sql.lastIndexOf(';'),
      },
    ]);
  });
});
