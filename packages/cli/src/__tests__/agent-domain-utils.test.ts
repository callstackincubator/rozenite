import { describe, it, expect } from 'vitest';
import type { AgentTool } from '../commands/agent/types.js';
import {
  encodePluginDomainSlug,
  buildRuntimePluginDomains,
  resolveDomainToken,
} from '../commands/agent/domain-utils.js';

const tool = (name: string): AgentTool => ({
  name,
  description: `${name} description`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
});

describe('Agent domain utils', () => {
  it('encodes plugin ids into safe domain slugs', () => {
    expect(encodePluginDomainSlug('@rozenite/mmkv-plugin')).toBe(
      'at-rozenite__mmkv-plugin',
    );
    expect(encodePluginDomainSlug('my plugin/id')).toBe('my-plugin__id');
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

    const byId = resolveDomainToken(domains[0].id, domains);
    const byPluginId = resolveDomainToken('@rozenite/mmkv-plugin', domains);

    expect(byId?.pluginId).toBe('@rozenite/mmkv-plugin');
    expect(byPluginId?.id).toBe(domains[0].id);
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
      tool('Console.getMessages'),
      tool('React.getNode'),
      tool('startTrace'),
      tool('takeHeapSnapshot'),
      tool('startRecording'),
      tool('app.echo'),
    ]);

    expect(domains.some((domain) => domain.pluginId === 'Console')).toBe(false);
    expect(domains.some((domain) => domain.pluginId === 'React')).toBe(false);
    expect(domains.some((domain) => domain.pluginId === 'startTrace')).toBe(false);
    expect(domains.some((domain) => domain.pluginId === 'takeHeapSnapshot')).toBe(false);
    expect(domains.some((domain) => domain.pluginId === 'startRecording')).toBe(false);
    expect(domains.some((domain) => domain.pluginId === 'app')).toBe(true);
  });
});
