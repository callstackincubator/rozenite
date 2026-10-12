import { describe, expect, it } from 'vitest';
import {
  BOOTSTRAP_DEBOUNCE_MS,
  CONNECTION_LOST_CLOSE_REASON,
  DISPATCHER_INIT_MAX_ATTEMPTS,
  DISPATCHER_INIT_RETRY_MS,
  FUSEBOX_DISPATCHER_GLOBAL,
  LYNX_BRIDGE_BINDING_NAME,
  MAIN_EXECUTION_CONTEXT_NAME,
  NEW_DEBUGGER_OPENED_CLOSE_REASON,
  PAGE_NOT_FOUND_CLOSE_REASON,
  REACT_DEVTOOLS_DOMAIN,
  RECOVERY_MAX_ATTEMPTS,
  RECOVERY_RETRY_DELAY_MS,
  RECREATING_DEVICE_CLOSE_REASON,
  ROZENITE_DOMAIN,
  buildBindingCalledEvent,
  buildBindingNameExpression,
  buildDispatcherReadyExpression,
  buildInitializeDomainExpression,
  buildSendMessageExpression,
  classifyCloseReason,
  findRecoverableCloseReason,
  parseBindingPayload,
  parseRozeniteBindingCalled,
  toAsciiJsSource,
} from '../protocol.js';

describe('constants', () => {
  it('pins the wire values', () => {
    expect(FUSEBOX_DISPATCHER_GLOBAL).toBe('__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__');
    expect(ROZENITE_DOMAIN).toBe('rozenite');
    expect(REACT_DEVTOOLS_DOMAIN).toBe('react-devtools');
    expect(MAIN_EXECUTION_CONTEXT_NAME).toBe('main');
    expect(LYNX_BRIDGE_BINDING_NAME).toBe('__CHROME_DEVTOOLS_FRONTEND_BINDING__');
    expect(RECREATING_DEVICE_CLOSE_REASON).toBe('[RECREATING_DEVICE]');
    expect(PAGE_NOT_FOUND_CLOSE_REASON).toBe('[PAGE_NOT_FOUND]');
    expect(CONNECTION_LOST_CLOSE_REASON).toBe('[CONNECTION_LOST]');
    expect(NEW_DEBUGGER_OPENED_CLOSE_REASON).toBe('[NEW_DEBUGGER_OPENED]');
  });

  it('pins the handshake timings', () => {
    expect(DISPATCHER_INIT_MAX_ATTEMPTS).toBe(20);
    expect(DISPATCHER_INIT_RETRY_MS).toBe(250);
    expect(RECOVERY_MAX_ATTEMPTS).toBe(16);
    expect(RECOVERY_RETRY_DELAY_MS).toBe(500);
    expect(BOOTSTRAP_DEBOUNCE_MS).toBe(500);
  });
});

describe('classifyCloseReason', () => {
  it.each([
    ['[RECREATING_DEVICE]', 'recoverable'],
    ['[PAGE_NOT_FOUND]', 'recoverable'],
    ['[CONNECTION_LOST]', 'recoverable'],
    ['Closed: [CONNECTION_LOST] by proxy', 'recoverable'],
    ['[NEW_DEBUGGER_OPENED]', 'taken-by-another-debugger'],
    ['[RECREATING_DEVICE] [NEW_DEBUGGER_OPENED]', 'taken-by-another-debugger'],
    ['', 'terminal'],
    ['going away', 'terminal'],
    ['RECREATING_DEVICE', 'terminal'],
  ])('classifies %j as %s', (reason, expected) => {
    expect(classifyCloseReason(reason)).toBe(expected);
  });

  it('reports which recoverable reason matched', () => {
    expect(findRecoverableCloseReason('x [PAGE_NOT_FOUND] y')).toBe('[PAGE_NOT_FOUND]');
    expect(findRecoverableCloseReason('[NEW_DEBUGGER_OPENED]')).toBeUndefined();
  });
});

describe('toAsciiJsSource', () => {
  it('leaves ASCII untouched and escapes every non-ASCII code unit', () => {
    expect(toAsciiJsSource('abc "q" \\ \n')).toBe('abc "q" \\ \n');
    expect(toAsciiJsSource('é')).toBe('\\u00e9');
    expect(toAsciiJsSource('\u{1F600}')).toBe('\\ud83d\\ude00');
  });
});

