import { createRozeniteRpc, getRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { connectFakePair, waitForMessage } from '@rozenite/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { createCustomFlagsAdapter } from '../react-native/adapters/custom';
import { createFeatureFlagsHandlers } from '../react-native/handlers';
import {
  FEATURE_FLAGS_PLUGIN_ID,
  type FeatureFlagsEventMap,
  type FeatureFlagsMethods,
} from '../shared/messaging';

/**
 * Runs the real `react-native.ts`-side protocol code (`createFeatureFlagsHandlers`,
 * wired the same way `useRozeniteFeatureFlagsPlugin` wires it) against the
 * real panel-side protocol code (the same `createRozeniteRpc` calls
 * `useFeatureFlags` makes) over an in-memory `@rozenite/testing` fake pair —
 * no Metro, no simulator, no DevTools, and none of `@rozenite/plugin-bridge`
 * mocked.
 *
 * This intentionally does not render `useRozeniteFeatureFlagsPlugin` or
 * `useFeatureFlags` themselves: both are thin React effects around exactly
 * this RPC client/handler wiring, and neither is decomposed into a
 * client-accepting function the way `createFeatureFlagsHandlers` is. Driving
 * them through React here would mean either giving `useRozeniteDevToolsClient`
 * a channel it has no parameter for (out of scope — see the PR description),
 * or mocking `@rozenite/ui` and `@tanstack/react-query` to render the panel,
 * which the "not 80% mocked" guardrail in `docs/agents/unit-testing.md`
 * rules out. What's exercised here is the actual wire contract between the
 * two sides — the thing most likely to silently drift.
 */
describe('feature flags plugin protocol, over a @rozenite/testing fake pair', () => {
  const openHandles: { close: () => void }[] = [];

  afterEach(() => {
    openHandles.splice(0).forEach((handle) => handle.close());
  });

  const connect = async () => {
    const { device: deviceChannel, panel: panelChannel } = connectFakePair();

    const deviceClient = await getRozeniteDevToolsClient<FeatureFlagsEventMap>(
      FEATURE_FLAGS_PLUGIN_ID,
      { channel: deviceChannel },
    );
    const panelClient = await getRozeniteDevToolsClient<FeatureFlagsEventMap>(
      FEATURE_FLAGS_PLUGIN_ID,
      { channel: panelChannel },
    );

    const deviceRpc = createRozeniteRpc<FeatureFlagsMethods>(deviceClient);
    const panelRpc = createRozeniteRpc<FeatureFlagsMethods>(panelClient);

    openHandles.push(
      { close: () => deviceRpc.close() },
      { close: () => panelRpc.close() },
      { close: () => deviceClient.close() },
      { close: () => panelClient.close() },
    );

    return { deviceClient, panelClient, deviceRpc, panelRpc };
  };

  it('round-trips getSnapshot through the real handler and a real provider', async () => {
    const { deviceRpc, panelRpc } = await connect();
    const provider = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [
        { key: 'dark-mode', value: true },
        { key: 'checkout-variant', value: 'b' },
      ],
    });
    const handlers = createFeatureFlagsHandlers(() => [provider]);
    deviceRpc.handle('getSnapshot', handlers.getSnapshot);

    const snapshot = await panelRpc.method('getSnapshot').invoke();

    expect(snapshot).toEqual({
      providers: [
        {
          id: 'app',
          name: 'App flags',
          flags: [
            { key: 'dark-mode', type: 'boolean', value: true, overridden: false },
            { key: 'checkout-variant', type: 'string', value: 'b', overridden: false },
          ],
        },
      ],
    });
  });

  it('setOverride mutates the real provider and the panel sees the result', async () => {
    const { deviceRpc, panelRpc } = await connect();
    const provider = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [{ key: 'dark-mode', value: false }],
    });
    const handlers = createFeatureFlagsHandlers(() => [provider]);
    deviceRpc.handle('setOverride', handlers.setOverride);

    const result = await panelRpc
      .method('setOverride')
      .invoke({ providerId: 'app', key: 'dark-mode', value: true });

    expect(result).toEqual({
      flag: { key: 'dark-mode', type: 'boolean', value: true, overridden: true },
    });
    // The mutation landed on the real provider, not just in the RPC response.
    expect(await provider.listFlags()).toEqual([
      { key: 'dark-mode', type: 'boolean', value: true, overridden: true },
    ]);
  });

  it('propagates an unknown providerId as a real RozeniteHandlerError, not a hang or a crash', async () => {
    const { deviceRpc, panelRpc } = await connect();
    const handlers = createFeatureFlagsHandlers(() => []);
    deviceRpc.handle('getSnapshot', handlers.getSnapshot);
    deviceRpc.handle('setOverride', handlers.setOverride);

    await expect(
      panelRpc.method('setOverride').invoke({ providerId: 'missing', key: 'x', value: true }),
    ).rejects.toMatchObject({
      name: 'RozeniteHandlerError',
      remote: expect.objectContaining({
        message: expect.stringContaining('unknown providerId "missing"'),
      }),
    });
  });

  it('pushes flags-changed the same way useRozeniteFeatureFlagsPlugin wires provider.subscribe', async () => {
    const { deviceClient, panelClient } = await connect();
    const provider = createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => [{ key: 'dark-mode', value: false }],
    });

    // `subscribe` is optional on `FeatureFlagsProvider` in general, but
    // `createCustomFlagsAdapter` (the adapter under test) always provides
    // one.
    if (!provider.subscribe) {
      throw new Error('Expected the custom adapter to provide subscribe().');
    }

    // Mirrors the subscription effect in useRozeniteFeatureFlagsPlugin: push
    // a `flags-changed` event whenever the provider notifies of a change.
    const providerSubscription = provider.subscribe(() => {
      deviceClient.send('flags-changed', { type: 'flags-changed', providerId: provider.id });
    });
    openHandles.push({ close: () => providerSubscription.remove() });

    const pushed = waitForMessage(panelClient, 'flags-changed', { timeoutMs: 1000 });

    await provider.setOverride('dark-mode', true);

    await expect(pushed).resolves.toEqual({ type: 'flags-changed', providerId: 'app' });
  });
});
