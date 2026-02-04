import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readRegisteredDaemons,
  registerDaemon,
  touchRegisteredDaemon,
  unregisterDaemon,
} from '../commands/agent/daemon-registry.js';
import { getAgentDaemonTransport, getAgentGlobalRegistryPath } from '../commands/agent/daemon-paths.js';
import type { DaemonInfo } from '../commands/agent/daemon-protocol.js';

describe('agent daemon registry', () => {
  let tempHome: string | null = null;

  afterEach(() => {
    vi.restoreAllMocks();
    if (tempHome) {
      fs.rmSync(tempHome, { recursive: true, force: true });
      tempHome = null;
    }
  });

  const setupHome = (): string => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'rozenite-registry-home-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tempHome);
    return tempHome;
  };

  const createInfo = (workspace: string, pid = 123): DaemonInfo => {
    const transport = getAgentDaemonTransport(workspace, 'linux');
    return {
      pid,
      workspace,
      transportKind: transport.kind,
      address: transport.address,
      startedAt: 456,
      sessionCount: 1,
    };
  };

  it('registers daemons in the global registry', () => {
    setupHome();
    const workspace = path.join(os.tmpdir(), 'rozenite-registry-workspace');

    const info = createInfo(workspace);
    const entry = registerDaemon(info);
    const registryPath = getAgentGlobalRegistryPath();

    expect(fs.existsSync(registryPath)).toBe(true);
    expect(readRegisteredDaemons()).toEqual([entry]);
  });

  it('touch updates the existing registry entry timestamp', async () => {
    setupHome();
    const workspace = path.join(os.tmpdir(), 'rozenite-registry-touch');

    const initial = registerDaemon(createInfo(workspace));
    await new Promise((resolve) => setTimeout(resolve, 2));
    const touched = touchRegisteredDaemon(createInfo(workspace));

    expect(touched.lastSeenAt).toBeGreaterThanOrEqual(initial.lastSeenAt);
    expect(readRegisteredDaemons()).toHaveLength(1);
  });

  it('unregisters daemons by workspace transport identity', () => {
    setupHome();
    const first = path.join(os.tmpdir(), 'rozenite-registry-one');
    const second = path.join(os.tmpdir(), 'rozenite-registry-two');

    registerDaemon(createInfo(first, 111));
    registerDaemon(createInfo(second, 222));

    unregisterDaemon(first);

    expect(readRegisteredDaemons()).toEqual([
      expect.objectContaining({
        workspace: second,
        pid: 222,
      }),
    ]);
  });
});
