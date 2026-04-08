import { Alert } from 'react-native';
import { useRozeniteInAppAgentTool, type AgentTool } from '@rozenite/agent-bridge';

type ShowAlertInput = {
  title?: string;
  message?: string;
};

type RandomNumberInput = {
  min?: number;
  max?: number;
};

const showAlertTool: AgentTool = {
  name: 'show-alert',
  description: 'Show a native alert in the playground app.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Alert title. Defaults to "Agent Playground".',
      },
      message: {
        type: 'string',
        description: 'Alert body text.',
      },
    },
  },
};

const randomNumberTool: AgentTool = {
  name: 'random-number',
  description: 'Return a random number in the optional [min, max] range.',
  inputSchema: {
    type: 'object',
    properties: {
      min: {
        type: 'number',
        description: 'Minimum value (inclusive). Defaults to 0.',
      },
      max: {
        type: 'number',
        description: 'Maximum value (inclusive). Defaults to 100.',
      },
    },
  },
};

const echoPayloadTool: AgentTool = {
  name: 'echo-payload',
  description: 'Echo back payload for quick tool call smoke tests.',
  inputSchema: {
    type: 'object',
    properties: {
      payload: {
        description: 'Any JSON payload to be echoed back.',
      },
    },
  },
};

export const useAgentPlaygroundTools = () => {
  useRozeniteInAppAgentTool<ShowAlertInput>({
    tool: showAlertTool,
    handler: ({ title, message }) => {
      Alert.alert(title || 'Agent Playground', message || 'Alert from Agent tool.');

      return {
        ok: true,
      };
    },
  });

  useRozeniteInAppAgentTool<RandomNumberInput>({
    tool: randomNumberTool,
    handler: ({ min = 0, max = 100 }) => {
      const safeMin = Number.isFinite(min) ? min : 0;
      const safeMax = Number.isFinite(max) ? max : 100;
      const [from, to] =
        safeMin <= safeMax ? [safeMin, safeMax] : [safeMax, safeMin];
      const random = Math.random() * (to - from) + from;

      return {
        min: from,
        max: to,
        value: random,
      };
    },
  });

  useRozeniteInAppAgentTool<{ payload?: unknown }>({
    tool: echoPayloadTool,
    handler: ({ payload }) => {
      return {
        echoed: payload ?? null,
      };
    },
  });
};
