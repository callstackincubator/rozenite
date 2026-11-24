---
'@rozenite/redux-devtools-plugin': minor
---

Add an `actionCreators` option to the Redux DevTools enhancer. The creators you pass appear in the panel's Dispatcher, where you can fill in their arguments and dispatch them. Pass an object of creators, or an array of `{ name, func, args }` to name the arguments yourself, which is the reliable choice on Hermes.
