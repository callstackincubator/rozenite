---
"@rozenite/network-activity-plugin": patch
---

Filter Hermes internal bytecode frames out of Network Activity initiator symbolication requests so Metro no longer tries to read pseudo-files like `address at InternalBytecode.js`.
