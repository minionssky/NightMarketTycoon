import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

async function executable(path) {
  if (!path) return false;
  try { await access(path, constants.X_OK); return (await stat(path)).isFile(); } catch { return false; }
}
/** Read-only readiness check. A discovered binary is not a validated engine, build or device run. */
export async function inspectWeChatReadiness({ creatorPath, devtoolsPath, projectPath,
  configPath = fileURLToPath(new URL('../config/wechat.example.json', import.meta.url)) } = {}) {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const configValid = /^3\.8\./.test(config.creatorVersion) && config.platform === 'wechatgame' &&
    config.orientation === 'portrait' && config.designResolution?.width === 720 && config.designResolution?.height === 1280 &&
    config.realAdsEnabled === false && config.rewardedAdUnitId === '';
  let projectManifestValid = false;
  if (projectPath) {
    try {
      const manifest = JSON.parse(await readFile(resolve(projectPath, 'package.json'), 'utf8'));
      await access(resolve(projectPath, 'assets'));
      projectManifestValid = /^3\.8\./.test(manifest.creator?.version ?? '');
    } catch { /* Missing/invalid engine-created project is a reported blocker. */ }
  }
  const creatorFound = await executable(creatorPath), devtoolsFound = await executable(devtoolsPath);
  const blockers = [!configValid && 'invalid planning config', !creatorFound && 'Cocos Creator executable not supplied/found',
    !devtoolsFound && 'WeChat DevTools executable not supplied/found', !projectManifestValid && 'editor-created 3.8 project not supplied/recognized',
    !/^wx[0-9a-f]{16}$/i.test(config.appId ?? '') && 'actual authorized AppID still required'].filter(Boolean);
  return { status: blockers.length ? 'blocked' : 'manual-validation-required', creatorFound, devtoolsFound, projectManifestValid,
    configValid, blockers, buildValidated: false, deviceValidated: false, realAdsEnabled: false };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const report = await inspectWeChatReadiness({ creatorPath: process.env.COCOS_CREATOR,
      devtoolsPath: process.env.WECHAT_DEVTOOLS, projectPath: process.argv[2] });
    console.log(JSON.stringify(report, null, 2)); process.exitCode = report.status === 'blocked' ? 2 : 0;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
