---
'@rozenite/sqlite-plugin': minor
---

`classifySqlStatement`, `normalizeSingleStatementSql`, `splitSqlStatements`, `statementReturnsRows`, `decodeSqliteBridgeValue`, and `formatSqliteError` are now exported from `@rozenite/sqlite-plugin`. These are the building blocks you need when writing a custom SQLite adapter — to parse and classify SQL before execution, and to decode values coming back over the native bridge.
