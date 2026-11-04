import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createPreviewServer } from '../../scripts/preview.mjs';

async function scenario(seed, run, failWrites = false) {
  const server = createPreviewServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-11-04T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-11-04T12:00:01Z'));
    await page.addInitScript(({ seed, failWrites }) => {
      if (!localStorage.getItem('night_market_save_v1')) localStorage.setItem('night_market_save_v1', JSON.stringify(seed));
      window.failRewardWrites = failWrites;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (window.failRewardWrites && key === 'night_market_save_v1') throw Error('test quota');
        return original.call(this, key, value);
      };
    }, { seed, failWrites });
    await page.goto(`http://127.0.0.1:${server.address().port}`); await run(page); assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
const seed = lastSaveTime => ({ version: 1, coins: 0, totalEarned: 0, stallLevel: 1, totalOrders: 0, lastSaveTime, notifiedRecipeIds: [] });
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('night_market_save_v1')));

test('rewards UI: free offline base, failed/skipped ads, duplicate callback once, refresh and recipe consistency', async () => {
  await scenario(seed(Date.parse('2026-11-04T11:00:01Z')), async page => {
    await page.locator('#open-offline').click(); assert.match(await page.locator('#offline-summary').textContent(), /360 金币/);
    assert.equal(await page.locator('#offline-ad').isDisabled(), true);
    await page.locator('#claim-offline').click(); assert.equal(await page.locator('#coins').textContent(), '360');
    assert.equal(await page.locator('#claim-offline').isDisabled(), true);
    for (const [mode, text] of [['cancel', '提前关闭'], ['error', '加载失败']]) {
      await page.locator('#mock-mode').selectOption(mode); await page.locator('#offline-ad').click();
      await page.waitForFunction(text => document.getElementById('reward-status').textContent.includes(text), text);
      assert.equal(await page.locator('#coins').textContent(), '360');
    }
    await page.locator('#mock-mode').selectOption('duplicate'); await page.locator('#offline-ad').click();
    await page.waitForFunction(() => document.getElementById('reward-status').textContent.includes('领取成功'));
    assert.equal(await page.locator('#coins').textContent(), '720'); assert.equal(await page.locator('#book-count').textContent(), '2/3');
    assert.equal((await stored(page)).totalOrders, 0); assert.equal((await stored(page)).totalEarned, 720);
    await page.screenshot({ path: 'artifacts/phase4/offline-390.png', fullPage: true });
    await page.locator('#close-rewards').click(); await page.locator('#dismiss-unlock').click();
    await page.reload(); assert.equal(await page.locator('#coins').textContent(), '720');
    await page.locator('#open-offline').click(); assert.equal(await page.locator('#claim-offline').isDisabled(), true);
    assert.equal(await page.locator('#offline-ad').isDisabled(), true);
    await page.locator('#close-rewards').click(); await page.locator('#open-tasks').click();
    await page.locator('[data-task="coins_300"]').click(); assert.equal(await page.locator('#coins').textContent(), '780');
    assert.equal(await page.locator('[data-task="coins_300"]').isDisabled(), true);
  });
});
test('rewards UI: history is not daily progress; five orders, task once, order ad and responsive close/reopen', async () => {
  const initial = { ...seed(0), totalOrders: 15, totalEarned: 200 };
  await scenario(initial, async page => {
    await page.locator('#open-tasks').click(); assert.match(await page.locator('#daily-period').textContent(), /今日 0 单/);
    assert.equal(await page.locator('[data-task="orders_5"]').isDisabled(), true); await page.locator('#close-rewards').click();
    for (let i = 0; i < 5; i++) { await page.clock.runFor(1100); await page.locator('#cook').click(); await page.clock.runFor(2100); }
    await page.locator('#open-tasks').click(); await page.locator('[data-task="orders_5"]').click();
    assert.equal(await page.locator('#coins').textContent(), '80');
    await page.locator('#mock-mode').selectOption('error'); await page.locator('#order-ad').click();
    await page.waitForFunction(() => document.getElementById('reward-status').textContent.includes('加载失败'));
    assert.equal(await page.locator('#coins').textContent(), '80');
    await page.locator('#mock-mode').selectOption('duplicate'); await page.locator('#order-ad').click();
    await page.waitForFunction(() => document.getElementById('reward-status').textContent.includes('领取成功'));
    assert.equal(await page.locator('#coins').textContent(), '90');
    for (const width of [320, 390, 720]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.ok(await page.locator('#close-rewards').isVisible());
      await page.screenshot({ path: `artifacts/phase4/tasks-${width}.png`, fullPage: true });
    }
    await page.locator('#close-rewards').click(); await page.reload();
    await page.locator('#open-tasks').click(); assert.equal(await page.locator('[data-task="orders_5"]').textContent(), '已领取');
    assert.equal(await page.locator('#order-ad').isDisabled(), true); assert.equal(await page.locator('#coins').textContent(), '90');
    assert.equal((await stored(page)).totalOrders, 20); assert.equal((await stored(page)).progress.daily.orders, 5);
  });
});
test('rewards UI: failed persistence shows error, keeps zero coins and permits retry', async () => {
  await scenario(seed(Date.parse('2026-11-04T11:00:01Z')), async page => {
    await page.locator('#open-offline').click(); await page.locator('#claim-offline').click();
    assert.match(await page.locator('#reward-status').textContent(), /存档失败/); assert.equal(await page.locator('#coins').textContent(), '0');
    await page.evaluate(() => { window.failRewardWrites = false; }); await page.locator('#claim-offline').click();
    assert.equal(await page.locator('#coins').textContent(), '360'); assert.match(await page.locator('#reward-status').textContent(), /领取成功/);
  }, true);
});
