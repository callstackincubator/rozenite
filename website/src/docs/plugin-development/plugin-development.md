# Plugin Development

This guide will walk you through the complete process of creating a React Native DevTools plugin, from initial generation to building for production.

> **Tip**: Before creating your own plugin, check out the [Official Plugins](../official-plugins/overview.md) to see if there's already a plugin that meets your needs!

## Quick Start

Generate a new plugin in seconds:

```shell title="Terminal"
npx rozenite generate
cd my-awesome-plugin
rozenite dev
```

## Step 1: Generate Your Plugin

The `rozenite generate` command creates a complete plugin project structure:

```shell title="Terminal"
# Generate in current directory
rozenite generate

# Generate in specific directory
rozenite generate my-plugin-name
```

This creates:

- Complete TypeScript project setup
- Vite build configuration with Rozenite plugin
- Sample DevTools panel
- Git repository with initial commit
- All dependencies installed

## Step 2: Understanding Plugin Structure

Your generated plugin has this structure:

```
my-plugin/
├── src/
│   └── hello-world.tsx      # Your DevTools panels
├── react-native.ts          # React Native entry point
├── rozenite.config.ts       # Plugin configuration
├── vite.config.ts          # Build configuration
├── package.json            # Dependencies and scripts
└── tsconfig.json          # TypeScript configuration
```

## Step 3: Creating Panels

Panels are React components that appear in the DevTools interface. They're defined in your `rozenite.config.ts` file. **Plugin developers can leverage React Native APIs and libraries** to create powerful debugging tools that integrate deeply with the React Native runtime.

### Type-Safe Plugin Development

Rozenite provides full TypeScript support for plugin development. The `DevToolsPluginClient` uses an event-based API with full type safety:

#### Client API

```typescript
// Hook usage
const client = useDevToolsPluginClient<EventMap>({
  pluginId: 'your-plugin-id',
});

// Client methods
client.send('event-name', payload); // Send typed event
client.onMessage('event-name', callback); // Listen for typed event
client.close(); // Clean up connection
```

#### Type Safety Benefits

- **Compile-time error checking** for event names and payloads
- **IntelliSense support** for all event types and methods
- **Type-safe event handling** between DevTools and React Native
- **Automatic refactoring** when event interfaces change
- **Plugin ID isolation** ensures events don't conflict between plugins

```typescript title="rozenite.config.ts"
export default {
  panels: [
    {
      name: 'My Custom Panel',
      source: './src/my-panel.tsx',
    },
    {
      name: 'Another Panel',
      source: './src/another-panel.tsx',
    },
  ],
};
```

### Panel Configuration Options

| Property | Type     | Description                      |
| -------- | -------- | -------------------------------- |
| `name`   | `string` | Display name in DevTools sidebar |
| `source` | `string` | Path to your React component     |

### Creating a Panel Component

Create a new panel by adding a React component:

```typescript title="src/my-panel.tsx"
import React from 'react';

export default function MyPanel() {
  return (
    <div style={{ padding: '16px' }}>
      <h2>My Custom Panel</h2>
      <p>This is my custom DevTools panel!</p>
    </div>
  );
}
```

### Using the Plugin Bridge

Connect your panel to React Native using the plugin bridge. The `DevToolsPluginClient` provides full TypeScript support for type-safe communication:

```typescript title="src/my-panel.tsx"
import React, { useEffect, useState } from 'react';
import { useDevToolsPluginClient } from '@rozenite/plugin-bridge';

// Define type-safe event map
interface PluginEvents {
  'user-data': {
    id: string;
    name: string;
    email: string;
  };
  'request-user-data': {
    type: 'userInfo';
  };
}

export default function MyPanel() {
  const client = useDevToolsPluginClient<PluginEvents>({
    pluginId: 'my-user-panel',
  });
  const [userData, setUserData] = useState<PluginEvents['user-data'] | null>(
    null
  );

  useEffect(() => {
    if (!client) return;

    // Type-safe message listener
    const subscription = client.onMessage('user-data', (data) => {
      // TypeScript knows data is PluginEvents['user-data']
      setUserData(data);
    });

    // Type-safe message sending
    client.send('request-user-data', { type: 'userInfo' });

    return () => subscription.remove();
  }, [client]);

  if (!client) {
    return <div>Connecting to React Native...</div>;
  }

  return (
    <div style={{ padding: '16px' }}>
      <h2>User Data Panel</h2>
      {userData ? (
        <div>
          <p>
            <strong>Name:</strong> {userData.name}
          </p>
          <p>
            <strong>Email:</strong> {userData.email}
          </p>
        </div>
      ) : (
        <p>Loading user data...</p>
      )}
    </div>
  );
}
```

