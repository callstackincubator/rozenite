// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('react-native entry point', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.resetModules();
  });

  it('exports no-op stubs in production, without touching @rozenite/plugin-bridge', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';

    const mod = await import('./react-native.js');

    expect(() => mod.useRozenitePluginAgentTool({} as any)).not.toThrow();
    expect(() => mod.useRozeniteInAppAgentTool({} as any)).not.toThrow();
    expect(mod.useRozenitePluginAgentTool({} as any)).toBeUndefined();
    expect(mod.useRozeniteInAppAgentTool({} as any)).toBeUndefined();
    expect(mod.useRozenitePluginAgentTool.toString()).not.toContain('useRozeniteDomainAgentTool');
    expect(mod.useRozeniteInAppAgentTool.toString()).not.toContain('useRozeniteDomainAgentTool');
  });

  // The dev branch's require('./src/react-native/useRozeniteAgentTool') targets
  // a compiled .js file that only exists after `tsc` builds this package - under
  // vitest, which runs directly against the .ts source, that extensionless
  // require() can't resolve. The real hook implementation reached from that
  // branch has its own full test suite in
  // src/react-native/useRozeniteAgentTool.test.tsx, and the dev/production
  // split itself is verified by bundling apps/playground in both modes (see
  // the PR description).
});
