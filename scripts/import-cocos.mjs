import { readFile, mkdir, access, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const sourceScripts = Object.freeze(['GameUI.ts', 'RecipeBookUI.ts', 'ui/UiFactory.ts', 'core/GameCore.ts',
  'ui/effects/VisualStyle.ts', 'ui/effects/VectorArt.ts', 'ui/effects/NightMarketScene.ts', 'RewardsUI.ts', 'integration/RuntimeProbe.ts']);

/** Import only source scripts into an editor-created 3.8 project. Never fabricate scenes or overwrite assets. */
export async function importCocos(target) {
  if (!target) throw Error('Usage: npm run import:cocos -- /absolute/path/to/editor-created-project');
  const root = resolve(target);
  const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  if (!/^3\.8\./.test(manifest.creator?.version ?? '')) throw Error('Requires an editor-created Cocos Creator 3.8.x project');
  await access(resolve(root, 'assets'));
  const plan = await Promise.all(sourceScripts.map(async name => {
    const source = fileURLToPath(new URL(`../assets/scripts/${name}`, import.meta.url));
    const destination = resolve(root, 'assets/night-market/scripts', name);
    await access(source);
    let exists = false;
    try { await access(destination); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (exists) throw Error(`Refusing to overwrite: ${destination}`);
    return { source, destination };
  }));
  for (const { source, destination } of plan) {
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination, constants.COPYFILE_EXCL);
  }
  return plan.map(p => p.destination);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const files = await importCocos(process.argv[2]);
    console.log(`Imported ${files.length} scripts. Open Creator; save a 2D scene as MainGame; attach GameUI to Canvas. See docs/COCOS_SETUP.md.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
