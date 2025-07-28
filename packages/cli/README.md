![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A command-line interface for creating and managing React Native DevTools plugins.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite CLI is the primary tool for scaffolding, building, and developing React Native DevTools plugins. It provides an intuitive command-line experience with interactive prompts, automated project setup, and development workflows.

## Features

- **Plugin Generation**: Create new React Native DevTools plugins with a complete project structure
- **Interactive Setup**: Guided prompts for plugin configuration and metadata
- **Build System**: Compile plugins for different targets
- **Development Server**: Hot-reload development environment with file watchers
- **Template System**: Pre-configured templates with TypeScript, Vite, and Rozenite integration

## Installation

The CLI is included with the main Rozenite package:

```bash
npm install rozenite
```

## Quick Start

### Generate a New Plugin

Create a new React Native DevTools plugin:

```bash
npx rozenite generate
```

This will:

- Create a new directory with the plugin name
- Set up TypeScript configuration
- Configure Vite build system
- Install necessary dependencies
- Initialize a Git repository
- Create a basic plugin structure

### Build a Plugin

Compile your plugin for production:

```bash
npx rozenite build
```

This builds the plugin for all configured targets.

### Development Mode

Start the development server with hot reload:

```bash
npx rozenite dev
```

This starts:

- Vite dev server for client panels
- File watchers for React Native entry points
- Hot reload for development

## Commands

### `rozenite generate [path]`

Generate a new React Native DevTools plugin.

**Options:**

- `[path]` - Target directory (defaults to current directory)

**Examples:**

```bash
# Generate in current directory
rozenite generate

# Generate in specific directory
rozenite generate ./my-plugins/awesome-plugin
```

### `rozenite build [path]`

Build a React Native DevTools plugin for production.

**Options:**

- `[path]` - Plugin directory (defaults to current directory)

**Examples:**

```bash
# Build current plugin
rozenite build

# Build specific plugin
rozenite build ./my-plugin
```

### `rozenite dev [path]`

Start development server with file watchers.

**Options:**

- `[path]` - Plugin directory (defaults to current directory)

**Examples:**

```bash
# Start dev server for current plugin
rozenite dev

# Start dev server for specific plugin
rozenite dev ./my-plugin
```

## Plugin Structure

When you generate a new plugin, the CLI creates the following structure:

```
my-plugin/
├── src/
│   └── hello-world.tsx          # Example plugin component
├── package.json                 # Plugin dependencies and metadata
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite build configuration
├── rozenite.config.ts          # Rozenite plugin configuration
└── react-native.ts             # React Native entry point
```

## Configuration

### `rozenite.config.ts`

The main configuration file for your plugin:

```typescript
export default {
  panels: [
    {
      name: 'Hello World!',
      source: './src/hello-world.tsx',
    },
  ],
};
```

## Development Workflow

1. **Generate** a new plugin using `rozenite generate`
2. **Develop** your plugin using `rozenite dev`
3. **Build** for production using `rozenite build`
4. **Test** your plugin in React Native DevTools
5. **Publish** your plugin to npm

## Requirements

- Node.js >= 22
- pnpm, npm, or yarn package manager

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/rozenite?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/rozenite
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
