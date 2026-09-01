---
'@rozenite/middleware': patch
---

Expose commit cost beyond render time in the React agent `getProfileTimeline` tool. Each commit can now report `effectDurationMs`, `passiveEffectDurationMs`, `priorityLevel`, `updaterCount` and `hasChangeDescriptions`, so a commit that renders quickly but commits slowly is visible without a separate call.
