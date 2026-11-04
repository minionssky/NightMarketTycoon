import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, rm, access, symlink, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { prepareCocos } from '../scripts/prepare-cocos.mjs';
import { inspectBuildInputs, runProcess, validateCocos, verifyWeChatOutput } from '../scripts/validate-cocos.mjs';
const require = createRequire(import.meta.url);
const { populateScene } = require('../extensions/night-market-integration/dist/scene.js');
const { methods } = require('../extensions/night-market-integration/dist/main.js');

/** Minimal engine contract double. Passing these tests is L1, never a Creator/engine run. */
function engineFixture() {
  class Component {}
  class Transform extends Component { setContentSize(w, h) { this.width = w; this.height = h; } }
  class Canvas extends Component {}
  class Camera extends Component { static ProjectionType = { ORTHO: 0 }; static ClearFlag = { SOLID_COLOR: 7 }; }
  class Widget extends Component {}
  class GameUI extends Component {}
  class Probe extends Component {}
  class Node {
    constructor(name) { this.name = name; this.uuid = randomUUID(); this.children = []; this.components = []; }
    addChild(node) { this.children.push(node); node.parent = this; }
    getComponent(ctor) { return this.components.find(component => component instanceof ctor); }
    getComponents(ctor) { return this.components.filter(component => component instanceof ctor); }
    addComponent(ctor) { const component = new ctor(); component.node = this; this.components.push(component); return component; }
    setPosition(...position) { this.position = position; }
    destroy() { this.destroyed = true; }
  }
  const scene = new Node('MainGame');
  return { scene, Node, Component, UITransform: Transform, Canvas, Camera, Widget, GameUI, Probe,
    Layers: { Enum: { UI_2D: 1 << 25 } }, Color: class { constructor(value) { this.value = value; } },
    director: { getScene: () => scene }, js: { getClassByName: name => name === 'GameUI' ? GameUI : Probe } };
}
async function projectFixture(directory) {
  await mkdir(join(directory, 'assets'), { recursive: true });
  await writeFile(join(directory, 'package.json'), JSON.stringify({ creator: { version: '3.8.8' } }));
}
const temporary = async run => {
  const dir = await mkdtemp(join(tmpdir(), 'nightmarket-integration-'));
  try { return await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
};

test('L1 scene contract: creates Canvas/camera/GameUI/probe once, not a real engine preview', () => {
  const cc = engineFixture(); const result = populateScene(cc);
  assert.equal(result.status, 'configured'); assert.equal(cc.scene.children.length, 1);
  const node = cc.scene.children[0], canvas = node.getComponent(cc.Canvas), camera = canvas.cameraComponent;
  assert.equal(node.getComponent(cc.UITransform).height, 1280); assert.equal(camera.orthoHeight, 640);
  assert.equal(camera.visibility, cc.Layers.Enum.UI_2D); assert.ok(node.getComponent(cc.GameUI)); assert.ok(node.getComponent(cc.Probe));
  assert.equal(populateScene(cc).status, 'already-configured'); assert.equal(node.children.length, 1);
});
test('L1 scene contract: untouched template reuses camera; custom content/missing scripts are refused before mutation', () => {
  const cc = engineFixture(), canvas = new cc.Node('Canvas'), camera = new cc.Node('Camera');
  canvas.addComponent(cc.Canvas); canvas.addComponent(cc.UITransform); camera.addComponent(cc.Camera);
  canvas.addChild(camera); cc.scene.addChild(canvas); populateScene(cc); assert.equal(canvas.children[0], camera);
  const custom = engineFixture(); custom.scene.addChild(new custom.Node('UserContent'));
  assert.throws(() => populateScene(custom), /Refusing non-empty/); assert.equal(custom.scene.children.length, 1);
  const missing = engineFixture(); missing.js.getClassByName = () => null;
  assert.throws(() => populateScene(missing), /not registered/); assert.equal(missing.scene.children.length, 0);
});
test('L1 editor IPC contract: targets saved asset, snapshots and saves, records no runtime/device validation', async () => temporary(async dir => {
  const previous = globalThis.Editor, calls = [];
  globalThis.Editor = { App: { version: '3.8.8' }, Project: { path: dir }, Message: { async request(channel, message) {
    calls.push([channel, message]);
    if (message === 'query-dirty') return false;
    if (message === 'query-asset-info') return { uuid: 'editor-fixture-uuid', imported: true, invalid: false };
    if (message === 'execute-scene-script') return { status: 'configured' };
    if (message === 'save-scene') return 'saved-fixture-result';
  } } };
  try {
    const report = await methods.populateMainGame();
    assert.equal(report.runtimePreviewValidated, false); assert.equal(report.deviceValidated, false);
    assert.ok(calls.findIndex(c => c[1] === 'open-scene') < calls.findIndex(c => c[1] === 'execute-scene-script'));
    globalThis.Editor.Message.request = async () => true;
    await assert.rejects(methods.populateMainGame(), /Save current scene/);
  } finally { globalThis.Editor = previous; }
}));
test('installer: dry run, source+extension preparation and identical re-run without generating fake scene/meta', async () => temporary(async dir => {
  await projectFixture(dir); const plan = await prepareCocos(dir, { dryRun: true });
  assert.equal(plan.files.length, 12); await assert.rejects(access(join(dir, 'extensions')));
  const installed = await prepareCocos(dir); assert.equal(installed.engineRunValidated, false);
  assert.equal((await prepareCocos(dir)).files.every(f => f.status === 'unchanged'), true);
  await assert.rejects(access(join(dir, 'assets/night-market/MainGame.scene')));
  assert.match(await readFile(join(dir, 'extensions/night-market-integration/dist/scene.js'), 'utf8'), /populateScene/);
}));
test('installer: one modified target blocks all new writes; symlink ancestors are rejected', async () => temporary(async dir => {
  await projectFixture(dir); const prepared = await prepareCocos(dir);
  await writeFile(prepared.files[0].destination, 'user modifications');
  const absent = prepared.files.at(-1).destination; await unlink(absent);
  await assert.rejects(prepareCocos(dir), /Refusing to overwrite modified/);
  assert.equal(await readFile(prepared.files[0].destination, 'utf8'), 'user modifications'); await assert.rejects(access(absent));
  const second = join(dir, 'other-project'); await projectFixture(second);
  await symlink(join(dir, 'assets'), join(second, 'assets/night-market'), 'dir');
  await assert.rejects(prepareCocos(second), /Unsafe target ancestor/);
}));
async function exportFixture(dir) {
  await projectFixture(dir); await prepareCocos(dir);
  const uuid = randomUUID();
  // Filesystem fixture only. This is not legal Cocos serialization and is never presented as L2 evidence.
  await writeFile(join(dir, 'assets/night-market/MainGame.scene'), 'fixture-only');
  await writeFile(join(dir, 'assets/night-market/MainGame.scene.meta'), JSON.stringify({ uuid }));
  const config = { platform: 'wechatgame', startScene: uuid,
    scenes: [{ uuid, url: 'db://assets/night-market/MainGame.scene' }], packages: { wechatgame: { appid: 'wx3f8534584b5b98af', orientation: 'portrait' } } };
  const path = join(dir, 'exported-config.json'); await writeFile(path, JSON.stringify(config)); return { path, config };
}
test('build input checks: exported UUID/AppID/portrait contract only; rejects planning JSON and mismatched meta', async () => temporary(async dir => {
  const { path, config } = await exportFixture(dir);
  assert.equal((await inspectBuildInputs(dir, path, 'wx3f8534584b5b98af')).config.startScene, config.startScene);
  await assert.rejects(inspectBuildInputs(dir, new URL('../config/wechat.json', import.meta.url), 'wx3f8534584b5b98af'));
  await writeFile(join(dir, 'assets/night-market/MainGame.scene.meta'), JSON.stringify({ uuid: randomUUID() }));
  await assert.rejects(inspectBuildInputs(dir, path, 'wx3f8534584b5b98af'), /meta UUID/);
}));
test('subprocess fixture: captures logs/exit 36 without calling it an engine run; missing executable records error', async () => temporary(async dir => {
  // Explicit file-descriptor output avoids host console hooks in the subprocess fixture.
  const result = await runProcess(process.execPath, ['-e', 'require("node:fs").writeSync(1,"Node subprocess fixture, not Creator"); process.exit(36)'], join(dir, 'node.log'));
  assert.equal(result.code, 36); assert.match(await readFile(join(dir, 'node.log'), 'utf8'), /not Creator/);
  const missing = await runProcess(join(dir, 'missing'), [], join(dir, 'missing.log')); assert.ok(missing.error);
}));
test('output checks reject incomplete/wrong AppID/orientation fixtures; actual environment attempt stays explicitly blocked', async () => temporary(async dir => {
  await assert.rejects(verifyWeChatOutput(dir, 'wx3f8534584b5b98af'));
  await writeFile(join(dir, 'game.js'), 'fixture only'); await writeFile(join(dir, 'game.json'), JSON.stringify({ gameOrientation: 'landscape' }));
  await writeFile(join(dir, 'project.config.json'), JSON.stringify({ appid: 'wrong', compileType: 'game' }));
  await assert.rejects(verifyWeChatOutput(dir, 'wx3f8534584b5b98af'), /not portrait/);
  await writeFile(join(dir, 'game.json'), JSON.stringify({ gameOrientation: 'portrait' }));
  await assert.rejects(verifyWeChatOutput(dir, 'wx3f8534584b5b98af'), /AppID/);
  const result = await validateCocos({ creatorPath: join(dir, 'missing'), devtoolsPath: join(dir, 'missing'), reportRoot: join(dir, 'reports') });
  assert.equal(result.report.status, 'blocked'); assert.equal(result.report.process, null); assert.equal(result.report.levels.L3.build, 'not-run');
  assert.equal(result.report.levels.L4, 'not-verified');
}));

test('L1 process fixture only: runner rejects exit 0, accepts 36 plus fresh output, never marks runtime/device passed',
  { skip: process.platform === 'win32' }, async () => temporary(async dir => {
    const { path } = await exportFixture(dir), fake = join(dir, 'process-fixture');
    // This is a Node protocol fixture, not Creator. All generated fake output stays in the disposable test directory.
    await writeFile(fake, `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path');
const project = process.argv[process.argv.indexOf('--project') + 1];
const configPath = process.argv[process.argv.indexOf('--build') + 1].slice('configPath='.length);
const config = JSON.parse(fs.readFileSync(configPath));
const out = path.join(config.buildPath, config.outputName); fs.mkdirSync(out, {recursive:true});
fs.writeFileSync(path.join(out,'game.js'), 'Node fixture, NOT Cocos output');
fs.writeFileSync(path.join(out,'game.json'), JSON.stringify({gameOrientation:'portrait'}));
fs.writeFileSync(path.join(out,'project.config.json'), JSON.stringify({appid:'wx3f8534584b5b98af',compileType:'game'}));
fs.writeSync(1, 'Process fixture, NOT a Creator build');
process.exit(Number(fs.readFileSync(path.join(project, 'fixture-exit-code'), 'utf8')));
`, { mode: 0o755 });
    await writeFile(join(dir, 'fixture-exit-code'), '0');
    const first = await validateCocos({ projectPath: dir, configPath: path, creatorPath: fake, reportRoot: join(dir, 'attempts') });
    assert.equal(first.report.status, 'failed'); assert.match(first.report.blockers.join(' '), /received 0/);
    await writeFile(join(dir, 'fixture-exit-code'), '36');
    const second = await validateCocos({ projectPath: dir, configPath: path, creatorPath: fake, reportRoot: join(dir, 'attempts') });
    assert.equal(second.report.status, 'build-artifacts-verified');
    assert.notEqual(second.reportPath, first.reportPath); assert.match(second.report.levels.L2, /runtime-preview-not-verified/);
    assert.equal(second.report.levels.L3.developerToolsPreview, 'not-verified'); assert.equal(second.report.levels.L4, 'not-verified');
    assert.equal(second.report.process.code, 36);
  }));
