# Plugin Development

This guide will walk you through the complete process of creating a React Native DevTools plugin, from initial generation to building for production.

## Quick Start

Generate a new plugin in seconds:

```shell title="Terminal"
npx rozenite generate my-awesome-plugin
cd my-awesome-plugin
npm run dev
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
client.send('event-name', payload);           // Send typed event
client.onMessage('event-name', callback);     // Listen for typed event
client.close();                               // Clean up connection
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

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Display name in DevTools sidebar |
| `source` | `string` | Path to your React component |

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
  const [userData, setUserData] = useState<PluginEvents['user-data'] | null>(null);

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
          <p><strong>Name:</strong> {userData.name}</p>
          <p><strong>Email:</strong> {userData.email}</p>
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

export default function setupPlugin(client: DevToolsPluginClient<PluginEvents>) {
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

## Step 5: Development Workflow

### Start Development Server

```shell title="Terminal"
npm run dev
```

This starts a development server that:
- Watches for file changes
- Hot reloads your panels
- Provides debugging information

### Testing Your Plugin

1. Start your React Native app with DevTools enabled
2. Open DevTools in your browser
3. Your plugin panels will appear in the sidebar
4. Make changes to your code and see them update instantly

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
- `panel.js` - Your DevTools panels
- `react-native.js` - React Native integration (if applicable)
- Source maps for debugging

## Advanced Configuration

### Custom Vite Configuration

Extend the default Vite config in `vite.config.ts`:

```typescript title="vite.config.ts"
import { defineConfig } from 'vite';
import rozenite from '@rozenite/vite-plugin';

export default defineConfig({
  plugins: [rozenite()],
  build: {
    rollupOptions: {
      external: ['react', 'react-dom'],
    },
  },
});
```

### Multiple Entry Points

Create complex plugins with multiple panels:

```typescript title="rozenite.config.ts"
export default {
  panels: [
    {
      name: 'Network Monitor',
      source: './src/network-panel.tsx',
    },
    {
      name: 'State Inspector',
      source: './src/state-panel.tsx',
    },
    {
      name: 'Performance',
      source: './src/performance-panel.tsx',
    },
  ],
};
```

## Best Practices

### Panel Design

- Keep panels focused on a single responsibility
- Use consistent styling and layout
- Provide clear error states and loading indicators
- Make panels responsive for different screen sizes

### Performance

- Avoid expensive operations in render cycles
- Use React.memo for expensive components
- Debounce frequent updates
- Clean up event listeners and subscriptions

### Communication

- Use typed message interfaces
- Handle connection errors gracefully
- Provide fallback data when React Native is unavailable
- Use meaningful method names for messages

## Troubleshooting

### Common Issues

**Panel not appearing in DevTools:**
- Check `rozenite.config.ts` syntax
- Ensure the source file exists
- Verify the component exports correctly

**Build errors:**
- Check TypeScript compilation
- Verify all dependencies are installed
- Ensure Node.js version is 22+

**Runtime errors:**
- Check browser console for errors
- Verify plugin bridge usage
- Ensure React Native integration is correct

## Next Steps

- Explore the [CLI documentation](./cli.md) for more command options
- Join the community to share your plugins and get help 