import { describe, expect, it } from 'vitest';
import { extractConsoleMessage } from '../agent/runtime/console/extract.js';

/**
 * Fixtures are trimmed from real `Runtime.consoleAPICalled` frames captured off
 * a Hermes device (Expo Router playground, iOS). Only `stackTrace` and the long
 * string payload are abbreviated; the `args` shapes are verbatim.
 */
const consoleAPICalled = (args: unknown[], type = 'log') => ({
  method: 'Runtime.consoleAPICalled',
  params: { args, type, executionContextId: 1, timestamp: 1787151570445.115 },
});

const textOf = (message: unknown): string => {
  const extracted = extractConsoleMessage(message);
  if (!extracted) {
    throw new Error('Expected the message to be extracted');
  }
  return extracted.text;
};

describe('extractConsoleMessage argument rendering', () => {
  it('renders inlined primitives', () => {
    expect(
      textOf(
        consoleAPICalled([
          { type: 'string', value: 'hello' },
          { type: 'number', value: 42 },
          { type: 'boolean', value: true },
          { type: 'object', subtype: 'null', value: null },
        ]),
      ),
    ).toBe('hello 42 true null');
  });

  it('renders unserializable numbers from their description', () => {
    expect(
      textOf(
        consoleAPICalled([
          { description: 'NaN', type: 'number', unserializableValue: 'NaN' },
          { description: 'Infinity', type: 'number', unserializableValue: 'Infinity' },
          { description: '-0', type: 'number', unserializableValue: '-0' },
          { description: '10n', type: '', unserializableValue: '10n' },
        ]),
      ),
    ).toBe('NaN Infinity -0 10n');
  });

  it('renders an object preview instead of the bare class name', () => {
    expect(
      textOf(
        consoleAPICalled([
          {
            className: 'Object',
            description: 'Object',
            objectId: '268',
            type: 'object',
            preview: {
              description: 'Object',
              overflow: false,
              type: 'object',
              properties: [{ name: 'this', type: 'object', value: 'Object' }],
            },
          },
        ]),
      ),
    ).toBe('{this: Object}');
  });

  it('quotes string properties so they are distinguishable from identifiers', () => {
    expect(
      textOf(
        consoleAPICalled([
          {
            className: 'Object',
            description: 'Object',
            objectId: '1',
            type: 'object',
            preview: {
              overflow: false,
              type: 'object',
              properties: [
                { name: 'name', type: 'string', value: 'boom' },
                { name: 'count', type: 'number', value: '42' },
              ],
            },
          },
        ]),
      ),
    ).toBe('{name: "boom", count: 42}');
  });

  it('renders an array preview and marks Hermes overflow', () => {
    expect(
      textOf(
        consoleAPICalled([
          {
            className: 'Array',
            description: 'Array(15)',
            objectId: '48',
            subtype: 'array',
            type: 'object',
            preview: {
              description: 'Array(15)',
              overflow: true,
              subtype: 'array',
              type: 'object',
              properties: Array.from({ length: 10 }, (_, index) => ({
                name: String(index),
                type: 'number',
                value: String(index + 1),
              })),
            },
          },
        ]),
      ),
    ).toBe('[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, …]');
  });

  it('marks overflow on a wide object', () => {
    expect(
      textOf(
        consoleAPICalled([
          {
            className: 'Object',
            description: 'Object',
            objectId: '57',
            type: 'object',
            preview: {
              description: 'Object',
              overflow: true,
              type: 'object',
              properties: Array.from({ length: 10 }, (_, index) => ({
                name: `k${index}`,
                type: 'number',
                value: String(index),
              })),
            },
          },
        ]),
      ),
    ).toBe('{k0: 0, k1: 1, k2: 2, k3: 3, k4: 4, k5: 5, k6: 6, k7: 7, k8: 8, k9: 9, …}');
  });

  it('prefers the description for errors so the stack is not stored twice', () => {
    const stack = 'Error: boom\n    at global (:1:23)';
    const text = textOf(
      consoleAPICalled([
        {
          className: 'Error',
          description: stack,
          objectId: '31',
          subtype: 'error',
          type: 'object',
          preview: {
            description: 'Object',
            overflow: false,
            type: 'object',
            properties: [
              { name: 'message', type: 'string', value: 'boom' },
              { name: 'stack', type: 'string', value: stack },
            ],
          },
        },
      ]),
    );

    expect(text).toBe(stack);
    // The preview repeats the stack; rendering it would double the retained bytes.
    expect(text).not.toContain('message');
  });

  it('falls back to the description when a preview carries nothing', () => {
    // Hermes reports Map and Set exactly this way, so claiming `{}` would lie.
    expect(
      textOf(
        consoleAPICalled([
          {
            className: 'Object',
            description: 'Object',
            objectId: '55',
            type: 'object',
            preview: { description: 'Object', overflow: false, properties: [], type: 'object' },
          },
          {
            className: 'Object',
            description: 'Object',
            objectId: '56',
            type: 'object',
            preview: { description: 'Object', overflow: false, properties: [], type: 'object' },
          },
        ]),
      ),
    ).toBe('Object Object');
  });
});

describe('extractConsoleMessage truncation', () => {
  it('caps a large inlined string and reports what was dropped', () => {
    const text = textOf(consoleAPICalled([{ type: 'string', value: 'x'.repeat(1_000_000) }]));

    expect(text.length).toBeLessThan(3_000);
    expect(text).toContain('…(+997952 chars)');
  });

  it('caps an individual preview property value', () => {
    const text = textOf(
      consoleAPICalled([
        {
          className: 'Object',
          description: 'Object',
          objectId: '1',
          type: 'object',
          preview: {
            overflow: false,
            type: 'object',
            properties: [{ name: 'blob', type: 'string', value: 'y'.repeat(100_000) }],
          },
        },
      ]),
    );

    expect(text.length).toBeLessThan(3_000);
    expect(text).toContain('…(+98976 chars)');
  });

  it('caps the joined text across many large arguments', () => {
    const args = Array.from({ length: 20 }, () => ({
      type: 'string',
      value: 'z'.repeat(100_000),
    }));

    expect(textOf(consoleAPICalled(args)).length).toBeLessThan(9_000);
  });

  it('caps a long exception description', () => {
    const extracted = extractConsoleMessage({
      method: 'Runtime.exceptionThrown',
      params: {
        timestamp: 1787151570445,
        exceptionDetails: { text: 'Error: '.concat('q'.repeat(100_000)) },
      },
    });

    expect(extracted?.level).toBe('error');
    expect(extracted?.text.length).toBeLessThan(9_000);
  });
});
