import { test, expect } from '@playwright/test';
test('JSONのブロック名をHTMLとして実行せず、計算時にも外部へ入力を送らない', async ({ page }) => {
 const external: string[] = [];
 let dialog = false;
 page.on('request',request=>{if(new URL(request.url()).origin!==new URL('http://127.0.0.1:4173').origin) external.push(new URL(request.url()).origin);});
 page.on('dialog',async d=>{dialog=true;await d.dismiss();});
 await page.goto('/');
 const payload='<svg onload=alert(1)>';
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('control-diagram-v1')!));
 saved.diagram.nodes.find((n:{id:string})=>n.id==='g').label=payload;
 await page.locator('input[type=file]').setInputFiles({name:'diagram.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
 await expect(page.getByRole('button',{name:'伝達関数 '+payload,exact:true})).toBeVisible();
 expect(await page.locator('.diagram-canvas svg[onload]').count()).toBe(0);
 await page.getByRole('button',{name:'全体の伝達関数を求める',exact:true}).click();
 await expect(page.locator('.result-status')).toBeVisible();
 expect(dialog).toBe(false);
 expect(external).toEqual([]);
});
