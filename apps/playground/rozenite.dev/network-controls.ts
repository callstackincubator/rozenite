import { createSection } from '@rozenite/controls-plugin';
import { useMemo } from 'react';
import { navigationRef } from '../src/app/navigation/navigationRef';
import { useNetworkTestStore } from '../src/app/stores/networkTestStore';

// Split out of src/app/screens/NetworkTestScreen.tsx: the screen used to
// build this section from local `transport` state and call
// `useRozeniteControlsPlugin` (and `navigation.navigate`) directly. The
// transport state now lives in `useNetworkTestStore` so both the screen and
// this dev-only section can read/write it, and navigation goes through the
// module-level `navigationRef` instead of a navigation prop.
//
// Registered as its own `useRozeniteControlsPlugin` call from the dev entry
// (not merged into `usePlaygroundControlsSections`'s array) so it mounts
// alongside the app-level Controls sections, matching today's behaviour of
// two independent callers.
export const useNetworkControlsSections = () => {
  const transport = useNetworkTestStore((state) => state.transport);
  const setTransport = useNetworkTestStore((state) => state.setTransport);

  return useMemo(
    () => [
      createSection({
        id: 'network-playground',
        title: 'Network Playground',
        description:
          'Local controls registered from the Network screen, mounted alongside the app-level Controls sections.',
        items: [
          {
            id: 'active-transport',
            type: 'text' as const,
            title: 'Active Transport',
            value: transport,
          },
          {
            id: 'reset-transport',
            type: 'button' as const,
            title: 'Reset to fetch',
            actionLabel: 'Reset',
            onPress: () => setTransport('fetch'),
          },
          {
            id: 'request-body-test',
            type: 'button' as const,
            title: 'Open Request Body Test',
            actionLabel: 'Open',
            onPress: () => navigationRef.current?.navigate('RequestBodyTest'),
          },
        ],
      }),
    ],
    [setTransport, transport],
  );
};
