import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
let server: Server, base: string;
const prefix = "/block-diagram-tool/";
const publicUrl = "https://yoinoranpu.github.io/block-diagram-tool/";
test.beforeAll(async () => {
  const root = resolve("dist");
  const types: Record<string, string> = { ".png": "image/png", ".svg": "image/svg+xml", ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".xml": "application/xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf" };
  server = createServer(async (req, res) => {
    const path = new URL(req.url!, "http://localhost").pathname;
    const file = resolve(root, path.slice(prefix.length) || "index.html");
    if (!path.startsWith(prefix) || !file.startsWith(root + "/")) {
      res.writeHead(404).end(); return;
    }
    try {
      const data = await readFile(file);
      res.writeHead(200, { "Content-Type": `${types[extname(file)] ?? "application/octet-stream"}; charset=utf-8` }).end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}${prefix}`;
});
test.afterAll(async () => { await new Promise<void>((done) => server.close(() => done())); });
test("公開URLと同じ階層で計算・案内ページ・サイトマップが動く", async ({ page, request }) => {
  const failed: string[] = [];
  page.on("requestfailed", (req) => failed.push(req.url()));
  await page.goto(base);
  await expect(page).toHaveTitle("制御工学計算ツール｜ブロック線図・伝達関数・状態空間表現");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", publicUrl);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /無料・ログイン不要/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", publicUrl + "og-card.png");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  for (const [file, width, height] of [["favicon-48.png", 48, 48], ["favicon-96.png", 96, 96], ["apple-touch-icon.png", 180, 180], ["og-card.png", 1200, 630]] as const) {
    const response = await request.get(base + file);
    expect(response.ok(), file).toBe(true);
    const bytes = await response.body();
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(bytes.readUInt32BE(16)).toBe(width);
    expect(bytes.readUInt32BE(20)).toBe(height);
  }
  const structured = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? "null");
  expect(structured["@type"]).toBe("WebApplication");
  expect(structured.url).toBe(publicUrl);
  await page.getByRole("button", { name: "全体の伝達関数を求める", exact: true }).click();
  await expect(page.locator(".result-status")).toBeVisible();
  await expect(page.locator(".loading-intro")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const sitemap = await request.get(base + "sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const links = await page.evaluate((xml) => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("サイトマップのXMLが不正です");
    return [...doc.querySelectorAll("loc")].map((n) => n.textContent!);
  }, await sitemap.text());
  expect(links).toEqual([publicUrl, ...["guide.html", "privacy.html", "feedback.html", "parallel.html", "state-space.html", "examples.html"].map((path) => publicUrl + path)]);
  for (const link of links) {
    expect(link.startsWith(publicUrl)).toBe(true);
    const response = await request.get(base + link.slice(publicUrl.length));
    expect(response.ok(), link).toBe(true);
    const html = await response.text();
    expect(html).not.toMatch(/noindex/i);
    expect(html).toContain(`rel="canonical" href="${link}"`);
  }
  await page.getByRole("navigation", { name: "サイト案内" }).getByRole("link", { name: "使い方・対応範囲" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ブロック線図・伝達関数の計算方法と使い方");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index,follow");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByRole("link", { name: "データの扱い", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("入力データ");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByRole("link", { name: "計算画面へ戻る" }).click();
  await expect(page.getByRole("button", { name: "全体の伝達関数を求める", exact: true })).toBeVisible();
  expect(failed).toEqual([]);
});
test("JavaScriptなしでも公開案内と使い方を読める", async ({ browser }, info) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: info.project.use.viewport });
  const page = await context.newPage();
  try {
    await page.goto(base);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ブロック線図");
    expect(await page.locator("noscript").textContent()).toContain("JavaScriptが必要");
    await expect(page.locator(".site-information")).toContainText("無料・ログイン不要");
    await page.getByRole("navigation", { name: "サイト案内" }).getByRole("link", { name: "使い方・対応範囲" }).click();
    await expect(page.getByRole("heading", { name: "文字係数・分数の入力" })).toBeVisible();
    await expect(page.locator("main")).toContainText("1/(L*C)");
  } finally { await context.close(); }
});

test("例題の解説はJavaScriptなしで読め、計算画面へ移動できる", async ({ browser }, info) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: info.project.use.viewport });
  const page = await context.newPage();
  try {
    await page.goto(base + "guide.html");
    for (const [file, text] of [["feedback.html", "単位フィードバック"], ["parallel.html", "通分"], ["state-space.html", "初期状態"]]) {
      await page.getByRole("navigation", { name: "関連する計算の解説" }).locator(`a[href="./${file}"]`).click();
      await expect(page.locator("main")).toContainText(text);
      expect(await page.locator("main math mfrac").count()).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByRole("link", { name: "無料の計算ツールで確認する" })).toHaveAttribute("href", "./");
    }
  } finally { await context.close(); }
});

test("例題一覧から問題・答えを確認し、入力済みの計算画面へ進める", async ({ page }, info) => {
  await page.goto(base + "examples.html");
  await expect(page).toHaveTitle(/ブロック線図の例題6選/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', publicUrl + 'examples.html');
  await expect(page.locator('.example-card')).toHaveCount(6);
  for (const id of ['series', 'parallel', 'negative', 'positive', 'multi', 'state']) {
    const card = page.locator('#' + id);
    await card.locator('summary').click();
    await expect(card.locator('.formula')).toBeVisible();
    await expect(card.getByRole('link', { name: 'この例題を編集して計算する' })).toHaveAttribute('href', './?example=' + id);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#multi').screenshot({ path: `/tmp/control-multi-${info.project.name}.png` });
  await page.locator('#series').getByRole('link', { name: 'この例題を編集して計算する' }).click();
  await expect(page.getByRole('complementary', { name: '例題の作業画面' })).toContainText('直列結合');
  await page.getByRole('button', { name: '全体の伝達関数を求める', exact: true }).click();
  await expect(page.locator('.result-status')).toBeVisible();
});
