---
'@rozenite/agent-sdk': minor
---

Tool names now resolve forgivingly. After an exact match on the qualified or
short name, case, `-` and `_` are ignored, so `getmessages`, `get-messages`
and `listEntries` find `getMessages` and `list-entries`. A name that matches
several tools is an error that lists them. No tool is renamed.

`session`, `targets`, `domains` and `tap` join
`RESERVED_DOMAIN_NAMES`, so no plugin can derive a domain name that shadows
a `rozenite agent` command; a scoped plugin falls back to its package name,
as it already does for a built-in domain name.
