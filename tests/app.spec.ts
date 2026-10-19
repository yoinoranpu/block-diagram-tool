import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("負帰還・複数ループの計算と答えの比較", async ({ page }) => {
  await page.getByRole("button", { name: "全体の伝達関数を求める" }).click();
  await expect(page.locator(".result-status")).toBeVisible();
  await expect(page.locator(".error")).toHaveCount(0);
  await page.getByText("別の答えと等価か比較する", { exact: true }).click();
  await page.getByLabel("比較する式の分子").fill("K");
  await page.getByLabel("比較する式の分母").fill("s+a+K");
  await page.getByRole("button", { name: "等価性を確認", exact: true }).click();
  await expect(page.locator(".comparison")).toContainText(
    "有理式として等価です",
  );
  await page.getByRole("button", { name: "複数ループ", exact: true }).click();
  await expect(page.locator(".result-status")).toHaveCount(0);
  await page.getByRole("button", { name: "全体の伝達関数を求める" }).click();
  await expect(page.locator(".result-status")).toBeVisible();
  await expect(page.locator(".error")).toHaveCount(0);
});
test("生成した全パターンを検証し、編集して再計算できる", async ({ page }) => {
  await page.getByRole("button", { name: "02 伝達関数から線図" }).click();
  await page.getByRole("button", { name: "等価な線図を生成する" }).click();
  await expect(page.locator(".candidate-tabs button")).toHaveCount(4);
  for (const title of [
    "単一ブロック",
    "ゲイン分離",
    "因数による直列構成",
    "積分器による構成",
  ]) {
    await page.getByRole("button", { name: title, exact: true }).click();
    await expect(page.locator(".verified")).toContainText("厳密一致");
  }
  await page.getByRole("button", { name: "この線図を編集する" }).click();
  await page.getByRole("button", { name: "全体の伝達関数を求める" }).click();
  await expect(page.locator(".result-status")).toBeVisible();
  await expect(page.locator(".error")).toHaveCount(0);
});
test("ブロックの編集、移動、複製、削除、元に戻す、やり直す", async ({
  page,
}) => {
  await page.getByRole("button", { name: "直列", exact: true }).click();
  await page
    .getByRole("button", { name: "伝達関数 G", exact: true })
    .first()
    .click();
  await page.getByLabel("選択ブロックの分子").fill("a");
  await page.getByRole("button", { name: "要素を→へ移動" }).click();
  await page.getByRole("button", { name: "複製", exact: true }).click();
  await expect(page.locator(".diagram-node")).toHaveCount(5);
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await expect(page.locator(".diagram-node")).toHaveCount(4);
  await page.getByRole("button", { name: "元に戻す", exact: true }).click();
  await expect(page.locator(".diagram-node")).toHaveCount(5);
  await page.getByRole("button", { name: "やり直す", exact: true }).click();
  await expect(page.locator(".diagram-node")).toHaveCount(4);
  await page.reload();
  await expect(page.locator(".diagram-node")).toHaveCount(4);
  await page
    .getByRole("button", { name: "伝達関数 G", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("選択ブロックの分子")).toHaveValue("a");
});
test("接続口を順番に押して配線、符号を変更", async ({ page }) => {
  await page.getByRole("button", { name: "直列", exact: true }).click();
  // Remove an edge via its accessible inspector after selecting its hit path.
  await page
    .locator(".diagram-canvas > g")
    .first()
    .locator("path")
    .last()
    .dispatchEvent("click");
  await page.getByRole("button", { name: "配線を削除" }).click();
  await page
    .getByRole("button", { name: "入力 の出力接続口", exact: true })
    .click();
  await page
    .getByRole("button", { name: "G の入力接続口", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "全体の伝達関数を求める" }).click();
  await expect(page.locator(".result-status")).toBeVisible();
  await page.getByRole("button", { name: "負帰還", exact: true }).click();
  const minus = page.getByRole("button", {
    name: "加算点の入力符号 マイナス。押すと切り替え",
  });
  await expect(minus).toHaveCount(1);
  await minus.click();
  await expect(minus).toHaveCount(0);
});
test("JSONの書き出し・読み込みと不正データの拒否", async ({ page }) => {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON保存" }).click();
  const path = await (await download).path();
  expect(path).toBeTruthy();
  await page.getByRole("button", { name: "直列", exact: true }).click();
  await expect(page.locator(".diagram-node")).toHaveCount(4);
  await page.locator("input[type=file]").setInputFiles(path!);
  await expect(page.locator(".diagram-node")).toHaveCount(6);
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":2}'),
    });
  await expect(page.locator(".error")).toContainText("対応していないJSON形式");
  await expect(page.locator(".diagram-node")).toHaveCount(6);
});
test("不正な式は答えを作らずエラーを表示、画面幅を維持", async ({ page }) => {
  await page.getByRole("button", { name: "02 伝達関数から線図" }).click();
  await page.getByLabel("伝達関数の分母", { exact: true }).fill("0");
  await page.getByRole("button", { name: "等価な線図を生成する" }).click();
  await expect(page.locator(".error")).toContainText("分母が恒等的に0");
  await expect(page.locator(".result-status")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
