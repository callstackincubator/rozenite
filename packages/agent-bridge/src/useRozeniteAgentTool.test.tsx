// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';
import { defineAgentToolContract } from '@rozenite/agent-shared';
import type { AgentTool } from './types.js';
import {
  type UseRozeniteInAppAgentToolOptions,
  useRozeniteInAppAgentTool,
} from './useRozeniteAgentTool.js';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

type Listener = (payload: unknown) => void;

const mocks = vi.hoisted(() => {
  const listeners = new Map<string, Set<Listener>>();
  const send = vi.fn();
  const onMessage = vi.fn((type: string, listener: Listener) => {
    const typeListeners = listeners.get(type) ?? new Set<Listener>();
    typeListeners.add(listener);
    listeners.set(type, typeListeners);

    return {
      remove: () => {
        typeListeners.delete(listener);
      },
    };
  });
  const close = vi.fn();

  return {
    client: {
      send,
      onMessage,
      close,
    },
    emit: (type: string, payload: unknown) => {
      listeners.get(type)?.forEach((listener) => {
        listener(payload);
      });
    },
    reset: () => {
      listeners.clear();
      send.mockReset();
      onMessage.mockClear();
      close.mockReset();
    },
  };
});

vi.mock('@rozenite/plugin-bridge', () => ({
  useRozeniteDevToolsClient: () => mocks.client,
}));

const TOOL: AgentTool = {
  name: 'test-tool',
  description: 'Test tool',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

function TestComponent({ enabled = true }: { enabled?: boolean }) {
  useRozeniteInAppAgentTool({
    tool: TOOL,
    enabled,
    handler: async (args: unknown) => args,
  });

  return null;
}

const renderTool = async (
  enabled = true,
): Promise<{
  root: Root;
  container: HTMLDivElement;
}> => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<TestComponent enabled={enabled} />);
  });

  return { root, container };
};

const unmountTool = async (root: Root, container: HTMLDivElement) => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
};

describe('useRozeniteAgentTool', () => {
  beforeEach(() => {
    mocks.reset();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('supports typed contracts and explicit handler generics for plain tools', () => {
    const typedTool = defineAgentToolContract<
      { message: string },
      { echoed: string }
    >({
      ...TOOL,
      name: 'typed-tool',
    });
    const typedOptions: UseRozeniteInAppAgentToolOptions<typeof typedTool> = {
      tool: typedTool,
      handler: ({ message }) => ({
        echoed: message,
      }),
    };
    const plainOptions: UseRozeniteInAppAgentToolOptions<
      { min?: number; max?: number },
      { value: number }
    > = {
      tool: TOOL,
      handler: ({ min = 0, max = 100 }) => ({
        value: min + max,
      }),
    };

    expectTypeOf(typedOptions.handler).parameter(0).toEqualTypeOf<{
      message: string;
    }>();
    expectTypeOf(plainOptions.handler).parameter(0).toEqualTypeOf<{
      min?: number;
      max?: number;
    }>();
  });

  it('registers initially after listeners are attached', async () => {
    const { root, container } = await renderTool();

    expect(mocks.client.onMessage).toHaveBeenNthCalledWith(
      1,
      'tool-call',
      expect.any(Function),
    );
    expect(mocks.client.onMessage).toHaveBeenNthCalledWith(
      2,
      'agent-session-ready',
      expect.any(Function),
    );
    expect(mocks.client.send).toHaveBeenNthCalledWith(1, 'register-tool', {
      tools: [
        {
          ...TOOL,
          name: 'app.test-tool',
        },
      ],
    });

    await unmountTool(root, container);
  });

  it('replays register-tool when agent-session-ready arrives', async () => {
    const { root, container } = await renderTool();

    mocks.client.send.mockClear();

    await act(async () => {
      mocks.emit('agent-session-ready', { sessionId: 'device-1' });
    });

    expect(mocks.client.send).toHaveBeenCalledWith('register-tool', {
      tools: [
        {
          ...TOOL,
          name: 'app.test-tool',
        },
      ],
    });

    await unmountTool(root, container);
  });

  it('does not register or replay when disabled', async () => {
    const { root, container } = await renderTool(false);

    expect(mocks.client.send).not.toHaveBeenCalled();

    await act(async () => {
      mocks.emit('agent-session-ready', { sessionId: 'device-1' });
    });

    expect(mocks.client.send).not.toHaveBeenCalled();

    await unmountTool(root, container);
  });
});
