---
"rozenite": major
"@rozenite/agent-bridge": minor
"@rozenite/agent-shared": minor
---

Change agent CLI row-shaped output to the stable columnar `cols` / `rows`
contract for two or more rows. Terminal pagination envelopes are removed, and
additional pages now provide a runnable `next` command instead of a bare
cursor. Paginated tools now declare their stable row fields through a reusable
shared contract, re-exported from `@rozenite/agent-bridge`, so built-in and
third-party plugins receive the same output behavior without CLI allowlists.
