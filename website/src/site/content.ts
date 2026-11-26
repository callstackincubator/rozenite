// The facts the new pages use, in one place. Every command, package, tool and target here comes
// from the docs (src/content/docs/docs/**), the repo README, packages/cli/docs or the plugin
// packages themselves. Do not add numbers, adopters or claims that are not in the repo.

export const site = {
  name: 'Rozenite',
  title: 'Rozenite: DevTools panels for React Native and Lynx',
  description:
    'Plug-and-play DevTools panels for React Native and Lynx, with type-safe plugin APIs and runtime tools for agents.',
  repo: 'https://github.com/callstackincubator/rozenite',
  discord: 'https://discord.gg/xgGt7KAjxv',
  license: 'https://github.com/callstackincubator/rozenite/blob/main/LICENSE',
  callstack: 'https://callstack.com/?utm_source=rozenite&utm_medium=referral',
  install: 'npx rozenite@latest init',
  /** Alt text for the social card (public/og-image.jpg). */
  ogAlt:
    'Rozenite by Callstack. See inside your running app. So can your agent. React Native DevTools with a Rozenite panel and an agent terminal showing the same failing request.',
  skill: 'npx skills add callstackincubator/rozenite --skill rozenite',
};

export const docs = {
  start: '/docs/getting-started',
  intro: '/docs/introduction',
  compatibility: '/docs/compatibility',
  directory: '/plugin-directory',
  agents: '/docs/agent/overview',
  appTools: '/docs/agent/adding-tools-to-your-application',
  pluginTools: '/docs/agent/making-your-plugin-agent-enabled',
  lynx: '/docs/targets/rozenite-for-lynx',
  web: '/docs/targets/rozenite-for-web',
  standalone: '/docs/standalone-app',
  pluginDev: '/docs/plugin-development/overview',
  llms: '/llms.txt',
};

/** Targets and bundlers, in the order docs/DESIGN.md fixes. */
export const marquee = [
  'React Native',
  'iOS',
  'Android',
  'Expo',
  'Metro',
  'Re.Pack',
  'React Native Web',
  'Webpack',
  'Lynx',
  'rspeedy',
  'React Native DevTools',
];

/**
 * The official plugins on the home page, by slug (the docs page's file name), ordered by how
 * often a team reaches for them. Each plugin's name, copy and page come from its docs page in
 * src/content/docs/docs/official-plugins/ (see site/plugin-docs.ts); a plugin left out of this
 * list still gets its page and cell, after these ones.
 */
export const pluginOrder = [
  'network-activity',
  'tanstack-query',
  'redux-devtools',
  'zustand',
  'react-navigation',
  'storage',
  'performance-monitor',
  'controls',
  'file-system',
  'feature-flags',
  'sqlite',
  'expo-atlas',
  'require-profiler',
  'react-hook-form',
  'overlay',
];

/** Rozenite for Agents: the built-in domains and a few of their real tools. */
export const domains = [
  {
    id: 'console',
    about: 'Logs from the app, filtered by level or text.',
    tools: ['getMessages', 'clearMessages'],
  },
  {
    id: 'network',
    about: 'Requests during a flow, with headers and bodies.',
    tools: ['startRecording', 'listRequests', 'getResponseBody'],
  },
  {
    id: 'react',
    about: 'The component tree, props, state and hooks, and render profiles.',
    tools: ['searchNodes', 'startProfiling', 'getRenderData'],
  },
  {
    id: 'performance',
    about: 'A performance trace over a reproduction.',
    tools: ['startTrace', 'stopTrace'],
  },
  {
    id: 'memory',
    about: 'Heap snapshots and allocation sampling.',
    tools: ['takeHeapSnapshot', 'startSampling'],
  },
];

export const code = {
  metro: `const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withRozenite } = require('@rozenite/metro');

const defaultConfig = getDefaultConfig(__dirname);

module.exports = withRozenite(mergeConfig(defaultConfig, {}), {
  enabled: process.env.WITH_ROZENITE === 'true',
});`,
  repack: `import { withRozenite } from '@rozenite/repack';

export default withRozenite(
  {
    // Your existing Re.Pack configuration
  },
  {
    enabled: process.env.WITH_ROZENITE === 'true',
  },
);`,
  lynx: `import { defineConfig } from '@lynx-js/rspeedy';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { rozeniteLynxPlugin } from '@rozenite/lynx/rspeedy';

export default defineConfig({
  plugins: [pluginReactLynx(), rozeniteLynxPlugin()],
});`,
  web: `const { getDefaultConfig } = require('expo/metro-config');
const { withRozeniteWeb } = require('@rozenite/web/metro');

const config = getDefaultConfig(__dirname);

module.exports = withRozeniteWeb(config);

// and in your web entry point:
require('@rozenite/web');`,
  agentCli: `npx rozenite agent session create

npx rozenite agent console call \\
  --tool getMessages \\
  --args '{"levels":["error"]}' \\
  --session <session-id>`,
};

/** Questions people ask, answered only from the docs. */
export const faq = [
  {
    q: 'Does any of this ship to my users?',
    a: 'No. Rozenite is off until you enable it in your bundler config, and plugins are disabled in production builds, so no plugin code ships.',
  },
  {
    q: 'Which versions does it support?',
    a: 'Expo SDK 52+, React Native 0.76+ and Re.Pack 5.2+. Bare React Native works when it matches the React Native of the minimum Expo SDK.',
  },
  {
    q: 'Does it work with Expo?',
    a: 'Yes, with Expo and bare React Native, on Metro or Re.Pack. `rozenite init` detects the bundler and updates the config.',
  },
  {
    q: 'Can an agent and React Native DevTools connect at once?',
    a: 'Yes. Your agent can hold a session on the app while React Native DevTools stays open, so you can watch the panels while it works.',
  },
  {
    q: 'What about Lynx and the web?',
    a: 'Both are experimental. Lynx works through rspeedy, React Native Web through the browser extension. Plugins declare which targets they support.',
  },
  {
    q: 'Can I list my own plugin?',
    a: 'Yes. The plugin directory is a list in the repo: add your package with a pull request.',
  },
];
