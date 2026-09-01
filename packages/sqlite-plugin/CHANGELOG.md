# @rozenite/sqlite-plugin

## 2.3.0

### Minor Changes

- [#457](https://github.com/callstackincubator/rozenite/pull/457) [`3a29044`](https://github.com/callstackincubator/rozenite/commit/3a29044d0b72354ff80cb2e044afe7d51b800348) Thanks [@V3RON](https://github.com/V3RON)! - Every official plugin now declares the integrations it supports, so a plugin that cannot work in the environment you are debugging can say so instead of loading and failing.

  Controls, Feature Flags, React Hook Form and TanStack Query import nothing from `react-native` on the device and declare every integration, Lynx included. Plugins built on native modules — SQLite, Storage, File System and Performance Monitor — declare React Native only, and so do Network Activity and Require Profiler: `react-native-web` provides no `TurboModuleRegistry` or `DevSettings`, which their device code calls. The rest use React Native APIs that do have web equivalents, and also declare Rozenite for Web.

### Patch Changes

- Updated dependencies [[`158f4e5`](https://github.com/callstackincubator/rozenite/commit/158f4e5406d6428e24164bdde82d459030fa7309)]:
  - @rozenite/plugin-bridge@2.3.0
  - @rozenite/agent-bridge@2.3.0

## 2.2.0

### Patch Changes

- Updated dependencies [[`dffeda5`](https://github.com/callstackincubator/rozenite/commit/dffeda53c57f491a303108937d4b4ce68054226f), [`4f5fe74`](https://github.com/callstackincubator/rozenite/commit/4f5fe747ca0c6e93d0bf05076c7e2e2ad25fd744)]:
  - @rozenite/agent-bridge@2.2.0
  - @rozenite/plugin-bridge@2.2.0

## 2.1.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@2.1.0
  - @rozenite/plugin-bridge@2.1.0

## 2.0.0

### Minor Changes

- [#353](https://github.com/callstackincubator/rozenite/pull/353) [`7539217`](https://github.com/callstackincubator/rozenite/commit/7539217520f0c3ff28d2e943bf866b6bcc3c1fe0) Thanks [@V3RON](https://github.com/V3RON)! - Add controls to drop a single table or view from the Structure tab and to
  drop all tables and views in a database from the sidebar. Both are gated by
  a shared confirmation dialog that requires typing the object or database
  name and previews the SQL that will run.

### Patch Changes

- Updated dependencies [[`a57b914`](https://github.com/callstackincubator/rozenite/commit/a57b91448e6cc9b88bd987bf462f07deef6b0d55), [`fa96bb8`](https://github.com/callstackincubator/rozenite/commit/fa96bb84d53d264b1f30aa7034ec678711a2c6b1), [`476a27f`](https://github.com/callstackincubator/rozenite/commit/476a27f5532f4e35ad66feb5c9481b9396592d14)]:
  - @rozenite/agent-bridge@2.0.0
  - @rozenite/plugin-bridge@2.0.0

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
