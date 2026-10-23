import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => { await page.goto("/"); });
test("状態空間に-R/Lなどの文字入り分数を入力し、回路と力学の例題を検算できる", async ({ page }, info) => {
  test.setTimeout(60000);
  await page.getByRole("button", { name: "03 状態空間表現から" }).click();
  await expect(page.locator(".state-expression-help")).toContainText("-R/L");
  for (const [id, order] of [["rl", "1"], ["rc", "1"], ["rlc", "2"], ["mechanical", "2"]]) {
    await page.getByLabel("回路・力学の例題", { exact: true }).selectOption(id);
    await expect(page.getByLabel("状態数", { exact: true })).toHaveValue(order);
    await expect(page.locator(".physical-example-guide")).toBeVisible();
    if (id === "rlc") {
      await expect(page.getByLabel("A(2,2)", { exact: true })).toHaveValue("-R/L");
      await page.getByLabel("A(2,2)", { exact: true }).fill("－Ｒ／Ｌ");
      await expect(page.getByLabel("A(2,2)", { exact: true })).toHaveValue("-R/L");
      await expect(page.getByLabel("B(2)", { exact: true })).toHaveValue("1/L");
    }
    await page.getByRole("button", { name: "伝達関数と状態変数線図を求める" }).click();
    await expect(page.locator(".result-status")).toContainText("厳密計算済み");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator(".katex-error")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (id === "rlc") {
      await page.locator(".state-input").screenshot({ path: info.outputPath("rlc-state-input.png") });
      await page.getByRole("button", { name: "この線図を編集する →", exact: true }).click();
      await page.getByRole("button", { name: "全体の伝達関数を求める", exact: true }).click();
      await expect(page.locator(".result-status")).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
      await page.getByRole("button", { name: "03 状態空間表現から" }).click();
    }
  }
});
test("線図と伝達関数のタブでもRLC回路を読み込んで計算できる", async ({ page }) => {
  await page.getByLabel("回路・力学の例題", { exact: true }).selectOption("rlc");
  await expect(page.locator(".notice")).toContainText("コンデンサ");
  await page.getByRole("button", { name: "全体の伝達関数を求める", exact: true }).click();
  await expect(page.locator(".result-status")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "02 伝達関数から線図" }).click();
  await page.getByLabel("回路・力学の例題", { exact: true }).selectOption("rlc");
  await expect(page.getByLabel("伝達関数の分子", { exact: true })).toHaveValue("1");
  await expect(page.getByLabel("伝達関数の分母", { exact: true })).toHaveValue("L*C*s^2+R*C*s+1");
  await page.getByRole("button", { name: "等価な線図を生成する" }).click();
  await expect(page.locator(".result-status")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
