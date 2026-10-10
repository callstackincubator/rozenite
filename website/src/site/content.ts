// The facts the new pages use, in one place. Every command, package, tool and target here comes
// from the docs (src/content/docs/docs/**), the repo README, packages/cli/docs or the plugin
// packages themselves. Do not add numbers, adopters or claims that are not in the repo.

import type { IconName } from '../components/site/icons';

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
  skill: 'npx skills add https://github.com/callstackincubator/rozenite --skill rozenite',
};

export const docs = {
  start: '/docs/getting-started',
  intro: '/docs/introduction',
  compatibility: '/docs/compatibility',
  plugins: '/docs/official-plugins/overview',
  directory: '/plugin-directory',
  agents: '/docs/agent/overview',
  skills: '/docs/agent/skills',
  appTools: '/docs/agent/adding-tools-to-your-application',
  pluginTools: '/docs/agent/making-your-plugin-agent-enabled',
  sdk: '/docs/agent/sdk',
  lynx: '/docs/targets/rozenite-for-lynx',
  web: '/docs/targets/rozenite-for-web',
  standalone: '/docs/standalone-app',
  pluginDev: '/docs/plugin-development/overview',
  pluginGuide: '/docs/plugin-development/plugin-development',
  rpc: '/docs/plugin-development/rpc',
  testing: '/docs/plugin-development/testing',
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

export type Plugin = {
  name: string;
  pkg: string;
  /** What the panel shows, one line. */
  about: string;
  icon: IconName;
  href: string;
  /** Also registers tools for Rozenite for Agents, and the agent domain it shows up as. */
  agent?: string;
  /** A few real agent tool names, for agent-enabled plugins. */
  tools?: string[];
};

/** The fourteen official plugins, ordered by how often a team reaches for them. */
export const plugins: Plugin[] = [
  {
    name: 'Network Activity',
    pkg: '@rozenite/network-activity-plugin',
    about: 'HTTP and WebSocket traffic: requests, headers, payloads and timings.',
    icon: 'network',
    href: '/docs/official-plugins/network-activity',
    agent: 'network-activity',
    tools: ['listRequests', 'getRequestDetails'],
  },
  {
    name: 'TanStack Query',
    pkg: '@rozenite/tanstack-query-plugin',
    about: 'Queries, mutations and cache entries, with refetch, invalidate and reset.',
    icon: 'query',
    href: '/docs/official-plugins/tanstack-query',
    agent: 'tanstack-query',
    tools: ['list-queries', 'invalidate-query', 'refetch-query'],
  },
  {
    name: 'Redux DevTools',
    pkg: '@rozenite/redux-devtools-plugin',
    about: 'Store state, dispatched actions and a diff for each one.',
    icon: 'cube',
    href: '/docs/official-plugins/redux-devtools',
    agent: 'redux-devtools',
    tools: ['get-store-state', 'list-actions', 'dispatch-action'],
  },
  {
    name: 'React Navigation',
    pkg: '@rozenite/react-navigation-plugin',
    about: 'Action timeline, navigation state, time travel and deep link testing.',
    icon: 'signpost',
    href: '/docs/official-plugins/react-navigation',
    agent: 'react-navigation',
    tools: ['get-root-state', 'navigate', 'go-back'],
  },
  {
    name: 'Storage',
    pkg: '@rozenite/storage-plugin',
    about: 'MMKV, AsyncStorage and Expo SecureStore in one panel.',
    icon: 'database',
    href: '/docs/official-plugins/storage',
    agent: 'storage',
    tools: ['list-storages', 'list-entries', 'edit-entry'],
  },
  {
    name: 'Performance Monitor',
    pkg: '@rozenite/performance-monitor-plugin',
    about: 'Startup timing, custom marks, measures and metrics.',
    icon: 'gauge',
    href: '/docs/official-plugins/performance-monitor',
  },
  {
    name: 'Controls',
    pkg: '@rozenite/controls-plugin',
    about: 'Your own toggles, inputs and buttons, kept out of your product UI.',
    icon: 'faders',
    href: '/docs/official-plugins/controls',
    agent: 'controls',
    tools: ['list-sections', 'set-value', 'press-button'],
  },
  {
    name: 'File System',
    pkg: '@rozenite/file-system-plugin',
    about: 'App directories, with text and image previews and hex for binaries.',
    icon: 'folder',
    href: '/docs/official-plugins/file-system',
    agent: 'file-system',
    tools: ['list-roots', 'list-entries', 'read-text-file'],
  },
  {
    name: 'Feature Flags',
    pkg: '@rozenite/feature-flags-plugin',
    about: 'Inspect and override flags from a custom store, LaunchDarkly or Statsig.',
    icon: 'flag',
    href: '/docs/official-plugins/feature-flags',
  },
  {
    name: 'SQLite',
    pkg: '@rozenite/sqlite-plugin',
    about: "Browse tables and run queries against your app's databases.",
    icon: 'table',
    href: '/docs/official-plugins/sqlite',
  },
  {
    name: 'Expo Atlas',
    pkg: '@rozenite/expo-atlas-plugin',
    about: 'Your Metro bundle: module sizes, duplicates and the dependency graph.',
    icon: 'stack',
    href: '/docs/official-plugins/expo-atlas',
  },
  {
    name: 'Require Profiler',
    pkg: '@rozenite/require-profiler-plugin',
    about: "A flame graph of your app's startup require() calls.",
    icon: 'flame',
    href: '/docs/official-plugins/require-profiler',
  },
  {
    name: 'React Hook Form',
    pkg: '@rozenite/rhf-plugin',
    about: 'Values, errors, dirty and touched state for every mounted form.',
    icon: 'form',
    href: '/docs/official-plugins/react-hook-form',
  },
  {
    name: 'Overlay',
    pkg: '@rozenite/overlay-plugin',
    about: 'Grids and reference images over the running app, with a compare slider.',
    icon: 'grid',
    href: '/docs/official-plugins/overlay',
  },
];

export const agentPlugins = plugins.filter((p) => p.agent);

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

/** Agents the docs name. */
export const agentClients = ['Codex', 'Cursor', 'Any agent with a shell', 'Node.js scripts'];

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
  appTool: `import { useRozeniteInAppAgentTool, type AgentTool } from '@rozenite/agent-bridge';

const buildInfoTool: AgentTool = {
  name: 'get-build-info',
  description: 'Return app build metadata.',
  inputSchema: { type: 'object', properties: {} },
};

function AppAgentTools() {
  useRozeniteInAppAgentTool({
    tool: buildInfoTool,
    handler: () => ({ version: '1.0.0' }),
  });
  return null;
}`,
  appToolCall: `rozenite agent app tools --session <sessionId> --json
rozenite agent app call --tool get-build-info --args '{}' --session <sessionId> --json`,
  pluginTool: `import { useRozenitePluginAgentTool, type AgentTool } from '@rozenite/agent-bridge';

const echoTool: AgentTool = {
  name: 'echo',
  description: 'Return the provided value.',
  inputSchema: {
    type: 'object',
    properties: { value: { type: 'string' } },
    required: ['value'],
  },
};

export function MyPluginAgentTools() {
  useRozenitePluginAgentTool({
    pluginId: '@my-org/my-rozenite-plugin',
    tool: echoTool,
    handler: ({ value }: { value: string }) => ({ value }),
  });
  return null;
}`,
  sdk: `import { createAgentClient } from '@rozenite/agent-sdk';

const client = createAgentClient();

const requests = await client.withSession(async (session) => {
  await session.domains.list();
  return session.tools.call({
    domain: 'network',
    tool: 'listRequests',
    args: { limit: 20 },
  });
});`,
  panelClient: `const client = useRozeniteDevToolsClient<EventMap>({
  pluginId: 'checkout-inspector',
});

client.onMessage('cart-updated', (cart) => {
  setItems(cart.items);
});

client.send('clear-cart', { reason: 'devtools' });`,
  appSide: `import { DevToolsPluginClient } from '@rozenite/plugin-bridge';
import { Platform, Dimensions } from 'react-native';

export default function setupPlugin(
  client: DevToolsPluginClient<PluginEvents>
) {
  client.onMessage('request-user-data', () => {
    client.send('user-data', {
      id: 'user-123',
      name: 'John Doe',
      email: 'john@example.com',
    });
  });
}`,
  config: `import type { RozeniteConfig } from '@rozenite/vite-plugin';

export default {
  panels: [
    { name: 'My Custom Panel', source: './src/my-panel.tsx' },
  ],
  integrations: ['react-native'],
} satisfies RozeniteConfig;`,
  include: `module.exports = withRozenite(mergeConfig(defaultConfig, customConfig), {
  enabled: process.env.WITH_ROZENITE === 'true',
  include: ['@rozenite/storage-plugin', '@rozenite/network-activity-plugin'],
  pluginDisplay: 'tabs',
});`,
  testing: `const { device, panel } = connectFakePair();

const deviceClient = await getRozeniteDevToolsClient<CacheInspectorEvents>(
  '@acme/cache-inspector',
  { channel: device }
);
const panelClient = await getRozeniteDevToolsClient<CacheInspectorEvents>(
  '@acme/cache-inspector',
  { channel: panel }
);

registerCacheHandlers(deviceClient, { entries: [{ key: 'user:42', sizeBytes: 1024 }] });
panelClient.send('cache-entries-request', {});

const response = await waitForMessage(panelClient, 'cache-entries');`,
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
    a: 'Not yet. A device serves one debugger connection, so an agent session disconnects DevTools until React Native supports more than one.',
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
