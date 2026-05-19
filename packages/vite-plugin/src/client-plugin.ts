import type { Plugin, ViteDevServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import ejs from 'ejs';
import { fileURLToPath } from 'node:url';
import { normalizePath } from 'vite';
import { loadConfig, RozeniteConfig } from './load-config.js';
import { getPackageJSON } from './package-json.js';
import { DEV_HOST_CONFIG_GLOBAL_KEY, DEV_HOST_STATE_ELEMENT_ID } from './dev-host/constants.js';
import {
  getBuiltDevHostAssets,
  getDevHostHtmlTemplate,
  getDevHostSourceEntryFile,
} from './dev-host/server.js';
import {
  ROZENITE_DEV_CONFIG_MODULE_ID,
  getRozeniteConfigPath,
  loadRozeniteDevConfigModule,
  resolveRozeniteDevConfigModuleId,
} from './dev-config-module.js';

type PanelEntry = {
  name: string;
  label: string;
  sourceFile: string;
  htmlFile: string;
};

type ManifestPanelEntry = {
  name: string;
  source: string;
};

type DevHostPanelEntry = {
  label: string;
  source: string;
};

type DevHostState = {
  packageName: string;
  packageDescription: string;
  panels: DevHostPanelEntry[];
};

const TEMPLATES_DIR = path.resolve(
  fileURLToPath(import.meta.url),
  '..',
  '..',
  'templates',
);

const PACKAGE_DIR = path.resolve(
  fileURLToPath(import.meta.url),
  '..',
  '..',
);

const DEV_HOST_SOURCE_ENTRY_FILE = getDevHostSourceEntryFile(PACKAGE_DIR);

const PANELS_DIR = './panels';
const DEVTOOLS_DIR = 'devtools';
const DEV_HOST_ROUTE = '/';

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
        htmlFile: `${name}.html`,
      };
    });
  };

  const PANEL_TEMPLATE = path.join(TEMPLATES_DIR, 'panel.ejs');

  const getManifestPanels = (): ManifestPanelEntry[] => {
    return getPanels().map((panel) => ({
      name: panel.label,
      source: `/${DEVTOOLS_DIR}/` + panel.htmlFile,
    }));
  };

  const getDevHostPanels = (): DevHostPanelEntry[] => {
    return getPanels().map((panel) => ({
      label: panel.label,
      source: `/${DEVTOOLS_DIR}/` + panel.htmlFile,
    }));
  };

  const generatePanelHtmlContent = (panel: PanelEntry): string => {
    const template = fs.readFileSync(PANEL_TEMPLATE, 'utf-8');
    const relativePath = path.relative(projectRoot, panel.sourceFile);
    return ejs.render(template, {
      panelName: panel.name,
      panelFile: relativePath,
    });
  };

  const getDevHostState = async (): Promise<DevHostState> => {
    const packageJSON = await getPackageJSON(projectRoot);

    return {
      packageName: packageJSON.name,
      packageDescription: packageJSON.description,
      panels: getDevHostPanels(),
    };
  };

  const serializeDevHostState = (state: DevHostState): string => {
    return JSON.stringify(state).replace(/</g, '\\u003c');
  };

  const toFsUrl = (filePath: string) => {
    return `/@fs${normalizePath(filePath)}`;
  };

  const getDevHostAssetTags = () => {
    const builtAssets = getBuiltDevHostAssets(PACKAGE_DIR);

    if (!builtAssets) {
      return [
        {
          tag: 'script',
          attrs: {
            type: 'module',
            src: toFsUrl(DEV_HOST_SOURCE_ENTRY_FILE),
          },
          injectTo: 'body' as const,
        },
      ];
    }

    return [
      ...builtAssets.styles.map((stylePath) => ({
        tag: 'link',
        attrs: {
          rel: 'stylesheet',
          href: toFsUrl(stylePath),
        },
        injectTo: 'head' as const,
      })),
      {
        tag: 'script',
        attrs: {
          type: 'module',
          src: toFsUrl(builtAssets.script),
        },
        injectTo: 'body' as const,
      },
    ];
  };

  return {
    name: 'rozenite-client-plugin',
    async config(config) {
      if (config.root) {
        projectRoot = config.root;
      }

      rozeniteConfig = await loadConfig(getRozeniteConfigPath(projectRoot));
      const panels = getPanels();

      config.server ??= {};
      config.server.open =
        config.server.open === true
          ? DEV_HOST_ROUTE
          : (config.server.open ?? DEV_HOST_ROUTE);
      // Keep in sync with `DEV_SERVER_URL` in packages/runtime/src/dev-mode.ts
      config.server.port = 8888;

      config.build ??= {};
      config.build.rollupOptions ??= {};
      config.build.rollupOptions.input = {
        ...(config.build.rollupOptions.input as Record<string, string>),
        ...Object.fromEntries(
          panels.map((panel) => [
            panel.name,
            `${DEVTOOLS_DIR}/${panel.htmlFile}`,
          ]),
        ),
      };
      config.build.rollupOptions.output = {
        assetFileNames: `${DEVTOOLS_DIR}/assets/[name]-[hash][extname]`,
        chunkFileNames: `${DEVTOOLS_DIR}/assets/[name]-[hash].js`,
        entryFileNames: `${DEVTOOLS_DIR}/assets/[name]-[hash].js`,
        ...(config.build.rollupOptions.output ?? {}),
      };
    },

    resolveId(id) {
      const devConfigModuleId = resolveRozeniteDevConfigModuleId(id);

      if (devConfigModuleId) {
        return devConfigModuleId;
      }

      const isPanel = getPanels().some(
        (panel) => `${DEVTOOLS_DIR}/${panel.htmlFile}` === id,
      );

      if (isPanel) {
        return id;
      }

      return null;
    },

    load(id) {
      const devConfigModule = loadRozeniteDevConfigModule(id, projectRoot);

      if (devConfigModule) {
        return devConfigModule;
      }

      const panel = getPanels().find(
        (panel) => `${DEVTOOLS_DIR}/${panel.htmlFile}` === id,
      );

      if (panel) {
        return generatePanelHtmlContent(panel);
      }

      return null;
    },

    async transformIndexHtml(_html, context) {
      const pathname = context?.path ?? DEV_HOST_ROUTE;

      if (pathname !== DEV_HOST_ROUTE) {
        return;
      }

      const state = await getDevHostState();

      return [
        {
          tag: 'script',
          attrs: {
            id: DEV_HOST_STATE_ELEMENT_ID,
            type: 'application/json',
          },
          children: serializeDevHostState(state),
          injectTo: 'body',
        },
        {
          tag: 'script',
          attrs: {
            type: 'module',
          },
          children: `import rozeniteConfig from ${JSON.stringify(ROZENITE_DEV_CONFIG_MODULE_ID)}; window[${JSON.stringify(DEV_HOST_CONFIG_GLOBAL_KEY)}] = rozeniteConfig.dev ?? {};`,
          injectTo: 'body',
        },
        {
          tag: 'meta',
          attrs: {
            name: 'rozenite-dev-host',
            content: 'true',
          },
          injectTo: 'head',
        },
        ...getDevHostAssetTags(),
      ];
    },

    async configureServer(server: ViteDevServer) {
      viteServer = server;
      const packageJSON = await getPackageJSON(projectRoot);

      server.middlewares.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader(
          'Access-Control-Allow-Methods',
          'GET, POST, PUT, DELETE, OPTIONS',
        );
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization',
        );

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        const panels = getPanels();
        const requestUrl = req.url || '/';
        const url = new URL(requestUrl, 'http://localhost').pathname;

        if (url === DEV_HOST_ROUTE) {
          server
            .transformIndexHtml(requestUrl, getDevHostHtmlTemplate())
            .then((html) => {
              res.setHeader('Content-Type', 'text/html');
              res.end(html);
            })
            .catch((err) => {
              next(err);
            });
          return;
        }

        if (url === '/rozenite.json') {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify(
              {
                name: packageJSON.name,
                version: packageJSON.version,
                description: packageJSON.description,
                panels: getManifestPanels(),
              },
              null,
              2,
            ),
          );
          return;
        }

        const panel = panels.find(
          (panel) => `/${DEVTOOLS_DIR}/` + panel.htmlFile === url,
        );

        if (panel) {
          const htmlContent = generatePanelHtmlContent(panel);

          server
            .transformIndexHtml(requestUrl, htmlContent)
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
      const packageJSON = await getPackageJSON(projectRoot);

      this.emitFile({
        type: 'asset',
        fileName: 'rozenite.json',
        source: JSON.stringify({
          name: packageJSON.name,
          version: packageJSON.version,
          description: packageJSON.description,
          panels: getManifestPanels(),
        }),
      });
    },
  };
};
