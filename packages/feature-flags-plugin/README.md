![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin for inspecting and overriding feature flags in React Native DevTools.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite Feature Flags Plugin lets you list, inspect, and force-override feature flags on a running device from React Native DevTools — across a homegrown flag store, LaunchDarkly, and Statsig.

## Read this first: Tier A vs. Tier B

Every adapter can list flags and show effective values. Whether **setting an override just works, or needs a call-site change**, depends on whether the plugin or the provider owns the override store:

- **Tier A — the provider owns the store.** Statsig's `LocalOverrideAdapter` is a native local-override mechanism; the adapter just points at it. **No call-site change.** Overrides live exactly as long as that `LocalOverrideAdapter` instance does — durable if you construct it once at app start, ephemeral if you don't.
- **Tier B — the plugin owns the store.** LaunchDarkly and the custom/local adapter have no such mechanism, so the plugin keeps an in-memory override map itself. Reading through it requires one changed line: for LaunchDarkly, pass the **wrapped client** (not the raw SDK client) to `<LDProvider>`. Overrides are **in-memory and gone on app restart** unless you wire persistence yourself via `createFlagOverrides({ initial, onChange })`.

This means **"Reset all overrides" in the panel is durable on Tier A and ephemeral on Tier B** — restarting the app after a Tier A reset keeps flags clean, while a Tier B reset only clears the current process's in-memory map. Neither is a bug; they're consequences of who owns the store. Each adapter section below states its lifetime in one line.

## Installation

```bash
npm install @rozenite/feature-flags-plugin
```

Optional peers depending on the adapters you use:

```bash
npm install @launchdarkly/react-native-client-sdk
npm install @statsig/js-client @statsig/react-native-bindings @statsig/js-local-overrides
```

## Usage

### Custom / local adapter (Tier B — no provider, you declare the flags)

For a homegrown flag store, or as a placeholder before wiring a real provider. **No call-site change** beyond registering the adapter — flags are read straight from your own `listFlags()`.

```ts
import {
  createCustomFlagsAdapter,
  useRozeniteFeatureFlagsPlugin,
} from '@rozenite/feature-flags-plugin';

useRozeniteFeatureFlagsPlugin({
  providers: [
    createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => flagStore.getAll(), // FeatureFlagInput[]: { key, value, type? }
    }),
  ],
});
```

Overrides are an in-memory `Map`, gone on app restart by default. Wire persistence with `createFlagOverrides`:

```ts
import { createCustomFlagsAdapter, createFlagOverrides } from '@rozenite/feature-flags-plugin';

const overrides = createFlagOverrides({
  initial: JSON.parse(storage.getString('flag-overrides') ?? '{}'),
  onChange: (all) => storage.set('flag-overrides', JSON.stringify(all)),
});

createCustomFlagsAdapter({ id: 'app', name: 'App flags', listFlags, overrides });
```

### LaunchDarkly adapter (Tier B — wrapped client)

`createLaunchDarklyFlagsAdapter` returns a `provider` for the hook and a `client` you must pass to `<LDProvider>` in place of the raw SDK client — **the one changed line**. Every LD hook (`useBoolVariation`, `useLDClient`, ...) then reads through it automatically, since LD's hooks are a thin read off the context client.

```ts
import { ReactNativeLDClient, AutoEnvAttributes, LDProvider } from '@launchdarkly/react-native-client-sdk';
import {
  createLaunchDarklyFlagsAdapter,
  useRozeniteFeatureFlagsPlugin,
} from '@rozenite/feature-flags-plugin';

const rawClient = new ReactNativeLDClient(LD_MOBILE_KEY, AutoEnvAttributes.Enabled);
const { provider, client } = createLaunchDarklyFlagsAdapter({ client: rawClient });

useRozeniteFeatureFlagsPlugin({ providers: [provider] });

<LDProvider client={client}>{/* ... */}</LDProvider>;
```

Overrides are in-memory, gone on app restart, unless you pass your own `overrides` (same `createFlagOverrides` option as the custom adapter). There is no `refresh()` — the LD client has no documented, version-stable way to force one; LD refreshes over its own streaming/polling connection instead. Anything holding a direct reference to the raw client (not the wrapped one) bypasses overrides.

### Statsig adapter (Tier A — native override store)

You construct the `StatsigClient` and `LocalOverrideAdapter` yourself; the adapter only takes references to them. **No call-site change.** Override lifetime is whatever your `LocalOverrideAdapter` instance's lifetime is — this plugin doesn't manage it.

```ts
import { StatsigClient } from '@statsig/js-client';
import { LocalOverrideAdapter } from '@statsig/js-local-overrides';
import {
  createStatsigFlagsAdapter,
  useRozeniteFeatureFlagsPlugin,
} from '@rozenite/feature-flags-plugin';

const overrideAdapter = new LocalOverrideAdapter();
const client = new StatsigClient(STATSIG_CLIENT_KEY, { userID: 'user-123' }, { overrideAdapter });
await client.initializeAsync();

useRozeniteFeatureFlagsPlugin({
  providers: [
    createStatsigFlagsAdapter({
      client,
      overrideAdapter,
      flags: [
        { key: 'new-onboarding' }, // boolean gate (default type)
        { key: 'checkout-copy', type: 'string' },
        { key: 'max-items', type: 'number' },
        { key: 'layout-config', type: 'json' },
      ],
    }),
  ],
});
```

Notes specific to this adapter:

- Statsig has no client-side way to enumerate gates or dynamic configs, so you declare which flags exist up front via `flags`. `setOverride`/`clearOverride`/`get-flag` throw for a key that isn't declared.
- A gate (`type: 'boolean'`, the default) maps directly to `checkGate`/`overrideGate`.
- Dynamic configs are Statsig's only non-gate primitive, and their value is a parameter map, not a single scalar. For `string`/`number` flags, this adapter reads and writes a single parameter named `value` within the config by convention (`config.get('value', default)` / `overrideDynamicConfig(key, { value })`) — this is a convention of this adapter, not a Statsig API. A `json`-typed flag reads/writes the config's full parameter map instead and avoids the convention entirely.
- No `refresh()` — the closest SDK method (`updateUserAsync`) re-identifies the user rather than refetching specs for the current one, so this adapter doesn't invent a refresh convention around it.

## Agent Tools (LLM Integration)

When this plugin is active, it registers agent tools under the `@rozenite/feature-flags-plugin` domain so coding agents can drive flags through Rozenite for Agents:

- `list-flags`: list flags across providers (or a single one via `providerId`), including type, effective value, and override state.
- `get-flag`: read a single flag by key.
- `override-flag`: force a flag to a value — reproduce a bug report that only happens with a flag on.
- `clear-overrides`: clear one override (pass `key`) or every override for a provider.

`providerId` is optional everywhere and resolves to the sole registered provider when there's only one.

## Notes

- A flag is `{ key, type: 'boolean' | 'string' | 'number' | 'json', value, overridden }` — `value` is always the effective, post-override value.
- `providers: FeatureFlagsProvider[]` accepts more than one adapter at once (e.g. a homegrown flag store alongside LaunchDarkly during a migration). The panel only shows the multi-provider sidebar when more than one is registered.
- There is no `capabilities` object on `FeatureFlagsProvider` — every Tier B provider can override everything it lists, and enumeration limits (like Statsig's) are handled by declaring flags up front instead.
- `refresh` is optional on `FeatureFlagsProvider` and is only implemented where the provider has a real refetch primitive; neither the LaunchDarkly nor the Statsig adapter implements it (see each section above).

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/rozenite?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/feature-flags-plugin
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
