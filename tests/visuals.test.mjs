import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameManager, freshSave } from '../assets/scripts/core/GameCore.ts';
import { VisualDirector, Motion, backdropArt, stallArt, counterArt, characterArt, foodArt } from '../assets/scripts/ui/effects/VisualStyle.ts';
const create = (data = freshSave()) => new GameManager({ getItem: () => JSON.stringify(data), setItem() {} });

test('visual timeline never changes the business snapshot, storage, rewards or order state', () => {
  const game = create(); game.tick(1); const before = game.snapshot;
  const director = new VisualDirector();
  for (const quality of ['full', 'low']) for (let i = 0; i < 200; i++) director.sample(before, .016, quality);
  assert.deepEqual(game.snapshot, before);
  for (const dt of [-1, NaN, Infinity]) assert.throws(() => director.sample(before, dt, 'full'), RangeError);
});
test('arrival, wait, departure, two character variants and low motion remain visual-only', () => {
  const game = create(), director = new VisualDirector(); director.sample(game.snapshot, 0, 'full');
  game.tick(1); const enter = director.sample(game.snapshot, 0, 'full'); assert.equal(enter.guestX, 800);
  const wait = director.sample(game.snapshot, Motion.enter, 'full'); assert.equal(wait.guestX, 555);
  game.cook(); game.tick(2); const served = director.sample(game.snapshot, 0, 'full'); assert.equal(served.happy, true);
  const exit = director.sample(game.snapshot, Motion.departDelay + Motion.depart, 'full'); assert.equal(exit.guestX, 805);
  game.tick(1); game.tick(0); const next = director.sample(game.snapshot, 0, 'full'); assert.notEqual(next.variant, enter.variant);
  const low = director.sample(game.snapshot, .1, 'low'); assert.equal(low.guestX, 555); assert.equal(low.guestY, 430);
  assert.equal(low.signScale, 1); assert.equal(low.lanternAngle, 0); assert.equal(low.phase, 0);
});
test('restored totals do not replay bursts; repeated snapshots cannot restart reward or upgrade effects', () => {
  const game = create({ ...freshSave(), coins: 50, totalEarned: 50 }); const director = new VisualDirector();
  assert.equal(director.sample(game.snapshot, 0, 'full').rewardVisible, false);
  assert.equal(director.sample(game.snapshot, 0, 'full').upgradeVisible, false);
  game.tick(1); director.sample(game.snapshot, .1, 'full'); game.cook(); game.tick(2);
  const reward = director.sample(game.snapshot, 0, 'full'); assert.equal(reward.rewardVisible, true); assert.equal(reward.rewardAmount, 10);
  assert.equal(director.sample(game.snapshot, Motion.reward, 'full').rewardVisible, false);
  assert.equal(director.sample(game.snapshot, 0, 'full').rewardVisible, false);
  assert.equal(game.upgrade(), true); assert.equal(director.sample(game.snapshot, 0, 'full').upgradeVisible, true);
  assert.equal(director.sample(game.snapshot, Motion.upgrade, 'full').upgradeVisible, false);
  assert.equal(director.sample(game.snapshot, 0, 'full').upgradeVisible, false);
  const reloaded = new VisualDirector(); assert.equal(reloaded.sample(game.snapshot, 0, 'full').rewardVisible, false);
  assert.equal(reloaded.sample(game.snapshot, 0, 'full').upgradeVisible, false);
});
test('procedural assets are finite, reproducible and bounded; all dishes and both customers have distinct art', () => {
  const art = [...backdropArt(), ...stallArt(), ...counterArt(), ...characterArt(0), ...characterArt(1),
    ...foodArt('sausage'), ...foodArt('milk_tea'), ...foodArt('fried_skewer')];
  assert.ok(art.length < 300); assert.equal(Motion.maxParticles, 6);
  assert.deepEqual(backdropArt(), backdropArt()); assert.notDeepEqual(characterArt(0), characterArt(1));
  assert.notDeepEqual(foodArt('sausage'), foodArt('milk_tea'));
  for (const shape of art) { assert.ok(Number.isFinite(shape.x) && Number.isFinite(shape.y)); assert.match(shape.fill, /^#[0-9a-f]{6,8}$/i); }
});
