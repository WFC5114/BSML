// Minimal static server for the built site, so the QA suite does not depend on the app's own dev server.
// Usage: QA_SITE_DIR=../dist QA_PORT=4173 node scripts/serve.mjs
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.env.QA_SITE_DIR || '../dist');
const port = Number(process.env.QA_PORT || 4173);

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

async function resolveFile(urlPath) {
  const safe = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, safe);
  if (!file.startsWith(root)) return null;
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, 'index.html');
    await stat(file);
    return file;
  } catch {
    // Allow extensionless URLs (/en/schools -> /en/schools.html)
    try { await stat(file + '.html'); return file + '.html'; } catch { return null; }
  }
}

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  // Redirect /en -> /en/ like most static hosts do
  if (!extname(path) && !path.endsWith('/')) {
    try {
      if ((await stat(join(root, path))).isDirectory()) { res.writeHead(301, { Location: path + '/' }); return res.end(); }
    } catch {}
  }
  const file = await resolveFile(path);
  if (!file) {
    const notFound = await resolveFile('/404.html');
    res.writeHead(404, { 'Content-Type': types['.html'] });
    return res.end(notFound ? await readFile(notFound) : 'Not found');
  }
  res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
  res.end(await readFile(file));
}).listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));
