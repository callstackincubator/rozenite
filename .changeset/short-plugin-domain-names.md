---
"@rozenite/agent-sdk": minor
"rozenite": minor
---

Derive short, stable agent domain names from npm package names instead of mangled, hash-suffixed slugs. `@rozenite/mmkv-plugin` now resolves to the domain `mmkv` instead of `at-rozenite__mmkv-plugin`, and `@avasapp/rozenite-plugin-ably` resolves to `avasapp/ably`. The domain name is a pure function of the plugin's package name alone — installing, removing, or updating other plugins never changes it, and two packages that would derive the same domain name now fail loudly instead of one silently shadowing the other.

The previous mangled slug form (e.g. `at-rozenite__mmkv-plugin`) is still accepted by `resolveDomainToken` as an undocumented compatibility alias for one release cycle.
