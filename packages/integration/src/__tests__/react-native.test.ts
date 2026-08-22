/**
 * Contract tests for `createReactNativeIntegration` that don't need a real
 * React Native *project* — only a real `react-native` install, which this
 * monorepo already provides. Mirrors the approach `@rozenite/middleware`'s
 * own suites use (see `middleware.test.ts`'s "standalone app" describe and
 * `integration-domain.e2e.test.ts`): point `projectRoot` at this package's
 * own directory, where `react-native` and `@react-native/dev-middleware`
 * are hoisted and resolvable, rather than inventing a project fixture.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createReactNativeIntegration } from '../react-native.js';

const projectRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

describe('createReactNativeIntegration', () => {
  it('reports the react-native host integration id', () => {
    const integration = createReactNativeIntegration({ projectRoot });
    expect(integration.id).toBe('react-native');
  });

  it('resolves a real, existing debugger frontend directory', () => {
    const integration = createReactNativeIntegration({ projectRoot });
    const frontendPath = integration.getDebuggerFrontendPath();

    expect(frontendPath).not.toBeNull();
    expect(fs.existsSync(frontendPath as string)).toBe(true);
  });

  it('does not throw for an installed React Native version that satisfies the minimum', () => {
    const integration = createReactNativeIntegration({ projectRoot });
    expect(() => integration.verifyEnvironment()).not.toThrow();
  });

  it('throws verifying the environment when react-native cannot be resolved at all', () => {
    // A directory with no node_modules of its own and no ancestor that
    // resolves react-native either - unlike anywhere under this repo,
    // which hoists one to the workspace root.
    const emptyProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rozenite-integration-test-'));

    try {
      const integration = createReactNativeIntegration({ projectRoot: emptyProjectRoot });
      expect(() => integration.verifyEnvironment()).toThrow();
    } finally {
      fs.rmSync(emptyProjectRoot, { recursive: true, force: true });
    }
  });

  it('installs the inspector hooks against a real dev-middleware without throwing, idempotently', () => {
    const integration = createReactNativeIntegration({ projectRoot });

    // A second `initializeRozenite` call patching again (e.g. two dev
    // servers in the same process) must compose with itself only once -
    // see the ROZENITE_PATCHED guard in `integration-domain.ts`.
    expect(() => integration.installInspectorHooks()).not.toThrow();
    expect(() => integration.installInspectorHooks()).not.toThrow();
  });
});
