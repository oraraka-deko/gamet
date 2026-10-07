import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm',
};

/**
 * Helper that mimics Go's fs.Glob over the assets directory
 */
function listDirPngs(relDir, prefix = '') {
  const fullDir = path.join(__dirname, 'assets', relDir);
  if (!fs.existsSync(fullDir)) return [];
  return fs
    .readdirSync(fullDir)
    .filter((f) => f.endsWith('.png') && f.startsWith(prefix))
    .sort()
    .map((f) => `/assets/${relDir.replace(/\\/g, '/')}/${f}`);
}

export function getAssetManifest() {
  return {
    playerSprite: '/assets/images/player.png',
    titleFont: '/assets/fonts/title.ttf',
    meteors: listDirPngs('images/meteors'),
    meteorsSmall: listDirPngs('images/meteors-small'),
    archer1: {
      idle: listDirPngs('archer/1', 'Elf_01__IDLE_'),
      attack: listDirPngs('archer/1', 'Elf_01__ATTACK_'),
      hurt: listDirPngs('archer/1', 'Elf_01__HURT_'),
      die: listDirPngs('archer/1', 'Elf_01__DIE_'),
    },
    archer2: {
      idle: listDirPngs('archer/2', 'Elf_02__IDLE_'),
      attack: listDirPngs('archer/2', 'Elf_02__ATTACK_'),
      hurt: listDirPngs('archer/2', 'Elf_02__HURT_'),
      die: listDirPngs('archer/2', 'Elf_02__DIE_'),
    },
    arrowSprite: '/assets/arrows/without_shadow/1.png',
    explosionSprite: '/assets/images/explosion.png',
  };
}

export function createGameServer() {
  return http.createServer((req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(reqUrl.pathname);

    if (pathname === '/api/assets') {
      const manifest = getAssetManifest();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(manifest));
      return;
    }

    if (pathname === '/') {
      pathname = '/index.html';
    }

    // Prevent directory traversal outside workspace root
    const safePath = path.normalize(path.join(__dirname, pathname));
    if (!safePath.startsWith(__dirname)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
      return;
    }

    fs.stat(safePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      });

      const stream = fs.createReadStream(safePath);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        }
        res.end('500 Internal Server Error');
      });
      stream.pipe(res);
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const server = createGameServer();
  server.listen(PORT, () => {
    console.log(`Archer Duel (Node.js port) running at http://localhost:${PORT}`);
  });
}

