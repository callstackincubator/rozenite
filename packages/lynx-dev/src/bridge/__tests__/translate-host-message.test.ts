import { describe, expect, it } from 'vitest';
import { translateHostMessage } from '../translate-host-message.js';

describe('translateHostMessage', () => {
  describe('Runtime.addBinding', () => {
    it('replies locally with the empty result and never forwards', () => {
      const action = translateHostMessage(
        JSON.stringify({ id: 7, method: 'Runtime.addBinding', params: { name: 'anything' } }),
      );
      expect(action).toEqual({ kind: 'reply', message: { id: 7, result: {} } });
    });

    it('carries the host id, not any other value', () => {
      const action = translateHostMessage(JSON.stringify({ id: 42, method: 'Runtime.addBinding' }));
      expect(action).toEqual({ kind: 'reply', message: { id: 42, result: {} } });
    });
  });

  describe('ReactNativeApplication.enable', () => {
    it('replies locally with the empty result and never forwards', () => {
      const action = translateHostMessage(
        JSON.stringify({ id: 1, method: 'ReactNativeApplication.enable' }),
      );
      expect(action).toEqual({ kind: 'reply', message: { id: 1, result: {} } });
    });
  });

  describe('everything else', () => {
    it('forwards Runtime.enable verbatim, host id preserved', () => {
      const action = translateHostMessage(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
      expect(action).toEqual({ kind: 'forward', message: { id: 2, method: 'Runtime.enable' } });
    });

    it('forwards Runtime.evaluate with its params untouched', () => {
      const message = {
        id: 3,
        method: 'Runtime.evaluate',
        params: { expression: 'globalThis.__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__ != undefined' },
      };
      const action = translateHostMessage(JSON.stringify(message));
      expect(action).toEqual({ kind: 'forward', message });
    });

    it('forwards an arbitrary unrecognized method the same way', () => {
      const message = { id: 99, method: 'Network.enable' };
      const action = translateHostMessage(JSON.stringify(message));
      expect(action).toEqual({ kind: 'forward', message });
    });
  });

  describe('malformed input', () => {
    it('drops a non-JSON string', () => {
      const action = translateHostMessage('not json{{{');
      expect(action.kind).toBe('drop');
    });

    it('drops a JSON string that is not an object (number)', () => {
      const action = translateHostMessage('5');
      expect(action.kind).toBe('drop');
    });

    it('drops a JSON string that is not an object (array)', () => {
      const action = translateHostMessage('[1,2,3]');
      expect(action.kind).toBe('drop');
    });

    it('drops null', () => {
      const action = translateHostMessage('null');
      expect(action.kind).toBe('drop');
    });

    it('drops a message with no id', () => {
      const action = translateHostMessage(JSON.stringify({ method: 'Runtime.enable' }));
      expect(action.kind).toBe('drop');
    });

    it('drops a message whose id is not a number', () => {
      const action = translateHostMessage(JSON.stringify({ id: '7', method: 'Runtime.enable' }));
      expect(action.kind).toBe('drop');
    });

    it('drops a message with no method', () => {
      const action = translateHostMessage(JSON.stringify({ id: 7 }));
      expect(action.kind).toBe('drop');
    });

    it('never throws on malformed input', () => {
      for (const raw of ['', '{', 'undefined', '{"id": null}', '{"id": true, "method": 1}']) {
        expect(() => translateHostMessage(raw)).not.toThrow();
      }
    });
  });
});
