// Duplicates spike: does Spotify keep duplicate URIs written via the API?
// Secrets come from env only and are never logged.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
const ID = process.env.SPOTIFY_CLIENT_ID, SECRET = process.env.SPOTIFY_CLIENT_SECRET;
if (!ID || !SECRET) { console.error('Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET'); process.exit(1); }
const REDIRECT = 'http://127.0.0.1:3000/api/auth/callback';
const SCOPES = 'playlist-read-private playlist-modify-private playlist-modify-public';
const A = 'spotify:track:4uLU6hMCjMI75M1A2tKUQC', B = 'spotify:track:3n3Ppam7vgaVa1iaRUc9qp';
const OUT = new URL('./result.json', import.meta.url);
const b64u = b => b.toString('base64url');
const verifier = b64u(crypto.randomBytes(48));
const challenge = b64u(crypto.createHash('sha256').update(verifier).digest());
const state = b64u(crypto.randomBytes(16));
const authUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
  client_id: ID, response_type: 'code', redirect_uri: REDIRECT, scope: SCOPES,
  code_challenge_method: 'S256', code_challenge: challenge, state }).toString();
const log = (...a) => console.log(new Date().toISOString(), ...a);
let done = false;
async function api(token, method, path, body) {
  const r = await fetch('https://api.spotify.com/v1' + path, { method,
    headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  log(method, path, r.status);
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${typeof j === 'string' ? j : JSON.stringify(j)}`);
  return j;
}
async function run(code) {
  const steps = {}; const result = { startedAt: new Date().toISOString(), expected: ['A','A','B','A'], steps };
  let token, pid;
  try {
    const tr = await fetch('https://accounts.spotify.com/api/token', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(ID + ':' + SECRET).toString('base64') },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier }) });
    const tj = await tr.json(); log('token exchange', tr.status);
    if (!tr.ok) throw new Error('token exchange ' + tr.status + ' ' + (tj.error || '') + ' ' + (tj.error_description || ''));
    token = tj.access_token; steps.grantedScopes = tj.scope;
    const me = await api(token, 'GET', '/me'); result.userId = me.id; result.product = me.product;
    const pl = await api(token, 'POST', '/me/playlists', { name: 'rulemix dup test', public: false, description: 'temporary duplicates spike' });
    pid = pl.id; result.playlistId = pid;
    steps.put = await api(token, 'PUT', `/playlists/${pid}/items`, { uris: [A, A, B] });
    steps.post = await api(token, 'POST', `/playlists/${pid}/items`, { uris: [A] });
    const items = await api(token, 'GET', `/playlists/${pid}/items?limit=50`);
    const uris = (items.items || []).map(i => (i.item || i.track || {}).uri);
    result.actualUris = uris;
    result.actual = uris.map(u => u === A ? 'A' : u === B ? 'B' : u);
    result.duplicatesKeptInOrder = JSON.stringify(result.actual) === JSON.stringify(result.expected);
  } catch (e) { result.error = String(e.message || e); log('ERROR', result.error); }
  if (pid && token) {
    try { await api(token, 'DELETE', `/playlists/${pid}/followers`); result.cleanup = 'unfollowed'; }
    catch (e) { result.cleanup = 'FAILED: ' + e.message; }
  }
  result.finishedAt = new Date().toISOString();
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  log('RESULT', JSON.stringify({ actual: result.actual, duplicatesKeptInOrder: result.duplicatesKeptInOrder, error: result.error, cleanup: result.cleanup }));
}
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1:3000');
  if (u.pathname === '/') { res.writeHead(302, { Location: authUrl }); return res.end(); }
  if (u.pathname !== '/api/auth/callback') { res.writeHead(404); return res.end('not found'); }
  if (u.searchParams.get('state') !== state) { res.writeHead(400); return res.end('state mismatch'); }
  if (u.searchParams.get('error')) { log('auth error', u.searchParams.get('error')); res.writeHead(400); return res.end('auth error: ' + u.searchParams.get('error')); }
  if (done) { res.writeHead(200); return res.end('already ran; see result.json'); }
  done = true;
  await run(u.searchParams.get('code'));
  res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(fs.readFileSync(OUT, 'utf8'));
});
server.listen(3000, '127.0.0.1', () => { log('listening on http://127.0.0.1:3000'); log('AUTHORIZE_URL ' + authUrl); });
