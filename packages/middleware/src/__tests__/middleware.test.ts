import { createServer, get } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMiddleware, getNormalizedRequestUrl } from '../middleware.js';
import { createScopedMiddleware, type MiddlewareHandler } from '../scoped-middleware.js';
import { createAgentSessionManager } from '../agent/index.js';
import type { InstalledPlugin } from '../auto-discovery.js';
import type { RozeniteConfig } from '../config.js';

let activeServer: ReturnType<typeof createServer> | null = null;

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    if (!activeServer) {
      resolve();
      return;
    }

    activeServer.close((error) => {
      activeServer = null;

      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

const runRequest = async (
  middleware: MiddlewareHandler,
  url: string,
): Promise<{ status: number; body: string }> => {
  activeServer = createServer((req, res) => {
    middleware(req, res, () => {
      res.statusCode = 404;
      res.end('not found');
    });
  });

  await new Promise<void>((resolve) => {
    activeServer!.listen(0, resolve);
  });

  const address = activeServer.address();

  if (!address || typeof address === 'string') {
    throw new Error('Expected an ephemeral TCP port');
  }

  return new Promise((resolve, reject) => {
    const request = get(`http://127.0.0.1:${address.port}${url}`, (response) => {
      let body = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({
          status: response.statusCode ?? 0,
          body,
        });
      });
    });

    request.on('error', reject);
  });
};

describe('middleware request normalization', () => {
  it('restores stripped agent routes for scoped integrations', () => {
    expect(getNormalizedRequestUrl('/agent/targets')).toBe('/rozenite/agent/targets');
    expect(getNormalizedRequestUrl('/agent/sessions/device-1')).toBe(
      '/rozenite/agent/sessions/device-1',
    );
  });

  it('preserves agent routes under /rozenite', () => {
    expect(getNormalizedRequestUrl('/rozenite/agent/targets')).toBe('/rozenite/agent/targets');
    expect(getNormalizedRequestUrl('/rozenite/agent/sessions/device-1')).toBe(
      '/rozenite/agent/sessions/device-1',
    );
  });

  it('continues stripping the /rozenite prefix for non-agent routes', () => {
    expect(getNormalizedRequestUrl('/rozenite/plugins/demo/index.js')).toBe(
      '/plugins/demo/index.js',
    );
    expect(getNormalizedRequestUrl('/rozenite/rn_fusebox.html')).toBe('/rn_fusebox.html');
  });
});

describe('scoped middleware', () => {
  it('keeps agent setup working when the outer prefix is stripped first', async () => {
    const middleware = createScopedMiddleware('/rozenite', (req, res, next) => {
      if (req.url && getNormalizedRequestUrl(req.url) === '/rozenite/agent/targets') {
        res.end('agent targets');
        return;
      }

      next();
    });

    const response = await runRequest(middleware, '/rozenite/agent/targets');

    expect(response).toEqual({
      status: 200,
      body: 'agent targets',
    });
  });

  it('delegates only requests within the configured prefix', async () => {
    const handler = vi.fn<MiddlewareHandler>((req, res) => {
      res.end(req.url);
    });
    const middleware = createScopedMiddleware('/rozenite', handler);

    const insideResponse = await runRequest(middleware, '/rozenite/plugins/demo/index.js');
    const outsideResponse = await runRequest(middleware, '/open-stack-frame');

    expect(insideResponse).toEqual({
      status: 200,
      body: '/plugins/demo/index.js',
    });
    expect(outsideResponse).toEqual({
      status: 404,
      body: 'not found',
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stops propagation when delegated middleware ends the response and still calls next', async () => {
    const downstream = vi.fn();
    const buggyMiddleware = createScopedMiddleware('/rozenite', (_req, res, next) => {
      res.statusCode = 204;
      res.end();
      next();
    });

    const response = await runRequest((req, res, next) => {
      buggyMiddleware(req, res, () => {
        downstream();
        next();
      });
    }, '/rozenite/rn_fusebox.html');

    expect(response).toEqual({ status: 204, body: '' });
    expect(downstream).not.toHaveBeenCalled();
  });
});

describe('standalone app', () => {
  // Resolving the debugger frontend needs a real react-native install, so
  // point at this package's own directory: it sits inside the monorepo,
  // where react-native and @react-native/dev-middleware are hoisted and
  // resolvable, without depending on any particular project fixture.
  const projectRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

  const createApp = (
    installedPlugins: InstalledPlugin[],
    destroyOnDetachPlugins: string[],
    runtimeVersion?: string,
  ): MiddlewareHandler => {
    const config: RozeniteConfig = { projectRoot };
    const agentSessionManager = createAgentSessionManager({ projectRoot });

    return getMiddleware(
      config,
      installedPlugins,
      destroyOnDetachPlugins,
      agentSessionManager,
      runtimeVersion,
    ) as unknown as MiddlewareHandler;
  };

  it('serves the config endpoint with the installed plugin names and runtime version', async () => {
    const app = createApp(
      [{ name: '@rozenite/network-activity-plugin', path: '/plugins/network-activity' }],
      ['@rozenite/some-plugin'],
      '2.1.0',
    );

    const response = await runRequest(app, '/rozenite/app/config');

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      installedPlugins: ['@rozenite/network-activity-plugin'],
      destroyOnDetachPlugins: ['@rozenite/some-plugin'],
      runtimeVersion: '2.1.0',
    });
  });

  it('omits runtimeVersion from the config payload when it is not provided', async () => {
    const app = createApp([], []);

    const response = await runRequest(app, '/rozenite/app/config');
    const payload = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(payload).toEqual({ installedPlugins: [], destroyOnDetachPlugins: [] });
    expect('runtimeVersion' in payload).toBe(false);
  });

  it('serves the app HTML for both /rozenite/app and /rozenite/app/ without redirecting', async () => {
    const app = createApp([], []);

    const withoutTrailingSlash = await runRequest(app, '/rozenite/app?ws=abc&appId=123');
    const withTrailingSlash = await runRequest(app, '/rozenite/app/?ws=abc&appId=123');

    for (const response of [withoutTrailingSlash, withTrailingSlash]) {
      expect(response.status).toBe(200);
      expect(response.body).toContain('<div id="root"></div>');
    }
  });

  it('registers the config route ahead of the static app mount so it cannot be shadowed', async () => {
    // Proves the ordering actually matters: a built app could ship a file
    // literally named "config" (unlikely, but not impossible), which would
    // shadow the JSON route if the static mount were registered first.
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rozenite-app-'));
    fs.writeFileSync(path.join(tempDir, 'config'), 'not json');

    try {
      const buildApp = (registerConfigFirst: boolean): MiddlewareHandler => {
        const router = express();
        const registerConfig = () => {
          router.get('/app/config', (_, res) => {
            res.json({ ok: true });
          });
        };
        const registerStatic = () => {
          router.use('/app', express.static(tempDir));
        };

        if (registerConfigFirst) {
          registerConfig();
          registerStatic();
        } else {
          registerStatic();
          registerConfig();
        }

        return router as unknown as MiddlewareHandler;
      };

      const shadowed = await runRequest(buildApp(false), '/app/config');
      const notShadowed = await runRequest(buildApp(true), '/app/config');

      expect(shadowed.body).toBe('not json');
      expect(JSON.parse(notShadowed.body)).toEqual({ ok: true });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
