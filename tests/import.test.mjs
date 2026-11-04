import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importCocos } from '../scripts/import-cocos.mjs';

test('source importer accepts a 3.8 manifest fixture and preserves existing files on repeat', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nightmarket-import-'));
  try {
    await mkdir(join(dir, 'assets'));
    // This is a filesystem test fixture, not a generated or validated Cocos project.
    await writeFile(join(dir, 'package.json'), JSON.stringify({ creator: { version: '3.8.8' } }));
    const files = await importCocos(dir); assert.equal(files.length, 7);
    assert.match(await readFile(files[4], 'utf8'), /class VisualDirector/);
    assert.match(await readFile(files[6], 'utf8'), /class NightMarketScene/);
    assert.match(await readFile(files[1], 'utf8'), /class RecipeBookUI/);
    assert.match(await readFile(files[2], 'utf8'), /node.layer = parent.layer/);
    assert.match(await readFile(files[0], 'utf8'), /class GameUI/);
    await writeFile(files[0], 'existing user changes');
    await assert.rejects(importCocos(dir), /Refusing to overwrite/);
    assert.equal(await readFile(files[0], 'utf8'), 'existing user changes');
  } finally { await rm(dir, { recursive: true }); }
});
test('source importer rejects unsupported projects before copying', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nightmarket-import-invalid-'));
  try {
    await writeFile(join(dir, 'package.json'), JSON.stringify({ creator: { version: '3.7.0' } }));
    await assert.rejects(importCocos(dir), /3\.8/);
    await assert.rejects(access(join(dir, 'assets')));
    await assert.rejects(importCocos(), /Usage/);
  } finally { await rm(dir, { recursive: true }); }
});
