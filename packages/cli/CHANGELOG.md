# rozenite

## 1.7.0

### Minor Changes

- [#216](https://github.com/callstackincubator/rozenite/pull/216) [`a826e35`](https://github.com/callstackincubator/rozenite/commit/a826e35ffadcf79b9d2f1bb033666d3b27d40752) Thanks [@V3RON](https://github.com/V3RON)! - Refactor the agent workflow to use Metro-backed session routes and shared transport types instead of the old daemon-oriented CLI flow.

  The agent bridge now re-registers in-app tools after session bootstrap, middleware waits for session bootstrap before exposing created sessions, and the packaged CLI skill/docs were updated to match the new session and artifact behavior.

### Patch Changes

- [#212](https://github.com/callstackincubator/rozenite/pull/212) [`83269e6`](https://github.com/callstackincubator/rozenite/commit/83269e6719e02776d654f7c111755c164870d44d) Thanks [@V3RON](https://github.com/V3RON)! - Restructure plugin packaging so build outputs are grouped under target-specific `dist/devtools`, `dist/react-native`, and `dist/metro` directories.

  The CLI now keeps builder-managed `package.json` entry fields in sync with generated outputs, React Native `require()` chunks use stable names, and public declaration files are bundled per target entry.

- Updated dependencies [[`a826e35`](https://github.com/callstackincubator/rozenite/commit/a826e35ffadcf79b9d2f1bb033666d3b27d40752)]:
  - @rozenite/agent-shared@1.7.0
  - @rozenite/tools@1.7.0

## 1.6.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/tools@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/tools@1.5.1

## 1.5.0

### Minor Changes

- [#190](https://github.com/callstackincubator/rozenite/pull/190) [`5ae53a4`](https://github.com/callstackincubator/rozenite/commit/5ae53a4b509adbd8536ea24812f7ca523a95b625) Thanks [@V3RON](https://github.com/V3RON)! - Added Rozenite for Agents, including the new CLI agent workflow, shared agent packages, and middleware support for the new agent connection flow.

### Patch Changes

- Updated dependencies []:
  - @rozenite/tools@1.5.0

## 1.4.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/tools@1.4.0

## 1.3.0

### Minor Changes

- [#171](https://github.com/callstackincubator/rozenite/pull/171) Thanks [@dannyhw](https://github.com/dannyhw)! - Plugin templates were updated to use updated dependencies.

### Patch Changes

- Updated dependencies []:
  - @rozenite/tools@1.3.0
