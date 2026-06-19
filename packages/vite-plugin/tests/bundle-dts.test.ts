import { describe, expect, it } from 'vitest';
import { normalizeRolledUpDeclarations } from '../src/bundle-dts.js';

describe('normalizeRolledUpDeclarations', () => {
  it('rewrites exported value references to typeof', () => {
    const input = `
export declare let useNetworkActivityDevTools: useNetworkActivityDevTools_2;
declare const useNetworkActivityDevTools_2: (config?: NetworkActivityDevToolsConfig) => unknown;
`;

    expect(normalizeRolledUpDeclarations(input)).toContain(
      'export declare let useNetworkActivityDevTools: typeof useNetworkActivityDevTools_2;',
    );
  });

  it('rewrites type aliases that point at declared values', () => {
    const input = `
declare type UseNetworkActivityDevTools = useNetworkActivityDevTools_2;
declare const useNetworkActivityDevTools_2: (config?: NetworkActivityDevToolsConfig) => unknown;
`;

    expect(normalizeRolledUpDeclarations(input)).toContain(
      'declare type UseNetworkActivityDevTools = typeof useNetworkActivityDevTools_2;',
    );
  });

  it('leaves proper type aliases unchanged', () => {
    const input = `
declare type NetworkActivityDevToolsConfig = {
  enabled?: boolean;
};
declare type UseNetworkActivityDevTools = NetworkActivityDevToolsConfig;
`;

    expect(normalizeRolledUpDeclarations(input)).toBe(input);
  });
});
