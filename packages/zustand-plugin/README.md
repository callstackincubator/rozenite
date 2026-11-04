![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin for inspecting, time travelling and editing Zustand stores in React Native DevTools.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Zustand plugin records every change to your Zustand stores and shows it in a **Zustand** panel. You get a timeline of named actions with their arguments, a diff for each change, the call site symbolicated through Metro, time travel, live editing, the ability to call store actions, and `persist` status. Every store appears in one view, so you can see that `Session.logout` is what emptied the cart.

## Features

- **Action names and arguments with no boilerplate.** The middleware wraps your store's functions, so `addItem(42)` shows up as `addItem(42)` without `set(…, 'cart/addItem')`.
- **Async attribution.** A `set` after an `await` is attributed to the store's pending action, shown with `· after await`. When several of its actions are in flight, it stays anonymous instead of being guessed.
- **Diffs and history.** Each change is recorded as a patch with its old and new values. A small ring buffer on the device replays everything that happened before the panel opened, including startup and hydration.
- **Time travel.** Jump to any state the device still holds, from the timeline or with the scrubber, pause recording, and export history as JSON. Jumps restore the app's own copy of the state, and your actions keep working.
- **Live editing and callable actions.** Edit any value in place, or call a store action with JSON arguments.
- **`persist` status.** See the storage key, the version and whether the store has hydrated; rehydrate or clear storage.
- **Rich values.** `Map`, `Set`, `Date`, `BigInt`, `undefined`, `NaN`, class instances, circular references and functions are shown as what they are. Large values load lazily in the panel. Typed arrays, `ArrayBuffer`, `DataView` and circular references are view-only.
- **Warnings with copyable fixes**, for example when `rozenite()` is not the outermost middleware.
- **Rozenite for Agents.** Agents can list stores, read state and history, call actions, set values, time travel and pause recording.
- **Development only.** Every export compiles to a pass-through in production builds.

## Installation

```bash
npm install -D @rozenite/zustand-plugin
```

`zustand` (v4.4 or newer) is a peer dependency.

## Usage

Wrap the store's initializer with `rozenite()` and give the store a stable `name`. Put `rozenite()` **outermost**, so it can see `persist` hydration:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { rozenite } from '@rozenite/zustand-plugin';

export const useCartStore = create<CartState>()(
  rozenite(
    persist(
      (set) => ({
        items: [],
        addItem: (item: Item) => set((state) => ({ items: [...state.items, item] })),
        checkout: async () => {
          set({ status: 'pending' });
          await api.checkout();
          set({ status: 'paid', items: [] });
        },
      }),
      { name: 'cart' },
    ),
    { name: 'Cart' },
  ),
);
```

| Option | Default | Description |
| --- | --- | --- |
| `name` | required | Store name and stable id. |
| `enabled` | `true` in development | Turns recording off. |
| `maxAge` | `50` | Number of transitions kept on the device. They are replayed when the panel connects, and only their states can be jumped to. |
| `trace` | `false` | Capture a stack for every change, symbolicated through Metro in the panel. |
| `stateSanitizer` | — | Strip secrets or huge values from the state before it leaves the device. |

A third `set` argument still names a change explicitly: `set(next, false, 'cart/reset')`. Names passed through an inner `devtools()` or `persist()` are kept.

### Rozenite for Agents

```ts
import { useZustandAgentTools } from '@rozenite/zustand-plugin';

useZustandAgentTools();
```

## Notes

- **Time travel restores the app's own copy.** The device keeps the last `maxAge` states, so a jump brings back exactly what the store held, including values hidden by `stateSanitizer` or never loaded in the panel, while your store's functions stay the live ones. Older entries stay visible in the panel but cannot be jumped to. With `persist`, the restored state is written to storage like any other change.
- **Fast Refresh** keeps a store's history: re-creating a store with the same name shows a `♻ reloaded` marker. Two stores alive at once with the same name trigger a warning; give each one its own name.
- **Listeners.** A `set` made by a store subscriber while another `set` is notifying is folded into that transition.
- Values are serialised only while a DevTools panel is listening. Until then, and from two minutes after the panel goes quiet (DevTools closed), the device keeps references to state, which Zustand's immutability makes cheap.
- Large arrays, objects and strings load lazily, but an object referenced from many places is sent once per place. When one snapshot or transition encodes to more than 50,000 values, the store gets a warning (in the panel and in the app's console). Use `stateSanitizer` to drop or summarise that branch.

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/@rozenite/zustand-plugin?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@rozenite/zustand-plugin?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/zustand-plugin
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
