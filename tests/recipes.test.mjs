import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RecipeConfig, RecipeManager, GameManager, EconomyManager, GameConfig, freshSave } from '../assets/scripts/core/GameCore.ts';
const storageFor = data => {
  const map = new Map(data === undefined ? [] : [[GameConfig.saveKey, JSON.stringify(data)]]);
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
};
const arrive = game => { game.tick(1); if (game.snapshot.order?.state === 'EXITED') game.tick(0); };
const serve = game => { assert.equal(game.cook(), true); game.tick(game.snapshot.order.duration); };
const ids = manager => manager.unlockedRecipes.map(r => r.id);
const oldSave = totalEarned => ({ version: 1, coins: 123, stallLevel: 3, totalEarned, totalOrders: 42, lastSaveTime: 99 });

test('registry has unique immutable IDs, economy, chapter, rarity and unlock conditions', () => {
  assert.deepEqual(RecipeConfig.map(r => [r.id, r.name, r.basePrice, r.baseDuration, r.unlock.amount]), [
    ['sausage', '烤肠', 10, 2, 0], ['milk_tea', '奶茶', 25, 4, 500], ['fried_skewer', '炸串', 45, 5, 2000],
  ]);
  assert.equal(new Set(RecipeConfig.map(r => r.id)).size, 3);
  assert.equal(GameConfig.baseIncome, 10); // Phase 1 public alias still resolves to the registry.
  for (const recipe of RecipeConfig) {
    assert.ok(recipe.chapter && recipe.rarity && recipe.description);
    assert.throws(() => { recipe.unlock.amount = 0; }, TypeError);
    for (let level = 1; level <= 10; level++) {
      assert.equal(EconomyManager.income(level, recipe.id), Math.round(recipe.basePrice * 1.2 ** (level - 1)));
      assert.equal(EconomyManager.duration(level, recipe.id), recipe.baseDuration * (level <= 3 ? 1 : level <= 6 ? .9 : .8));
    }
  }
});
test('unlock boundaries 499/500 and 1999/2000 and catalog progress use one source', () => {
  for (const [total, expected] of [[0, 1], [499, 1], [500, 2], [1999, 2], [2000, 3]]) {
    const manager = new RecipeManager(total);
    assert.equal(ids(manager).length, expected);
    const catalog = manager.catalog(1);
    assert.equal(catalog.filter(r => r.unlocked).length, expected);
    for (const entry of catalog) {
      assert.equal(entry.unlocked, manager.isUnlocked(entry.id));
      assert.equal(entry.remainingToUnlock, Math.max(0, entry.unlock.amount - total));
    }
  }
});
test('crossing emits events once, large jumps queue both notices, acknowledgments are idempotent', () => {
  const manager = new RecipeManager(499);
  assert.deepEqual(manager.checkUnlocks(499), []);
  assert.equal(manager.acknowledge('milk_tea'), false);
  assert.deepEqual(manager.checkUnlocks(500), [{ type: 'recipe-unlocked', recipeId: 'milk_tea' }]);
  assert.deepEqual(manager.checkUnlocks(500), []);
  assert.equal(manager.notifications.length, 1);
  assert.equal(manager.acknowledge('milk_tea'), true);
  assert.equal(manager.acknowledge('milk_tea'), false);
  assert.deepEqual(manager.notifications, []);
  assert.deepEqual(manager.checkUnlocks(2000), [{ type: 'recipe-unlocked', recipeId: 'fried_skewer' }]);
  assert.deepEqual(manager.checkUnlocks(0), []); assert.equal(ids(manager).length, 3);
  const jump = new RecipeManager(0);
  assert.deepEqual(jump.checkUnlocks(3000).map(e => e.recipeId), ['milk_tea', 'fried_skewer']);
  assert.deepEqual(jump.checkUnlocks(3000), []); assert.equal(jump.acknowledge('sausage'), false);
});
test('Phase 1 saves migrate lazily without losing any financial or order fields; notices survive only until shown', () => {
  const original = oldSave(2000), storage = storageFor(original);
  const game = new GameManager(storage, () => 101);
  for (const key of Object.keys(original)) assert.equal(game.snapshot[key], original[key]);
  assert.equal(game.snapshot.recipes.filter(r => r.unlocked).length, 3);
  assert.deepEqual(game.snapshot.unlockNotifications.map(e => e.recipeId), ['milk_tea', 'fried_skewer']);
  assert.equal(game.acknowledgeRecipeUnlock('milk_tea'), true);
  const restarted = new GameManager(storage, () => 10 ** 12); // No offline reward.
  assert.deepEqual(restarted.snapshot.unlockNotifications.map(e => e.recipeId), ['fried_skewer']);
  assert.equal(restarted.snapshot.coins, original.coins); assert.equal(restarted.snapshot.totalOrders, original.totalOrders);
  assert.equal(restarted.snapshot.stallLevel, original.stallLevel); assert.equal(restarted.snapshot.totalEarned, original.totalEarned);
  assert.equal(restarted.snapshot.order, null);
  restarted.acknowledgeRecipeUnlock('fried_skewer');
  assert.deepEqual(new GameManager(storage).snapshot.unlockNotifications, []);
  const saved = JSON.parse(storage.getItem(GameConfig.saveKey));
  assert.equal(saved.version, 1); assert.deepEqual(saved.notifiedRecipeIds, ['milk_tea', 'fried_skewer']);
});
test('malformed optional metadata is repaired independently; unknown, duplicate and locked notice IDs cannot grant unlocks', () => {
  for (const metadata of [undefined, null, {}, 'milk_tea', [null, 'bogus', 'milk_tea', 'milk_tea', 'fried_skewer']]) {
    const original = { ...oldSave(500), notifiedRecipeIds: metadata };
    const game = new GameManager(storageFor(original));
    assert.equal(game.snapshot.coins, 123); assert.equal(game.snapshot.totalOrders, 42);
    assert.equal(game.snapshot.stallLevel, 3); assert.equal(game.snapshot.totalEarned, 500);
    assert.equal(game.snapshot.recipes[2].unlocked, false);
    assert.deepEqual(game.snapshot.notifiedRecipeIds, Array.isArray(metadata) ? ['milk_tea'] : []);
  }
  const game = new GameManager(storageFor({ ...freshSave(), totalEarned: 490, notifiedRecipeIds: ['milk_tea'] }));
  assert.deepEqual(game.snapshot.notifiedRecipeIds, []); arrive(game); serve(game);
  assert.deepEqual(game.snapshot.unlockNotifications.map(e => e.recipeId), ['milk_tea']);
});
test('actual settlement crosses 500 and makes milk tea a 25-coin/4-second order, with single settlement', () => {
  const storage = storageFor({ ...freshSave(), coins: 490, totalEarned: 490, totalOrders: 49 });
  const game = new GameManager(storage, () => 200); arrive(game);
  assert.equal(game.snapshot.recipes[1].unlocked, false); serve(game);
  assert.equal(game.snapshot.totalEarned, 500); assert.equal(game.snapshot.recipes[1].unlocked, true);
  assert.equal(game.snapshot.unlockNotifications[0].recipeId, 'milk_tea');
  assert.equal(game.acknowledgeRecipeUnlock('milk_tea'), true);
  assert.equal(game.acknowledgeRecipeUnlock('milk_tea'), false);
  arrive(game); assert.equal(game.snapshot.order.recipeId, 'milk_tea');
  assert.equal(game.snapshot.order.income, 25); assert.equal(game.snapshot.order.duration, 4);
  game.cook(); assert.equal(game.cook(), false); game.tick(3.999); assert.equal(game.snapshot.coins, 500);
  game.tick(.001); assert.equal(game.snapshot.coins, 525); game.tick(0); assert.equal(game.snapshot.coins, 525);
  assert.equal(game.snapshot.totalOrders, 51);
  assert.deepEqual(new GameManager(storage).snapshot.unlockNotifications, []);
});
test('1999 remains locked, settlement past 2000 enables fried skewer and preserves spending-independent unlocks', () => {
  const game = new GameManager(storageFor({ ...freshSave(), coins: 500, totalEarned: 1999 }));
  assert.equal(game.snapshot.recipes[2].unlocked, false); arrive(game); serve(game);
  assert.equal(game.snapshot.totalEarned, 2009); assert.equal(game.snapshot.recipes[2].unlocked, true);
  assert.equal(game.upgrade(), true); assert.equal(game.snapshot.coins, 460);
  assert.equal(game.snapshot.totalEarned, 2009); assert.equal(game.snapshot.recipes[2].unlocked, true);
  arrive(game); serve(game); arrive(game);
  assert.equal(game.snapshot.order.recipeId, 'fried_skewer');
  assert.equal(game.snapshot.order.income, 54); assert.equal(game.snapshot.order.duration, 5);
});
test('orders rotate only unlocked recipes in deterministic catalog order', () => {
  for (const [earned, expected] of [[0, ['sausage']], [500, ['sausage', 'milk_tea']], [2000, ['sausage', 'milk_tea', 'fried_skewer']]]) {
    const game = new GameManager(storageFor({ ...freshSave(), totalEarned: earned }));
    const ordered = [];
    for (let i = 0; i < expected.length * 3; i++) { arrive(game); ordered.push(game.snapshot.order.recipeId); serve(game); }
    assert.deepEqual(ordered, [...expected, ...expected, ...expected]);
  }
});
test('tea/skewer lock their own price and time through waiting/cooking upgrades at Lv4 and Lv7', () => {
  for (const level of [3, 6]) for (const target of ['milk_tea', 'fried_skewer']) for (const cooking of [false, true]) {
    const game = new GameManager(storageFor({ ...freshSave(), stallLevel: level, coins: 6000, totalEarned: 6000 }));
    arrive(game); serve(game); arrive(game);
    if (target === 'fried_skewer') { serve(game); arrive(game); }
    assert.equal(game.snapshot.order.recipeId, target);
    const locked = game.snapshot.order;
    if (cooking) game.cook(); assert.equal(game.upgrade(), true);
    assert.equal(game.snapshot.order.income, locked.income); assert.equal(game.snapshot.order.duration, locked.duration);
    if (!cooking) game.cook(); game.tick(locked.duration - .01);
    assert.equal(game.snapshot.order.state, 'COOKING'); game.tick(.01);
    const after = game.snapshot.coins; game.tick(0); assert.equal(game.snapshot.coins, after);
    arrive(game); const next = game.snapshot.order;
    assert.equal(next.income, EconomyManager.income(level + 1, next.recipeId));
    assert.equal(next.duration, EconomyManager.duration(level + 1, next.recipeId));
  }
});
test('snapshot mutations cannot grant recipes or dismiss notices; failed notice saves can retry', () => {
  let fail = true; const storage = storageFor({ ...freshSave(), totalEarned: 500 });
  const game = new GameManager({ getItem: storage.getItem, setItem: (key, value) => {
    if (fail) throw Error('quota'); storage.setItem(key, value);
  } });
  const snapshot = game.snapshot; snapshot.recipes[2].unlocked = true;
  snapshot.notifiedRecipeIds.push('milk_tea'); snapshot.unlockNotifications.length = 0;
  assert.equal(game.snapshot.recipes[2].unlocked, false); assert.equal(game.snapshot.unlockNotifications.length, 1);
  assert.equal(game.acknowledgeRecipeUnlock('milk_tea'), true);
  assert.equal(game.snapshot.saveStatus, 'unavailable'); assert.deepEqual(game.snapshot.unlockNotifications, []);
  fail = false; assert.equal(game.save(), true);
  assert.deepEqual(new GameManager(storage).snapshot.unlockNotifications, []);
});
