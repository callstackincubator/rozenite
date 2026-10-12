---
'@rozenite/repack': patch
---

Fix `withRozenite` for Re.Pack replacing a `devServer.setupMiddlewares` function
defined in your config, so your own dev server middlewares are kept. Rozenite
also now reports its runtime version to the middleware, as it does for Metro.
