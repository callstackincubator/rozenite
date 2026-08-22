import express, { Application } from 'express';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { type RozeniteHostIntegration } from '@rozenite/tools';
import { getEntryPointHTML } from './entry-point.js';
import { InstalledPlugin } from './auto-discovery.js';
import { getReactNativeDebuggerFrontendPath } from './resolve.js';
import { RozeniteConfig } from './config.js';
import { logger } from './logger.js';
import type { AgentSessionManager } from './agent/index.js';
import { createAgentRoutes } from './agent/index.js';

const require = createRequire(import.meta.url);

export type MiddlewareConfig = {
  destroyOnDetachPlugins?: string[];
};

/**
 * The JSON counterpart of the `__ROZENITE__` global that `getEntryPointHTML`
 * injects into Fusebox's HTML for the embedded shell. Served as JSON for
 * `@rozenite/app`, which isn't server-rendered. Keep in sync with
 * `RozeniteAppConfig` in `packages/app/src/config.ts`.
 */
export type RozeniteAppConfigResponse = {
  installedPlugins: string[];
  destroyOnDetachPlugins: string[];
  runtimeVersion?: string;
  /**
   * The pre-handshake default: which host this dev server serves. Used by
   * the client when the `Rozenite.getEnvironment` CDP domain is
   * unavailable (an older dev-middleware, or the patch in
   * `integration-domain.ts` failed) - the domain's per-target answer wins
   * over this when it's there, since it also knows whether the target is
   * web.
   */
  integration: RozeniteHostIntegration;
};

export const getNormalizedRequestUrl = (url: string): string => {
  if (url === '/agent' || url.startsWith('/agent/')) {
    return `/rozenite${url}`;
  }

  if (url === '/rozenite' || url.startsWith('/rozenite/')) {
    if (url === '/rozenite/agent' || url.startsWith('/rozenite/agent/')) {
      return url;
    }

    return url.replace('/rozenite', '');
  }

  return url;
};

export const getMiddleware = (
  options: RozeniteConfig,
  installedPlugins: InstalledPlugin[],
  destroyOnDetachPlugins: string[],
  agentSessionManager: AgentSessionManager,
  runtimeVersion?: string,
): Application => {
  const app = express();
  const hostIntegration: RozeniteHostIntegration = options.integration ?? 'react-native';
  const isLynx = hostIntegration === 'lynx';
  // Lynx has no react-native install to resolve the Fusebox debugger
  // frontend from, and doesn't need it: `@rozenite/app` is loaded
  // standalone there instead of embedded in Fusebox's HTML.
  const debuggerFrontend = isLynx ? null : require(getReactNativeDebuggerFrontendPath(options));

  const frameworkPath = path.resolve(require.resolve('@rozenite/runtime'), '..');
  const shellPath = path.join(
    path.dirname(require.resolve('@rozenite/shell/package.json')),
    'dist',
  );
  const appPath = path.join(path.dirname(require.resolve('@rozenite/app/package.json')), 'dist');

  if (!isLynx) {
    logger.debug(`Debugger frontend path: ${debuggerFrontend}`);
  }
  logger.debug(`Framework path: ${frameworkPath}`);

  app.use((req, _, next) => {
    assert(req.url, 'req.url is required');

    logger.debug(`Incoming request: ${req.url}`);

    req.url = getNormalizedRequestUrl(req.url);

    next();
  });

  app.get('/plugins/:plugin/*others', (req, res, next) => {
    const pluginName = req.params.plugin.replace('_', '/');
    const plugin = installedPlugins.find((plugin) => plugin.name === pluginName);

    if (!plugin) {
      res.status(404).send('Plugin not found');
      return;
    }

    const pluginPath = path.join(plugin.path, 'dist');
    req.url = req.url.replace('plugins/' + pluginName.replace('/', '_'), '');
    express.static(pluginPath)(req, res, next);
  });

  app.get('/embedder-static/embedderScript.js', (_, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.end('');
  });

  // Fusebox-only route: Lynx never requests this, so it's skipped rather
  // than served with a null debugger frontend.
  if (!isLynx) {
    app.get('/rn_fusebox.html', (_, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.send(
        getEntryPointHTML(
          debuggerFrontend,
          installedPlugins.map((plugin) => plugin.name),
          destroyOnDetachPlugins,
          options.pluginDisplay ?? 'sidebar',
          hostIntegration,
          runtimeVersion,
        ),
      );
    });
  }

  app.get('/host.js', (_, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.end(fs.readFileSync(path.join(frameworkPath, 'host.js'), 'utf8'));
  });

  app.use('/shell', express.static(shellPath));

  app.get('/app/config', (_, res) => {
    const config: RozeniteAppConfigResponse = {
      installedPlugins: installedPlugins.map((plugin) => plugin.name),
      destroyOnDetachPlugins,
      runtimeVersion,
      integration: hostIntegration,
    };

    res.json(config);
  });

  // express.static would 301-redirect a bare "/app" request to "/app/" to
  // canonicalize it as a directory. That redirect target is computed from
  // the already-normalized URL (the /rozenite prefix stripped above), so it
  // would send the browser to "/app/" — outside the /rozenite namespace this
  // middleware is mounted under. Serve index.html directly instead; Express's
  // non-strict routing matches this for both "/app" and "/app/", and leaving
  // the request untouched keeps its query string (e.g. ?ws=...&appId=...)
  // intact for the client to read.
  //
  // `root` must be passed explicitly: without it, `send` (which backs
  // `res.sendFile`) checks *every* segment of the absolute path for a
  // leading dot to decide whether to treat it as a dotfile — including
  // ancestor directories that have nothing to do with this app, like a
  // hidden checkout folder (e.g. `~/.herdr/worktrees/...`). With `root`
  // set, only the relative path under it is checked, matching the
  // `express.static(appPath)` call below.
  app.get('/app', (_, res) => {
    res.sendFile('index.html', { root: appPath });
  });

  app.use('/app', express.static(appPath));

  app.use(createAgentRoutes(agentSessionManager));

  if (!isLynx) {
    app.use(express.static(debuggerFrontend));
  }

  return app;
};
