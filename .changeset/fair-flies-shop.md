---
'@rozenite/controls-plugin': minor
'@rozenite/file-system-plugin': minor
'@rozenite/mmkv-plugin': minor
'@rozenite/network-activity-plugin': minor
'@rozenite/react-navigation-plugin': minor
'@rozenite/redux-devtools-plugin': minor
'@rozenite/tanstack-query-plugin': minor
---

Add typed `./sdk` entrypoints for the official agent-enabled plugins backed by
the same shared tool contracts used at runtime.

These plugins now publish typed descriptor groups for `session.tools.call(...)`
workflows, including shared public input/result types, while keeping their
existing tool names and runtime behavior unchanged. The official agent SDK docs
and plugin authoring guidance now also document this SDK export pattern,
including the `network-activity` fallback note for environments without the
built-in `network` domain.
