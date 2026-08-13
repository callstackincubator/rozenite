# Plugin Development Overview

Plugins add new panels to React Native DevTools through Rozenite — custom debugging tools, performance monitors, and development utilities tailored to your app.

## How plugins work

A plugin has two parts that talk to each other over a type-safe, event-based bridge:

1. **React Native side** — code that runs in your app.
2. **DevTools side** — the panel UI shown in DevTools.

Changes on either side are reflected on the other in real time, and both sides can send data or commands.

## Plugin structure

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

## What you can build

Anything that benefits from a live view into your running app: custom debugging tools, performance monitors, state inspectors, network tools, storage inspectors, or development-time analytics.

To develop without wiring up a playground app first, `rozenite dev` opens an in-browser dev host where you can preview panels, read the message log, and dispatch commands — see the [Plugin Development guide](./plugin-development.md#step-5-local-development-workflow). You can also define reusable presets and scripted dev flows in `rozenite.config.ts` to speed up local iteration.

## Getting started

Ready to build one? Follow the [Plugin Development Guide](./plugin-development.md) for a full walkthrough, or browse the [Official Plugins](../official-plugins/overview.md) for examples of what's possible.

## Contributing

We welcome contributions to both our maintained plugins and the community ecosystem. See the [Plugin Development Guide](./plugin-development.md) to get started, or reach out to the community to discuss an idea.
