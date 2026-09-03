import { useEffect, useState } from '@lynx-js/react';
import {
  createCustomFlagsAdapter,
  createFlagOverrides,
  useRozeniteFeatureFlagsPlugin,
  type FeatureFlagInput,
} from '@rozenite/feature-flags-plugin';

import { Group, Row } from '../src/ui.jsx';

const declarations: FeatureFlagInput[] = [
  { key: 'new-splash', value: true, type: 'boolean' },
  { key: 'greeting', value: 'Hello from Lynx', type: 'string' },
];

// Module scope so the adapter (and the overrides it writes to) survives every
// render: the panel and the app then read the same override store.
const overrides = createFlagOverrides();

const adapter = createCustomFlagsAdapter({
  id: 'app',
  name: 'App flags',
  listFlags: () => declarations,
  overrides,
});

const providers = [adapter];

const resolve = (key: string) =>
  overrides.get(key) ?? declarations.find((flag) => flag.key === key)?.value;

/**
 * Minimal Feature Flags playground: two flags behind the custom adapter, with
 * their effective values rendered so an override set from the panel shows up
 * on the device.
 */
export function FeatureFlagsPlayground() {
  useRozeniteFeatureFlagsPlugin({ providers });

  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const subscription = overrides.subscribe(() => forceUpdate((value) => value + 1));
    return () => subscription.remove();
  }, []);

  return (
    <Group title="Feature Flags">
      <Row label="new-splash" value={String(resolve('new-splash'))} />
      <Row label="greeting" value={String(resolve('greeting'))} last />
    </Group>
  );
}
