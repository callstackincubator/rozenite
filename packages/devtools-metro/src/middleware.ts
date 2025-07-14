import debuggerFrontend from '@react-native/debugger-frontend';
import serveStatic from 'serve-static';
import express, { Application } from 'express';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { getEntryPointHTML } from './entry-point.js';

export const getMiddleware = (installedPlugins: string[]): Application => {
  const app = express();
  const frameworkPath = path.resolve(
    require.resolve('@rozenite/devtools-core/host'),
    '..'
  );

  app.use((req, _, next) => {
    assert(req.url, 'req.url is required');

    if (req.url.includes('/callstack')) {
      req.url = req.url.replace('/callstack', '');
    }

    next();
  });

  app.get('/plugins/:plugin/*others', (req, res) => {
    const pluginName = req.params.plugin.replace('_', '/');
    const pluginPath = path.dirname(require.resolve(pluginName));
    req.url = req.url.replace('plugins/' + pluginName.replace('/', '_'), '');

    serveStatic(pluginPath)(req, res, (err) => {
      throw err;
    });
  });

  app.get('/embedder-static/embedderScript.js', (_, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.end('');
  });

  app.get('/rn_fusebox.html', (_, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(getEntryPointHTML(installedPlugins));
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
