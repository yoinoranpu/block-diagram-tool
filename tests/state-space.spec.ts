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
    page.getByRole("img", { name: "全信号を線で接続した状態変数線図" }),
  ).toBeVisible();
  await expect(page.locator(".state-connected")).toContainText("x₂");
  await expect(page.locator(".state-connected")).not.toContainText("Σ");
  await page.getByRole("button", { name: "ラベルで接続", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "入力した行列に対応する状態変数線図" }),
  ).toBeVisible();
  await expect(page.locator(".state-diagram")).toContainText("x₂");
  await page
    .getByRole("button", { name: "すべて線で接続", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "全信号を線で接続した状態変数線図" }),
  ).toBeVisible();
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
    else expect(bytes.toString()).toContain("x₂");
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
  await expect(page.locator(".state-connected")).toContainText("x₃");
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

test("画像の例を整数係数とsの降べき順で表示する", async ({ page }, info) => {
  await page.getByRole("textbox", { name: "A(2,1)", exact: true }).fill("-6");
  await page.getByRole("textbox", { name: "A(2,2)", exact: true }).fill("5");
  await page.getByRole("textbox", { name: "B(2)", exact: true }).fill("-2");
  await page
    .getByRole("button", { name: "伝達関数と状態変数線図を求める" })
    .click();
  await expect(page.locator(".result-formula .formula")).toHaveAttribute(
    "aria-label",
    "\\frac{-2}{\\left(s-2\\right)\\left(s-3\\right)}",
  );
  await page.getByText("展開形を表示", { exact: true }).click();
  await expect(page.locator(".expanded-expression .formula")).toHaveAttribute(
    "aria-label",
    "\\frac{-2}{s^{2}-5s+6}",
  );
  await page.getByText("テキスト式を表示", { exact: true }).click();
  await expect(page.locator(".text-expression code")).toHaveText(
    "(-2)/(s^2-5*s+6)",
  );
  await page
    .locator(".result-card")
    .screenshot({ path: info.outputPath("integer-coefficients.png") });
});

test("密な3次行列の全25要素をブラウザWorkerで接続する", async ({
  page,
}, info) => {
  await page.getByRole("button", { name: "3次の例題", exact: true }).click();
  for (let i = 1; i <= 3; i++)
    for (let j = 1; j <= 3; j++)
      await page
        .getByRole("textbox", { name: `A(${i},${j})`, exact: true })
        .fill(String((i - 1) * 3 + j));
  for (let i = 1; i <= 3; i++) {
    await page.getByRole("textbox", { name: `B(${i})`, exact: true }).fill("1");
    await page.getByRole("textbox", { name: `C(${i})`, exact: true }).fill("1");
  }
  await page.getByRole("textbox", { name: "D", exact: true }).fill("1");
  await page
    .getByRole("button", { name: "伝達関数と状態変数線図を求める" })
    .click();
  await expect(page.locator(".state-connected-node")).toHaveCount(25, {
    timeout: 15000,
  });
  await expect(page.locator(".state-connected-edge")).toHaveCount(36);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .locator(".state-connected")
    .screenshot({ path: info.outputPath("dense-connected.png") });
});

test("並列状態の自己帰還を積分器の直下と次の状態経路の間へ置く", async ({ page }, info) => {
  for (let i = 1; i <= 2; i++) {
    for (let j = 1; j <= 2; j++)
      await page.getByRole("textbox", { name: `A(${i},${j})`, exact: true })
        .fill(i === j ? String(i + 1) : "0");
    await page.getByRole("textbox", { name: `B(${i})`, exact: true }).fill(i === 1 ? "2" : "-2");
    await page.getByRole("textbox", { name: `C(${i})`, exact: true }).fill("1");
  }
  await page.getByRole("textbox", { name: "D", exact: true }).fill("0");
  await page.getByRole("button", { name: "伝達関数と状態変数線図を求める" }).click();
  await expect(page.locator(".state-connected-node")).toHaveCount(13);
  await expect(page.getByRole("alert")).toHaveCount(0);
  const point = async (id: string) => {
    const box = await page.locator(`.state-connected-node[data-node-id="${id}"] .node-body`).boundingBox();
    return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  };
  const x1 = await point("x1"), x2 = await point("x2");
  const a11 = await point("A11"), a22 = await point("A22");
  expect(a11.x).toBeCloseTo(x1.x, 1);
  expect(a22.x).toBeCloseTo(x2.x, 1);
  expect(x2.x).toBeCloseTo(x1.x, 1);
  expect(a11.y).toBeGreaterThan(x1.y);
  expect(a11.y).toBeLessThan(x2.y);
  expect(a22.y).toBeGreaterThan(x2.y);
  expect((await point("B2")).x).toBeCloseTo((await point("B1")).x, 1);
  await page.locator(".state-connected").screenshot({ path: info.outputPath("diagonal-feedback.png") });
});
