import { test, expect } from '@playwright/test';
test('キーボードでブロック編集を開始し、閉じると同じ要素へ戻る', async ({ page }) => {
  await page.goto('/');
  const block = page.getByRole('button', { name: '伝達関数 G', exact: true });
  await block.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('選択ブロックの分子')).toBeFocused();
  await page.getByLabel('選択ブロックの分子').fill('2');
  await page.keyboard.press('Escape');
  await expect(block).toBeFocused();
  await expect(page.getByRole('region', { name: 'ブロックを編集' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '拡大', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '全体表示', exact: true })).toBeVisible();
});
test('スマホで要素追加を隠さず、計算後に答えの先頭へ移動できる', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  await page.goto('/');
  for (const name of ['伝達関数', '加算点', '分岐点', '入力', '出力']) {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeInViewport();
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: '全体の伝達関数を求める', exact: true }).click();
  const result = page.getByRole('complementary', { name: '計算結果' });
  await expect(result).toBeFocused();
  await expect.poll(async () => Math.abs((await result.boundingBox())!.y - 12)).toBeLessThan(15);
  await page.getByRole('link', { name: '図・式を編集する場所へ戻る' }).click();
  await expect(page.getByRole('heading', { name: 'ブロック線図を作る' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
