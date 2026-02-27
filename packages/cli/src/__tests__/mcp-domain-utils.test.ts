import { describe, it, expect } from 'vitest';
import type { MCPTool } from '../commands/mcp/types.js';
import {
  encodePluginDomainSlug,
  buildRuntimePluginDomains,
  resolveDomainToken,
} from '../commands/mcp/domain-utils.js';

const tool = (name: string): MCPTool => ({
  name,
  description: `${name} description`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
});

describe('MCP domain utils', () => {
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
});
