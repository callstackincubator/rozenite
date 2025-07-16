import debuggerFrontend from '@react-native/debugger-frontend';
import serveStatic from 'serve-static';
import express, { Application } from 'express';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { getEntryPointHTML } from './entry-point.js';
import { InstalledPlugin } from './auto-discovery.js';

export const getMiddleware = (
  installedPlugins: InstalledPlugin[]
): Application => {
  const app = express();
  const frameworkPath = path.resolve(
    require.resolve('@rozenite/runtime'),
    '..'
  );

  app.use((req, _, next) => {
    assert(req.url, 'req.url is required');

    if (req.url.includes('/rozenite')) {
      req.url = req.url.replace('/rozenite', '');
    }

    next();
  });

  app.get('/plugins/:plugin/*others', (req, res, next) => {
    const pluginName = req.params.plugin.replace('_', '/');
    const plugin = installedPlugins.find(
      (plugin) => plugin.name === pluginName
    );

    if (!plugin) {
      res.status(404).send('Plugin not found');
      return;
    }

    const pluginPath = path.join(plugin.path, 'dist');
    req.url = req.url.replace('plugins/' + pluginName.replace('/', '_'), '');
    serveStatic(pluginPath)(req, res, next);
  });

  app.get('/embedder-static/embedderScript.js', (_, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.end('');
  });

  app.get('/rn_fusebox.html', (_, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(getEntryPointHTML(installedPlugins.map((plugin) => plugin.name)));
  });

  app.get('/host.js', (_, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.end(fs.readFileSync(path.join(frameworkPath, 'host.js'), 'utf8'));
  });

  app.get('/*others', (req, res, next) => {
    serveStatic(path.join(debuggerFrontend))(req, res, next);
  });

  return app;
};
