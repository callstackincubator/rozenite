---
name: feature-flags
description: List, read and override the app's feature flags across its flag providers, and clear overrides.
domain: feature-flags
---

# Feature Flags Plugin Domain

A Rozenite plugin for inspecting and overriding feature flags in React Native DevTools, across a homegrown flag store, LaunchDarkly and Statsig. Use this domain to read a flag's effective value and to force a flag on, off or to a variant on this device, for example to reproduce a bug that only happens with one flag value.

## Domain

- Plugin ID: `@rozenite/feature-flags-plugin`
- Domain token: `feature-flags`

## Tools

```
npx rozenite agent feature-flags list-flags
npx rozenite agent feature-flags get-flag --key new-checkout
npx rozenite agent feature-flags override-flag --key new-checkout --value true
npx rozenite agent feature-flags clear-overrides --key new-checkout
npx rozenite agent feature-flags clear-overrides
```

If more than one provider is registered, add `--providerId <id>` to `get-flag`, `override-flag` and `clear-overrides`. `list-flags` without it lists every provider.

`list-flags` prints one row per provider with `providerId`, `providerName` and its `flags`; each flag has `key`, `type`, the effective `value` and whether it is `overridden`. Flag lists are small, so they are not paged.

## Overrides

`override-flag` takes a `--value` that matches the flag's `type`: `true`/`false` for `boolean`, text for `string`, a number for `number`, any JSON for `json`. The override lasts until `clear-overrides`; with `--key` that clears one flag and returns it, without it every override of the provider is cleared and the count is returned. Whether an override survives an app restart depends on the provider.

## Minimal Flow

`list-flags` -> `get-flag` -> `override-flag` -> reproduce -> `clear-overrides`.
