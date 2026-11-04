import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameConfig, GameManager, EconomyManager, UpgradeManager, freshSave } from '../assets/scripts/core/GameCore.ts';
const memory = (data) => {
  const map = new Map(data === undefined ? [] : [[GameConfig.saveKey, typeof data === 'string' ? data : JSON.stringify(data)]]);
  return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
};
const create = (data) => new GameManager(memory(data), () => 12345);
const arrive = g => { g.tick(1); if (g.snapshot.order?.state === 'EXITED') g.tick(0); };
const serve = g => { assert.equal(g.cook(), true); g.tick(g.snapshot.order.duration); };

test('initial arrival at exactly 1 second; cooking takes 2 seconds', () => {
  const g = create(); assert.equal(g.snapshot.coins, 0); assert.equal(g.snapshot.stallLevel, 1);
  assert.equal(g.cook(), false); g.tick(.999); assert.equal(g.snapshot.order, null);
  g.tick(.001); assert.equal(g.snapshot.order.state, 'WAITING');
  assert.equal(g.cook(), true); g.tick(1.999); assert.equal(g.snapshot.coins, 0);
  g.tick(.001); assert.equal(g.snapshot.order.state, 'SERVED'); assert.equal(g.snapshot.coins, 10);
  g.tick(.999); assert.equal(g.snapshot.order.state, 'SERVED');
  g.tick(.001); assert.equal(g.snapshot.order.state, 'EXITED');
  g.tick(0); assert.equal(g.snapshot.order.state, 'WAITING');
});
test('repeated clicks and ticks never settle an order twice', () => {
  const g = create(); arrive(g); assert.equal(g.cook(), true);
  for (let i = 0; i < 100; i++) assert.equal(g.cook(), false);
  g.tick(2); for (let i = 0; i < 100; i++) { g.tick(0); assert.equal(g.cook(), false); }
  assert.equal(g.snapshot.coins, 10); assert.equal(g.snapshot.totalOrders, 1);
});
test('20 consecutive orders, unique IDs, no stuck state, persisted totals', () => {
  const storage = memory(); const g = new GameManager(storage, () => 99); const ids = new Set();
  for (let i = 0; i < 20; i++) { arrive(g); ids.add(g.snapshot.order.id); serve(g); }
  assert.equal(ids.size, 20); assert.equal(g.snapshot.coins, 200);
  assert.equal(g.snapshot.totalOrders, 20); assert.equal(g.snapshot.totalEarned, 200);
  const restored = new GameManager(storage); assert.equal(restored.snapshot.coins, 200);
  assert.equal(restored.snapshot.totalOrders, 20); assert.equal(restored.snapshot.order, null);
  arrive(restored); assert.equal(restored.snapshot.order.state, 'WAITING');
});
test('insufficient coins, exact funds, level cap, all economic formulas', () => {
  const g = create(); assert.equal(g.upgrade(), false); assert.equal(g.snapshot.coins, 0);
  for (let level = 1; level <= 10; level++) {
    assert.equal(EconomyManager.income(level), Math.round(10 * 1.2 ** (level - 1)));
    const cost = Math.round(50 * 1.5 ** (level - 1));
    assert.equal(UpgradeManager.cost(level), level === 10 ? null : cost);
    const rich = create({ ...freshSave(), stallLevel: level, coins: cost, totalEarned: cost });
    assert.equal(rich.upgrade(), level !== 10);
    assert.equal(rich.snapshot.coins, level === 10 ? cost : 0);
    assert.equal(rich.snapshot.stallLevel, Math.min(10, level + 1));
    assert.equal(rich.upgrade(), false);
  }
});
test('upgrading in WAITING or COOKING preserves locked income and duration', () => {
  for (const cooking of [false, true]) {
    const g = create({ ...freshSave(), coins: 1000, totalEarned: 1000, stallLevel: 3 });
    arrive(g); if (cooking) g.cook();
    const locked = g.snapshot.order; assert.equal(g.upgrade(), true);
    assert.equal(g.snapshot.order.income, locked.income); assert.equal(g.snapshot.order.duration, 2);
    if (!cooking) g.cook(); g.tick(1.8); assert.equal(g.snapshot.order.state, 'COOKING');
    g.tick(.2); assert.equal(g.snapshot.totalEarned, 1000 + locked.income);
    arrive(g); assert.equal(g.snapshot.order.duration, 1.8);
    assert.equal(g.snapshot.order.income, EconomyManager.income(4));
  }
  assert.equal(EconomyManager.duration(6), 1.8); assert.equal(EconomyManager.duration(7), 1.6);
  assert.equal(EconomyManager.duration(10), 1.6);
});
test('restart restores upgrade, discards in-flight order and never compensates rewards', () => {
  const storage = memory({ ...freshSave(), coins: 50, totalEarned: 50 });
  const g = new GameManager(storage, () => 12345); assert.equal(g.upgrade(), true);
  arrive(g); g.cook(); g.tick(1); g.save();
  const restored = new GameManager(storage); assert.equal(restored.snapshot.coins, 0);
  assert.equal(restored.snapshot.stallLevel, 2); assert.equal(restored.snapshot.lastSaveTime, 12345);
  assert.equal(restored.snapshot.order, null); arrive(restored); serve(restored);
  assert.equal(restored.snapshot.coins, 12);
});
test('malformed, unsupported, missing, fractional, negative, unsafe saves recover', () => {
  const corrupt = ['{', 'null', '[]', 'true', '{}', { ...freshSave(), version: 2 }];
  for (const field of ['coins', 'totalEarned', 'totalOrders', 'lastSaveTime', 'stallLevel'])
    for (const value of [-1, 1.1, '2', null, Number.MAX_SAFE_INTEGER + 1])
      corrupt.push({ ...freshSave(), [field]: value });
  corrupt.push({ ...freshSave(), stallLevel: 0 }, { ...freshSave(), stallLevel: 11 }, { ...freshSave(), coins: 1 });
  for (const data of corrupt) {
    const g = create(data); assert.equal(g.snapshot.coins, 0); assert.equal(g.snapshot.stallLevel, 1);
    assert.equal(g.snapshot.saveStatus, 'recovered'); arrive(g); serve(g); assert.equal(g.snapshot.coins, 10);
  }
});
test('storage read/write failures do not interrupt play; retry can persist', () => {
  let broken = true; let saved;
  const g = new GameManager({ getItem() { throw Error('denied'); }, setItem(k, v) { if (broken) throw Error('quota'); saved = v; } });
  arrive(g); serve(g); assert.equal(g.snapshot.coins, 10); assert.equal(g.snapshot.saveStatus, 'unavailable');
  broken = false; assert.equal(g.save(), true); assert.equal(JSON.parse(saved).coins, 10);
});
test('snapshots cannot mutate domain; invalid dt rejected; long frames do not auto cook', () => {
  const g = create(); arrive(g); const snapshot = g.snapshot;
  snapshot.coins = 999; snapshot.order.income = 999;
  serve(g); assert.equal(g.snapshot.coins, 10);
  for (const dt of [-1, NaN, Infinity]) assert.throws(() => g.tick(dt), RangeError);
  g.tick(1000); g.tick(1000); assert.equal(g.snapshot.order.state, 'WAITING');
  assert.equal(g.snapshot.totalOrders, 1);
});
