import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameManager, GameConfig, freshSave, OfflineManager, MonetizationConfig, DailyTaskManager, MockAdService, WeChatRewardAdService } from '../assets/scripts/core/GameCore.ts';
const start = Date.parse('2026-11-04T12:00:00Z');
const memory = data => {
  const map = new Map(data === undefined ? [] : [[GameConfig.saveKey, JSON.stringify(data)]]);
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
};
const setup = (data = freshSave(), now = start) => {
  let time = now; const storage = memory(data); const game = new GameManager(storage, () => time);
  return { game, storage, setTime: value => { time = value; }, reopen: () => new GameManager(storage, () => time) };
};
const serve = game => { game.tick(1); if (game.snapshot.order?.state === 'EXITED') game.tick(0); assert.equal(game.cook(), true); game.tick(game.snapshot.order.duration); };
const reward = async (game, mode = 'complete', placement = 'order_bonus') => { const ad = new MockAdService(); ad.mode = mode; return game.requestAd(placement, ad); };

test('offline: zero, rollback, bad numbers, cap and level formula are safe', () => {
  for (const end of [start, start - 1, NaN, Infinity, -1, 1e100, Number.MAX_SAFE_INTEGER])
    assert.equal(OfflineManager.calculate(start, end, 1).amount, 0);
  for (const last of [NaN, Infinity, -1, 1e100]) assert.equal(OfflineManager.calculate(last, start, 1).amount, 0);
  assert.deepEqual(OfflineManager.calculate(start, start + 10_000, 1), { seconds: 10, amount: 1 });
  for (let level = 1; level <= 10; level++) {
    const result = OfflineManager.calculate(start, start + 24 * 3600_000, level);
    assert.equal(result.seconds, 14400); assert.equal(result.amount, Math.floor(14400 * .1 * 1.2 ** (level - 1)));
  }
});
test('offline base once across refresh; optional bonus only on completed ad; no orders manufactured', async () => {
  const s = setup({ ...freshSave(), lastSaveTime: start - 3600_000 });
  assert.equal(s.game.snapshot.offline.amount, 360); assert.equal(s.game.snapshot.coins, 0);
  const claim = s.game.claimOffline(); assert.equal(claim.status, 'success'); assert.equal(claim.coins, 360);
  assert.equal(s.game.claimOffline().status, 'already_claimed'); assert.equal(s.reopen().claimOffline().status, 'already_claimed');
  for (const mode of ['cancel', 'error']) { await reward(s.game, mode, 'offline_double'); assert.equal(s.game.snapshot.coins, 360); }
  assert.equal((await reward(s.game, 'duplicate', 'offline_double')).status, 'success');
  assert.equal(s.game.snapshot.coins, 720); assert.equal(s.game.snapshot.totalOrders, 0);
  assert.equal((await reward(s.reopen(), 'complete', 'offline_double')).status, 'already_claimed');
  assert.equal(s.game.snapshot.recipes[1].unlocked, true);
});
test('offline normal play never needs ads: later return can replace a base-claimed offer and keep unclaimed offers stable', () => {
  const s = setup({ ...freshSave(), lastSaveTime: start - 100_000 });
  const id = s.game.snapshot.offline.id; s.game.save(); s.setTime(start + 100_000); s.game.resume();
  assert.equal(s.game.snapshot.offline.id, id); assert.equal(s.game.claimOffline().coins, 10);
  s.setTime(start + 200_000); s.game.resume(); assert.notEqual(s.game.snapshot.offline.id, id);
  assert.equal(s.game.claimOffline().coins, 10);
});
test('clock rollback and invalid now cannot create money or reset task receipts; forward save watermark is retained', () => {
  const s = setup({ ...freshSave(), lastSaveTime: start - 3600_000 }); s.game.claimOffline();
  s.setTime(start - 86_400_000); s.game.resume(); assert.equal(s.game.snapshot.offline.baseClaimed, true);
  assert.equal(s.game.claimOffline().status, 'already_claimed');
  assert.ok(JSON.parse(s.storage.getItem(GameConfig.saveKey)).lastSaveTime >= start);
  for (const time of [NaN, Infinity, -1, Number.MAX_SAFE_INTEGER]) {
    s.setTime(time); assert.equal(s.game.save(), false);
    assert.equal(s.game.claimTask('coins_300').status, 'invalid_clock'); assert.equal(s.game.snapshot.coins, 360);
  }
});
test('legacy save fields preserved; history not daily progress; corrupt new state is isolated and cannot grant old rewards', () => {
  const old = { ...freshSave(), coins: 100, totalEarned: 900, totalOrders: 80, stallLevel: 4, lastSaveTime: start, notifiedRecipeIds: ['milk_tea'] };
  for (const progress of [undefined, null, {}, { schema: 1 }, 'bad']) {
    const s = setup({ ...old, progress });
    for (const field of Object.keys(old)) assert.deepEqual(s.game.snapshot[field], old[field]);
    assert.equal(s.game.snapshot.tasks[0].progress, 0); assert.equal(s.game.snapshot.tasks[2].progress, 0);
    assert.equal(s.game.claimTask('orders_5').status, 'not_ready'); assert.equal(s.game.snapshot.orderBonus, null);
  }
});
test('daily: 5/15 orders and 300 income, free claims once, resume and refresh retain receipts', () => {
  const s = setup(); for (let i = 0; i < 5; i++) serve(s.game);
  assert.equal(s.game.claimTask('orders_5').coins, 30); assert.equal(s.game.claimTask('orders_5').status, 'already_claimed');
  assert.equal(s.reopen().claimTask('orders_5').status, 'already_claimed');
  for (let i = 0; i < 10; i++) serve(s.game);
  assert.equal(s.game.claimTask('orders_15').coins, 80); assert.equal(s.game.snapshot.tasks[2].progress, 150);
  for (let i = 0; i < 15; i++) serve(s.game);
  assert.equal(s.game.claimTask('coins_300').coins, 60);
  assert.equal(s.game.snapshot.totalEarned, 470); assert.equal(s.game.snapshot.tasks[2].progress, 300);
  assert.equal(s.reopen().claimTask('coins_300').status, 'already_claimed');
});
test('daily: Beijing midnight, online rollover and clock rollback; historical totals never become progress', () => {
  const midnight = Date.parse('2026-11-04T16:00:00Z');
  assert.notEqual(DailyTaskManager.day(midnight - 1), DailyTaskManager.day(midnight));
  const s = setup(freshSave(), midnight - 1); for (let i = 0; i < 5; i++) serve(s.game);
  s.game.claimTask('orders_5'); s.setTime(midnight); assert.equal(s.game.snapshot.tasks[0].progress, 0);
  assert.equal(s.game.snapshot.tasks[0].claimed, false); serve(s.game); assert.equal(s.game.snapshot.tasks[0].progress, 1);
  s.setTime(midnight - 1); assert.equal(s.game.snapshot.tasks[0].progress, 1);
  s.setTime(midnight + 1); s.game.save(); assert.equal(s.reopen().snapshot.tasks[0].progress, 1);
});
test('new reward transaction is atomic: storage failure grants no money or receipt, then retry is safe', () => {
  const storage = memory({ ...freshSave(), lastSaveTime: start - 3600_000 }); let fail = true;
  const game = new GameManager({ getItem: storage.getItem, setItem: (key, value) => { if (fail) throw Error('quota'); storage.setItem(key, value); } }, () => start);
  assert.equal(game.claimOffline().status, 'storage_error'); assert.equal(game.snapshot.coins, 0);
  assert.equal(game.snapshot.offline.baseClaimed, false); fail = false;
  assert.equal(game.claimOffline().coins, 360); assert.equal(game.claimOffline().status, 'already_claimed');
});
test('ad: complete/cancel/error/duplicate/throw and disabled WeChat semantics, same order idempotency across restart', async () => {
  const s = setup(); serve(s.game);
  for (const mode of ['cancel', 'error', 'unknown']) { const result = await reward(s.game, mode); assert.equal(result.status, mode === 'cancel' ? 'cancelled' : 'failed'); }
  assert.equal((await s.game.requestAd('order_bonus', { showRewardedAd() { throw Error('load'); } })).status, 'failed');
  assert.equal((await s.game.requestAd('order_bonus', { showRewardedAd: async () => ({ status: 'unknown' }) })).status, 'failed');
  const disabled = new WeChatRewardAdService({ createRewardedVideoAd() { throw Error('must not call platform'); } });
  assert.equal(disabled.platformAvailable, true); assert.equal(disabled.enabled, false);
  assert.equal((await s.game.requestAd('order_bonus', disabled)).status, 'unavailable');
  const ad = new MockAdService(); ad.mode = 'duplicate';
  const result = await s.game.requestAd('order_bonus', ad); assert.equal(result.coins, 10); assert.equal(ad.emittedCallbacks, 2);
  assert.equal(s.game.snapshot.coins, 20); assert.equal(s.game.snapshot.totalOrders, 1);
  assert.equal((await reward(s.reopen())).status, 'already_claimed');
});
test('ad: async competition is busy; captured order survives next order without modifying its offer', async () => {
  const s = setup(); serve(s.game); let finish;
  const pending = s.game.requestAd('order_bonus', { showRewardedAd: () => new Promise(resolve => { finish = resolve; }) });
  assert.equal((await reward(s.game)).status, 'busy'); serve(s.game);
  finish({ status: 'completed' }); assert.equal((await pending).requestId, 'order:1:bonus');
  assert.equal(s.game.snapshot.coins, 30); assert.equal(s.game.snapshot.orderBonus.number, 2); assert.equal(s.game.snapshot.orderBonus.claimed, false);
  assert.equal((await reward(s.game)).coins, 10); assert.equal(s.game.snapshot.coins, 40);
});
test('offline base and ad are independent; failed bonus save does not consume receipt and retry remains once', async () => {
  const s = setup({ ...freshSave(), lastSaveTime: start - 3600_000 }); s.game.claimOffline();
  let fail = true; const game = new GameManager({ getItem: s.storage.getItem, setItem: (key, value) => {
    if (fail) throw Error('quota'); s.storage.setItem(key, value);
  } }, () => start);
  assert.equal((await reward(game, 'complete', 'offline_double')).status, 'storage_error'); assert.equal(game.snapshot.coins, 360);
  fail = false; assert.equal((await reward(game, 'complete', 'offline_double')).status, 'success'); assert.equal(game.snapshot.coins, 720);
});
test('progress snapshots are isolated; overflow and malformed offline records do not grant money', () => {
  const s = setup({ ...freshSave(), lastSaveTime: start - 3600_000 });
  const snapshot = s.game.snapshot; snapshot.offline.amount = 999999; snapshot.progress.daily.coins = 999999;
  assert.equal(s.game.claimOffline().coins, 360);
  const saved = JSON.parse(s.storage.getItem(GameConfig.saveKey)); saved.progress.offline.amount = 999999;
  const repaired = setup(saved).game; assert.equal(repaired.snapshot.coins, 360); assert.equal(repaired.snapshot.offline, null);
  const huge = setup({ ...freshSave(), coins: Number.MAX_SAFE_INTEGER, totalEarned: Number.MAX_SAFE_INTEGER, lastSaveTime: start - 3600_000 });
  assert.equal(huge.game.claimOffline().status, 'limit'); assert.equal(huge.game.snapshot.offline.baseClaimed, false);
  assert.equal(MonetizationConfig.timezoneOffsetMinutes, 480);
});

