---
'@rozenite/performance-monitor-plugin': minor
---

Rebuild the Performance Monitor DevTools panel on `@rozenite/ui` and consolidate its information architecture into a single screen: a full-height waterfall (Measures/Metrics/Marks/RN Marks/Resources, filterable by entryType and name) is the sole timeline view, with startup timing folded into it as derived measures instead of a separate summary. Selecting an entry opens a detail panel docked to the right of the waterfall instead of a separate table row. The toolbar now leads with a single start/stop toggle next to Clear, and export is rebuilt as a dialog with per-type include toggles and live counts.
