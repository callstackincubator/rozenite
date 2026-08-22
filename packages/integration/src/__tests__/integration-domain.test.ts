import { describe, it, expect, vi } from 'vitest';
import { createRozeniteIntegrationMessageHandlerFactory } from '../integration-domain.js';

const createConnection = () => ({
  page: { id: 'page-1' },
  device: { appId: 'com.example.app', id: 'device-1', name: 'Device', sendMessage: vi.fn() },
  debugger: { userAgent: null as string | null, sendMessage: vi.fn() },
});

describe('createRozeniteIntegrationMessageHandlerFactory', () => {
  it('answers Rozenite.getEnvironment and never forwards it to the device', () => {
    const connection = createConnection();
    const handler = createRozeniteIntegrationMessageHandlerFactory(
      'react-native',
      null,
    )(connection)!;

    const handled = handler.handleDebuggerMessage({ id: 7, method: 'Rozenite.getEnvironment' });

    expect(handled).toBe(true);
    expect(connection.debugger.sendMessage).toHaveBeenCalledWith({
      id: 7,
      result: { integration: 'react-native' },
    });
  });

  it('resolves react-native-web once the device has reported platform "web"', () => {
    const connection = createConnection();
    const handler = createRozeniteIntegrationMessageHandlerFactory(
      'react-native',
      null,
    )(connection)!;

    handler.handleDeviceMessage({
      method: 'ReactNativeApplication.metadataUpdated',
      params: { platform: 'web' },
    });
    handler.handleDebuggerMessage({ id: 1, method: 'Rozenite.getEnvironment' });

    expect(connection.debugger.sendMessage).toHaveBeenCalledWith({
      id: 1,
      result: { integration: 'react-native-web' },
    });
  });

  it('resolves react-native for platform "ios"', () => {
    const connection = createConnection();
    const handler = createRozeniteIntegrationMessageHandlerFactory(
      'react-native',
      null,
    )(connection)!;

    handler.handleDeviceMessage({
      method: 'ReactNativeApplication.metadataUpdated',
      params: { platform: 'ios' },
    });
    handler.handleDebuggerMessage({ id: 1, method: 'Rozenite.getEnvironment' });

    expect(connection.debugger.sendMessage).toHaveBeenCalledWith({
      id: 1,
      result: { integration: 'react-native' },
    });
  });

  it('resolves lynx / lynx-web for a lynx host', () => {
    const connection = createConnection();
    const handler = createRozeniteIntegrationMessageHandlerFactory('lynx', null)(connection)!;

    handler.handleDebuggerMessage({ id: 1, method: 'Rozenite.getEnvironment' });
    expect(connection.debugger.sendMessage).toHaveBeenLastCalledWith({
      id: 1,
      result: { integration: 'lynx' },
    });

    handler.handleDeviceMessage({
      method: 'ReactNativeApplication.metadataUpdated',
      params: { platform: 'web' },
    });
    handler.handleDebuggerMessage({ id: 2, method: 'Rozenite.getEnvironment' });
    expect(connection.debugger.sendMessage).toHaveBeenLastCalledWith({
      id: 2,
      result: { integration: 'lynx-web' },
    });
  });

  it('snoops metadata without consuming the message, and still calls the embedder device handler', () => {
    const connection = createConnection();
    const existing = { handleDeviceMessage: vi.fn(), handleDebuggerMessage: vi.fn() };
    const handler = createRozeniteIntegrationMessageHandlerFactory(
      'react-native',
      () => existing,
    )(connection)!;

    const message = {
      method: 'ReactNativeApplication.metadataUpdated',
      params: { platform: 'ios' },
    };
    const result = handler.handleDeviceMessage(message);

    // Not claimed - dev-middleware forwards it on to the debugger as usual.
    expect(result).toBeUndefined();
    expect(existing.handleDeviceMessage).toHaveBeenCalledWith(message);
  });

  it('still consults the embedder debugger handler for messages it does not own', () => {
    const connection = createConnection();
    const existing = {
      handleDeviceMessage: vi.fn(),
      handleDebuggerMessage: vi.fn((): true => true),
    };
    const handler = createRozeniteIntegrationMessageHandlerFactory(
      'react-native',
      () => existing,
    )(connection)!;

    const message = { id: 2, method: 'Network.enable' };
    const result = handler.handleDebuggerMessage(message);

    expect(result).toBe(true);
    expect(existing.handleDebuggerMessage).toHaveBeenCalledWith(message);
  });

  it('tolerates an embedder factory that returns null, e.g. Expo on an unsupported page', () => {
    const connection = createConnection();
    const handler = createRozeniteIntegrationMessageHandlerFactory(
      'react-native',
      () => null,
    )(connection)!;

    expect(() => handler.handleDebuggerMessage({ id: 1, method: 'Network.enable' })).not.toThrow();
    expect(handler.handleDebuggerMessage({ id: 1, method: 'Network.enable' })).toBeUndefined();
  });

  it('tolerates an undefined existing factory (no embedder handler configured at all)', () => {
    const connection = createConnection();
    const handler = createRozeniteIntegrationMessageHandlerFactory('lynx', undefined)(connection)!;

    expect(() => handler.handleDeviceMessage({ method: 'Anything' })).not.toThrow();
    expect(() => handler.handleDebuggerMessage({ id: 1, method: 'Network.enable' })).not.toThrow();
  });

  it('never throws on a malformed or non-JSON-object frame', () => {
    const connection = createConnection();
    const handler = createRozeniteIntegrationMessageHandlerFactory(
      'react-native',
      null,
    )(connection)!;

    for (const malformed of [null, undefined, 'a string', 42, [1, 2, 3], true]) {
      expect(() => handler.handleDeviceMessage(malformed)).not.toThrow();
      expect(() => handler.handleDebuggerMessage(malformed)).not.toThrow();
    }
  });

  it('never throws even when the embedder handler itself throws', () => {
    const connection = createConnection();
    const throwing = {
      handleDeviceMessage: vi.fn(() => {
        throw new Error('boom');
      }),
      handleDebuggerMessage: vi.fn(() => {
        throw new Error('boom');
      }),
    };
    const handler = createRozeniteIntegrationMessageHandlerFactory(
      'react-native',
      () => throwing,
    )(connection)!;

    expect(() => handler.handleDeviceMessage({ method: 'Anything' })).not.toThrow();
    expect(() => handler.handleDebuggerMessage({ id: 1, method: 'Network.enable' })).not.toThrow();
  });
});
