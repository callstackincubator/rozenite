---
'@rozenite/agent-bridge': minor
'@rozenite/agent-shared': minor
---

Add typed agent tool contracts and descriptors that can be shared across runtime
tool registration and SDK-facing plugin exports.

`@rozenite/agent-shared` now exposes `defineAgentToolContract(...)`,
`defineAgentToolDescriptor(...)`, and `defineAgentToolDescriptors(...)`, while
`@rozenite/agent-bridge` can infer handler input and result types from typed
tool contracts passed to `useRozeniteInAppAgentTool(...)` and
`useRozenitePluginAgentTool(...)`.
