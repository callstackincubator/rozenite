---
'@rozenite/zustand-plugin': minor
---

Add `@rozenite/zustand-plugin`, a DevTools panel for Zustand stores wrapped in the `rozenite()` middleware. It shows a timeline of named actions with their arguments, recorded automatically from your store's functions, including `set` calls after an `await`. Each change has a diff and a call site symbolicated through Metro. You can jump back to any state the app still holds, export history, edit state live, and call actions from the panel. `persist` stores show their storage key, version and hydration status. Agent tools are included. Works with Zustand 4.4 and newer.
