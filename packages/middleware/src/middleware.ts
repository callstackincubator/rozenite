import express, { Application } from 'express';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getEntryPointHTML } from './entry-point.js';
import { InstalledPlugin } from './auto-discovery.js';
import { getReactNativeDebuggerFrontendPath } from './resolve.js';
import { RozeniteConfig } from './config.js';
import { logger } from './logger.js';
import type { AgentSessionManager } from './agent/index.js';
import { createAgentRoutes } from './agent/index.js';

const execPromise = promisify(exec);

async function openInFileManager(
  targetPath: string,
): Promise<{ success: boolean; error?: string }> {
  let cleanPath = targetPath;
  if (cleanPath.startsWith('file://')) {
    cleanPath = cleanPath.slice(7);
  }

  // basic command injection check
  const safePath = cleanPath.replace(/"/g, '\\"');

  let command = '';
  if (process.platform === 'darwin') {
    command = `open -R "${safePath}"`;
  } else if (process.platform === 'win32') {
    command = `explorer.exe /select,"${safePath}"`;
  } else {
    command = `xdg-open "${safePath}"`;
  }

  try {
    await execPromise(command);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const require = createRequire(import.meta.url);

export type MiddlewareConfig = {
  destroyOnDetachPlugins?: string[];
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

  app.post('/open-in-file-manager', express.json(), async (req, res) => {
    const { path } = req.body;
    if (typeof path !== 'string') {
      res.status(400).send('Path is required');
      return;
    }

    logger.debug(`Opening path in host file manager: ${path}`);
    const result = await openInFileManager(path);
    if (result.success) {
      res.status(200).json({ success: true });
    } else {
      logger.error(`Failed to open path in host file manager: ${result.error}`);
      res.status(500).json({ success: false, error: result.error });
    }
  });

  app.use(createAgentRoutes(agentSessionManager));

  app.use(express.static(debuggerFrontend));

  return app;
};
