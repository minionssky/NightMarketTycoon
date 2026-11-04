import { access, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { constants, createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { platform, arch, release } from 'node:os';
import { join, resolve, delimiter, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const cliSafePath = path => { if (/[;\r\n\0]/.test(path)) throw Error('Build paths cannot contain semicolons or control characters'); return path; };
export async function findExecutable(explicit, candidates = []) {
  const list = explicit ? [explicit] : candidates;
  for (const path of list.filter(Boolean)) try {
    await access(path, constants.X_OK); if ((await stat(path)).isFile()) return resolve(path);
  } catch { /* Continue safe discovery; never execute a guessed command. */ }
  return null;
}
export async function discoverTools({ creatorPath, devtoolsPath } = {}) {
  const paths = (process.env.PATH ?? '').split(delimiter);
  const creatorNames = platform() === 'win32' ? ['CocosCreator.exe'] : ['CocosCreator', 'creator'];
  const devtoolNames = platform() === 'win32' ? ['cli.bat'] : ['wechat-devtools', 'wechatwebdevtools'];
  return {
    creator: await findExecutable(creatorPath ?? process.env.COCOS_CREATOR, [
      ...paths.flatMap(dir => creatorNames.map(name => join(dir, name))),
      '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator',
      '/Applications/CocosCreator/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator',
      ...(platform() === 'win32' ? [join(process.env.PROGRAMDATA ?? 'C:\\ProgramData', 'cocos/editors/Creator/3.8.8/CocosCreator.exe')] : []),
    ]),
    devtools: await findExecutable(devtoolsPath ?? process.env.WECHAT_DEVTOOLS, [
      ...paths.flatMap(dir => devtoolNames.map(name => join(dir, name))),
      '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    ]),
  };
}
export async function inspectBuildInputs(projectPath, configPath, appId) {
  if (!projectPath || !configPath) throw Error('Provide an editor-created project and editor-exported WeChat build config');
  const project = resolve(projectPath), configFile = resolve(configPath);
  cliSafePath(project); cliSafePath(configFile);
  const manifest = await readJson(join(project, 'package.json'));
  if (!/^3\.8\./.test(manifest.creator?.version ?? '')) throw Error('Project manifest must declare Creator 3.8.x');
  const configBytes = await readFile(configFile), config = JSON.parse(configBytes.toString());
  if (config.platform !== 'wechatgame' || config.packages?.wechatgame?.appid !== appId || config.packages.wechatgame.orientation !== 'portrait')
    throw Error('Use an editor-exported wechatgame config with the configured AppID and portrait orientation');
  const scene = config.scenes?.find(item => item.uuid === config.startScene);
  if (typeof config.startScene !== 'string' || !scene || scene.url !== 'db://assets/night-market/MainGame.scene') throw Error('Exported startScene must reference the editor-generated MainGame UUID');
  const scenePath = join(project, 'assets/night-market/MainGame.scene');
  await access(scenePath);
  const meta = await readJson(`${scenePath}.meta`);
  if (!meta.uuid || meta.uuid !== config.startScene) throw Error('MainGame scene meta UUID does not match exported startScene');
  await access(join(project, 'assets/night-market/scripts/GameUI.ts'));
  return { project, configFile, config, declaredCreatorVersion: manifest.creator.version,
    configSha256: createHash('sha256').update(configBytes).digest('hex') };
}
/** A subprocess with complete logs; no shell interpolation and no secret environment dump. */
export async function runProcess(command, args, logPath, { timeoutMs = 20 * 60_000, cwd } = {}) {
  return new Promise(resolveResult => {
    const stream = createWriteStream(logPath, { flags: 'wx' });
    let child, timedOut = false, errorMessage = null, timer, killTimer;
    const finish = (code, signal) => {
      clearTimeout(timer); clearTimeout(killTimer); stream.end(() => resolveResult({ code, signal, timedOut, error: errorMessage }));
    };
    stream.once('open', () => {
      child = spawn(command, args, { cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.pipe(stream, { end: false }); child.stderr.pipe(stream, { end: false });
      child.once('error', error => { errorMessage = error.message; });
      child.once('close', finish);
      timer = setTimeout(() => { timedOut = true; child.kill(); killTimer = setTimeout(() => child.kill('SIGKILL'), 5000); }, timeoutMs);
    });
    stream.once('error', error => { errorMessage = error.message; if (child) child.kill(); else resolveResult({ code: null, error: errorMessage, timedOut: false }); });
  });
}
export async function verifyWeChatOutput(directory, appId) {
  const files = {};
  for (const name of ['game.js', 'game.json', 'project.config.json']) {
    const bytes = await readFile(join(directory, name)); if (!bytes.length) throw Error(`Empty output ${name}`);
    files[name] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  if ((await readJson(join(directory, 'game.json'))).gameOrientation !== 'portrait') throw Error('Generated game.json is not portrait');
  const project = await readJson(join(directory, 'project.config.json'));
  if (project.appid !== appId || project.compileType !== 'game') throw Error('Generated WeChat project AppID/type is wrong');
  return files;
}
export async function validateCocos(options = {}) {
  const outputRoot = resolve(options.reportRoot ?? join(root, 'artifacts/integration')); cliSafePath(outputRoot);
  await mkdir(outputRoot, { recursive: true });
  const directory = join(outputRoot, `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`);
  await mkdir(directory); // Each attempt owns a fresh directory. Existing build output is never reused.
  const tools = await discoverTools(options);
  const report = { schema: 1, recordedAt: new Date().toISOString(), scope: 'Cocos/WeChat integration attempt',
    host: { platform: platform(), arch: arch(), release: release(), node: process.version }, tools,
    status: 'blocked', blockers: [], manualBlockers: [], command: null, process: null, output: null,
    levels: { L1: 'external-unit-and-browser-checks-required', L2: 'blocked-editor-runtime-not-observed',
      L3: { build: 'not-run', developerToolsPreview: 'not-verified' }, L4: 'not-verified', L5: 'disabled-out-of-scope' } };
  let inputs;
  if (!tools.devtools) report.manualBlockers.push('WeChat DevTools not found; account login and simulator preview remain unavailable');
  if (!tools.creator) report.blockers.push('Cocos Creator executable not found; no engine process was launched');
  try {
    const planning = await readJson(join(root, 'config/wechat.json'));
    if (planning.realAdsEnabled !== false) throw Error('Real ads must remain disabled');
    if (!/^wx[0-9a-f]{16}$/i.test(planning.appId ?? '')) throw Error('Configure a valid WeChat AppID first');
    inputs = await inspectBuildInputs(options.projectPath, options.configPath, planning.appId);
  } catch (error) { report.blockers.push(error.message); }
  if (report.blockers.length === 0) {
    try {
      const execution = { ...inputs.config, buildPath: join(directory, 'engine-output'), outputName: 'wechatgame',
        logDest: join(directory, 'creator-build.log') };
      // Remove derived output paths from exported configs. Creator computes fresh destinations under buildPath.
      delete execution.dest;
      const configPath = join(directory, 'execution-config.json');
      await writeFile(configPath, JSON.stringify(execution, null, 2), { flag: 'wx' });
      report.project = inputs.project; report.declaredCreatorVersion = inputs.declaredCreatorVersion;
      report.originalConfigSha256 = inputs.configSha256;
      report.command = { executable: tools.creator, args: ['--project', inputs.project, '--build', `configPath=${configPath}`] };
      report.process = await runProcess(tools.creator, report.command.args, join(directory, 'process.log'), { cwd: inputs.project });
      // Creator's documented success code is 36. Generic exit 0 is not engine-build proof.
      if (report.process.code !== 36 || report.process.timedOut || report.process.error) throw Error(`Creator build did not return success code 36 (received ${report.process.code})`);
      const outputPath = join(directory, 'engine-output/wechatgame');
      const rel = relative(directory, outputPath); if (rel.startsWith('..') || isAbsolute(rel)) throw Error('Unsafe generated output path');
      report.output = { path: outputPath, files: await verifyWeChatOutput(outputPath, (await readJson(join(root, 'config/wechat.json'))).appId) };
      report.status = 'build-artifacts-verified'; report.levels.L2 = 'engine-build-step-completed-runtime-preview-not-verified';
      report.levels.L3.build = 'artifacts-verified';
      if (!tools.devtools) report.blockers.push('WeChat DevTools unavailable; simulator preview and account authorization remain unverified');
    } catch (error) { report.status = 'failed'; report.blockers.push(error.message); report.levels.L3.build = 'failed'; }
  }
  const reportPath = join(directory, 'report.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
  return { reportPath, report };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), value = key => { const index = args.indexOf(key); return index < 0 ? undefined : args[index + 1]; };
    const result = await validateCocos({ projectPath: value('--project'), configPath: value('--config'),
      creatorPath: value('--creator'), devtoolsPath: value('--devtools'), reportRoot: value('--reports') });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.report.status === 'blocked' ? 2 : result.report.status === 'failed' ? 1 : 0;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
