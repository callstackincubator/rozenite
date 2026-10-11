---
name: sqlite
description: List the app's registered SQLite databases and run SQL against one of them.
domain: sqlite
---

# SQLite Plugin Domain

A Rozenite plugin for inspecting SQLite databases in React Native DevTools. Use this domain to find the databases the app registered and to run SQL against one of them: read rows, inspect the schema with `PRAGMA`, or change data.

## Domain

- Plugin ID: `@rozenite/sqlite-plugin`
- Domain token: `sqlite`

## Tools

```
npx rozenite agent sqlite list-databases
npx rozenite agent sqlite execute-sql --databaseId <id> --sql "SELECT name FROM sqlite_master WHERE type = 'table'"
npx rozenite agent sqlite execute-sql --databaseId <id> --sql 'SELECT * FROM todos LIMIT 20'
```

`list-databases` prints one row per database with `id`, `name` and `adapterName`; `--fields all` adds `adapterId`. Pass the `id` as `--databaseId`.

## Running SQL

`execute-sql` runs one or more semicolon-separated statements in order and stops at the first error. The result lists each statement with its `rows`, `columns` and `metadata`; `failedStatementIndex` names the statement that failed, which carries an `error` instead. Statements before it have already run.

`execute-sql` returns every row a statement produces, so add a `LIMIT` to reads of large tables.

## Minimal Flow

`list-databases` -> `execute-sql` with a `SELECT` or `PRAGMA table_info(<table>)`.

Mutation:
`execute-sql` with `INSERT`, `UPDATE`, `DELETE` or DDL. These change the app's data.
