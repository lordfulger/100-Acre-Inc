// Cloud saves linked to a Google account.
//
// Sign-in works like signing in on a TV: the game asks for a link code, opens
// /cloud/signin?code=… in a browser, the player signs in with Google there, and
// the game picks up the result by polling. That works the same in the Android
// app, a browser, and an iPhone home-screen web app (where redirects are flaky).
//
// Saves go to Supabase when SUPABASE_URL / SUPABASE_SERVICE_KEY are set,
// otherwise to data/saves.json (fine for local testing; the free Render disk is
// wiped on restart, so set up Supabase for real use).

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
// Accepts the project URL with or without a trailing /rest/v1/.
const SUPA_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const SUPA_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();
const FAKE_GOOGLE = process.env.FAKE_GOOGLE === '1'; // tests only: accepts "fake:<id>:<email>"
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) console.warn('SESSION_SECRET not set: cloud sign-ins will reset when the server restarts.');

const LINK_TTL_MS = 10 * 60_000;
const MAX_SAVE_BYTES = 512 * 1024;
const links = new Map(); // code -> { created, result?: { token, email } }

export const cloudReady = () => Boolean(CLIENT_ID || FAKE_GOOGLE);

// ---------- sessions (signed tokens, nothing stored) ----------

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (body) => createHmac('sha256', SECRET).update(body).digest('base64url');

function makeToken(sub, email) {
  const body = b64(JSON.stringify({ sub, email }));
  return `${body}.${sign(body)}`;
}

function readToken(req) {
  const m = /^Bearer (.+)\.(.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const [, body, mac] = m;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
}

// ---------- Google ----------

async function verifyGoogle(credential) {
  if (FAKE_GOOGLE && credential.startsWith('fake:')) {
    const [, sub, email] = credential.split(':');
    return { sub: `fake-${sub}`, email };
  }
  if (!CLIENT_ID) throw new Error('Google sign-in is not set up on the server.');
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!res.ok) throw new Error('Google did not accept that sign-in.');
  const info = await res.json();
  const issuerOk = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
  if (info.aud !== CLIENT_ID || !issuerOk || Number(info.exp) * 1000 < Date.now()) throw new Error('That sign-in is not for this game.');
  if (info.email_verified !== 'true' && info.email_verified !== true) throw new Error('Please use a verified Google email.');
  return { sub: info.sub, email: info.email };
}

// ---------- storage ----------

const DATA_DIR = process.env.DATA_DIR || join(import.meta.dirname, '..', 'data');
const FILE = join(DATA_DIR, 'saves.json');

