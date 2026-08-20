---
'@rozenite/middleware': minor
---

Make the agent `console` domain usable on long sessions and readable for the
logs that matter. Object arguments now render their contents — `console.log({
userId: 42 })` reports `{userId: 42}` instead of `Object`, and arrays render
their elements with an explicit overflow marker — while every rendered value is
length-capped, so a single multi-megabyte string can no longer sit in the buffer
(and each entry is stored once rather than twice). The per-device buffer is a
true ring buffer, so appending costs the same whether it is empty or full, and a
read seeks straight to its starting position and stops once the page is filled
instead of filtering, sorting, copying, and reversing the whole buffer.

`getMessages` items now carry a `cursor`, and the tool accepts `before` and
`after` bounds, so an agent can find an error under a level filter and then read
the entries surrounding it — including under different filters — in one
follow-up call. Cursors are now plain opaque positions: they are no longer bound
to the filters or sort order of the request that produced them, which is what
makes reading around an entry possible and shrinks each cursor by ~96%.

Breaking: the `argsPreview` field is gone from `getMessages` (it only ever
repeated `text`, and was never part of the default projection), and cursors from
an older session are not accepted by this version.