## Step 4: React Native Integration

Add React Native functionality by creating a `react-native.ts` file. You can use React Native APIs and libraries to enhance your plugin:

```typescript title="react-native.ts"
import { DevToolsPluginClient } from '@rozenite/plugin-bridge';
import { Platform, Dimensions } from 'react-native';

// Use the same type-safe event map
interface PluginEvents {
  'user-data': {
    id: string;
    name: string;
    email: string;
  };
  'request-user-data': {
    type: 'userInfo';
  };
}

export default function setupPlugin(
  client: DevToolsPluginClient<PluginEvents>
) {
  // Handle messages from DevTools panels with full type safety
  client.onMessage('request-user-data', (data) => {
    // Access React Native APIs
    const deviceInfo = {
      platform: Platform.OS,
      version: Platform.Version,
      dimensions: Dimensions.get('window'),
    };

    // Send type-safe response
    client.send('user-data', {
      id: 'user-123',
      name: 'John Doe',
      email: 'john@example.com',
    });
  });
}
```

## Step 5: Local Development Workflow

### Complete Development Setup

For local plugin development, follow these steps:

#### Step 1: Create and Start Your Plugin

```shell title="Terminal"
# Create a new plugin
rozenite generate
cd my-awesome-plugin

# Start the development server
rozenite dev
```

This starts a development server that:

- Watches for file changes
- Hot reloads your panels automatically
- Provides real-time feedback during development

#### Step 2: Link to React Native Playground

1. **Create or use a React Native playground project** that has Rozenite configured
2. **Add your plugin to the playground's dependencies** (you can use `npm link`, `yarn link` or `pnpm link` for local development)

#### Step 3: Run Your React Native App

```shell title="Terminal"
# In your playground project directory
# Set ROZENITE_DEV_MODE to your plugin name to force load it in dev mode
ROZENITE_DEV_MODE=my-awesome-plugin npx react-native start
# Or if using Expo
ROZENITE_DEV_MODE=my-awesome-plugin npx expo start
```

Then run the app on your device or simulator.

#### Step 4: Open DevTools

1. Open React Native DevTools in your browser
2. Your plugin panels should appear in the sidebar automatically

### Hot Reloading

Your development workflow supports automatic hot reloading:

- **Panel changes**: Your DevTools panels will automatically update when you make changes to your plugin code
- **React Native integration changes**: Changes to your `react-native.ts` file will also hot reload
- **New panels**: If you add a new panel to your `rozenite.config.ts`, restart React Native DevTools by pressing `Ctrl+R` (or `Cmd+R` on Mac)
- **Configuration changes**: Most changes to `rozenite.config.ts` require a DevTools restart

### Testing Your Plugin

1. Make changes to your panel components - they should update instantly
2. Modify your React Native integration code - changes should be reflected immediately
3. Add new panels - remember to restart DevTools with `Ctrl+R`
4. Test communication between your panels and React Native code

## Step 6: Building for Production

Build your plugin for distribution:

```shell title="Terminal"
rozenite build
```

This creates optimized bundles:

- DevTools panels (minified and optimized)
- React Native entry point (if `react-native.ts` exists)
- Ready for distribution

### Build Output

The build creates a `dist/` directory with:

- `*.js` - Individual DevTools panel files (one file per panel, names reflect your config)
- `react-native.js` - React Native integration (if applicable)
- `rozenite.json` - Plugin manifest with metadata and configuration
- Source maps for debugging

## Next Steps

- Explore the [CLI documentation](../cli.md) for more command options
- Check out [Official Plugins](../official-plugins/overview.md) to see available plugins
- Join the community to share your plugins and get help
