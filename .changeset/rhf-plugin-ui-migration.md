---
'@rozenite/rhf-plugin': minor
---

Rebuild the React Hook Form DevTools panel on `@rozenite/ui`: a sidebar lists connected forms, fields render as a flat, indented table (Field/Type/Value/State/Error) with a fixed toolbar and footer summarizing form state, and clicking a field opens a detail dialog with its value, dirty/touched state, and error.

Add remote form reset: pass `reset` from `useForm()` to `useRozeniteRHFPlugin({ control, reset })` to let the DevTools panel revert the form to its default values via a "Reset form" toolbar button.
