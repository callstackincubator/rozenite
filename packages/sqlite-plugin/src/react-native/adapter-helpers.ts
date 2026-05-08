/**
 * Shared SQL + bridge helpers for custom adapters (e.g. non-Expo SQLite drivers).
 */
export type { SqlStatementSegment } from '../shared/sql';
export {
  classifySqlStatement,
  normalizeSingleStatementSql,
  splitSqlStatements,
  statementReturnsRows,
} from '../shared/sql';
export { decodeSqliteBridgeValue, formatSqliteError } from '../shared/bridge-values';
