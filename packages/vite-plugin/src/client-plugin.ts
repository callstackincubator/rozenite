import type { Plugin, ViteDevServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import ejs from 'ejs';
import { memo } from './utils.js';
import { fileURLToPath } from 'node:url';

type PanelEntry = {
  name: string;
  sourceFile: string;
  htmlFile: string;
};

const TEMPLATES_DIR = path.resolve(
  fileURLToPath(import.meta.url),
  '..',
  '..',
  'templates'
);

const PANELS_DIR = './panels';

export const rozeniteClientPlugin = (): Plugin => {
  let projectRoot = process.cwd();
  let viteServer: ViteDevServer | null = null;

  const getPanels = memo((): PanelEntry[] => {
    const panelsDir = path.resolve(projectRoot, PANELS_DIR);
    const panelFiles = fs
      .readdirSync(panelsDir)
      .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));

    return panelFiles.map((file) => {
      const name = path.basename(file, path.extname(file));

      return {
        name,
        sourceFile: file,
        htmlFile: name + '.html',
      };
    });
  });

  const DEVTOOLS_TEMPLATE = path.join(TEMPLATES_DIR, 'devtools.ejs');
  const PANEL_TEMPLATE = path.join(TEMPLATES_DIR, 'panel.ejs');
  const INDEX_TEMPLATE = path.join(TEMPLATES_DIR, 'index.ejs');

  const generateDevtoolsHtmlContent = (): string => {
    const template = fs.readFileSync(DEVTOOLS_TEMPLATE, 'utf-8');
    return ejs.render(template, {});
  };

  const generatePanelHtmlContent = (panelFile: string): string => {
    const template = fs.readFileSync(PANEL_TEMPLATE, 'utf-8');
    const panelName = path.basename(panelFile, path.extname(panelFile));
    return ejs.render(template, { panelName, panelFile });
  };

  const generateIndexHtmlContent = (): string => {
    const panelsDir = path.resolve(projectRoot, PANELS_DIR);
    const panelFiles = fs
      .readdirSync(panelsDir)
      .filter((file) => /\.(ts|tsx)$/.test(file));
    const panels = panelFiles.map((file) => ({
      name: path.basename(file, path.extname(file)),
      htmlFile: path.basename(file, path.extname(file)) + '.html',
    }));
    const template = fs.readFileSync(INDEX_TEMPLATE, 'utf-8');
    return ejs.render(template, { panels });
  };

  return {
    name: 'rozenite-client-plugin',
    config(config) {
      if (config.root) {
        projectRoot = config.root;
      }

      const panels = getPanels();

      config.build ??= {};
      config.build.rollupOptions ??= {};
      config.build.rollupOptions.input = {
        ...(config.build.rollupOptions.input as Record<string, string>),
        devtools: path.resolve(projectRoot, 'devtools.html'),
        ...Object.fromEntries(
          panels.map((panel) => [panel.name, panel.htmlFile])
        ),
      };
    },

    resolveId(id) {
      const isPanel = getPanels().some((panel) => panel.htmlFile === id);
      const isDevtools = id === 'devtools.html';

      if (isPanel || isDevtools) {
        return id;
      }

      return null;
    },

    load(id) {
      const panel = getPanels().find((panel) => panel.htmlFile === id);

      if (panel) {
        return generatePanelHtmlContent(panel.sourceFile);
      }

      if (id === 'devtools.html') {
        return generateDevtoolsHtmlContent();
      }

      return null;
    },

    configureServer(server: ViteDevServer) {
      viteServer = server;

      server.middlewares.use((req, res, next) => {
        const panels = getPanels();
        const url = req.url?.slice(1) || '';

        if (url === '' || url === 'index.html') {
          server
            .transformIndexHtml(req.url || '/', generateIndexHtmlContent())
            .then((html) => {
              res.setHeader('Content-Type', 'text/html');
              res.end(html);
            })
            .catch((err) => {
              next(err);
            });
          return;
        }

        const panel = panels.find((panel) => panel.htmlFile === url);

        if (panel) {
          const htmlContent = generatePanelHtmlContent(panel.sourceFile);

          server
            .transformIndexHtml(req.url || '/', htmlContent)
            .then((html) => {
              res.setHeader('Content-Type', 'text/html');
              res.end(html);
            })
            .catch((err) => {
              next(err);
            });
          return;
        }

        if (url === 'devtools.html') {
          const htmlContent = generateDevtoolsHtmlContent();

          server
            .transformIndexHtml(req.url || '/', htmlContent)
            .then((html) => {
              res.setHeader('Content-Type', 'text/html');
              res.end(html);
            })
            .catch((err) => {
              next(err);
            });
          return;
        }
        next();
      });
    },
    watchChange(id, change) {
      if (change.event !== 'create' && change.event !== 'delete') {
        return;
      }

      const relativePath = path.relative(projectRoot, id);

      if (!relativePath.startsWith(PANELS_DIR)) {
        return;
      }

      viteServer?.ws.send({
        type: 'full-reload',
        path: '/',
      });
    },
  };
};
