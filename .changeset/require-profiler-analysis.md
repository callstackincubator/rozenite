---
'@rozenite/require-profiler-plugin': minor
---

Add four ways to act on require timings rather than just read them.

Modules can now be rolled up by npm package, since that is the granularity decisions are made at — one row reading `lodash, 340ms across 87 modules` is actionable where 87 four-millisecond rows are not. Each package reports its own evaluation time and, separately, its cost including everything it pulled in, so a package nested inside itself is never counted twice.

Selecting a module shows the require chain that pulled it in, from the chain root down, with each ancestor clickable — the question every profiling session ends on, previously answerable only by reading ancestors off the flame graph by eye.

Packages evaluated from more than one install location are flagged, since a duplicated dependency costs evaluation time and bundle bytes twice and can break a stateful library outright.

A new Coverage tab reads Metro's module registry on demand and reports how much of the bundle was evaluated, ranking packages by how many of their modules have not run yet — the code-splitting candidates. It reports "not yet evaluated" rather than "unused" and shows the capture time, because the registry reflects the moment it was read rather than profiling time.
