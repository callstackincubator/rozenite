# Introduction

Rozenite is a comprehensive toolkit designed to accelerate React Native DevTools plugin development. It provides a CLI, Metro bundler integration, isomorphic communication layer, and a robust framework for creating, developing, and integrating custom plugins into React Native DevTools.

:::info OK I want to try it!
If you feel like skipping this intro section and try it out, feel free to head over to [Quick start](/docs/getting-started/index) page to run your first plugin.
:::

## Why We Exist

On a daily basis at [Callstack](https://callstack.com/), we're serving clients that usually have large teams, building complex React Native apps for years, accumulating tech debt, and becoming slower and slower to iterate. One of the biggest pain points we've observed is the lack of proper tooling for debugging and monitoring React Native applications in production and development environments.

React Native DevTools provides a solid foundation for debugging React Native apps, but teams often need custom functionality that isn't available out of the box. Whether it's custom performance monitoring, business-specific debugging tools, or integration with internal systems, developers frequently find themselves building their own solutions from scratch.

**We exist to solve this problem by providing a complete ecosystem for extending React Native DevTools.**

## Our Principles

We build Rozenite with a clear focus: to serve developers who need to extend React Native DevTools with custom functionality. These projects require flexibility, ease of development, and seamless integration with existing workflows. That's why our engineering design choices focus on:

- **Modular design**—build plugins that can be easily shared, distributed, and integrated into any React Native project
- **Developer experience**—provide excellent tooling for plugin development, testing, and debugging
- **Isomorphic communication**—seamless communication between the DevTools frontend and your React Native app
- **Metro integration**—native support for Metro bundler to ensure your plugins work seamlessly with React Native's build system

## The CLI

We've created a CLI from scratch with a focus on making plugin development as smooth as possible. Most developers can create their first plugin in under 10 minutes.

Its core part is a modular configuration mechanism allowing for customizing the plugin capabilities to your needs through a system of templates, build configurations, and development tools.

:::info Developer Experience
For the best DX we focus on our CLI to be the entrypoint to the Rozenite ecosystem. In the future we imagine you can interact with it through other tools, like VS Code extensions, AI agents, or custom development environments.
:::

### Key Features

The CLI handles the following plugin development tasks:

- Scaffolding new plugins with customizable templates
- Building and bundling plugins for development and production

### Available Commands

- `rozenite generate` - Create a new plugin project
- `rozenite build` - Build your plugin for production

For a complete list of commands, visit the [CLI page](/docs/cli/index).

## Getting Started

Ready to use your first plugin? Check out our [Quick Start guide](/docs/getting-started/index) to get up and running in minutes.

For more advanced usage, explore our [Plugin Development guide](/docs/guides/plugin-development) and [API documentation](/docs/api).
