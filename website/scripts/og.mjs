// Renders og/og.html twice, as the social card (public/og-image.jpg, 1200x630) and the README
// banner (public/rozenite-banner.jpg, 1660x512), plus the PNG icons from public/favicon.svg.
// Run with `pnpm --filter @rozenite/docs og` after changing any of them. The READMEs load the
// banner from https://www.rozenite.dev/rozenite-banner.jpg, so they change after a deploy.
// Uses playwright-core's Chromium if installed (`pnpm --filter @rozenite/docs exec playwright-core
// install chromium`), otherwise a local Google Chrome.
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };

// A static server over the website folder. The card imports the dither module the site uses;
// it is served as JavaScript by stripping its types.
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path === '/og/dither.js') {
      const source = await readFile(join(root, 'src/components/site/dither.ts'), 'utf8');
      res.writeHead(200, { 'Content-Type': types['.js'] });
      res.end(stripTypeScriptTypes(source));
      return;
    }
    const file = join(root, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
try {
  const shots = [
    { query: '', width: 1200, height: 630, scale: 1, path: 'public/og-image.jpg' },
    // 1245x384 at 4/3 gives the banner's 1660x512.
    {
      query: '?format=banner',
      width: 1245,
      height: 384,
      scale: 4 / 3,
      path: 'public/rozenite-banner.jpg',
    },
  ];
  for (const { query, width, height, scale, path } of shots) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
    await page.goto(`http://127.0.0.1:${port}/og/og.html${query}`);
    await page.waitForFunction(() => /** @type {any} */ (window).ogReady === true);
    const png = await page.screenshot({ type: 'png' });
    await writeFile(
      join(root, path),
      await sharp(png).jpeg({ quality: 90, mozjpeg: true }).toBuffer(),
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

// The icons: the mark in the accent, on the page background for the ones a home screen shows.
const mark = (size, padding, background) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padding} ${-padding} ${7 + padding * 2} ${10 + padding * 2}" width="${size}" height="${size}" shape-rendering="crispEdges">${background ? `<rect x="${-padding - 10}" y="${-padding - 10}" width="40" height="40" fill="${background}"/>` : ''}<path d="M3 0h1v1h1v2h1v2h1v3h-1v1h-1v1h-3v-1h-1v-1h-1v-3h1v-2h1v-2h1z" fill="#ff4f7b"/></svg>`;
for (const [name, size, padding, background] of [
  ['favicon-32.png', 32, 0, ''],
  ['apple-touch-icon.png', 180, 2, '#0a0a0a'],
]) {
  const svg = Buffer.from(mark(size, padding, background));
  await writeFile(
    join(root, 'public', name),
    await sharp(svg)
      .resize(size, size, {
        fit: 'contain',
        background: background || { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer(),
  );
}
console.log('Wrote public/og-image.jpg, public/rozenite-banner.jpg and the PNG icons');
