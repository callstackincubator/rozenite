/**
 * Shared SQL + bridge helpers for custom SQLite adapters (e.g. non-Expo drivers).
 * @see createSqliteAdapter in ./adapters/generic.ts
 */
export type { SqlStatementSegment } from '../shared/sql';
export {
  classifySqlStatement,
  normalizeSingleStatementSql,
  splitSqlStatements,
  statementReturnsRows,
} from '../shared/sql';
export { decodeSqliteBridgeValue, formatSqliteError } from '../shared/bridge-values';
