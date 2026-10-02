import { beforeEach, describe, expect, it, vi } from 'vitest';

const { initializeRozenite, rozeniteMiddleware, createScopedMiddleware, toRozeniteConfig } =
  vi.hoisted(() => ({
    toRozeniteConfig: vi.fn((_options: unknown, context: { projectRoot: string }) => ({
      built: true,
      ...context,
    })),
    createScopedMiddleware: vi.fn((_prefix: string, middleware: unknown) => middleware),
    initializeRozenite: vi.fn(),
    rozeniteMiddleware: vi.fn(),
  }));

vi.mock('@rozenite/middleware', () => ({
  initializeRozenite,
  createScopedMiddleware,
  toRozeniteConfig,
}));

vi.mock('@rozenite/runtime/package.json', () => ({
  default: { version: '9.9.9' },
}));

vi.mock('./version-check.js', () => ({
  assertSupportedRePackVersion: vi.fn(),
}));

import { withRozenite } from './index.js';

type SetupMiddlewares = (middlewares: unknown[], devServer: unknown) => unknown[];

const resolveSetupMiddlewares = async (
  config: Record<string, unknown>,
  options: Record<string, unknown> = {},
  env: Record<string, unknown> = { context: '/project' },
): Promise<SetupMiddlewares> => {
  const factory = withRozenite(config as never, { enabled: true, ...options } as never) as (
    env: unknown,
  ) => Promise<{ devServer: { setupMiddlewares: SetupMiddlewares } }>;
  const resolved = await factory(env);
  return resolved.devServer.setupMiddlewares;
};

describe('withRozenite (Re.Pack)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeRozenite.mockResolvedValue({ middleware: rozeniteMiddleware });
  });

  it('chains the existing setupMiddlewares and keeps its middlewares', async () => {
    const devServer = { id: 'dev-server' };
    const existing = () => undefined;
    const added = () => undefined;
    const userSetup = vi.fn((middlewares: unknown[]) => [...middlewares, added]);

    const setup = await resolveSetupMiddlewares({
      devServer: { setupMiddlewares: userSetup },
    });
    const result = setup([existing], devServer);

    expect(userSetup).toHaveBeenCalledWith([existing], devServer);
    expect(result).toHaveLength(3);
    expect(result.slice(1)).toEqual([existing, added]);
  });

  it('puts the Rozenite middleware before the user middlewares', async () => {
    const userMiddleware = () => undefined;
    const setup = await resolveSetupMiddlewares({
      devServer: {
        setupMiddlewares: (middlewares: unknown[]) => [...middlewares, userMiddleware],
      },
    });

    const result = setup([], {});
    const next = vi.fn();
    await (result[0] as (...args: unknown[]) => Promise<void>)({}, {}, next);

    expect(result[1]).toBe(userMiddleware);
    expect(rozeniteMiddleware).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('works when the config has no setupMiddlewares', async () => {
    const existing = () => undefined;
    const setup = await resolveSetupMiddlewares({});

    const result = setup([existing], {});

    expect(result).toHaveLength(2);
    expect(result[1]).toBe(existing);
  });

  it('forwards the runtime version and initializes and scopes only once', async () => {
    const setup = await resolveSetupMiddlewares({});
    const [middleware] = setup([], {}) as ((...args: unknown[]) => Promise<void>)[];

    await middleware({}, {}, vi.fn());
    await middleware({}, {}, vi.fn());

    expect(initializeRozenite).toHaveBeenCalledTimes(1);
    expect(createScopedMiddleware).toHaveBeenCalledTimes(1);
    expect(createScopedMiddleware).toHaveBeenCalledWith('/rozenite', rozeniteMiddleware);
    expect(initializeRozenite).toHaveBeenCalledWith(
      expect.objectContaining({ projectRoot: '/project' }),
      '9.9.9',
    );
  });

  it('builds the config through toRozeniteConfig with env.context as projectRoot', async () => {
    const options = { include: ['a'], projectRoot: '/evil' };
    const setup = await resolveSetupMiddlewares({}, options);
    const [middleware] = setup([], {}) as ((...args: unknown[]) => Promise<void>)[];
    await middleware({}, {}, vi.fn());

    expect(toRozeniteConfig).toHaveBeenCalledWith(expect.objectContaining(options), {
      projectRoot: '/project',
    });
    expect(initializeRozenite).toHaveBeenCalledWith(
      { built: true, projectRoot: '/project' },
      '9.9.9',
    );
  });

  it('does not forward `enabled` to Rozenite', async () => {
    const setup = await resolveSetupMiddlewares({});
    const [middleware] = setup([], {}) as ((...args: unknown[]) => Promise<void>)[];
    await middleware({}, {}, vi.fn());

    const [config] = initializeRozenite.mock.calls[0];
    expect(config).not.toHaveProperty('enabled');
  });

  it('falls back to process.cwd() when env.context is missing', async () => {
    await resolveSetupMiddlewares({}, {}, {});

    expect(toRozeniteConfig).toHaveBeenCalledWith(expect.anything(), {
      projectRoot: process.cwd(),
    });
  });
});
