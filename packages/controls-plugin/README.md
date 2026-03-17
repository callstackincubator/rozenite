![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin for exposing app-defined controls directly in React Native DevTools.

The Controls Plugin lets you create a custom control panel for your app inside Rozenite. You define sections and items on the device, then use DevTools to read runtime values, flip toggles, switch options, submit text input, and trigger actions without building extra debug screens.

![Controls Plugin](https://rozenite.dev/controls-plugin.png)

## Installation

```bash
npm install @rozenite/controls-plugin
```

## Usage

```ts
import { createSection, useRozeniteControlsPlugin } from '@rozenite/controls-plugin';
import { useMemo, useState } from 'react';

function App() {
  const [verboseLogging, setVerboseLogging] = useState(false);
  const [environment, setEnvironment] = useState('local');
  const [releaseLabel, setReleaseLabel] = useState('build-001');

  const sections = useMemo(
    () => [
      createSection({
        id: 'runtime-status',
        title: 'Runtime Status',
        items: [
          {
            id: 'current-environment',
            type: 'text',
            title: 'Environment',
            value: environment,
          },
          {
            id: 'verbose-logging',
            type: 'toggle',
            title: 'Verbose Logging',
            value: verboseLogging,
            onUpdate: setVerboseLogging,
          },
          {
            id: 'environment-selector',
            type: 'select',
            title: 'Environment',
            value: environment,
            options: [
              { label: 'Local', value: 'local' },
              { label: 'Staging', value: 'staging' },
              { label: 'Production', value: 'production' },
            ],
            onUpdate: setEnvironment,
          },
          {
            id: 'release-label',
            type: 'input',
            title: 'Release Label',
            value: releaseLabel,
            placeholder: 'build-001',
            applyLabel: 'Apply',
            onUpdate: setReleaseLabel,
          },
          {
            id: 'reset-session',
            type: 'button',
            title: 'Reset Session',
            actionLabel: 'Reset',
            onPress: () => {
              setVerboseLogging(false);
              setEnvironment('local');
              setReleaseLabel('build-001');
            },
          },
        ],
      }),
    ],
    [environment, releaseLabel, verboseLogging]
  );

  useRozeniteControlsPlugin({ sections });

  return <YourApp />;
}
```

## Supported Controls

- `text`: Show read-only runtime values such as current environment, build label, or connection status.
- `toggle`: Enable or disable boolean flags from DevTools.
- `select`: Switch between predefined options such as backend targets or feature variants.
- `input`: Edit text values and apply them from DevTools.
- `button`: Trigger one-off actions such as reset, sync, refetch, or clear cache.

## Organizing the Panel

Group related controls into sections so the panel stays readable as your app grows:

- Use one section for read-only diagnostics and another for mutable settings.
- Keep labels short and descriptive so they scan well in DevTools.
- Add `description` when a control changes app behavior in a non-obvious way.
- Use stable `id` values so controls remain predictable across reloads.

## Validation and Disabled States

Controls can guide users toward safe actions:

- Use `validate` to block invalid values and show a clear error message in DevTools.
- Use `disabled` when a control should be visible but unavailable in the current state.
- For text input, `applyLabel` can make the action clearer than a generic submit button.

## Notes

- The panel appears in React Native DevTools as `Controls`.
- Updates flow both ways: local state changes are reflected in DevTools, and DevTools actions update the device.
- The hook is disabled in production builds.
