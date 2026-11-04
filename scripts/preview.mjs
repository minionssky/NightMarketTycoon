import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const routes = {
  '/': ['preview/index.html', 'text/html; charset=utf-8'],
  '/game.js': ['preview/game.js', 'text/javascript; charset=utf-8'],
  '/visuals.js': ['preview/visuals.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['preview/style.css', 'text/css; charset=utf-8'],
  '/visual-style.js': ['assets/scripts/ui/effects/VisualStyle.ts', 'text/javascript; charset=utf-8'],
  '/core.js': ['assets/scripts/core/GameCore.ts', 'text/javascript; charset=utf-8'],
};
export function createPreviewServer() {
  return createServer(async (req, res) => {
    const route = routes[new URL(req.url, 'http://localhost').pathname];
    if (!route) { res.writeHead(404); res.end('Not found'); return; }
    try {
      let source = await readFile(resolve(root, route[0]), 'utf8');
      if (route[0].endsWith('.ts')) source = stripTypeScriptTypes(source);
      res.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-store' }); res.end(source);
    } catch { res.writeHead(500); res.end('Preview source unavailable'); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createPreviewServer();
  server.listen(4173, '127.0.0.1', () => console.log('Browser domain demo: http://127.0.0.1:4173 (not Cocos preview)'));
}
