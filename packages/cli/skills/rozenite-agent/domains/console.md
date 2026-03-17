# Console Domain

Read, filter, and paginate React Native console messages captured from the app, and clear the log buffer when needed.

## Tools
- `clearMessages` -> `{}`
- `getMessages` -> `{}` | `{"cursor":"<cursor>"}` | `{"limit":50}` | `{"levels":["error"]}` | `{"text":"warning"}`

## Minimal Flow
Logs are captured automatically. Use `getMessages` -> optional filtered/paginated reads -> `clearMessages`.
