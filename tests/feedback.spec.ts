import { test, expect } from "@playwright/test";
test("選択ですぐ名前と分数を編集でき、名前を保存・復元できる", async ({ page }, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "直列", exact: true }).click();
  await page.locator(".diagram-canvas").scrollIntoViewIfNeeded();
  const before = await page.locator(".diagram-canvas").boundingBox();
  const camera = await page.locator(".diagram-canvas").getAttribute("viewBox");
  await page.getByRole("button", { name: "伝達関数 G", exact: true }).click();
  const editor = page.getByRole("region", { name: "ブロックを編集", exact: true });
  await expect(editor).toBeVisible();
  for (const name of ["ブロックの名前", "選択ブロックの分子", "選択ブロックの分母"]) {
    const box = await page.getByLabel(name, { exact: true }).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  }
  expect((await page.locator(".diagram-canvas").boundingBox())!.y).toBeCloseTo(before!.y, 1);
  expect(await page.locator(".diagram-canvas").getAttribute("viewBox")).toBe(camera);
  await page.getByLabel("ブロックの名前", { exact: true }).fill("モーター");
  await page.getByLabel("選択ブロックの分子").fill("２Ｋ");
  await page.getByLabel("選択ブロックの分母").fill("ｓ＋１");
  await expect(page.getByLabel("選択ブロックの分子")).toHaveValue("2K");
  await page.getByLabel("選択ブロックの分子").fill("2*K");
  await page.screenshot({ path: info.outputPath("quick-block-editor.png") });
  await page.getByRole("button", { name: "編集欄を閉じる" }).click();
  await expect(page.getByRole("button", { name: "伝達関数 モーター", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "伝達関数 モーター", exact: true }).click();
  await expect(page.getByLabel("ブロックの名前", { exact: true })).toHaveValue("モーター");
  await expect(page.getByLabel("選択ブロックの分母")).toHaveValue("s+1");
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 360 });
  await expect.poll(async () => {
    const box = await editor.boundingBox();
    return !!box && box.y >= 0 && box.y + box.height <= 360;
  }).toBe(true);
});
test("線図と式からの答えは展開形を先に表示し、因数形も見られる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "02 伝達関数から線図" }).click();
  await page.getByLabel("伝達関数の分子", { exact: true }).fill("1");
  await page.getByLabel("伝達関数の分母", { exact: true }).fill("(s+1)*(s+2)");
  await page.getByRole("button", { name: "等価な線図を生成する" }).click();
  await expect(page.locator(".result-formula .formula")).toHaveAttribute("aria-label", "\\frac{1}{s^{2}+3s+2}");
  await page.getByText("因数形を表示", { exact: true }).click();
  await expect(page.locator(".expanded-expression .formula")).toHaveAttribute("aria-label", "\\frac{1}{\\left(s+1\\right)\\left(s+2\\right)}");
  await page.getByRole("button", { name: "この線図を編集する →", exact: true }).click();
  await expect(page.locator(".result-formula .formula")).toHaveAttribute("aria-label", "\\frac{1}{s^{2}+3s+2}");
});
