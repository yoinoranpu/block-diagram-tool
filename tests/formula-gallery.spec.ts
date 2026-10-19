import { writeFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { cases } from "../src/formulaCases";
test("12種類の式を実入力し、全生成パターンをPC・スマホで表示", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: "02 伝達関数から線図" }).click();
  let total = 0;
  let bends = 0;
  for (let index = 0; index < cases.length; index++) {
    const [num, den] = cases[index];
    await page.getByLabel("伝達関数の分子", { exact: true }).fill(num);
    await page.getByLabel("伝達関数の分母", { exact: true }).fill(den);
    await page.getByRole("button", { name: "等価な線図を生成する" }).click();
    await expect(page.locator(".candidate-tabs button").first()).toBeVisible();
    const names = await page
      .locator(".candidate-tabs button")
      .allTextContents();
    for (const name of names) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect(page.locator(".candidate-section .verified")).toContainText(
        "厳密一致",
      );
      await expect(
        page.locator(".candidate-section .canvas-warning"),
      ).toHaveCount(0);
      total++;
      bends += await page
        .locator(".candidate-section .wire")
        .evaluateAll((paths) =>
          paths.reduce(
            (n, p) =>
              n +
              Math.max(
                0,
                ((p.getAttribute("d") || "").match(/L/g) || []).length - 1,
              ),
            0,
          ),
        );
      if ((index === 5 || index === 7) && name === "積分器による構成")
        await page
          .locator(".candidate-section")
          .screenshot({ path: info.outputPath(`formula-${index}.png`) });
    }
  }
  await writeFile(
    info.outputPath("routing-audit.json"),
    JSON.stringify({ formulas: cases.length, diagrams: total, bends }),
  );
  await info.attach("routing-audit.json", {
    body: JSON.stringify({ formulas: cases.length, diagrams: total, bends }),
    contentType: "application/json",
  });
  expect(total).toBe(27);
});

test("並列と正負フィードバックの例題を表示して配線を点検", async ({
  page,
}, info) => {
  await page.goto("/");
  for (const [name, bendLimit] of [
    ["並列", 4],
    ["負帰還", 2],
    ["正帰還", 2],
  ] as const) {
    await page.getByRole("button", { name, exact: true }).click();
    const bends = await page
      .locator(".input-panel .wire")
      .evaluateAll((paths) =>
        paths.reduce(
          (n, p) =>
            n +
            Math.max(
              0,
              ((p.getAttribute("d") || "").match(/L/g) || []).length - 1,
            ),
          0,
        ),
      );
    expect(bends).toBeLessThanOrEqual(bendLimit);
    await expect(page.locator(".input-panel .canvas-warning")).toHaveCount(0);
    await page
      .locator(".input-panel .canvas-shell")
      .screenshot({ path: info.outputPath(`${name}.png`) });
  }
});
