import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createPreviewServer } from '../../scripts/preview.mjs';

async function scenario(run, reducedMotion = 'no-preference') {
  const server = createPreviewServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-11-04T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-11-04T12:00:01Z'));
    await page.addInitScript(() => {
      if (!localStorage.getItem('night_market_save_v1')) localStorage.setItem('night_market_save_v1', JSON.stringify({
        version: 1, coins: 50, totalEarned: 50, totalOrders: 5, stallLevel: 1, lastSaveTime: 0,
      }));
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`); await run(page); assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
async function assertCtaLayout(page) {
  const positions = await page.evaluate(() => {
    const ids = ['cook', 'upgrade', 'open-book'];
    return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
      boxes: ids.map(id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, height: r.height }; }) };
  });
  assert.ok(positions.scrollWidth <= positions.width);
  for (const box of positions.boxes) { assert.ok(box.x >= 0 && box.right <= positions.width); assert.ok(box.height >= 32); assert.ok(box.bottom <= positions.height, `CTA below viewport at ${positions.width}: ${box.bottom}/${positions.height}`); }
  assert.ok(positions.boxes[0].bottom < positions.boxes[1].y); assert.ok(positions.boxes[1].bottom < positions.boxes[2].y);
}
test('visuals: ordinary/cooking/catalog screenshots at 320/390/720, clickable CTAs and bounded layers', async () => {
  await scenario(async page => {
    await page.clock.runFor(1600);
    const initialNodes = await page.locator('#visual-scene *').count();
    assert.ok(initialNodes < 400);
    for (const [width, height] of [[320, 568], [390, 844], [720, 1280]]) {
      await page.setViewportSize({ width, height }); await assertCtaLayout(page);
      assert.equal(await page.locator('#visual-scene').getAttribute('data-state'), 'WAITING');
      await page.screenshot({ path: `artifacts/visuals/ordinary-${width}.png`, fullPage: true });
      await page.locator('#cook').click(); await page.locator('#cook').dispatchEvent('click'); await page.clock.runFor(250);
      assert.equal(await page.locator('#heat-layer').getAttribute('visibility'), 'visible');
      assert.equal(await page.locator('#heat-layer path').count(), 6);
      await page.screenshot({ path: `artifacts/visuals/cooking-${width}.png`, fullPage: true });
      await page.locator('#open-book').click(); await page.locator('[data-recipe-id="milk_tea"]').click();
      assert.equal(await page.locator('.recipe-card.locked .food-icon').count(), 2);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `artifacts/visuals/catalog-${width}.png`, fullPage: true });
      await page.locator('#close-book').click(); await page.clock.runFor(2000);
      assert.equal(await page.locator('#coins').textContent(), String(60 + ([320, 390, 720].indexOf(width)) * 10));
      await page.clock.runFor(1200);
      assert.ok(await page.locator('#visual-scene *').count() <= initialNodes + 2, 'art nodes must not accumulate per order');
    }
  });
});
test('visuals: upgrade flash, reward once, alternating customers, low mode, refresh and UI navigation', async () => {
  await scenario(async page => {
    await page.clock.runFor(1600);
    const first = await page.locator('#visual-scene').getAttribute('data-variant');
    await page.locator('#cook').click(); await page.locator('#cook').dispatchEvent('click'); await page.clock.runFor(2100);
    assert.equal(await page.locator('#coins').textContent(), '60');
    assert.equal(await page.locator('#reward-layer').getAttribute('visibility'), 'visible');
    await page.locator('#upgrade').click(); assert.equal(await page.locator('#coins').textContent(), '10');
    assert.equal(await page.locator('#upgrade-flash').getAttribute('visibility'), 'visible');
    await page.clock.runFor(1200); assert.equal(await page.locator('#reward-layer').getAttribute('visibility'), 'hidden');
    assert.notEqual(await page.locator('#visual-scene').getAttribute('data-variant'), first);
    await page.locator('#quality').click(); assert.equal(await page.locator('#visual-scene').getAttribute('data-quality'), 'low');
    const lantern = await page.locator('#lantern-left').getAttribute('transform');
    await page.clock.runFor(500); assert.equal(await page.locator('#lantern-left').getAttribute('transform'), lantern);
    await page.locator('#cook').click(); await page.clock.runFor(500);
    assert.equal(await page.locator('#heat-layer').getAttribute('visibility'), 'hidden');
    await page.locator('#open-book').click(); await page.clock.runFor(1600); await page.locator('#close-book').click();
    assert.equal(await page.locator('#coins').textContent(), '22');
    await page.reload(); assert.equal(await page.locator('#coins').textContent(), '22');
    assert.equal(await page.locator('#visual-scene').getAttribute('data-quality'), 'low');
    assert.equal(await page.locator('#reward-layer').getAttribute('visibility'), 'hidden');
  });
});
test('visuals: reduced-motion preference starts in low mode without changing gameplay', async () => {
  await scenario(async page => {
    assert.equal(await page.locator('#quality').getAttribute('aria-pressed'), 'true');
    await page.clock.runFor(1100); await page.locator('#cook').click(); await page.clock.runFor(2100);
    assert.equal(await page.locator('#coins').textContent(), '60');
  }, 'reduce');
});
