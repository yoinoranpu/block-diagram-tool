// Render the original SVG artwork to PNGs for search engines and link previews.
// Requires Playwright Chromium and Japanese fonts (for example Noto Sans CJK JP).
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const publicDir = new URL('../public/', import.meta.url);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  for (const [source, output, width, height] of [
    ['favicon.svg', 'favicon-48.png', 48, 48],
    ['favicon.svg', 'favicon-96.png', 96, 96],
    ['favicon.svg', 'apple-touch-icon.png', 180, 180],
    ['og-card.svg', 'og-card.png', 1200, 630],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const svg = await readFile(new URL(source, publicDir), 'utf8');
    await page.setContent(`<html lang="ja"><style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}</html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: fileURLToPath(new URL(output, publicDir)), omitBackground: true });
    await page.close();
  }
} finally { await browser.close(); }
