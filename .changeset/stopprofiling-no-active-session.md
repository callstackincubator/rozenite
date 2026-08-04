---
"@rozenite/middleware": patch
"rozenite": patch
---

Fix `react.stopProfiling` agent tool returning an empty success result instead of erroring when called with no active profiling session. It now throws `No active profiling session for this session`, matching the guard used by the other stop-style agent tools (`network.stopRecording`, `performance.stopTrace`, `memory.stopSampling`).
