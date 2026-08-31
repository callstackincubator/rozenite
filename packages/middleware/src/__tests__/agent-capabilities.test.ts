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
  createReactDomainService,
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

const createReactService = (): LocalAgentToolService =>
  createReactDomainService({
    sessionId: 's',
    sendReactDevToolsMessage: () => {},
  });

/**
 * The dispatch `session.ts` performs: offer the call to each service in
 * turn and take the first answer that is not `undefined`.
 */
const dispatch = async (
  services: LocalAgentToolService[],
  toolName: string,
): Promise<unknown | undefined> => {
  for (const service of services) {
    const result = await service.callTool(toolName, {});
    if (result !== undefined) {
      return result;
    }
  }

  return undefined;
};

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

  // A wrapped service is still asked about tools belonging to other
  // domains, because that is how the session finds the owner. Answering
  // anything but `undefined` there claims a tool it does not own.
  it('declines a tool it does not declare instead of claiming it', async () => {
    const filtered = withCapabilityFilter(createReactService(), LYNX_PROFILE);

    await expect(filtered.callTool('takeHeapSnapshot', {})).resolves.toBeUndefined();
  });

  // The regression this guards: React is first in `localServices`, and on
  // Lynx it keeps no tools at all. A wrapper that threw for every unknown
  // name aborted the walk on its first step, so every call on a Lynx
  // target failed -- reporting React's reason whatever domain was asked
  // for.
  it('lets the dispatch walk reach a later service on a fully unsupported first domain', async () => {
    const services = [
      withCapabilityFilter(createReactService(), LYNX_PROFILE),
      withCapabilityFilter(createMemoryService(), LYNX_PROFILE),
    ];

    expect(services[0].getTools()).toEqual([]);
    await expect(dispatch(services, 'startSampling')).rejects.toThrow(/PrimJS/);
  });
});
