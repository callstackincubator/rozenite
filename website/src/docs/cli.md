# `rozenite` CLI

The Rozenite CLI is a command-line tool that helps you create and build React Native DevTools plugins.

Basic usage:

```shell title="Terminal"
npx rozenite [command] [options]
```

![](/cli.png)

## Global Options

The following options are available for all commands:

| Options             | Description                     |
| ------------------- | ------------------------------- |
| `-h` or `--help`    | Shows all available options     |
| `-V` or `--version` | Outputs the Rozenite version number |

## Available Commands

Rozenite CLI provides commands for creating and building React Native DevTools plugins:

| Command       | Description                                     | Alias |
| :------------ | :---------------------------------------------- | :---- |
| `generate`    | Generate a new React Native DevTools plugin     | `g`   |
| `build`       | Build a React Native DevTools plugin            | `b`   |

## Command Details

### `rozenite generate [path]`

The `generate` command creates a new React Native DevTools plugin project. It will prompt you for plugin information and set up a complete development environment.

**Arguments:**
- `[path]` - Optional path where to create the plugin. If not provided, creates the plugin in the current directory.

**What it creates:**
- A new directory with your plugin name
- Complete project structure with TypeScript configuration
- Vite build configuration with Rozenite plugin
- Sample React Native DevTools panel
- Git repository with initial commit
- All necessary dependencies installed

**Example:**
```shell
# Create plugin in current directory
rozenite generate

# Create plugin in specific directory
rozenite generate my-awesome-plugin
```

### `rozenite build [path]`

The `build` command builds your React Native DevTools plugin for distribution. It creates optimized bundles for both the DevTools panel and React Native entry points.

**Arguments:**
- `[path]` - Optional path to the plugin directory. If not provided, builds the plugin in the current directory.

**What it builds:**
- DevTools panels (React components)
- React Native entry point (if `react-native.ts` exists)
- All builds are optimized and minified for production

**Example:**
```shell
# Build plugin in current directory
rozenite build

# Build plugin in specific directory
rozenite build my-awesome-plugin
```

## Plugin Structure

When you generate a new plugin, Rozenite creates the following structure:

```
my-plugin/
├── src/
│   └── hello-world.tsx      # Sample DevTools panel
├── react-native.ts          # React Native entry point
├── rozenite.config.ts       # Plugin configuration
├── vite.config.ts          # Build configuration
├── package.json            # Dependencies and scripts
└── tsconfig.json          # TypeScript configuration
```

### Configuration

The `rozenite.config.ts` file defines your plugin's panels:

```typescript
export default {
  panels: [
    {
      name: 'Hello world!',
      source: './src/hello-world.tsx',
    },
  ],
};
```

### Development

After generating a plugin, you can:

1. **Start development server:**
   ```shell
   npm run dev
   ```

2. **Build for production:**
   ```shell
   rozenite build
   ```

3. **Customize panels:** Edit the React components in the `src/` directory

4. **Add React Native integration:** Use the `@rozenite/plugin-bridge` package to communicate between your plugin and React Native app

## Requirements

- Node.js >= 22
- npm, yarn, pnpm, or bun package manager

## Getting Started

1. **Generate a new plugin:**
   ```shell
   npx rozenite generate my-first-plugin
   ```

2. **Navigate to the plugin directory:**
   ```shell
   cd my-first-plugin
   ```

3. **Start development:**
   ```shell
   npm run dev
   ```

4. **Build for production:**
   ```shell
   rozenite build
   ```

## Troubleshooting

If you encounter issues:

1. **Check Node.js version:** Ensure you're using Node.js 22 or higher
2. **Clear caches:** Remove `node_modules` and reinstall dependencies
3. **Check permissions:** Ensure you have write permissions in the target directory
4. **Report bugs:** Visit the [GitHub issues page](https://github.com/callstackincubator/rozenite/issues) to report problems
