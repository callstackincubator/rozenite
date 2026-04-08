Read, filter, and paginate React Native console messages from the app, and clear the log buffer when needed.

## Tools

- `clearMessages` -> `{}`
- `getMessages` -> `{}` | `{"cursor":"<cursor>"}` | `{"limit":50}` | `{"levels":["error"]}` | `{"text":"warning"}`

## Flow

Logs are captured automatically. Use `getMessages` -> optional filtered and paginated reads -> `clearMessages`.
