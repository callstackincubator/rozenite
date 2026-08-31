---
'@rozenite/middleware': patch
---

Fix Rozenite for Agents failing to connect with `CDP connection closed before
bootstrap completed` on Expo dev servers whose configured host differs from the
address the agent reached them through, such as when
`REACT_NATIVE_PACKAGER_HOSTNAME` is set.
