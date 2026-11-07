'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function loadEnv() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadEnv();

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const WEBHOOKS = {
  available: process.env.DISCORD_AVAILABLE_WEBHOOK || '',
  taken: process.env.DISCORD_TAKEN_WEBHOOK || '',
  system: process.env.DISCORD_SYSTEM_WEBHOOK || '',
  updates: process.env.DISCORD_UPDATES_WEBHOOK || '',
  bugs: process.env.DISCORD_BUGS_WEBHOOK || ''
};
const startedAt = Date.now();
const requestBuckets = new Map();
function rateLimited(req, key, limit, windowMs) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const id = `${key}:${ip}`; const now = Date.now(); const old = requestBuckets.get(id);
  if (!old || now - old.start >= windowMs) { requestBuckets.set(id, { start: now, count: 1 }); return false; }
  old.count++; return old.count > limit;
}
function validWebhook(value) {
  if (!value) return '';
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'discord.com' && /^\/api\/webhooks\/\d+\//.test(u.pathname) ? value : ''; } catch { return ''; }
}
const state = { checks: 0, available: 0, taken: 0, unknown: 0, candidates: 0, updates: [], events: [], clients: new Set() };
const WORDS = ['abuzz','adieu','aglow','amiss','amity','anewt','ardor','ashen','askew','aural','axiom','azure','banal','birch','blurt','brume','byway','cairn','chasm','cipher','clove','coven','crisp','crypt','curio','dazed','defer','delta','droll','dusky','eerie','elope','ember','ennui','epoch','ether','evoke','exile','fjord','flair','fluke','foyer','giddy','gloom','glyph','gnome','gouge','haven','helix','hushh','ivory','jaunt','joust','kudos','lilac','lumen','mauve','maybe','mirth','moire','mossy','myrrh','nymph','ochre','oddly','oleum','ombre','opine','orbit','ovine','oxbow','pique','plaid','plume','quell','quirk','raven','rebus','relic','riven','rogue','runic','sable','savor','serif','shard','sheen','shoal','sieve','slant','smirk','snare','solum','spore','stave','stoic','surly','swirl','tacit','thorn','umbra','uncut','unlit','vague','vapor','venom','vexed','vigil','waltz','weird','whelm','whorl','wryly','xylem','yearn','yeast','zesty'];
const PREFIXES = ['mis','un','out','over','under','anti','para','pseudo','near','ever'];
const SUFFIXES = ['word','heard','place','known','said','sense','spell','read','seen','told','woven','found'];

function safeEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' });
  res.end(body);
}
function broadcast(type, payload) {
  const packet = `data: ${JSON.stringify({ type, payload, stats: stats() })}\n\n`;
  for (const client of state.clients) client.write(packet);
}
function logEvent(message) {
  const event = { at: new Date().toISOString(), message: String(message).slice(0, 240) };
  state.events.unshift(event); state.events = state.events.slice(0, 30);
  broadcast('event', event);
}
function stats() {
  return { checks: state.checks, available: state.available, taken: state.taken, unknown: state.unknown, candidates: state.candidates,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), updatedAt: new Date().toISOString() };
}
async function discord(url, content) {
  url = validWebhook(url);
  if (!url) return false;
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: String(content).slice(0, 1900) }), signal: AbortSignal.timeout(8000) });
    if (!r.ok) logEvent(`Discord delivery failed (${r.status})`);
    return r.ok;
  } catch (e) { logEvent('Discord delivery failed: network error'); return false; }
}
function admin(req) {
  const supplied = req.headers['x-admin-password'] || '';
  return ADMIN_PASSWORD.length >= 12 && safeEqual(supplied, ADMIN_PASSWORD);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''; req.on('data', chunk => { data += chunk; if (data.length > 20000) reject(new Error('Body too large')); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}
function makeCandidates(mode, count) {
  const out = new Set();
  const max = Math.min(Math.max(Number(count) || 24, 1), 80);
  if (mode === 'rare') {
    const pool = [...WORDS];
    while (out.size < Math.min(max, pool.length)) {
      const i = crypto.randomInt(pool.length); out.add(pool.splice(i, 1)[0]);
    }
  } else if (mode === 'odd') {
    const pool = [];
    for (const p of PREFIXES) for (const s of SUFFIXES) { const v = (p + s).slice(0, 5); if (/^[a-z]{5}$/.test(v)) pool.push(v); }
    while (out.size < Math.min(max, pool.length)) out.add(pool.splice(crypto.randomInt(pool.length), 1)[0]);
  } else {
    while (out.size < max) {
      let word = ''; for (let i = 0; i < 5; i++) word += String.fromCharCode(97 + crypto.randomInt(26));
      out.add(word);
    }
  }
  return [...out];
}
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json; charset=utf-8', '.png':'image/png' };
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self' https: data:; script-src 'self' 'unsafe-inline' https://www.youtube.com https://w.soundcloud.com; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://w.soundcloud.com https://open.spotify.com; connect-src 'self' https://discord.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, { ok:true, service:'monsoon' });
  if (req.method === 'GET' && url.pathname === '/api/stats') return send(res, 200, stats());
  if (req.method === 'GET' && url.pathname === '/api/events') return send(res, 200, { events: state.events });
  if (req.method === 'GET' && url.pathname === '/api/stream') {
    res.writeHead(200, { 'content-type':'text/event-stream', 'cache-control':'no-cache', connection:'keep-alive' });
    res.write(`data: ${JSON.stringify({ type:'snapshot', stats:stats() })}\n\n`); state.clients.add(res); req.on('close', () => state.clients.delete(res)); return;
  }
  if (req.method === 'POST' && url.pathname === '/api/generate') {
    if (rateLimited(req, 'generate', 30, 60_000)) return send(res, 429, { error:'Too many requests. Try again shortly.' });
    try {
      const body = await readBody(req); const names = makeCandidates(body.mode, body.count);
      state.candidates += names.length; logEvent(`Generated ${names.length} ${body.mode || 'five-letter'} candidates`);
      return send(res, 200, { names, stats:stats() });
    } catch (e) { return send(res, 400, { error:e.message }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/check') {
    if (rateLimited(req, 'check', 20, 60_000)) return send(res, 429, { error:'Too many checks. Try again shortly.' });
    try {
      const body = await readBody(req); const name = String(body.username || '').toLowerCase();
      if (!/^[a-z][a-z0-9_]{4,31}$/.test(name)) return send(res, 400, { error:'Use a valid Telegram username: 5–32 characters, starting with a letter.' });
      // Telegram's public links and Bot API do not reliably prove that a username is claimable.
      // Do not infer availability from a failed lookup; leave the result explicitly unverified.
      state.checks++; state.unknown++; logEvent(`Manual verification requested for @${name}`);
      return send(res, 200, { username:name, status:'unknown', message:'Not verified. A public profile lookup cannot prove that this username is available. Open Telegram and check through its official username settings.', telegramUrl:`https://t.me/${encodeURIComponent(name)}`, stats:stats() });
    } catch (e) { return send(res, 400, { error:e.message }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/mark') {
    if (rateLimited(req, 'admin', 8, 5 * 60_000)) return send(res, 429, { error:'Too many admin attempts. Wait five minutes.' });
    if (!admin(req)) return send(res, 401, { error:'Admin authentication failed. Set ADMIN_PASSWORD to at least 12 characters.' });
    try {
      const body = await readBody(req); const name = String(body.username || '').toLowerCase(); const status = body.status;
      if (!/^[a-z][a-z0-9_]{4,31}$/.test(name) || !['available','taken'].includes(status) || body.confirmed !== true)
        return send(res, 400, { error:'A username, available/taken status, and explicit confirmation are required.' });
      state[status]++; logEvent(`Admin manually marked @${name} as ${status}`);
      await discord(WEBHOOKS[status], `Manual Telegram username status\n@${name} — ${status.toUpperCase()}\nMarked by dashboard admin. This is not an automated Telegram verification.`);
      return send(res, 200, { ok:true, stats:stats() });
    } catch (e) { return send(res, 400, { error:e.message }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/update') {
    if (rateLimited(req, 'admin', 8, 5 * 60_000)) return send(res, 429, { error:'Too many admin attempts. Wait five minutes.' });
    if (!admin(req)) return send(res, 401, { error:'Admin authentication failed.' });
    try {
      const body = await readBody(req); const message = String(body.message || '').trim().slice(0, 1500);
      if (message.length < 3) return send(res, 400, { error:'Announcement must be at least 3 characters.' });
      const item = { message, at:new Date().toISOString() }; state.updates.unshift(item); state.updates = state.updates.slice(0, 20);
      await discord(WEBHOOKS.updates, `MONSOON — PUBLIC UPDATE\n${message}`); logEvent('Admin published a public update'); broadcast('update', item);
      return send(res, 200, { ok:true, update:item });
    } catch (e) { return send(res, 400, { error:e.message }); }
  }
  if (req.method === 'GET' && url.pathname === '/api/updates') return send(res, 200, { updates:state.updates });
  let requested;
  try { requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, ''); }
  catch { return send(res, 400, { error:'Invalid path' }); }
  const publicRoot = path.resolve(__dirname, 'public');
  const file = path.resolve(publicRoot, requested);
  if (file !== publicRoot && !file.startsWith(publicRoot + path.sep)) return send(res, 403, { error:'Forbidden' });
  fs.readFile(file, (err, data) => { if (err) return send(res, 404, { error:'Not found' }); res.writeHead(200, { 'content-type':mime[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
});
server.listen(PORT, '0.0.0.0', () => console.log(`MONSOON listening on port ${PORT}`));
server.on('error', err => { console.error('HTTP server error:', err.message); });
process.on('uncaughtException', async err => { console.error('Uncaught exception:', err.message); await discord(WEBHOOKS.bugs, `MONSOON backend error\nUncaught exception: ${String(err.message).slice(0, 500)}`); process.exit(1); });
process.on('unhandledRejection', async reason => { const message = reason instanceof Error ? reason.message : String(reason); console.error('Unhandled rejection:', message); await discord(WEBHOOKS.bugs, `MONSOON backend error\nUnhandled rejection: ${message.slice(0, 500)}`); });
setInterval(async () => {
  const s = stats(); logEvent('Five-minute system heartbeat');
  await discord(WEBHOOKS.system, `MONSOON system heartbeat\nUptime: ${s.uptimeSeconds}s\nChecks: ${s.checks}\nAvailable (manually marked): ${s.available}\nTaken (manually marked): ${s.taken}\nUnverified: ${s.unknown}\nCandidates generated: ${s.candidates}`);
}, 5 * 60 * 1000).unref();
