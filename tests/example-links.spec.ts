import { test, expect } from '@playwright/test';
test('例題を開いて計算・復元・初期化でき、通常の作業データを保護する', async ({ page }) => {
  await page.goto('/');
  const original = await page.evaluate(() => localStorage.getItem('control-diagram-v1'));
  for (const id of ['series', 'parallel', 'negative', 'positive', 'multi']) {
    await page.goto('/?example=' + id);
    await expect(page.getByRole('complementary', { name: '例題の作業画面' })).toContainText('通常の作業とは別に保存');
    await page.getByRole('button', { name: '全体の伝達関数を求める', exact: true }).click();
    await expect(page.locator('.result-status')).toBeVisible();
    await expect(page.locator('.error')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('control-diagram-v1'))).toBe(original);
  }
  await page.goto('/?example=series');
  const initial = await page.evaluate(() => JSON.parse(localStorage.getItem('control-diagram-v1-example-series')!).diagram);
  await page.getByRole('button', { name: '新規線図', exact: true }).click();
  await page.reload();
  expect(await page.locator('.diagram-node').count()).toBe(0);
  await page.getByRole('button', { name: '例題を初期状態に戻す' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('control-diagram-v1-example-series')!).diagram)).toEqual(initial);
  await page.getByRole('link', { name: '通常の作業へ戻る' }).click();
  expect(await page.evaluate(() => localStorage.getItem('control-diagram-v1'))).toBe(original);
});
test('状態空間の入力済み例題も通常の保存を変更しない', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('control-state-space-v1', JSON.stringify({ A: [['-5']], B: ['3'], C: ['1'], D: '0' })));
  await page.goto('/?example=state');
  await expect(page.getByLabel('A(2,1)', { exact: true })).toHaveValue('-2');
  await expect(page.getByLabel('A(2,2)', { exact: true })).toHaveValue('-3');
  await page.getByLabel('A(2,1)', { exact: true }).fill('-4');
  await page.reload();
  await expect(page.getByLabel('A(2,1)', { exact: true })).toHaveValue('-4');
  await page.getByRole('button', { name: '例題を初期状態に戻す' }).click();
  await expect(page.getByLabel('A(2,1)', { exact: true })).toHaveValue('-2');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('control-state-space-v1')!).A)).toEqual([['-5']]);
});
