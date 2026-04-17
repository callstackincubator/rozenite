import { createServer, get } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNormalizedRequestUrl } from '../middleware.js';
import {
  createScopedMiddleware,
  type MiddlewareHandler,
} from '../scoped-middleware.js';

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
    const request = get(
      `http://127.0.0.1:${address.port}${url}`,
      (response) => {
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
      },
    );

    request.on('error', reject);
  });
};

describe('middleware request normalization', () => {
  it('preserves agent routes under /rozenite', () => {
    expect(getNormalizedRequestUrl('/rozenite/agent/targets')).toBe(
      '/rozenite/agent/targets',
    );
    expect(getNormalizedRequestUrl('/rozenite/agent/sessions/device-1')).toBe(
      '/rozenite/agent/sessions/device-1',
    );
  });

  it('continues stripping the /rozenite prefix for non-agent routes', () => {
    expect(getNormalizedRequestUrl('/rozenite/plugins/demo/index.js')).toBe(
      '/plugins/demo/index.js',
    );
    expect(getNormalizedRequestUrl('/rozenite/rn_fusebox.html')).toBe(
      '/rn_fusebox.html',
    );
  });
});

describe('scoped middleware', () => {
  it('delegates only requests within the configured prefix', async () => {
    const handler = vi.fn<MiddlewareHandler>((req, res) => {
      res.end(req.url);
    });
    const middleware = createScopedMiddleware('/rozenite', handler);

    const insideResponse = await runRequest(
      middleware,
      '/rozenite/plugins/demo/index.js',
    );
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
    const buggyMiddleware = createScopedMiddleware(
      '/rozenite',
      (_req, res, next) => {
        res.statusCode = 204;
        res.end();
        next();
      },
    );

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
