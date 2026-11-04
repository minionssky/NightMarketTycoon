import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createPreviewServer } from '../../scripts/preview.mjs';

async function scenario(seed, run) {
  const server = createPreviewServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-11-04T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-11-04T12:00:01Z'));
    if (seed) await page.addInitScript(data => {
      if (localStorage.getItem('night_market_save_v1') === null)
        localStorage.setItem('night_market_save_v1', JSON.stringify(data));
    }, seed);
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await run(page); assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('night_market_save_v1')));
const legacy = (coins, totalEarned, stallLevel = 1) => ({ version: 1, coins, totalEarned, stallLevel, totalOrders: 42, lastSaveTime: 99 });

test('browser: initial book 1/3, locked details, navigation and all mobile widths', async () => {
  await scenario(null, async page => {
    await page.locator('#open-book').click();
    assert.match(await page.locator('#book-progress').textContent(), /1\/3/);
    for (const width of [320, 390, 720]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('[data-recipe-id="milk_tea"]').click();
      assert.match(await page.locator('#recipe-condition').textContent(), /500/);
      assert.match(await page.locator('#recipe-stats').textContent(), /25 金币 \/ 4 秒/);
      await page.locator('[data-recipe-id="fried_skewer"]').click();
      assert.match(await page.locator('#recipe-condition').textContent(), /2000/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/recipe-book-locked.png', fullPage: true });
    await page.locator('#close-book').click(); assert.equal(await page.locator('#market').isVisible(), true);
  });
});
test('browser: income crosses 500, one toast, tea order locks price/time during upgrade, reload keeps progress', async () => {
  await scenario(legacy(490, 490), async page => {
    await page.clock.runFor(1100); await page.locator('#cook').click(); await page.clock.runFor(2100);
    assert.equal(await page.locator('#unlock-dialog').isVisible(), true);
    assert.match(await page.locator('#unlock-message').textContent(), /奶茶/);
    assert.deepEqual((await saved(page)).notifiedRecipeIds, ['milk_tea']);
    assert.equal(await page.locator('#book-count').textContent(), '2/3');
    await page.locator('#dismiss-unlock').click();
    await page.clock.runFor(1100);
    assert.match(await page.locator('#customer').textContent(), /奶茶.*25/);
    await page.locator('#cook').click(); await page.locator('#upgrade').click();
    assert.equal(await page.locator('#coins').textContent(), '450');
    await page.clock.runFor(3900); assert.equal(await page.locator('#coins').textContent(), '450');
    await page.clock.runFor(200); assert.equal(await page.locator('#coins').textContent(), '475');
    assert.match(await page.locator('#details').textContent(), /Lv\.2/);
    await page.reload(); assert.equal(await page.locator('#coins').textContent(), '475');
    assert.equal(await page.locator('#unlock-dialog').isVisible(), false);
    assert.equal(await page.locator('#book-count').textContent(), '2/3');
    assert.equal((await saved(page)).totalEarned, 525);
    await page.clock.runFor(1100); assert.match(await page.locator('#customer').textContent(), /烤肠.*12/);
  });
});
test('browser: 1999 to 2000 unlocks skewer, book 3/3, all recipes rotate, popup stays read across restart', async () => {
  await scenario(legacy(123, 1999, 3), async page => {
    assert.match(await page.locator('#unlock-message').textContent(), /奶茶/); // Old save migration notice.
    const migrated = await saved(page);
    assert.equal(migrated.coins, 123); assert.equal(migrated.totalEarned, 1999);
    assert.equal(migrated.stallLevel, 3); assert.equal(migrated.totalOrders, 42);
    await page.locator('#dismiss-unlock').click();
    await page.locator('#open-book').click(); await page.locator('[data-recipe-id="fried_skewer"]').click();
    assert.match(await page.locator('#recipe-condition').textContent(), /还差 1/);
    await page.locator('#close-book').click();
    await page.clock.runFor(1100); await page.locator('#cook').click(); await page.clock.runFor(2100);
    assert.match(await page.locator('#unlock-message').textContent(), /炸串/);
    assert.equal(await page.locator('#unlock-dialog').isVisible(), true);
    assert.deepEqual((await saved(page)).notifiedRecipeIds, ['milk_tea', 'fried_skewer']);
    await page.locator('#dismiss-unlock').click();
    await page.clock.runFor(1100); assert.match(await page.locator('#customer').textContent(), /奶茶.*36/);
    await page.locator('#cook').click(); await page.clock.runFor(4100); await page.clock.runFor(1100);
    assert.match(await page.locator('#customer').textContent(), /炸串.*65/);
    await page.locator('#cook').click(); await page.clock.runFor(4900);
    assert.match(await page.locator('#customer').textContent(), /制作炸串/);
    await page.clock.runFor(200); assert.equal(await page.locator('#coins').textContent(), '238');
    await page.locator('#open-book').click();
    assert.match(await page.locator('#book-progress').textContent(), /3\/3/);
    await page.locator('[data-recipe-id="fried_skewer"]').click();
    assert.match(await page.locator('#recipe-condition').textContent(), /已解锁/);
    await page.screenshot({ path: 'artifacts/recipe-book-complete.png', fullPage: true });
    await page.reload(); assert.equal(await page.locator('#unlock-dialog').isVisible(), false);
    assert.equal(await page.locator('#book-count').textContent(), '3/3');
    assert.equal(await page.locator('#coins').textContent(), '238');
  });
});
test('browser: showing a migrated unlock notice marks it read before closing or restarting', async () => {
  await scenario(legacy(0, 2000), async page => {
    assert.match(await page.locator('#unlock-message').textContent(), /奶茶/);
    // Reload while the first modal is still open: it must not show milk tea again.
    await page.reload(); assert.match(await page.locator('#unlock-message').textContent(), /炸串/);
    await page.reload(); assert.equal(await page.locator('#unlock-dialog').isVisible(), false);
    assert.equal(await page.locator('#book-count').textContent(), '3/3');
  });
});
