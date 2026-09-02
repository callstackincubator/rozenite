import { describe, expect, it } from 'vitest';
import type { DeviceFrame } from '../../types.js';
import { translateDeviceFrame } from '../translate-device-frame.js';

describe('translateDeviceFrame', () => {
  describe('cdp frames', () => {
    it('forwards a response verbatim', () => {
      const message = { id: 3, result: { value: true } };
      const frame: DeviceFrame = { kind: 'cdp', clientId: 1, sessionId: 1, message };
      expect(translateDeviceFrame(frame)).toEqual({ kind: 'send', message });
    });

    it('forwards an event verbatim', () => {
      const message = { method: 'Runtime.executionContextCreated', params: { context: { id: 1 } } };
      const frame: DeviceFrame = { kind: 'cdp', clientId: 1, sessionId: 1, message };
      expect(translateDeviceFrame(frame)).toEqual({ kind: 'send', message });
    });
  });

  describe('Runtime.executionContextCreated background-context rename', () => {
    const eventWithContextName = (name: unknown) => ({
      method: 'Runtime.executionContextCreated',
      params: { context: { id: 7, name, origin: '', uniqueId: 'abc' } },
    });

    it('renames a "Background:<group_id>" context to "main", id and other fields intact', () => {
      const message = eventWithContextName('Background:1');
      const frame: DeviceFrame = { kind: 'cdp', clientId: 1, sessionId: 1, message };
      expect(translateDeviceFrame(frame)).toEqual({
        kind: 'send',
        message: {
          method: 'Runtime.executionContextCreated',
          params: { context: { id: 7, name: 'main', origin: '', uniqueId: 'abc' } },
        },
      });
    });

    it('does not rename a Lepus "Main" context', () => {
      const message = eventWithContextName('Main');
      const frame: DeviceFrame = { kind: 'cdp', clientId: 1, sessionId: 1, message };
      expect(translateDeviceFrame(frame)).toEqual({ kind: 'send', message });
    });

    it('does not rename a Lepus "Main:<name>" context', () => {
      const message = eventWithContextName('Main:card');
      const frame: DeviceFrame = { kind: 'cdp', clientId: 1, sessionId: 1, message };
      expect(translateDeviceFrame(frame)).toEqual({ kind: 'send', message });
    });

    it('passes a context already named "main" through unchanged', () => {
      const message = eventWithContextName('main');
      const frame: DeviceFrame = { kind: 'cdp', clientId: 1, sessionId: 1, message };
      expect(translateDeviceFrame(frame)).toEqual({ kind: 'send', message });
    });

    it('leaves an unrelated CDP event unaffected', () => {
      const message = {
        method: 'Runtime.executionContextDestroyed',
        params: { executionContextId: 7 },
      };
      const frame: DeviceFrame = { kind: 'cdp', clientId: 1, sessionId: 1, message };
      expect(translateDeviceFrame(frame)).toEqual({ kind: 'send', message });
    });

    it('forwards untouched when params is missing or not an object', () => {
      for (const params of [undefined, null, 'nope', 5, []]) {
        const message = { method: 'Runtime.executionContextCreated', params };
        const frame: DeviceFrame = { kind: 'cdp', clientId: 1, sessionId: 1, message };
        expect(translateDeviceFrame(frame)).toEqual({ kind: 'send', message });
      }
    });

    it('forwards untouched when context is missing or not an object', () => {
      for (const context of [undefined, null, 'nope', 5, []]) {
        const message = { method: 'Runtime.executionContextCreated', params: { context } };
        const frame: DeviceFrame = { kind: 'cdp', clientId: 1, sessionId: 1, message };
        expect(translateDeviceFrame(frame)).toEqual({ kind: 'send', message });
      }
    });

    it('forwards untouched when name is missing or not a string', () => {
      for (const name of [undefined, null, 1, {}, []]) {
        const message = eventWithContextName(name);
        const frame: DeviceFrame = { kind: 'cdp', clientId: 1, sessionId: 1, message };
        expect(translateDeviceFrame(frame)).toEqual({ kind: 'send', message });
      }
    });

    it('never throws on any of these malformed shapes', () => {
      const malformedMessages = [
        { method: 'Runtime.executionContextCreated' },
        { method: 'Runtime.executionContextCreated', params: null },
        { method: 'Runtime.executionContextCreated', params: { context: null } },
        { method: 'Runtime.executionContextCreated', params: { context: { name: 42 } } },
      ];
      for (const message of malformedMessages) {
        const frame: DeviceFrame = { kind: 'cdp', clientId: 1, sessionId: 1, message };
        expect(() => translateDeviceFrame(frame)).not.toThrow();
      }
    });
  });

  describe('Lynx.onVMEvent (how a real device delivers the devtool channel)', () => {
    // Verified on LynxExplorer/iOS (Lynx engine 4.0, PrimJS): a device-side
    // `lynx.getDevtool().dispatchEvent({ type: 'rozenite', data })` arrives
    // as this CDP event, NOT as a `Customized` frame of type `rozenite`.
    const vmEvent = (event: unknown, data: unknown) => ({
      method: 'Lynx.onVMEvent',
      params: { event, vmType: 'JSContext', data },
    });

    const payload = JSON.stringify({
      domain: 'rozenite',
      message: { pluginId: 'demo-plugin', type: 'pong', payload: { ok: true } },
    });

    it('translates a rozenite VM event into Runtime.bindingCalled', () => {
      const frame: DeviceFrame = {
        kind: 'cdp',
        clientId: 1,
        sessionId: 2,
        message: vmEvent('rozenite', payload),
      };

      expect(translateDeviceFrame(frame)).toEqual({
        kind: 'send',
        message: {
          method: 'Runtime.bindingCalled',
          params: {
            name: '__CHROME_DEVTOOLS_FRONTEND_BINDING__',
            executionContextId: 0,
            payload,
          },
        },
      });
    });

    it('passes the payload string through byte-for-byte', () => {
      const oddlyOrdered = '{"message":{"type":"pong"},"domain":"rozenite"}';
      const frame: DeviceFrame = {
        kind: 'cdp',
        clientId: 1,
        sessionId: 2,
        message: vmEvent('rozenite', oddlyOrdered),
      };

      const action = translateDeviceFrame(frame);
      expect(action).toMatchObject({ kind: 'send' });
      expect((action as { message: { params: { payload: string } } }).message.params.payload).toBe(
        oddlyOrdered,
      );
    });

    it('forwards a VM event for another channel untouched', () => {
      const message = vmEvent('preact-devtools', payload);
      const frame: DeviceFrame = { kind: 'cdp', clientId: 1, sessionId: 2, message };
      expect(translateDeviceFrame(frame)).toEqual({ kind: 'send', message });
    });

    it('forwards a rozenite VM event with a non-string data field untouched', () => {
      const message = vmEvent('rozenite', { not: 'a string' });
      const frame: DeviceFrame = { kind: 'cdp', clientId: 1, sessionId: 2, message };
      expect(translateDeviceFrame(frame)).toEqual({ kind: 'send', message });
    });

    it('forwards a Lynx.onVMEvent with no params untouched', () => {
      const message = { method: 'Lynx.onVMEvent' };
      const frame: DeviceFrame = { kind: 'cdp', clientId: 1, sessionId: 2, message };
      expect(translateDeviceFrame(frame)).toEqual({ kind: 'send', message });
    });
  });

  describe('customized "rozenite" frames', () => {
    it('rewrites into a Runtime.bindingCalled event carrying the payload verbatim', () => {
      const frame: DeviceFrame = {
        kind: 'customized',
        clientId: 1,
        sessionId: 2,
        type: 'rozenite',
        data: '{"domain":"rozenite","message":{"foo":"bar"}}',
      };
      const action = translateDeviceFrame(frame);
      expect(action).toEqual({
        kind: 'send',
        message: {
          method: 'Runtime.bindingCalled',
          params: {
            name: '__CHROME_DEVTOOLS_FRONTEND_BINDING__',
            executionContextId: expect.any(Number),
            payload: '{"domain":"rozenite","message":{"foo":"bar"}}',
          },
        },
      });
    });

    it('passes an unusually formatted payload string through byte-identical', () => {
      // Deliberately odd whitespace and key order: proves the bridge does
      // not parse-and-restringify, which would silently normalise both.
      const oddPayload = '{ "message" :{"b":2,"a":1}  ,"domain":"rozenite"   }';
      const frame: DeviceFrame = {
        kind: 'customized',
        clientId: 1,
        sessionId: 2,
        type: 'rozenite',
        data: oddPayload,
      };
      const action = translateDeviceFrame(frame);
      if (action.kind !== 'send') {
        throw new Error('expected a send action');
      }
      const message = action.message as { params: { payload: string } };
      expect(message.params.payload).toBe(oddPayload);
      // Byte-for-byte, not just deep-equal after reparsing.
      expect(message.params.payload.length).toBe(oddPayload.length);
    });

    it('drops a rozenite frame whose data is not a string', () => {
      const frame: DeviceFrame = {
        kind: 'customized',
        clientId: 1,
        sessionId: 2,
        type: 'rozenite',
        data: { not: 'a string' },
      };
      expect(translateDeviceFrame(frame).kind).toBe('drop');
    });
  });

  describe('other customized types', () => {
    it('drops a non-rozenite customized frame', () => {
      const frame: DeviceFrame = {
        kind: 'customized',
        clientId: 1,
        sessionId: 2,
        type: 'react-devtools',
        data: 'irrelevant',
      };
      const action = translateDeviceFrame(frame);
      expect(action.kind).toBe('drop');
    });
  });

  describe('malformed input', () => {
    it('drops null', () => {
      expect(translateDeviceFrame(null as unknown as DeviceFrame).kind).toBe('drop');
    });

    it('drops a non-object', () => {
      expect(translateDeviceFrame('nope' as unknown as DeviceFrame).kind).toBe('drop');
    });

    it('drops an array', () => {
      expect(translateDeviceFrame([] as unknown as DeviceFrame).kind).toBe('drop');
    });

    it('drops a frame with an unrecognized kind', () => {
      const frame = { kind: 'unknown-kind', clientId: 1, sessionId: 1 } as unknown as DeviceFrame;
      expect(translateDeviceFrame(frame).kind).toBe('drop');
    });

    it('never throws on malformed input', () => {
      const inputs: unknown[] = [null, undefined, 'nope', 42, [], {}, { kind: 'cdp' }];
      for (const input of inputs) {
        expect(() => translateDeviceFrame(input as DeviceFrame)).not.toThrow();
      }
    });
  });
});
