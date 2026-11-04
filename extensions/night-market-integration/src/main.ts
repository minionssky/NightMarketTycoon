import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const extension = 'night-market-integration';
const sceneUrl = 'db://assets/night-market/MainGame.scene';
export function load(): void {}
export function unload(): void {}
export const methods = {
  async populateMainGame() {
    if (!/^3\.8\./.test(Editor.App.version)) throw new Error('Requires Creator 3.8.x.');
    if (await Editor.Message.request('scene', 'query-dirty')) throw new Error('Save current scene changes before running integration.');
    const info = await Editor.Message.request('asset-db', 'query-asset-info', sceneUrl);
    if (!info || !info.imported || info.invalid) throw new Error(`Create and save an empty scene with the editor at ${sceneUrl}; no scene JSON will be fabricated.`);
    await Editor.Message.request('scene', 'open-scene', info.uuid);
    const result = await Editor.Message.request('scene', 'execute-scene-script', { name: extension, method: 'populate', args: [] });
    await Editor.Message.request('scene', 'snapshot');
    const saved = await Editor.Message.request('scene', 'save-scene');
    if (!saved) throw new Error('Creator did not confirm scene save. Save in the editor and inspect Console.');
    const report = { schema: 1, timestamp: new Date().toISOString(), editorVersion: Editor.App.version,
      sceneUrl, sceneAssetUuid: info.uuid, saveResult: saved, ...result,
      runtimePreviewValidated: false, wechatBuildValidated: false, deviceValidated: false };
    const directory = join(Editor.Project.path, 'temp', extension); await mkdir(directory, { recursive: true });
    const path = join(directory, `scene-${Date.now()}.json`);
    await writeFile(path, JSON.stringify(report, null, 2), { flag: 'wx' });
    console.log(`[NightMarket] Saved scene configuration. Preview and device validation are still required. Evidence: ${path}`);
    return report;
  },
};
