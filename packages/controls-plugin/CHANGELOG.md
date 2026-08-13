# @rozenite/controls-plugin

## 2.1.0

### Patch Changes

- Updated dependencies [[`3ec6730`](https://github.com/callstackincubator/rozenite/commit/3ec673095da118cd0ac52c33cae0d8b03b0e162a), [`629df05`](https://github.com/callstackincubator/rozenite/commit/629df051e4ef08775a9a4e1a008aba819d7be05d)]:
  - @rozenite/ui@2.1.0
  - @rozenite/agent-bridge@2.1.0
  - @rozenite/agent-shared@2.1.0
  - @rozenite/plugin-bridge@2.1.0

## 2.0.0

### Minor Changes

- [#362](https://github.com/callstackincubator/rozenite/pull/362) [`222945f`](https://github.com/callstackincubator/rozenite/commit/222945f00049ca8b7a3746478d6a94b7e4ced6a7) Thanks [@V3RON](https://github.com/V3RON)! - Unify Controls, Overlay, and React Navigation DevTools panels with shared UI
  primitives, sidebar layouts, and dark-theme form controls.

### Patch Changes

- Updated dependencies [[`a57b914`](https://github.com/callstackincubator/rozenite/commit/a57b91448e6cc9b88bd987bf462f07deef6b0d55), [`fa96bb8`](https://github.com/callstackincubator/rozenite/commit/fa96bb84d53d264b1f30aa7034ec678711a2c6b1), [`de396d6`](https://github.com/callstackincubator/rozenite/commit/de396d651d592ac4186f3971d26c8f0551358d64), [`476a27f`](https://github.com/callstackincubator/rozenite/commit/476a27f5532f4e35ad66feb5c9481b9396592d14), [`81bddb8`](https://github.com/callstackincubator/rozenite/commit/81bddb87ab29e45804172a4be7595880099384d9), [`88c1faf`](https://github.com/callstackincubator/rozenite/commit/88c1faffb6ffdeaaf05bad750cfb8e46470f3ff5), [`6fad9f3`](https://github.com/callstackincubator/rozenite/commit/6fad9f3a3ac8a5c350d2e8b8c8336642aac5f73d), [`222945f`](https://github.com/callstackincubator/rozenite/commit/222945f00049ca8b7a3746478d6a94b7e4ced6a7), [`b42bf95`](https://github.com/callstackincubator/rozenite/commit/b42bf95cd1573e84ce2faefae92c021575709a33)]:
  - @rozenite/agent-bridge@2.0.0
  - @rozenite/agent-shared@2.0.0
  - @rozenite/ui@2.0.0
  - @rozenite/plugin-bridge@2.0.0

## 1.13.0

### Patch Changes

- Updated dependencies [[`7b00844`](https://github.com/callstackincubator/rozenite/commit/7b00844e6439bb7447bc2b61519a6aa6fc1c270f)]:
  - @rozenite/agent-shared@1.13.0
  - @rozenite/agent-bridge@1.13.0
  - @rozenite/plugin-bridge@1.13.0

## 1.12.0

### Minor Changes

- [#292](https://github.com/callstackincubator/rozenite/pull/292) [`c595bad`](https://github.com/callstackincubator/rozenite/commit/c595bad6b9b05d0212cb18aaf6afcd5134e89288) Thanks [@draggie](https://github.com/draggie)! - Allow multiple `useRozeniteControlsPlugin` hook instances to contribute controls sections to one combined panel.

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.12.0
  - @rozenite/agent-shared@1.12.0
  - @rozenite/plugin-bridge@1.12.0

## 1.11.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.11.0
  - @rozenite/agent-shared@1.11.0
  - @rozenite/plugin-bridge@1.11.0

## 1.10.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.10.0
  - @rozenite/agent-shared@1.10.0
  - @rozenite/plugin-bridge@1.10.0

## 1.9.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.9.0
  - @rozenite/agent-shared@1.9.0
  - @rozenite/plugin-bridge@1.9.0

## 1.8.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.8.1
  - @rozenite/agent-shared@1.8.1
  - @rozenite/plugin-bridge@1.8.1

## 1.8.0

### Minor Changes

- [#222](https://github.com/callstackincubator/rozenite/pull/222) [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a) Thanks [@manapard](https://github.com/manapard)! - Add typed `./sdk` entrypoints for the official agent-enabled plugins backed by
  the same shared tool contracts used at runtime.

  These plugins now publish typed descriptor groups for `session.tools.call(...)`
  workflows, including shared public input/result types, while keeping their
  existing tool names and runtime behavior unchanged. The official agent SDK docs
  and plugin authoring guidance now also document this SDK export pattern,
  including the `network-activity` fallback note for environments without the
  built-in `network` domain.

### Patch Changes

- Updated dependencies [[`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a), [`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a)]:
  - @rozenite/agent-bridge@1.8.0
  - @rozenite/agent-shared@1.8.0
  - @rozenite/plugin-bridge@1.8.0

## 1.7.0

### Patch Changes

- Updated dependencies [[`a826e35`](https://github.com/callstackincubator/rozenite/commit/a826e35ffadcf79b9d2f1bb033666d3b27d40752)]:
  - @rozenite/agent-bridge@1.7.0
  - @rozenite/plugin-bridge@1.7.0

## 1.6.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.6.0
  - @rozenite/plugin-bridge@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/agent-bridge@1.5.1
  - @rozenite/plugin-bridge@1.5.1

## 1.5.0

### Minor Changes

- [#190](https://github.com/callstackincubator/rozenite/pull/190) [`5ae53a4`](https://github.com/callstackincubator/rozenite/commit/5ae53a4b509adbd8536ea24812f7ca523a95b625) Thanks [@V3RON](https://github.com/V3RON)! - Added Rozenite for Agents support to the Controls, MMKV, React Navigation, and Storage plugins.

### Patch Changes

- Updated dependencies [[`5ae53a4`](https://github.com/callstackincubator/rozenite/commit/5ae53a4b509adbd8536ea24812f7ca523a95b625)]:
  - @rozenite/agent-bridge@1.5.0
  - @rozenite/plugin-bridge@1.5.0
