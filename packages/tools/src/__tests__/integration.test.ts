import { describe, it, expect } from 'vitest';
import {
  ROZENITE_INTEGRATIONS,
  DEFAULT_PLUGIN_INTEGRATIONS,
  IS_WEB_TARGET_EXPRESSION,
  isRozeniteIntegration,
  resolveIntegration,
  type RozeniteHostIntegration,
} from '../integration.js';

const HOSTS: RozeniteHostIntegration[] = ['react-native', 'lynx'];

describe('isRozeniteIntegration', () => {
  it('accepts every declared integration id', () => {
    for (const integration of ROZENITE_INTEGRATIONS) {
      expect(isRozeniteIntegration(integration)).toBe(true);
    }
  });

  it('rejects unknown strings, non-strings, and undefined', () => {
    expect(isRozeniteIntegration('react-native-cli')).toBe(false);
    expect(isRozeniteIntegration('')).toBe(false);
    expect(isRozeniteIntegration(undefined)).toBe(false);
    expect(isRozeniteIntegration(null)).toBe(false);
    expect(isRozeniteIntegration(42)).toBe(false);
    expect(isRozeniteIntegration({})).toBe(false);
  });
});

describe('DEFAULT_PLUGIN_INTEGRATIONS', () => {
  it('defaults an unlabeled plugin to React Native only', () => {
    expect(DEFAULT_PLUGIN_INTEGRATIONS).toEqual(['react-native']);
  });
});

describe('resolveIntegration', () => {
  it('resolves a native target to the host itself', () => {
    expect(resolveIntegration('react-native', false)).toBe('react-native');
    expect(resolveIntegration('lynx', false)).toBe('lynx');
  });

  it('resolves a browser target to the host web variant', () => {
    expect(resolveIntegration('react-native', true)).toBe('react-native-web');
    expect(resolveIntegration('lynx', true)).toBe('lynx-web');
  });

  // The derivation and the id list are two statements of the same fact.
  // This is what stops them drifting: every host x isWeb combination must
  // land on a declared id, and together they must cover the list exactly.
  it('generates precisely ROZENITE_INTEGRATIONS across every host', () => {
    const generated = HOSTS.flatMap((host) => [
      resolveIntegration(host, false),
      resolveIntegration(host, true),
    ]);

    expect([...generated].sort()).toEqual([...ROZENITE_INTEGRATIONS].sort());
    for (const integration of generated) {
      expect(isRozeniteIntegration(integration)).toBe(true);
    }
  });
});

describe('IS_WEB_TARGET_EXPRESSION', () => {
  // Evaluated at global scope in the device runtime, so it must be a bare
  // expression that reads only genuine globals - never a statement, and
  // never a reference to anything Rozenite installs.
  it('evaluates to false in a runtime with no window (a native device)', () => {
    expect(new Function(`return (${IS_WEB_TARGET_EXPRESSION})`)()).toBe(false);
  });

  it('evaluates to true against a window carrying a document', () => {
    const evaluate = new Function('window', `return (${IS_WEB_TARGET_EXPRESSION})`);

    expect(evaluate({ document: {} })).toBe(true);
    // A `window` without a `document` is not a browser - this is what
    // separates a real DOM from a runtime that merely defines the global.
    expect(evaluate({})).toBe(false);
  });
});