describe('expression builders (golden)', () => {
  it('dispatcher ready', () => {
    expect(buildDispatcherReadyExpression()).toBe(
      'globalThis.__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__ != undefined',
    );
  });

  it('binding name', () => {
    expect(buildBindingNameExpression()).toBe('__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__.BINDING_NAME');
  });

  it('initialize domain', () => {
    expect(buildInitializeDomainExpression('rozenite')).toBe(
      'void __FUSEBOX_REACT_DEVTOOLS_DISPATCHER__.initializeDomain("rozenite")',
    );
    expect(buildInitializeDomainExpression('react-devtools')).toBe(
      'void __FUSEBOX_REACT_DEVTOOLS_DISPATCHER__.initializeDomain("react-devtools")',
    );
  });

  it('send message', () => {
    expect(buildSendMessageExpression('rozenite', { type: 'ping' })).toBe(
      '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__.sendMessage("rozenite", "{\\"type\\":\\"ping\\"}")',
    );
  });

  it('send message with quotes and backslashes', () => {
    expect(buildSendMessageExpression('rozenite', { a: 'say "hi" \\ there' })).toBe(
      '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__.sendMessage("rozenite", ' +
        '"{\\"a\\":\\"say \\\\\\"hi\\\\\\" \\\\\\\\ there\\"}")',
    );
  });

  it('send message with a non-BMP emoji is pure ASCII', () => {
    const expression = buildSendMessageExpression('rozenite', { text: 'hi \u{1F600}' });
    expect(expression).toBe(
      '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__.sendMessage("rozenite", ' +
        '"{\\"text\\":\\"hi \\ud83d\\ude00\\"}")',
    );
    expect(/^[\0-\x7F]*$/.test(expression)).toBe(true);
  });

  it('evaluates back to the original payload string', () => {
    const message = { text: 'é \u{1F600} "q" \\', n: [1, null] };
    const received: unknown[] = [];
    const dispatcher = { sendMessage: (...args: unknown[]) => received.push(args) };
    new Function(FUSEBOX_DISPATCHER_GLOBAL, buildSendMessageExpression('rozenite', message))(
      dispatcher,
    );
    expect(received).toEqual([['rozenite', JSON.stringify(message)]]);
  });
});

describe('bindingCalled', () => {
  it('builds the event the Lynx bridge synthesises', () => {
    expect(buildBindingCalledEvent('{"domain":"rozenite"}')).toEqual({
      method: 'Runtime.bindingCalled',
      params: {
        name: '__CHROME_DEVTOOLS_FRONTEND_BINDING__',
        executionContextId: 0,
        payload: '{"domain":"rozenite"}',
      },
    });
  });

  it('round-trips through the parser, payload verbatim', () => {
    const payload = '{ "message" :{"b":2,"a":1}  ,"domain":"rozenite"   }';
    const event = buildBindingCalledEvent(payload);
    expect(event.params.payload).toBe(payload);
    expect(parseRozeniteBindingCalled(event)).toEqual({
      domain: 'rozenite',
      message: { b: 2, a: 1 },
    });
  });

  it('parses a payload with no message', () => {
    expect(parseBindingPayload('{"domain":"react-devtools"}')).toEqual({
      domain: 'react-devtools',
      message: undefined,
    });
  });

  it.each([
    ['empty', ''],
    ['not json', 'nope'],
    ['json null', 'null'],
    ['array', '[1]'],
    ['no domain', '{"message":1}'],
    ['non-string domain', '{"domain":1}'],
    ['empty domain', '{"domain":""}'],
  ])('rejects a malformed payload: %s', (_name, payload) => {
    expect(parseBindingPayload(payload)).toBeNull();
  });

  it.each([
    ['null', null],
    ['string', 'x'],
    ['array', []],
    ['other method', { method: 'Runtime.other', params: { payload: '{"domain":"a"}' } }],
    ['no params', { method: 'Runtime.bindingCalled' }],
    ['non-string payload', { method: 'Runtime.bindingCalled', params: { payload: 1 } }],
    ['bad payload', { method: 'Runtime.bindingCalled', params: { payload: '{' } }],
  ])('rejects a malformed frame: %s', (_name, frame) => {
    expect(parseRozeniteBindingCalled(frame)).toBeNull();
  });
});
