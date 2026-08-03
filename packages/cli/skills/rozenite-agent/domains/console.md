Read, filter, and paginate React Native console messages from the app, and clear the log buffer when needed.

## Tools

- `clearMessages` -> `{}`
- `getMessages` -> `{}` | `{"cursor":"<cursor>"}` | `{"limit":50}` | `{"levels":["error"]}` | `{"text":"warning"}`

## Flow

Logs are captured automatically. Use `getMessages` -> optional filtered and paginated reads -> `clearMessages`.

CLI discovery listings and paginated `getMessages` calls use columnar `cols`
and `rows` output when two or more rows are returned. Tool metadata remains
present, and `next` replaces the page envelope when another page is available.

By default `getMessages` omits the bulky `argsPreview` and `context` columns.
Pass `--fields argsPreview,context` (or any subset) or `--verbose` to include
them.
