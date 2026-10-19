import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "03 状態空間表現から" }).click();
});
test("文字係数から伝達関数と元の状態変数線図を表示し、PNG・SVGを保存", async ({
  page,
}, info) => {
  await page
    .getByRole("button", { name: "伝達関数と状態変数線図を求める" })
    .click();
  await expect(page.locator(".result-status")).toContainText("厳密計算済み");
  await expect(
    page.getByRole("img", { name: "入力した行列に対応する状態変数線図" }),
  ).toBeVisible();
  await expect(page.locator(".state-diagram")).toContainText("x2");
  await expect(page.locator(".state-diagram")).not.toContainText("Σ");
  await page.getByText("テキスト式を表示", { exact: true }).click();
  await expect(page.locator(".text-expression code")).toContainText("K");
  await page.getByText("計算過程・成立条件", { exact: true }).click();
  await expect(page.locator(".state-output")).toContainText("det(sI−A)");
  await page
    .locator(".state-workspace")
    .screenshot({ path: info.outputPath("state-space.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const format of ["PNG", "SVG"]) {
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("button", { name: `${format}保存`, exact: true })
      .click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(
      `control-diagram.${format.toLowerCase()}`,
    );
    const path = await download.path();
    const { readFile } = await import("node:fs/promises");
    const bytes = await readFile(path!);
    if (format === "PNG")
      expect([...bytes.subarray(0, 8)]).toEqual([
        137, 80, 78, 71, 13, 10, 26, 10,
      ]);
    else expect(bytes.toString()).toContain("x2");
  }
});
test("3次とD、編集後の再計算、入力の自動保存とJSONの往復", async ({ page }) => {
  await page.getByRole("button", { name: "3次の例題", exact: true }).click();
  await page.getByRole("textbox", { name: "D", exact: true }).fill("２");
  await expect(
    page.getByRole("textbox", { name: "D", exact: true }),
  ).toHaveValue("2");
  await page
    .getByRole("button", { name: "伝達関数と状態変数線図を求める" })
    .click();
  await expect(page.locator(".result-status")).toBeVisible();
  await expect(page.locator(".state-diagram")).toContainText("x3");
  await page.getByRole("textbox", { name: "D", exact: true }).fill("0");
  await expect(page.locator(".result-status")).toHaveCount(0);
  await page.getByRole("button", { name: "01 線図から伝達関数" }).click();
  await page.getByRole("button", { name: "03 状態空間表現から" }).click();
  await expect(page.getByLabel("状態数", { exact: true })).toHaveValue("3");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "行列をJSON保存" }).click();
  const path = await (await downloading).path();
  await page.getByRole("button", { name: "2次の例題", exact: true }).click();
  await page.locator(".state-workspace input[type=file]").setInputFiles(path!);
  await expect(page.getByLabel("状態数", { exact: true })).toHaveValue("3");
  await page.getByRole("textbox", { name: "A(1,1)", exact: true }).fill("");
  await page.reload();
  await page.getByRole("button", { name: "03 状態空間表現から" }).click();
  await expect(
    page.getByRole("textbox", { name: "A(1,1)", exact: true }),
  ).toHaveValue("");
});
test("状態数を変更し、係数sの誤りを成分付きで表示する", async ({ page }) => {
  await page.getByLabel("状態数", { exact: true }).selectOption("1");
  await page.getByRole("textbox", { name: "A(1,1)", exact: true }).fill("s");
  await page
    .getByRole("button", { name: "伝達関数と状態変数線図を求める" })
    .click();
  await expect(page.getByRole("alert")).toContainText("A(1,1)");
  await page.getByRole("textbox", { name: "A(1,1)", exact: true }).fill("-a");
  await page.getByRole("textbox", { name: "B(1)", exact: true }).fill("Ｋ");
  await page
    .getByRole("button", { name: "伝達関数と状態変数線図を求める" })
    .click();
  await expect(page.locator(".result-status")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
