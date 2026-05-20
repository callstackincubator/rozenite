---
'@rozenite/performance-monitor-plugin': minor
---

Add first-class startup insights to the Performance Monitor plugin.

A new Startup tab (first in the tab order) shows Total startup time and the three key launch phases — Native Launch, JS Bundle, and Initial Mount — with proportional bars so you can see at a glance where startup time is spent. Phases that have not yet completed show as "In progress…"; phases absent from the event stream show as "—". The startup data is derived automatically from React Native's buffered native marks, so no extra instrumentation is required.