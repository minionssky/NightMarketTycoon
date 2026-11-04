import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectWeChatReadiness } from '../scripts/wechat-preflight.mjs';

test('WeChat planning example is safe and missing environment reports blocked, never a successful build', async () => {
  const result = await inspectWeChatReadiness(); assert.equal(result.status, 'blocked');
  assert.equal(result.configValid, true); assert.equal(result.buildValidated, false);
  assert.equal(result.deviceValidated, false); assert.equal(result.realAdsEnabled, false);
  assert.equal(result.creatorFound, false); assert.ok(result.blockers.some(b => b.includes('AppID')));
});
test('preflight rejects production ad config and unsupported project manifest fixtures', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nightmarket-wechat-'));
  try {
    await writeFile(join(dir, 'plan.json'), JSON.stringify({ platform: 'wechatgame', realAdsEnabled: true, rewardedAdUnitId: 'unsafe' }));
    await writeFile(join(dir, 'package.json'), JSON.stringify({ creator: { version: '3.7.0' } })); await mkdir(join(dir, 'assets'));
    const result = await inspectWeChatReadiness({ projectPath: dir, configPath: join(dir, 'plan.json') });
    assert.equal(result.configValid, false); assert.equal(result.projectManifestValid, false); assert.equal(result.status, 'blocked');
  } finally { await rm(dir, { recursive: true }); }
});
