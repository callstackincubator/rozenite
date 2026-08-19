---
'@rozenite/feature-flags-plugin': minor
'@rozenite/storage-plugin': minor
'@rozenite/rhf-plugin': minor
'@rozenite/ui': minor
---

Add `useConfirmDialog()` to `@rozenite/ui`: an imperative alternative to `ConfirmDialog` that resolves a promise with the user's choice instead of driving `open` from local state. `PluginShell` now mounts `Toast` and `ConfirmDialog.Provider` automatically, so plugin panels no longer need to wrap themselves in `<Toast.Provider>` to use `useToast()`.

Migrate the feature-flags, storage, and React Hook Form DevTools panels to `useConfirmDialog()`, replacing their declarative confirm/alert dialogs.
