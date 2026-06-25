# @rozenite/sqlite-plugin

## 1.13.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.13.0
  - @rozenite/plugin-bridge@1.13.0

## 1.12.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.12.0
  - @rozenite/plugin-bridge@1.12.0

## 1.11.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.11.0
  - @rozenite/plugin-bridge@1.11.0

## 1.10.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.10.0
  - @rozenite/plugin-bridge@1.10.0

## 1.9.0

### Minor Changes

- [#259](https://github.com/callstackincubator/rozenite/pull/259) [`6fd13c0`](https://github.com/callstackincubator/rozenite/commit/6fd13c04108b5a49d0526223b0680b03a0bb6276) Thanks [@V3RON](https://github.com/V3RON)! - `classifySqlStatement`, `normalizeSingleStatementSql`, `splitSqlStatements`, `statementReturnsRows`, `decodeSqliteBridgeValue`, and `formatSqliteError` are now exported from `@rozenite/sqlite-plugin`. These are the building blocks you need when writing a custom SQLite adapter — to parse and classify SQL before execution, and to decode values coming back over the native bridge.

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.9.0
  - @rozenite/plugin-bridge@1.9.0

## 1.8.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.8.1
  - @rozenite/plugin-bridge@1.8.1

## 1.8.0

### Minor Changes

- [#228](https://github.com/callstackincubator/rozenite/pull/228) [`0b373c7`](https://github.com/callstackincubator/rozenite/commit/0b373c7e1b3ebf0a80f87f0a7871d55dcf300992) Thanks [@V3RON](https://github.com/V3RON)! - Add agent tool support to the SQLite plugin. LLM agents can now use `list-databases` to discover registered databases and `execute-sql` to run any SQL — including multi-statement scripts — against a specific database.

### Patch Changes

- Updated dependencies [[`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a), [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a)]:
  - @rozenite/agent-bridge@1.8.0
  - @rozenite/plugin-bridge@1.8.0

## 1.7.0

### Minor Changes

- [#210](https://github.com/callstackincubator/rozenite/pull/210) [`45877af`](https://github.com/callstackincubator/rozenite/commit/45877af273f007434679029ff46fd767797aa2e3) Thanks [@V3RON](https://github.com/V3RON)! - Add a new plugin for interacting with SQLite databases, making it possible to inspect database structure, browse tables, and run queries through the Rozenite plugin system.

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.7.0

## 1.6.0

- Initial release.
- Added adapter-driven SQLite inspection for Rozenite.
- Added an `expo-sqlite` adapter and query-first runtime bridge.
- Added Browse, Schema, and Query views for registered databases.