test('stale instance/ad completion after refresh cannot overwrite a newer receipt or income', async () => {
  const storage = memory({ ...freshSave(), lastSaveTime: start - 3600_000 });
  const a = new GameManager(storage, () => start), b = new GameManager(storage, () => start);
  assert.equal(a.claimOffline().status, 'success'); assert.equal(b.claimOffline().status, 'expired');
  let finish;
  const pending = a.requestAd('offline_double', { showRewardedAd: () => new Promise(resolve => { finish = resolve; }) });
  const refreshed = new GameManager(storage, () => start);
  assert.equal((await reward(refreshed, 'complete', 'offline_double')).status, 'success');
  serve(refreshed); finish({ status: 'completed' }); assert.equal((await pending).status, 'expired');
  assert.equal(new GameManager(storage, () => start).snapshot.coins, 730);
});

test('exact four-hour cap consumes the whole interval; delayed ad adds captured amount to upgraded balance', async () => {
  assert.equal(OfflineManager.calculate(start, start + 4 * 3600_000, 1).amount, 1440);
  const s = setup({ ...freshSave(), coins: 50, totalEarned: 50, lastSaveTime: start - 24 * 3600_000 });
  assert.equal(s.game.claimOffline().coins, 1440); assert.equal(s.reopen().claimOffline().status, 'already_claimed');
  serve(s.game); let finish;
  const pending = s.game.requestAd('order_bonus', { showRewardedAd: () => new Promise(resolve => { finish = resolve; }) });
  const balance = s.game.snapshot.coins; assert.equal(s.game.upgrade(), true);
  finish({ status: 'completed' }); assert.equal((await pending).coins, 10);
  assert.equal(s.game.snapshot.coins, balance - 50 + 10); assert.equal(s.game.snapshot.stallLevel, 2);
});
