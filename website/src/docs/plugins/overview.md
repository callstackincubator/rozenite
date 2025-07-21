# Plugins

Plugins are the way to add new panels and functionalities to React Native DevTools through Rozenite. They allow you to extend the DevTools with custom debugging tools, performance monitors, and development utilities.

## What are Plugins?

Plugins are packages that integrate seamlessly with Rozenite to add custom panels and functionality to React Native DevTools. As the creators of Rozenite, we maintain a couple of plugins that demonstrate the framework's capabilities:

- **Production Ready**: Tested and optimized for real-world use
- **Type Safe**: Built with full TypeScript support
- **Well Documented**: Comprehensive guides and examples
- **Actively Maintained**: Regular updates and bug fixes

## Available Plugins

As the creators of Rozenite, we maintain a couple of plugins to demonstrate the framework's capabilities:

### [Expo Atlas](./expo-atlas.md)

Integrate Expo Atlas directly into your React Native DevTools for bundle analysis and optimization. This plugin provides:

- **Bundle Visualization**: Interactive Metro bundle structure analysis
- **Module Analysis**: Detailed information about each module in your bundle
- **Size Optimization**: Identify large dependencies and optimize bundle size
- **Dependency Mapping**: Visualize module relationships and dependencies

## Installing Plugins

Plugins should be installed as development dependencies since they are only needed during development:

```bash
# Using npm
npm install --save-dev @rozenite/expo-atlas-plugin

# Using yarn
yarn add --dev @rozenite/expo-atlas-plugin

# Using pnpm
pnpm add --save-dev @rozenite/expo-atlas-plugin
```

## Configuration

Each plugin has its own configuration requirements. See the individual plugin documentation for setup instructions.

## Contributing

Want to contribute to plugins or suggest new ones? Check out our [Plugin Development Guide](./plugin-development.md) to learn how to create plugins, or reach out to the community to discuss your ideas. We welcome contributions to both our maintained plugins and community plugins.

## Community Plugins

In addition to the plugins we maintain, the Rozenite community creates and maintains many useful plugins. While these aren't officially supported, they can provide valuable functionality for specific use cases.

---

**Next**: Learn about the [Expo Atlas plugin](./expo-atlas.md) or explore [Plugin Development](./plugin-development.md) to create your own plugins. 