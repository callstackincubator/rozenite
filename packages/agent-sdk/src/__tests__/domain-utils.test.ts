import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AgentTool } from '@rozenite/agent-shared';
import {
  buildRuntimePluginDomains,
  deriveDomainName,
  formatUnknownDomainError,
  getDomainToolsByDefinition,
  inferPluginId,
  inferToolShortName,
  resolveDomainToken,
  resolveDomainTool,
  toAgentDomainTool,
  toAgentToolSchema,
} from '../domain-utils.js';
import { RESERVED_DOMAIN_NAMES, STATIC_DOMAINS } from '../constants.js';

const PLUGIN_DIRECTORY_PATH = fileURLToPath(
  new URL('../../../../plugin-directory.json', import.meta.url),
);

const getFirstPartyPluginIds = (): string[] => {
  const entries: { npmUrl: string }[] = JSON.parse(
    readFileSync(PLUGIN_DIRECTORY_PATH, 'utf-8'),
  );

  return entries
    .map((entry) => entry.npmUrl.replace('https://www.npmjs.com/package/', ''))
    .filter((pluginId) => pluginId.startsWith('@rozenite/'));
};

const tool = (name: string): AgentTool => ({
  name,
  description: `${name} description`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
});

describe('agent domain utils', () => {
  it('derives short domain names for every package in the plugin directory', () => {
    const expected: Record<string, string> = {
      '@rozenite/redux-devtools-plugin': 'redux-devtools',
      '@rozenite/network-activity-plugin': 'network-activity',
      '@rozenite/react-navigation-plugin': 'react-navigation',
      '@rozenite/tanstack-query-plugin': 'tanstack-query',
      '@rozenite/expo-atlas-plugin': 'expo-atlas',
      '@rozenite/overlay-plugin': 'overlay',
      '@rozenite/controls-plugin': 'controls',
      '@rozenite/performance-monitor-plugin': 'performance-monitor',
      '@rozenite/storage-plugin': 'storage',
      '@rozenite/sqlite-plugin': 'sqlite',
      '@rozenite/file-system-plugin': 'file-system',
      '@rozenite/rhf-plugin': 'rhf',
      '@rozenite/require-profiler-plugin': 'require-profiler',
      '@ilteoood/zorro': 'ilteoood/zorro',
      '@avasapp/rozenite-plugin-ably': 'avasapp/ably',
      '@react-native-nitro-geolocation/rozenite-plugin':
        'react-native-nitro-geolocation',
      'rozenite-preview': 'rozenite-preview',
      'rozenite-graphql-client-devtool': 'rozenite-graphql-client-devtool',
      'rozenite-assets-viewer': 'rozenite-assets-viewer',
      'rozenite-growthbook-plugin': 'rozenite-growthbook-plugin',
      'rozenite-zustand-devtools': 'rozenite-zustand-devtools',
      'rozenite-navigation-inspector': 'rozenite-navigation-inspector',
    };

    const pluginIds = Object.keys(expected);
    const derived = pluginIds.map((pluginId) => deriveDomainName(pluginId));

    for (const [index, pluginId] of pluginIds.entries()) {
      expect(derived[index]).toBe(expected[pluginId]);
    }
    expect(new Set(derived).size).toBe(pluginIds.length);
  });

  it('is a pure function of the plugin id: a rival package cannot rename an official plugin', () => {
    expect(deriveDomainName('@rozenite/mmkv-plugin')).toBe('mmkv');
    expect(deriveDomainName('@evil/rozenite-plugin-mmkv')).toBe('evil/mmkv');
    expect(deriveDomainName('@other/mmkv-plugin')).toBe('other/mmkv');
    expect(deriveDomainName('rozenite-mmkv-plugin')).toBe(
      'rozenite-mmkv-plugin',
    );
  });

  it('never lets a plugin shadow a built-in domain name', () => {
    expect(deriveDomainName('@evil/react-plugin')).toBe('evil/react');
    expect(deriveDomainName('@x/rozenite-plugin-console')).toBe('x/console');
    expect(deriveDomainName('rozenite-react-plugin')).toBe(
      'rozenite-react-plugin',
    );
    expect(deriveDomainName('@rozenite/react-plugin')).toBe(
      '@rozenite/react-plugin',
    );
  });

  it('build-time assertion: no first-party @rozenite/* plugin reduces onto a reserved built-in name', () => {
    const firstPartyPluginIds = getFirstPartyPluginIds();
    expect(firstPartyPluginIds.length).toBeGreaterThan(0);

    for (const pluginId of firstPartyPluginIds) {
      const domainName = deriveDomainName(pluginId);
      expect(RESERVED_DOMAIN_NAMES.has(domainName)).toBe(false);
      expect(domainName).not.toBe(pluginId);
    }
  });

  it('falls back to the scope when the reduced name is empty or generic residue', () => {
    expect(deriveDomainName('@react-native-nitro-geolocation/rozenite-plugin')).toBe(
      'react-native-nitro-geolocation',
    );
    expect(deriveDomainName('@scope/plugin')).toBe('scope');
    expect(deriveDomainName('@scope/devtools')).toBe('scope');
  });

  it('infers plugin ids for scoped, unscoped, and empty-style names', () => {
    expect(inferPluginId('@rozenite/mmkv-plugin.list-entries')).toBe(
      '@rozenite/mmkv-plugin',
    );
    expect(inferPluginId('app.echo')).toBe('app');
    expect(inferPluginId('listRequests')).toBe('listRequests');
  });

  it('infers short tool names from tool names', () => {
    expect(inferToolShortName('@rozenite/mmkv-plugin.list-entries')).toBe(
      'list-entries',
    );
    expect(inferToolShortName('app.echo')).toBe('echo');
    expect(inferToolShortName('listRequests')).toBe('listRequests');
  });

  it('builds dynamic plugin domains from distinct plugin ids', () => {
    const domains = buildRuntimePluginDomains([
      tool('@rozenite/mmkv-plugin.list-entries'),
      tool('@avasapp/rozenite-plugin-ably.list-channels'),
    ]);

    const ids = domains.map((domain) => domain.id);
    expect(ids).toContain('mmkv');
    expect(ids).toContain('avasapp/ably');
    expect(new Set(ids).size).toBe(2);
    expect(domains.every((domain) => domain.kind === 'plugin')).toBe(true);
    expect(domains.every((domain) => domain.actions.length === 3)).toBe(true);
  });

  it('errors instead of silently renaming when two packages by the same author derive the same domain name', () => {
    expect(() =>
      buildRuntimePluginDomains([
        tool('@a/rozenite-plugin-x.list'),
        tool('@a/x-plugin.list'),
      ]),
    ).toThrow(
      /Ambiguous domain name "a\/x": plugins @a\/rozenite-plugin-x, @a\/x-plugin/,
    );
  });

  it('errors instead of silently shadowing a built-in domain with an unscoped package literally named after it', () => {
    expect(() =>
      buildRuntimePluginDomains([tool('console.list')]),
    ).toThrow(/Plugin "console" derives the domain name "console"/);
  });

  it('resolves plugin domains by id or pluginId token', () => {
    const domains = buildRuntimePluginDomains([
      tool('@rozenite/mmkv-plugin.list-entries'),
    ]);

    const byId = resolveDomainToken(domains[0]!.id, domains);
    const byPluginId = resolveDomainToken('@rozenite/mmkv-plugin', domains);

    expect(byId?.pluginId).toBe('@rozenite/mmkv-plugin');
    expect(byPluginId?.id).toBe(domains[0]!.id);
  });

  it('tolerantly resolves mmkv, rozenite/mmkv, and the full package name to the same domain', () => {
    const domains = buildRuntimePluginDomains([
      tool('@rozenite/mmkv-plugin.list-entries'),
    ]);

    expect(resolveDomainToken('mmkv', domains)?.pluginId).toBe(
      '@rozenite/mmkv-plugin',
    );
    expect(resolveDomainToken('rozenite/mmkv', domains)?.pluginId).toBe(
      '@rozenite/mmkv-plugin',
    );
    expect(
      resolveDomainToken('@rozenite/mmkv-plugin', domains)?.pluginId,
    ).toBe('@rozenite/mmkv-plugin');
  });

  it('still accepts the deprecated pre-#319 mangled slug as a compatibility alias', () => {
    const domains = buildRuntimePluginDomains([
      tool('@rozenite/mmkv-plugin.list-entries'),
    ]);

    expect(
      resolveDomainToken('at-rozenite__mmkv-plugin', domains)?.pluginId,
    ).toBe('@rozenite/mmkv-plugin');
  });

  it('uses origin-aware descriptions for plugin and app domains', () => {
    const domains = buildRuntimePluginDomains([
      tool('app.list-entries'),
      tool('@rozenite/mmkv-plugin.list-entries'),
    ]);

    const appDomain = domains.find((domain) => domain.pluginId === 'app');
    const pluginDomain = domains.find(
      (domain) => domain.pluginId === '@rozenite/mmkv-plugin',
    );

    expect(appDomain?.description).toBe(
      'Runtime tools exposed by the app itself.',
    );
    expect(pluginDomain?.description).toBe(
      'Runtime tools exposed by plugin "@rozenite/mmkv-plugin".',
    );
  });

  it('does not create plugin domains for static built-in tools', () => {
    const domains = buildRuntimePluginDomains([
      tool('getMessages'),
      tool('getNode'),
      tool('startTrace'),
      tool('takeHeapSnapshot'),
      tool('startRecording'),
      tool('app.echo'),
    ]);

    expect(domains.some((domain) => domain.pluginId === 'getMessages')).toBe(
      false,
    );
    expect(domains.some((domain) => domain.pluginId === 'getNode')).toBe(false);
    expect(domains.some((domain) => domain.pluginId === 'startTrace')).toBe(
      false,
    );
    expect(
      domains.some((domain) => domain.pluginId === 'takeHeapSnapshot'),
    ).toBe(false);
    expect(domains.some((domain) => domain.pluginId === 'startRecording')).toBe(
      false,
    );
    expect(domains.some((domain) => domain.pluginId === 'app')).toBe(true);
  });

  it('filters static domain tools by built-in tool names', () => {
    const consoleDomain = STATIC_DOMAINS.find(
      (domain) => domain.id === 'console',
    );
    const networkDomain = STATIC_DOMAINS.find(
      (domain) => domain.id === 'network',
    );

    expect(
      getDomainToolsByDefinition(
        [tool('getMessages'), tool('clearMessages'), tool('app.echo')],
        consoleDomain!,
      ).map((entry) => entry.name),
    ).toEqual(['getMessages', 'clearMessages']);

    expect(
      getDomainToolsByDefinition(
        [tool('startRecording'), tool('listRequests'), tool('app.echo')],
        networkDomain!,
      ).map((entry) => entry.name),
    ).toEqual(['startRecording', 'listRequests']);
  });

  it('filters plugin domain tools by plugin id', () => {
    const pluginDomain = buildRuntimePluginDomains([
      tool('@rozenite/mmkv-plugin.list-entries'),
      tool('app.echo'),
    ]).find((domain) => domain.pluginId === '@rozenite/mmkv-plugin');

    expect(
      getDomainToolsByDefinition(
        [tool('@rozenite/mmkv-plugin.list-entries'), tool('app.echo')],
        pluginDomain!,
      ).map((entry) => entry.name),
    ).toEqual(['@rozenite/mmkv-plugin.list-entries']);
  });

  it('resolves domain tools by full name or short name', () => {
    const tools = [
      tool('@rozenite/mmkv-plugin.list-entries'),
      tool('@rozenite/mmkv-plugin.remove-entry'),
    ];

    expect(
      resolveDomainTool(
        tools,
        '@rozenite/mmkv-plugin',
        '@rozenite/mmkv-plugin.list-entries',
      ).name,
    ).toBe('@rozenite/mmkv-plugin.list-entries');

    expect(
      resolveDomainTool(tools, '@rozenite/mmkv-plugin', 'remove-entry').name,
    ).toBe('@rozenite/mmkv-plugin.remove-entry');
  });

  it('throws precise errors for ambiguous or missing tools', () => {
    expect(() =>
      resolveDomainTool(
        [tool('app.alpha.echo'), tool('app.beta.echo')],
        'app',
        'echo',
      ),
    ).toThrow(
      'Ambiguous tool "echo" for domain "app". Matches: app.alpha.echo, app.beta.echo.',
    );

    expect(() =>
      resolveDomainTool([tool('app.echo')], 'app', 'missing'),
    ).toThrow(
      'Tool "missing" not found for domain "app". Available: app.echo. Hint: rozenite agent app tools',
    );
  });

  it('formats unknown-domain errors with ranked suggestions', () => {
    expect(
      formatUnknownDomainError('netw', [
        ...STATIC_DOMAINS,
        ...buildRuntimePluginDomains([
          tool('@rozenite/mmkv-plugin.list-entries'),
        ]),
      ]).message,
    ).toBe(
      'Unknown domain "netw". Did you mean: network? Run `rozenite agent domains` to list available domains.',
    );
  });

  it('projects helper output for domain tool and schema views', () => {
    const entry: AgentTool = {
      ...tool('@rozenite/mmkv-plugin.list-entries'),
      pagination: {
        kind: 'cursor',
        fields: ['key', 'type'],
        defaultFields: ['key'],
      },
    };

    expect(toAgentDomainTool(entry, 'mmkv')).toEqual({
      ...entry,
      shortName: 'list-entries',
      domainId: 'mmkv',
    });

    expect(toAgentToolSchema(entry)).toEqual({
      name: '@rozenite/mmkv-plugin.list-entries',
      shortName: 'list-entries',
      inputSchema: entry.inputSchema,
      pagination: entry.pagination,
    });
  });
});
