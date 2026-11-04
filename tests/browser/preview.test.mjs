import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createPreviewServer } from '../../scripts/preview.mjs';

test('browser: 20 orders, disabled repeat clicks, upgrade, reload, corrupt save, responsive layout', async () => {
  const server = createPreviewServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-11-04T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-11-04T12:00:01Z'));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    assert.equal(await page.locator('#coins').textContent(), '0');
    assert.equal(await page.locator('#cook').isDisabled(), true);
    for (let i = 1; i <= 20; i++) {
      await page.clock.runFor(1100);
      assert.equal(await page.locator('#cook').isEnabled(), true);
      await page.locator('#cook').click();
      assert.equal(await page.locator('#cook').isDisabled(), true);
      await page.locator('#cook').dispatchEvent('click'); // synthetic repeated event must also be harmless
      await page.clock.runFor(1000);
      assert.equal(await page.locator('#coins').textContent(), String((i - 1) * 10));
      assert.ok(await page.locator('#progress').evaluate(node => node.value) > 0);
      await page.clock.runFor(1100);
      assert.equal(await page.locator('#coins').textContent(), String(i * 10));
    }
    await page.locator('#upgrade').click();
    assert.equal(await page.locator('#coins').textContent(), '150');
    assert.match(await page.locator('#details').textContent(), /Lv\.2/);
    await page.reload();
    assert.equal(await page.locator('#coins').textContent(), '150');
    assert.match(await page.locator('#details').textContent(), /Lv\.2/);
    assert.equal(await page.locator('#cook').isDisabled(), true);
    for (const width of [320, 390, 720]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/browser-demo.png', fullPage: true });
    // Corrupt on the new document: the outgoing document saves on pagehide.
    await page.addInitScript(() => localStorage.setItem('night_market_save_v1', '{broken'));
    await page.reload(); assert.equal(await page.locator('#coins').textContent(), '0');
    assert.match(await page.locator('#status').textContent(), /存档异常/);
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
