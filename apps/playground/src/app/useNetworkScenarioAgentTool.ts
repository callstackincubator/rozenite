import { useRozeniteInAppAgentTool, type AgentTool } from '@rozenite/agent-bridge';
import {
  ALL_SCENARIO_NAMES,
  NETWORK_SCENARIO_TOOL_NAME,
  isScenarioName,
  type NetworkScenarioResult,
} from './utils/network-activity/e2e-scenario-contract';
import { runNetworkScenario } from './utils/network-activity/e2e-scenarios';

type RunNetworkScenarioInput = {
  scenario?: unknown;
  baseUrl?: unknown;
};

const runNetworkScenarioTool: AgentTool = {
  name: NETWORK_SCENARIO_TOOL_NAME,
  description:
    'Run one Network Activity regression scenario against the e2e fixture server and return what the app observed. Used by apps/playground/e2e/network-activity.',
  inputSchema: {
    type: 'object',
    properties: {
      scenario: {
        type: 'string',
        enum: [...ALL_SCENARIO_NAMES],
        description: 'Scenario name.',
      },
      baseUrl: {
        type: 'string',
        description: 'Fixture server origin as reachable from the device.',
      },
    },
    required: ['scenario', 'baseUrl'],
  },
};

/**
 * Registers `app.run-network-scenario`, the entry point of the on-device
 * Network Activity harness (docs/adr/0002-network-activity-on-device-regression-harness.md).
 */
export const useNetworkScenarioAgentTool = () => {
  useRozeniteInAppAgentTool<RunNetworkScenarioInput, NetworkScenarioResult>({
    tool: runNetworkScenarioTool,
    handler: async ({ scenario, baseUrl } = {}) => {
      if (!isScenarioName(scenario)) {
        throw new Error(
          `Unknown scenario "${String(scenario)}". Expected one of: ${ALL_SCENARIO_NAMES.join(', ')}`,
        );
      }

      if (typeof baseUrl !== 'string' || !/^https?:\/\//.test(baseUrl)) {
        throw new Error('"baseUrl" must be an http(s) origin, e.g. http://localhost:38383');
      }

      return runNetworkScenario(scenario, baseUrl);
    },
  });
};
