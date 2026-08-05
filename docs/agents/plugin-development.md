# Plugin development

- For new request-response features, prefer the RPC-style protocol over the legacy message-based API.
- See the [RPC documentation](../../website/src/docs/plugin-development/rpc.md).
- Prefer reusable UI elements from `@rozenite/ui`.
- Put reusable new components in the `ui` package.
- Put one-off new components directly in the plugin.
- Use the compound components pattern for cooperating component sets.
