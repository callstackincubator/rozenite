# @rozenite/shell

## 2.1.0

### Minor Changes

- [#381](https://github.com/callstackincubator/rozenite/pull/381) [`629df05`](https://github.com/callstackincubator/rozenite/commit/629df051e4ef08775a9a4e1a008aba819d7be05d) Thanks [@V3RON](https://github.com/V3RON)! - Add a Plugins screen to shell mode, opened from a new cog button in the sidebar footer. It lists every loaded plugin with its package id, description, installed version, panels, and a link to npm when a newer version is published. The cog shows a dot when any plugin or the runtime itself has an update available. Panel state is preserved while the screen is open. Also fixes the npm version check to use the CDN-cached registry endpoint instead of the rate-limited `/latest` endpoint, and to correctly ignore local builds ahead of npm.

### Patch Changes

- Updated dependencies [[`3ec6730`](https://github.com/callstackincubator/rozenite/commit/3ec673095da118cd0ac52c33cae0d8b03b0e162a), [`629df05`](https://github.com/callstackincubator/rozenite/commit/629df051e4ef08775a9a4e1a008aba819d7be05d)]:
  - @rozenite/ui@2.1.0

## 2.0.0

### Minor Changes

- [#366](https://github.com/callstackincubator/rozenite/pull/366) [`7b138a5`](https://github.com/callstackincubator/rozenite/commit/7b138a54462a4340f33e895a7cc17583078a8e96) Thanks [@V3RON](https://github.com/V3RON)! - Show release-specific welcome messaging the first time a new Rozenite version runs.

- [#355](https://github.com/callstackincubator/rozenite/pull/355) [`ea5a01f`](https://github.com/callstackincubator/rozenite/commit/ea5a01fa86bc5f716896483fa6e1a49c283e6097) Thanks [@V3RON](https://github.com/V3RON)! - Show plugin panels in a unified Rozenite sidebar by default, with an option to
  keep the individual DevTools tabs presentation.

### Patch Changes

- [#360](https://github.com/callstackincubator/rozenite/pull/360) [`893f238`](https://github.com/callstackincubator/rozenite/commit/893f238c9e7015776ccb79915620271785227022) Thanks [@V3RON](https://github.com/V3RON)! - Preserve sidebar panel state by default and respect `destroyOnDetachPlugins`
  when switching panels.
- Updated dependencies [[`de396d6`](https://github.com/callstackincubator/rozenite/commit/de396d651d592ac4186f3971d26c8f0551358d64), [`81bddb8`](https://github.com/callstackincubator/rozenite/commit/81bddb87ab29e45804172a4be7595880099384d9), [`88c1faf`](https://github.com/callstackincubator/rozenite/commit/88c1faffb6ffdeaaf05bad750cfb8e46470f3ff5), [`6fad9f3`](https://github.com/callstackincubator/rozenite/commit/6fad9f3a3ac8a5c350d2e8b8c8336642aac5f73d), [`222945f`](https://github.com/callstackincubator/rozenite/commit/222945f00049ca8b7a3746478d6a94b7e4ced6a7), [`b42bf95`](https://github.com/callstackincubator/rozenite/commit/b42bf95cd1573e84ce2faefae92c021575709a33)]:
  - @rozenite/ui@2.0.0
