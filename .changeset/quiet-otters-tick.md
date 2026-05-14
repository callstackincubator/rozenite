---
'@rozenite/performance-monitor-plugin': patch
---

Fix time display precision in the Performance Monitor panel. Durations under 1s now show as integer milliseconds (clock accuracy is 1ms, so `.toFixed(2)` was always faking precision). Durations ≥ 1s show 3 decimals (`1.234s`) for the same 1ms-precision invariant. Wall-clock timestamps (mark `Recorded at`, measure `Start Time` / `End Time`, session `Started`) include their millisecond component in a stable 24h `HH:MM:SS.mmm` format. Non-zero sub-millisecond durations display as `<1ms` instead of `0ms`, so a marker that fired isn't mistaken for "not measured."