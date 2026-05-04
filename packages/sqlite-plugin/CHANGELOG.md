# @rozenite/sqlite-plugin

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
