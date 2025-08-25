# Introduction

Rozenite adds plug-and-play debugging panels to React Native DevTools. Install official plugins, open DevTools, and start debugging in minutes — no extra windows or servers.

![](/rozenite-loaded.png)

It also gives teams a safe, scalable way to standardize debugging across projects. Plugins auto‑discover and load during development, are easy to configure, and are automatically disabled in production builds so no plugin code ships to your users.

:::info Try it now
Skip ahead to the [Getting Started guide](/docs/getting-started) or browse the [Plugin Directory](/plugin-directory).
:::

## Why we built this

At [Callstack](https://callstack.com/), we work with teams building React Native apps that drive business value. But as these apps grow, debugging becomes a bottleneck that slows down development and hurts user experience. Teams spend more time fighting fires than building features. One of the biggest problems we see is the lack of good tools for monitoring and debugging React Native apps.

Teams constantly ask us for ways to gain insights into their apps—to track performance, monitor network requests, debug state management, or connect to their internal monitoring systems. But here's the problem: React Native DevTools doesn't support plugins. It's a great tool, but it's closed and can't be extended.

This forces teams to build their own debugging solutions from scratch. They waste weeks or months creating custom tools, setting up communication layers, and building UIs just to get the insights they need. This is expensive, time-consuming, and diverts resources from building actual features.

**We built Rozenite to solve this problem by giving you a complete toolkit for extending React Native DevTools.**

Instead of building everything from scratch, you can now create plugins that integrate seamlessly with React Native DevTools. You get a proven communication layer, a solid build system, and all the infrastructure you need. This means you can focus on building the insights that matter to your team, not reinventing the wheel.

:::note Fun fact
Rozenite is a rare mineral first described in 1960 on Ornak Mountain in the Western Tatras. Named after Polish mineralogist Zygmunt Rozen, it symbolizes exploration and discovery — the same spirit behind extending DevTools with new capabilities.
:::

## Who it’s for

- **Developers who want built‑in tooling**: add network, performance, storage and state panels without building anything.
- **Teams that need custom insights**: create tailored panels for your product, internal observability, or business logic.

## Build your own

Rozenite includes a type‑safe, batteries‑included development experience for creating custom plugins when you need to go beyond the official ones. Start with the [Plugin Development overview](/docs/plugin-development/overview) when you're ready.

## Next steps

Ready to try it? Start with the [Getting Started guide](/docs/getting-started) or explore the [Plugin Directory](/plugin-directory). When you need something custom, see the [Plugin Development overview](/docs/plugin-development/overview).
