import { describe, expect, it } from 'vitest';
import type { AgentTool } from '@rozenite/agent-shared';
import {
  buildRuntimePluginDomains,
  encodePluginDomainSlug,
  formatUnknownDomainError,
  getDomainToolsByDefinition,
  inferPluginId,
  inferToolShortName,
  resolveDomainToken,
  resolveDomainTool,
  toAgentDomainTool,
  toAgentToolSchema,
} from '../domain-utils.js';
import { STATIC_DOMAINS } from '../constants.js';

const tool = (name: string): AgentTool => ({
  name,
  description: `${name} description`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
});

describe('agent domain utils', () => {
  it('encodes plugin ids into safe domain slugs', () => {
    expect(encodePluginDomainSlug('@rozenite/mmkv-plugin')).toBe(
      'at-rozenite__mmkv-plugin',
    );
    expect(encodePluginDomainSlug('my plugin/id')).toBe('my-plugin__id');
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

  it('builds dynamic plugin domains and resolves collisions deterministically', () => {
    const domains = buildRuntimePluginDomains([
      tool('@a/b.list'),
      tool('at-a__b.list'),
    ]);

    const ids = domains.map((domain) => domain.id);
    expect(ids[0]).toMatch(/^at-a__b--[a-f0-9]{8}$/);
    expect(ids[1]).toMatch(/^at-a__b--[a-f0-9]{8}$/);
    expect(new Set(ids).size).toBe(2);
    expect(domains.every((domain) => domain.kind === 'plugin')).toBe(true);
    expect(domains.every((domain) => domain.actions.length === 3)).toBe(true);
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

  it('uses origin-aware descriptions for plugin and app domains', () => {
    const domains = buildRuntimePluginDomains([
      tool('app.list-entries'),
      tool('@rozenite/mmkv-plugin.list-entries'),
    ]);

    const appDomain = domains.find((domain) => domain.pluginId === 'app');
    const pluginDomain = domains.find(
      (domain) => domain.pluginId === '@rozenite/mmkv-plugin',
    );

    expect(appDomain?.description).toBe('Runtime tools exposed by the app itself.');
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

    expect(domains.some((domain) => domain.pluginId === 'getMessages')).toBe(false);
    expect(domains.some((domain) => domain.pluginId === 'getNode')).toBe(false);
    expect(domains.some((domain) => domain.pluginId === 'startTrace')).toBe(false);
    expect(domains.some((domain) => domain.pluginId === 'takeHeapSnapshot')).toBe(false);
    expect(domains.some((domain) => domain.pluginId === 'startRecording')).toBe(false);
    expect(domains.some((domain) => domain.pluginId === 'app')).toBe(true);
  });

  it('filters static domain tools by built-in tool names', () => {
    const consoleDomain = STATIC_DOMAINS.find((domain) => domain.id === 'console');
    const networkDomain = STATIC_DOMAINS.find((domain) => domain.id === 'network');

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
        ...buildRuntimePluginDomains([tool('@rozenite/mmkv-plugin.list-entries')]),
      ]).message,
    ).toBe(
      'Unknown domain "netw". Did you mean: network? Run `rozenite agent domains` to list available domains.',
    );
  });

  it('projects helper output for domain tool and schema views', () => {
    const entry = tool('@rozenite/mmkv-plugin.list-entries');

    expect(toAgentDomainTool(entry)).toEqual({
      ...entry,
      shortName: 'list-entries',
    });

    expect(toAgentToolSchema(entry)).toEqual({
      name: '@rozenite/mmkv-plugin.list-entries',
      shortName: 'list-entries',
      inputSchema: entry.inputSchema,
    });
  });
});
