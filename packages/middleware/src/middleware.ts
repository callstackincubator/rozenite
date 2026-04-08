import express, { Application } from 'express';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
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

export const getNormalizedRequestUrl = (url: string): string => {
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
): Application => {
  const app = express();
  const debuggerFrontend = require(getReactNativeDebuggerFrontendPath(options));

  const frameworkPath = path.resolve(
    require.resolve('@rozenite/runtime'),
    '..',
  );

  logger.debug(`Debugger frontend path: ${debuggerFrontend}`);
  logger.debug(`Framework path: ${frameworkPath}`);

  app.use((req, _, next) => {
    assert(req.url, 'req.url is required');

    logger.debug(`Incoming request: ${req.url}`);

    req.url = getNormalizedRequestUrl(req.url);

    next();
  });

  app.get('/plugins/:plugin/*others', (req, res, next) => {
    const pluginName = req.params.plugin.replace('_', '/');
    const plugin = installedPlugins.find(
      (plugin) => plugin.name === pluginName,
    );

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

  app.get('/rn_fusebox.html', (_, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(
      getEntryPointHTML(
        debuggerFrontend,
        installedPlugins.map((plugin) => plugin.name),
        destroyOnDetachPlugins,
      ),
    );
  });

  app.get('/host.js', (_, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.end(fs.readFileSync(path.join(frameworkPath, 'host.js'), 'utf8'));
  });

  app.use(createAgentRoutes(agentSessionManager));

  app.use(express.static(debuggerFrontend));

  return app;
};
