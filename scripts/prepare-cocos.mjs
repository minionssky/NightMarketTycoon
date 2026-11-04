import { readFile, mkdir, lstat, copyFile, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceScripts } from './import-cocos.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function safeParents(root, destination) {
  let current = dirname(destination);
  while (current !== root) {
    const rel = relative(root, current);
    if (rel.startsWith('..') || isAbsolute(rel)) throw Error('Target escapes the project');
    try { const info = await lstat(current); if (info.isSymbolicLink() || !info.isDirectory()) throw Error(`Unsafe target ancestor: ${current}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    current = dirname(current);
  }
}
export async function prepareCocos(target, { dryRun = false } = {}) {
  if (!target) throw Error('Usage: npm run prepare:cocos -- /path/to/editor-created-project [--dry-run]');
  const project = await realpath(resolve(target));
  const manifest = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
  if (!/^3\.8\./.test(manifest.creator?.version ?? '')) throw Error('Requires an editor-created 3.8.x project');
  const assets = await lstat(join(project, 'assets'));
  if (!assets.isDirectory() || assets.isSymbolicLink()) throw Error('assets must be a real directory');
  const entries = sourceScripts.map(name => ({
    source: join(root, 'assets/scripts', name), destination: join(project, 'assets/night-market/scripts', name),
  }));
  for (const name of ['package.json', 'dist/main.js', 'dist/scene.js']) entries.push({
    source: join(root, 'extensions/night-market-integration', name),
    destination: join(project, 'extensions/night-market-integration', name),
  });
  const plan = [];
  // Validate every source, hash and destination before the first mutation; never replace different content.
  for (const entry of entries) {
    await safeParents(project, entry.destination);
    const bytes = await readFile(entry.source);
    let status = 'new';
    try {
      const info = await lstat(entry.destination);
      if (!info.isFile() || info.isSymbolicLink()) throw Error(`Refusing target: ${entry.destination}`);
      if (digest(await readFile(entry.destination)) !== digest(bytes)) throw Error(`Refusing to overwrite modified file: ${entry.destination}`);
      status = 'unchanged';
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    plan.push({ ...entry, status, sha256: digest(bytes) });
  }
  if (!dryRun) for (const entry of plan) if (entry.status === 'new') {
    await mkdir(dirname(entry.destination), { recursive: true });
    await copyFile(entry.source, entry.destination, constants.COPYFILE_EXCL);
  }
  return { status: dryRun ? 'planned' : 'prepared', project, files: plan,
    engineRunValidated: false, next: 'Enable project extension. Save an empty/untouched 2D scene as assets/night-market/MainGame.scene; use Develop/NightMarket menu.' };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await prepareCocos(process.argv[2], { dryRun: process.argv.includes('--dry-run') }), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
