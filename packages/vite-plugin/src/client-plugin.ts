import type { Plugin, ViteDevServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import ejs from 'ejs';
import { fileURLToPath } from 'node:url';
import { loadConfig, RozeniteConfig } from './load-config.js';
import { getPackageJSON } from './package-json.js';

type PanelEntry = {
  name: string;
  label: string;
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
  let rozeniteConfig: RozeniteConfig | null = null;

  const getRozeniteConfig = (): RozeniteConfig => {
    if (!rozeniteConfig) {
      throw new Error('rozenite.config.ts not found');
    }

    return rozeniteConfig;
  };

  const getPanels = (): PanelEntry[] => {
    return getRozeniteConfig().panels.map((entry) => {
      const name = path.basename(entry.source, path.extname(entry.source));

      return {
        name,
        label: entry.name,
        sourceFile: path.resolve(projectRoot, entry.source),
        htmlFile: name + '.html',
      };
    });
  };

  const PANEL_TEMPLATE = path.join(TEMPLATES_DIR, 'panel.ejs');

  const generatePanelHtmlContent = (panel: PanelEntry): string => {
    const template = fs.readFileSync(PANEL_TEMPLATE, 'utf-8');
    const relativePath = path.relative(projectRoot, panel.sourceFile);
    return ejs.render(template, {
      panelName: panel.name,
      panelFile: relativePath,
    });
  };

  return {
    name: 'rozenite-client-plugin',
    async config(config) {
      if (config.root) {
        projectRoot = config.root;
      }

      rozeniteConfig = await loadConfig(
        path.resolve(projectRoot, 'rozenite.config.ts')
      );
      const panels = getPanels();

      config.server ??= {};
      config.server.open = false;
      config.server.port = 8888;

      config.build ??= {};
      config.build.rollupOptions ??= {};
      config.build.rollupOptions.input = {
        ...(config.build.rollupOptions.input as Record<string, string>),
        ...Object.fromEntries(
          panels.map((panel) => [panel.name, panel.htmlFile])
        ),
      };
    },

    resolveId(id) {
      const isPanel = getPanels().some((panel) => panel.htmlFile === id);

      if (isPanel) {
        return id;
      }

      return null;
    },

    load(id) {
      const panel = getPanels().find((panel) => panel.htmlFile === id);

      if (panel) {
        return generatePanelHtmlContent(panel);
      }

      return null;
    },

    async configureServer(server: ViteDevServer) {
      viteServer = server;
      const packageJSON = await getPackageJSON(projectRoot);

      server.middlewares.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader(
          'Access-Control-Allow-Methods',
          'GET, POST, PUT, DELETE, OPTIONS'
        );
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization'
        );

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        const panels = getPanels();
        const url = req.url || '/';

        if (url === '/rozenite.json') {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify(
              {
                name: packageJSON.name,
                version: packageJSON.version,
                description: packageJSON.description,
                panels: panels.map((panel) => ({
                  name: panel.label,
                  source: '/' + panel.htmlFile,
                })),
              },
              null,
              2
            )
          );
          return;
        }

        const panel = panels.find((panel) => '/' + panel.htmlFile === url);

        if (panel) {
          const htmlContent = generatePanelHtmlContent(panel);

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

    async generateBundle() {
      const panels = getPanels();
      const packageJSON = await getPackageJSON(projectRoot);

      this.emitFile({
        type: 'asset',
        fileName: 'rozenite.json',
        source: JSON.stringify({
          name: packageJSON.name,
          version: packageJSON.version,
          description: packageJSON.description,
          panels: panels.map((panel) => ({
            name: panel.label,
            source: '/' + panel.htmlFile,
          })),
        }),
      });
    },
  };
};
