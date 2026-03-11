import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  composeInspectorHandlers,
  parseRozeniteBindingPayload,
} from '../dev-tools-url-patch.js';
import { logger } from '../logger.js';
import type { DevToolsPluginMessage } from '../agent/types.js';

const createBindingMessage = (payload: unknown) => ({
  method: 'Runtime.bindingCalled',
  params: {
    payload: JSON.stringify(payload),
  },
});

describe('dev tools Agent inspector handler composition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    logger.setLevel('info');
  });

  it('handles rozenite binding messages without requiring original handler', () => {
    const handleDeviceMessage = vi.fn();
    const captureConsoleMessage = vi.fn();
    const captureReactDevToolsMessage = vi.fn();
    const composed = composeInspectorHandlers(
      { handleDeviceMessage, captureConsoleMessage, captureReactDevToolsMessage },
      'device-1',
      undefined,
    );

    const result = composed.handleDeviceMessage?.(
      createBindingMessage({
        domain: 'rozenite',
        message: {
          pluginId: 'rozenite-agent',
          type: 'tool-result',
          payload: { callId: '123', success: true },
        } satisfies DevToolsPluginMessage,
      }),
    );

    expect(result).toBe(true);
    expect(handleDeviceMessage).toHaveBeenCalledTimes(1);
    expect(handleDeviceMessage).toHaveBeenCalledWith('device-1', {
      pluginId: 'rozenite-agent',
      type: 'tool-result',
      payload: { callId: '123', success: true },
    });
  });

  it('delegates non-rozenite messages to the original device handler', () => {
    const handleDeviceMessage = vi.fn();
    const captureConsoleMessage = vi.fn();
    const captureReactDevToolsMessage = vi.fn();
    const originalHandleDeviceMessage = vi.fn().mockReturnValue('delegated');

    const composed = composeInspectorHandlers(
      { handleDeviceMessage, captureConsoleMessage, captureReactDevToolsMessage },
      'device-1',
      { handleDeviceMessage: originalHandleDeviceMessage },
    );

    const nonRozeniteMessage = createBindingMessage({
      domain: 'other',
      message: { any: 'value' },
    });
    const result = composed.handleDeviceMessage?.(nonRozeniteMessage);

    expect(result).toBe('delegated');
    expect(handleDeviceMessage).not.toHaveBeenCalled();
    expect(originalHandleDeviceMessage).toHaveBeenCalledWith(nonRozeniteMessage);
  });

  it('delegates debugger messages to the original handler', () => {
    const handleDeviceMessage = vi.fn();
    const captureConsoleMessage = vi.fn();
    const captureReactDevToolsMessage = vi.fn();
    const originalHandleDebuggerMessage = vi.fn().mockReturnValue('debugger-result');

    const composed = composeInspectorHandlers(
      { handleDeviceMessage, captureConsoleMessage, captureReactDevToolsMessage },
      'device-1',
      { handleDebuggerMessage: originalHandleDebuggerMessage },
    );
    const debuggerMessage = { method: 'Debugger.paused' };
    const result = composed.handleDebuggerMessage?.(debuggerMessage);

    expect(result).toBe('debugger-result');
    expect(originalHandleDebuggerMessage).toHaveBeenCalledWith(debuggerMessage);
  });

  it('logs metadata only and does not print full payload contents', () => {
    logger.setLevel('debug');
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handleDeviceMessage = vi.fn();
    const captureConsoleMessage = vi.fn();
    const captureReactDevToolsMessage = vi.fn();
    const composed = composeInspectorHandlers(
      { handleDeviceMessage, captureConsoleMessage, captureReactDevToolsMessage },
      'device-1',
      undefined,
    );

    composed.handleDeviceMessage?.(
      createBindingMessage({
        domain: 'rozenite',
        message: {
          pluginId: 'rozenite-agent',
          type: 'tool-call',
          payload: { toolName: 'secret-tool', callId: 'abc', secret: 'sensitive' },
        },
      }),
    );

    const emittedLogs = consoleLog.mock.calls
      .flatMap((call) => call.map((arg) => String(arg)))
      .join('\n');

    expect(emittedLogs).toContain('direction=device_to_node');
    expect(emittedLogs).toContain('tool=secret-tool');
    expect(emittedLogs).toContain('callId=abc');
    expect(emittedLogs).not.toContain('"secret":"sensitive"');
  });

  it('captures react-devtools domain messages for local ingestion', () => {
    const handleDeviceMessage = vi.fn();
    const captureConsoleMessage = vi.fn();
    const captureReactDevToolsMessage = vi.fn();
    const originalHandleDeviceMessage = vi.fn().mockReturnValue('delegated');

    const composed = composeInspectorHandlers(
      { handleDeviceMessage, captureConsoleMessage, captureReactDevToolsMessage },
      'device-react',
      { handleDeviceMessage: originalHandleDeviceMessage },
    );

    const reactDevToolsMessage = createBindingMessage({
      domain: 'react-devtools',
      message: { event: 'tree-sync', payload: { roots: [], nodes: [] } },
    });

    const result = composed.handleDeviceMessage?.(reactDevToolsMessage);

    expect(result).toBe('delegated');
    expect(captureReactDevToolsMessage).toHaveBeenCalledWith(
      'device-react',
      { event: 'tree-sync', payload: { roots: [], nodes: [] } },
    );
  });
});

describe('parseRozeniteBindingPayload', () => {
  it('returns null for malformed payload JSON', () => {
    const malformed = {
      method: 'Runtime.bindingCalled',
      params: {
        payload: '{"domain":"rozenite"',
      },
    };

    expect(parseRozeniteBindingPayload(malformed)).toBeNull();
  });
});
