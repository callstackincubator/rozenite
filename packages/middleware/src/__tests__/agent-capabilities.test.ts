import { describe, expect, it } from 'vitest';
import { getUnsupportedDomains, isToolSupported } from '@rozenite/agent-shared';
import {
  LYNX_PROFILE,
  REACT_NATIVE_PROFILE,
  resolveCapabilityProfile,
} from '../agent/capability-profiles.js';
import { UnsupportedToolError, withCapabilityFilter } from '../agent/capability-filter.js';
import {
  createMemoryDomainService,
  createNetworkDomainService,
  type LocalAgentToolService,
} from '../agent/local-domains.js';

const artifactWriter = async () => ({
  path: '/tmp/artifact',
  write: async () => {},
  finalize: async () => ({
    path: '/tmp/artifact',
    relativePath: 'artifact',
    bytes: 0,
    bucket: 'profiles' as const,
    fileName: 'artifact',
  }),
  abort: async () => {},
});

const createMemoryService = (): LocalAgentToolService =>
  createMemoryDomainService({
    getSessionInfo: () => ({ sessionId: 's', pageId: 'p', deviceId: 'd' }),
    sendCommand: async () => ({}),
    subscribeToCDPEvent: () => () => {},
    createArtifactWriter: artifactWriter,
  });

const createNetworkService = (): LocalAgentToolService =>
  createNetworkDomainService({
    getSessionInfo: () => ({ sessionId: 's', pageId: 'p', deviceId: 'd' }),
    sendCommand: async () => ({}),
    subscribeToCDPEvent: () => () => {},
  });

describe('capability profiles', () => {
  it('leaves React Native declaring no gaps', () => {
    expect(resolveCapabilityProfile('react-native')).toBe(REACT_NATIVE_PROFILE);
    expect(getUnsupportedDomains(REACT_NATIVE_PROFILE)).toEqual([]);
    expect(isToolSupported(REACT_NATIVE_PROFILE, 'network', 'listRequests')).toBe(true);
  });

  // The main long-term risk of a static table is drifting out of step
  // with the tools it describes, which would silently stop filtering.
  it('names only tools the services actually expose', () => {
    const toolsByDomain = new Map<string, Set<string>>([
      [
        'memory',
        new Set(
          createMemoryService()
            .getTools()
            .map((tool) => tool.name),
        ),
      ],
      [
        'network',
        new Set(
          createNetworkService()
            .getTools()
            .map((tool) => tool.name),
        ),
      ],
    ]);

    for (const [domainId, capability] of Object.entries(LYNX_PROFILE.domains)) {
      const known = toolsByDomain.get(domainId);
      if (!known) {
        continue;
      }

      for (const toolName of Object.keys(capability.tools ?? {})) {
        expect(known, `${domainId}.${toolName}`).toContain(toolName);
      }
    }
  });

  it('reports whole-domain and tool-level gaps differently', () => {
    const gaps = getUnsupportedDomains(LYNX_PROFILE);
    const network = gaps.find((gap) => gap.domain === 'network');
    const memory = gaps.find((gap) => gap.domain === 'memory');

    expect(network?.tools).toBeUndefined();
    expect(network?.fallback).toBe('@rozenite/network-activity-plugin');
    expect(memory?.tools?.map((tool) => tool.name)).toEqual(['startSampling', 'stopSampling']);
  });

  // Each tool carries its own reason rather than the domain borrowing
  // one of them, so a domain with two unrelated gaps explains each.
  it('carries a reason on every tool-level gap', () => {
    const memory = getUnsupportedDomains(LYNX_PROFILE).find((gap) => gap.domain === 'memory');

    expect(memory?.tools?.every((tool) => Boolean(tool.reason))).toBe(true);
    expect(memory?.reason).toBe('Not supported on lynx targets.');
  });

  // A web target is a browser, which backs Chrome's CDP surface in full.
  // The Lynx gaps below are PrimJS's, and PrimJS is not what runs there.
  it('gives the web integrations an empty profile, Lynx included', () => {
    expect(getUnsupportedDomains(resolveCapabilityProfile('lynx-web'))).toEqual([]);
    expect(getUnsupportedDomains(resolveCapabilityProfile('react-native-web'))).toEqual([]);
    expect(isToolSupported(resolveCapabilityProfile('lynx-web'), 'network', 'listRequests')).toBe(
      true,
    );
  });
});

describe('capability filtering', () => {
  it("drops an unsupported domain's tools from a Lynx session", () => {
    const filtered = withCapabilityFilter(createNetworkService(), LYNX_PROFILE);

    expect(filtered.getTools()).toEqual([]);
  });

  it('keeps the supported half of a degraded domain', () => {
    const filtered = withCapabilityFilter(createMemoryService(), LYNX_PROFILE);
    const names = filtered.getTools().map((tool) => tool.name);

    expect(names).toContain('takeHeapSnapshot');
    expect(names).not.toContain('startSampling');
    expect(names).not.toContain('stopSampling');
  });

  it('explains a filtered tool called by exact name rather than running it', async () => {
    const filtered = withCapabilityFilter(createMemoryService(), LYNX_PROFILE);

    await expect(filtered.callTool('startSampling', {})).rejects.toBeInstanceOf(
      UnsupportedToolError,
    );
    await expect(filtered.callTool('startSampling', {})).rejects.toThrow(/PrimJS/);
  });

  it('hands back the original service when nothing is filtered', () => {
    const service = createNetworkService();

    expect(withCapabilityFilter(service, REACT_NATIVE_PROFILE)).toBe(service);
  });
});
