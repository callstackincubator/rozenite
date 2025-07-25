# Introduction

Rozenite helps you build custom tools for React Native DevTools. It gives you everything you need to create plugins that make debugging your React Native apps easier and more powerful.

Think of it as a complete toolkit that turns React Native DevTools into a platform you can extend with your own debugging tools. Whether you need to track network requests, monitor app performance, or debug specific business logic, Rozenite makes it simple to build and integrate custom plugins.

:::info Want to try it now?
If you'd like to skip this intro and jump right in, head over to our [Quick start](/docs/getting-started/index) page to create your first plugin.
:::

## The Name

Rozenite is named after a rare mineral discovered in 1960 on Ornak Mountain in the Western Tatra Mountains. The mineral was named after Polish mineralogist Zygmunt Rozen (1874–1936). We chose this name because it represents exploration and discovery—just like scientists exploring mountains to find new minerals, we're exploring new ways to extend React Native DevTools with custom debugging tools.

## Why We Built This

At [Callstack](https://callstack.com/), we work with teams building React Native apps that drive business value. But as these apps grow, debugging becomes a bottleneck that slows down development and hurts user experience. Teams spend more time fighting fires than building features. One of the biggest problems we see is the lack of good tools for monitoring and debugging React Native apps.

Teams constantly ask us for ways to gain insights into their apps—to track performance, monitor network requests, debug state management, or connect to their internal monitoring systems. But here's the problem: React Native DevTools doesn't support plugins. It's a great tool, but it's closed and can't be extended.

This forces teams to build their own debugging solutions from scratch. They waste weeks or months creating custom tools, setting up communication layers, and building UIs just to get the insights they need. This is expensive, time-consuming, and diverts resources from building actual features.

**We built Rozenite to solve this problem by giving you a complete toolkit for extending React Native DevTools.**

Instead of building everything from scratch, you can now create plugins that integrate seamlessly with React Native DevTools. You get a proven communication layer, a solid build system, and all the infrastructure you need. This means you can focus on building the insights that matter to your team, not reinventing the wheel.

## What Makes Rozenite Special

Rozenite isn't just another development tool—it's a complete ecosystem designed specifically for React Native DevTools plugins. Here's what sets it apart:

### Built for React Native

Unlike generic plugin systems, Rozenite is built from the ground up for React Native. It understands how React Native apps work, how Metro bundler operates, and how DevTools communicates with your app.

### Developer-First Design

We've focused on making plugin development as smooth as possible. The CLI guides you through every step, the build system handles the complex parts, and the communication layer just works.

## What We Believe

We built Rozenite with one goal: to help developers who need custom DevTools features. These projects need to be flexible, easy to build, and work smoothly with existing workflows. That's why we focus on:

- **Modular design**—build plugins you can easily share and use in any React Native project
- **Great developer experience**—excellent tools for building, testing, and debugging your plugins
- **Easy communication**—seamless connection between DevTools and your React Native app
- **Metro integration**—works perfectly with Metro bundler, React Native's build system

## The CLI

We built a CLI from the ground up to make plugin development smooth and fast. Most developers can create their first plugin in under 10 minutes.

The CLI uses a flexible configuration system that lets you customize your plugin's capabilities through templates, build settings, and development tools. It handles all the boilerplate code so you can focus on building your plugin's core functionality.

:::info Developer Experience
We focus on making our CLI the main way to interact with Rozenite. In the future, you'll be able to use it through VS Code extensions, AI assistants, or custom development environments.
:::

### What It Does

The CLI handles all the common plugin development tasks:

- **Project Generation** - Creating new plugins from customizable templates
- **Hot Reloading** - Providing fast development feedback with live reloading features
- **Production Builds** - Building and bundling plugins optimized for production use

### Main Commands

- `rozenite generate` - Create a new plugin project
- `rozenite dev` - Start development server with hot reloading
- `rozenite build` - Build your plugin for production

For a complete list of commands, visit the [CLI page](/docs/cli/index).

## What You Can Build

With Rozenite, you can create plugins for:

- **Performance monitoring** - Track app performance, memory usage, and render times
- **Network debugging** - Monitor API calls, request/response data, and network errors
- **State management** - Inspect Redux, Zustand, or custom state stores
- **Custom debugging** - Build tools specific to your app's business logic
- **Integration tools** - Connect DevTools to your existing monitoring systems

## Getting Started

Ready to build your first plugin? Check out our [Quick Start guide](/docs/getting-started/index) to get up and running in minutes.

For more advanced usage, explore our [Plugin Development guide](/docs/guides/plugin-development) and [API documentation](/docs/api).