const supaHeaders = () => ({
  apikey: SUPA_KEY,
  // Legacy service_role keys are JWTs and also go in Authorization; new sb_secret_ keys don't.
  ...(SUPA_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SUPA_KEY}` } : {}),
  'content-type': 'application/json',
});

async function loadSave(sub) {
  if (SUPA_URL && SUPA_KEY) {
    const res = await fetch(`${SUPA_URL}/rest/v1/saves?google_sub=eq.${encodeURIComponent(sub)}&select=data,all_time,updated_at`, { headers: supaHeaders() });
    if (!res.ok) throw new Error(`Supabase read failed (${res.status})`);
    const [row] = await res.json();
    return row ? { data: row.data, allTime: row.all_time, updatedAt: row.updated_at } : null;
  }
  const all = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
  return all[sub] || null;
}

async function storeSave(sub, email, data, allTime) {
  const updatedAt = new Date().toISOString();
  if (SUPA_URL && SUPA_KEY) {
    const res = await fetch(`${SUPA_URL}/rest/v1/saves`, {
      method: 'POST',
      headers: { ...supaHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ google_sub: sub, email, data, all_time: allTime, updated_at: updatedAt }),
    });
    if (!res.ok) throw new Error(`Supabase write failed (${res.status})`);
    return updatedAt;
  }
  mkdirSync(DATA_DIR, { recursive: true });
  const all = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
  all[sub] = { data, allTime, updatedAt };
  writeFileSync(FILE, JSON.stringify(all));
  return updatedAt;
}

// ---------- the multiplayer rooms ----------

// Render's free disk is wiped whenever the server restarts or wakes from sleep, so
// the rooms (members, chat, queued gifts, Expotitions) live in a reserved row of
// the saves table too. Google account ids are numbers, so this key can't clash.
const ROOMS_ROW = 'server:rooms';
export const roomsInCloud = () => Boolean(SUPA_URL && SUPA_KEY);

/** The saved rooms, or null when Supabase isn't set up. Throws if Supabase can't be read. */
export async function loadRooms() {
  if (!roomsInCloud()) return null;
  return (await loadSave(ROOMS_ROW))?.data ?? {};
}

export async function storeRooms(rooms) {
  await storeSave(ROOMS_ROW, null, rooms, 0);
}

// ---------- HTTP ----------

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_SAVE_BYTES) { reject(new Error('Save is too big.')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch { reject(new Error('Bad request.')); }
    });
  });
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function signinPage(code) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in · 100 Acre Inc</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #FFF7E3; font-family: -apple-system, system-ui, sans-serif; color: #4A3418; }
  .card { background: #FFFDF6; border: 2px solid #EBD9AE; border-radius: 24px; padding: 28px 22px; max-width: 360px; margin: 16px; text-align: center; }
  h1 { font-size: 22px; margin: 8px 0; } p { line-height: 1.45; } #msg { font-weight: 700; } #btn { display: flex; justify-content: center; margin: 18px 0 8px; }
  img { width: 72px; height: 72px; border-radius: 18px; }
</style></head><body><div class="card">
  <img src="/apple-touch-icon.png" alt="">
  <h1>Save 100 Acre Inc to Google</h1>
  <p>Sign in so your honey, homes and Golden Honeycombs are kept safe and can come back on any phone.</p>
  <div id="btn"></div>
  <p id="msg"></p>
</div>
<script src="https://accounts.google.com/gsi/client" async defer></script>
<script>
  const code = ${JSON.stringify(code)};
  const msg = document.getElementById('msg');
  async function done(r) {
    msg.textContent = 'Signing in…';
    const res = await fetch('/cloud/complete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, credential: r.credential }) });
    const out = await res.json();
    if (out.ok) {
      document.getElementById('btn').remove();
      msg.textContent = '✅ Signed in as ' + out.email + '. You can close this and go back to the game.';
      setTimeout(() => window.close(), 1500);
    } else msg.textContent = 'Oh bother: ' + out.error;
  }
  window.onload = () => {
    google.accounts.id.initialize({ client_id: ${JSON.stringify(CLIENT_ID)}, callback: done });
    google.accounts.id.renderButton(document.getElementById('btn'), { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with' });
  };
</script></body></html>`;
}

/** Handles /cloud/* requests. Returns true if it took the request. */
export async function handleCloud(req, res) {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/cloud/')) return false;
  const now = Date.now();
  for (const [code, l] of links) if (now - l.created > LINK_TTL_MS) links.delete(code);

  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT' });
      return res.end(), true;
    }
    switch (`${req.method} ${url.pathname}`) {
      case 'GET /cloud/status':
        return json(res, 200, { ready: cloudReady() }), true;

      case 'POST /cloud/link': {
        if (!cloudReady()) return json(res, 503, { error: 'Cloud saves are not set up on the server yet.' }), true;
        const code = randomBytes(16).toString('hex');
        links.set(code, { created: now });
        return json(res, 200, { code }), true;
      }

      case 'GET /cloud/signin': {
        const code = url.searchParams.get('code') || '';
        const ok = links.has(code);
        res.writeHead(ok ? 200 : 410, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        res.end(ok ? signinPage(code) : `<p style="font-family:sans-serif;padding:24px">${escapeHtml('This sign-in link has expired. Go back to the game and tap "Sign in with Google" again.')}</p>`);
        return true;
      }

      case 'POST /cloud/complete': {
        const { code, credential } = await readBody(req);
        const link = links.get(code);
        if (!link) return json(res, 410, { error: 'This sign-in link has expired.' }), true;
        const { sub, email } = await verifyGoogle(String(credential || ''));
        link.result = { token: makeToken(sub, email), email };
        return json(res, 200, { ok: true, email }), true;
      }

      case 'GET /cloud/poll': {
        const link = links.get(url.searchParams.get('code') || '');
        if (!link) return json(res, 410, { error: 'expired' }), true;
        if (!link.result) return json(res, 200, { pending: true }), true;
        links.delete(url.searchParams.get('code'));
        return json(res, 200, link.result), true;
      }

      case 'GET /cloud/save': {
        const who = readToken(req);
        if (!who) return json(res, 401, { error: 'Please sign in again.' }), true;
        return json(res, 200, (await loadSave(who.sub)) || { data: null }), true;
      }

      case 'PUT /cloud/save': {
        const who = readToken(req);
        if (!who) return json(res, 401, { error: 'Please sign in again.' }), true;
        const { data, force, base } = await readBody(req);
        const allTime = Number(data?.allTimeEarned);
        if (!data || typeof data !== 'object' || !Number.isFinite(allTime)) return json(res, 400, { error: 'Bad save.' }), true;
        // A phone says which cloud version it last synced with (`base`). If the cloud has
        // changed since, another copy of the game saved in between: ask, rather than overwrite.
        // A phone that has never synced is behind if it has made less honey (all-time only goes up).
        const current = await loadSave(who.sub);
        // (Compared as times: the database may write the same moment in another format.)
        const behind = base ? Date.parse(current?.updatedAt) !== Date.parse(base) : Number(current?.allTime) > allTime;
        if (current && !force && behind) {
          return json(res, 409, { error: 'The cloud has newer progress.', cloud: current }), true;
        }
        const updatedAt = await storeSave(who.sub, who.email, data, allTime);
        return json(res, 200, { ok: true, updatedAt }), true;
      }
    }
    return json(res, 404, { error: 'Not found' }), true;
  } catch (err) {
    console.error('cloud:', err.message);
    return json(res, 400, { error: err.message }), true;
  }
}
