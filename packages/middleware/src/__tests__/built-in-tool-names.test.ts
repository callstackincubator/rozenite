import { BUILT_IN_DOMAIN_TOOL_NAMES } from '@rozenite/agent-shared';
import { describe, expect, it } from 'vitest';
import {
  createMemoryDomainService,
  createNetworkDomainService,
  createPerformanceDomainService,
  createReactDomainService,
} from '../agent/local-domains.js';
import { createAgentMessageHandler } from '../agent/runtime/handler.js';

const unused = (): never => {
  throw new Error('not expected to be called while listing tools');
};

const sorted = (names: readonly string[]): string[] => [...names].sort();

describe('built-in domain tool names', () => {
  const exposed: Record<string, string[]> = {
    performance: createPerformanceDomainService({
      getSessionInfo: unused,
      sendCommand: unused,
      subscribeToCDPEvent: unused,
      createArtifactWriter: unused,
    })
      .getTools()
      .map((tool) => tool.name),
    react: createReactDomainService({
      sessionId: 'session',
      sendReactDevToolsMessage: unused,
    })
      .getTools()
      .map((tool) => tool.name),
    memory: createMemoryDomainService({
      getSessionInfo: unused,
      sendCommand: unused,
      subscribeToCDPEvent: unused,
      createArtifactWriter: unused,
    })
      .getTools()
      .map((tool) => tool.name),
    network: createNetworkDomainService({
      getSessionInfo: unused,
      sendCommand: unused,
      subscribeToCDPEvent: unused,
    })
      .getTools()
      .map((tool) => tool.name),
    console: (() => {
      const handler = createAgentMessageHandler();
      handler.connectDevice('device-1', 'iPhone', { sendMessage() {} });
      return handler.getTools('device-1').map((tool) => tool.name);
    })(),
  };

  it('covers every built-in domain', () => {
    expect(sorted(Object.keys(exposed))).toEqual(sorted(Object.keys(BUILT_IN_DOMAIN_TOOL_NAMES)));
  });

  for (const [domain, names] of Object.entries(BUILT_IN_DOMAIN_TOOL_NAMES)) {
    it(`exposes exactly the shared ${domain} tool names`, () => {
      expect(sorted(exposed[domain])).toEqual(sorted(names));
    });
  }
});
