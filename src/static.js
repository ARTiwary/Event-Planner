'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg']);
const cache = new Map(); // file -> { mtimeMs, raw, gz }

/** Resolve a URL path to a file inside `root`, or null if it escapes the folder or is hidden. */
function resolveSafe(root, urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]); } catch { return null; }
  if (decoded.includes('\0')) return null;
  const rel = decoded === '/' ? '/index.html' : decoded;
  if (rel.split('/').some(seg => seg.startsWith('.') && seg !== '')) return null; // no dotfiles or ".."
  const file = path.resolve(root, '.' + rel);
  return file.startsWith(path.resolve(root) + path.sep) ? file : null;
}

/** Serve a static file with caching headers and gzip. Returns false if nothing was served. */
async function serveStatic(req, res, root) {
  const file = resolveSafe(root, req.url);
  if (!file) return false;
  let stat;
  try { stat = await fs.promises.stat(file); } catch { return false; }
  if (!stat.isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  let entry = cache.get(file);
  if (!entry || entry.mtimeMs !== stat.mtimeMs) {
    const raw = await fs.promises.readFile(file);
    entry = { mtimeMs: stat.mtimeMs, raw, gz: COMPRESSIBLE.has(ext) ? zlib.gzipSync(raw) : null };
    cache.set(file, entry);
  }
  const wantsGzip = entry.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const body = wantsGzip ? entry.gz : entry.raw;
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': body.length,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600', Vary: 'Accept-Encoding',
  };
  if (wantsGzip) headers['Content-Encoding'] = 'gzip';
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}

module.exports = { serveStatic, resolveSafe };
