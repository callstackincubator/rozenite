import { beforeEach, describe, expect, it, vi } from 'vitest';

const { initializeRozenite } = vi.hoisted(() => ({ initializeRozenite: vi.fn() }));

vi.mock('@rozenite/middleware', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@rozenite/middleware')>()),
  initializeRozenite,
}));

vi.mock('@rozenite/runtime/package.json', () => ({
  default: { version: '9.9.9' },
}));

import { withRozenite } from '../index.js';

describe('withRozenite (Metro)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeRozenite.mockResolvedValue({ middleware: vi.fn(), devModePackage: null });
  });

  it('forwards only Rozenite options, projectRoot from the Metro config, and the runtime version', async () => {
    await withRozenite({ projectRoot: '/metro-root' }, {
      enabled: true,
      enhanceMetroConfig: (config: unknown) => config,
      include: ['a'],
      logLevel: 'warn',
      projectRoot: '/evil',
    } as never)();

    expect(initializeRozenite).toHaveBeenCalledTimes(1);
    expect(initializeRozenite).toHaveBeenCalledWith(
      { include: ['a'], logLevel: 'warn', projectRoot: '/metro-root' },
      '9.9.9',
    );
  });
});
