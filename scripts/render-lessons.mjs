// Shared static lesson template: render math at build time, without client JavaScript.
import katex from 'katex';
import { readdir, readFile, writeFile } from 'node:fs/promises';
const folder = new URL('../content/lessons/', import.meta.url);
for (const name of await readdir(folder)) {
  if (!name.endsWith('.html')) continue;
  const source = await readFile(new URL(name, folder), 'utf8');
  const html = source.replace(/<!-- math( display)? -->([\s\S]*?)<!-- \/math -->/g, (_, display, tex) => {
    const rendered = katex.renderToString(tex, { output: 'mathml', displayMode: Boolean(display), throwOnError: true, trust: false, strict: 'error' });
    return display ? `<div class="lesson-math-display">${rendered}</div>` : rendered;
  });
  const breadcrumb = `<nav class="lesson-breadcrumb" aria-label="現在位置"><a href="./">計算ツール</a> / <a href="./examples.html">例題と解説</a></nav>`;
  const finalHtml = html.replace('<main>', '<main>' + breadcrumb);
  await writeFile(new URL(`../public/${name}`, import.meta.url), finalHtml);
}
