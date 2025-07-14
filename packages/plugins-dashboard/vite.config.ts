/// <reference types='vitest' />
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const callstackDevtoolsStubPlugin = (): Plugin => {
  return {
    name: 'callstack-devtools-stub-plugin',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx.server) {
          return html.replace(
            '<head>',
            `<head>
              <script>
                window.callstack = {
                  devtools: {
                    panels: {
                      create: (name, icon, url) => {
                        console.log('Creating panel', name, icon, url);
                      },
                    },
                    plugins: [
                      {
                        id: '@callstack/plugins-dashboard',
                        name: 'Callstack DevTools Dashboard',
                        description: 'A plugin that displays a dashboard of all registered plugins',
                        website: 'http://localhost:3000',
                      },
                    ],
                  },
                };
              </script>`
          );
        }
        return html;
      },
    },
  };
};

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/plugins-dashboard',
  plugins: [react(), callstackDevtoolsStubPlugin()],
  base: './',
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: false,
    minify: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        panel: resolve(__dirname, './panel.html'),
        devtools: resolve(__dirname, './devtools.html'),
        background: resolve(__dirname, './background.ts'),
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
