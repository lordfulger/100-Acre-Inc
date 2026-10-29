// Hundred Acre Honey Tycoon — multiplayer relay server.
//
// The economy runs on each phone (so it is smooth and works offline). This
// server links friends together in a shared "wood" (room): live roster, chat,
// honey gifts, hugs, shared balloon joy, and co-op Expotitions (contracts).

import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, statSync, createReadStream } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = process.env.DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const DATA_FILE = join(DATA_DIR, 'rooms.json');
const MAX_MEMBERS = 8;
const CHAT_HISTORY = 60;
const HUG_COOLDOWN_MS = 20_000;
const BALLOON_COOLDOWN_MS = 8_000;

// Co-op contracts. `goalSeconds` = how many seconds of the wood's combined
// honey/sec the goal is worth when the contract starts (growth makes it easier).
export const CONTRACTS = [
  { id: 'tail', name: "Find Eeyore's Tail", emoji: '🐴', minutes: 30, goalSeconds: 600, minGoal: 5_000, combs: [1, 2, 4] },
  { id: 'party', name: "Pooh's Party Feast", emoji: '🎉', minutes: 60, goalSeconds: 1_800, minGoal: 25_000, combs: [2, 4, 8] },
  { id: 'pole', name: 'Expotition to the North Pole', emoji: '🧭', minutes: 180, goalSeconds: 7_200, minGoal: 150_000, combs: [4, 8, 16] },
  { id: 'flood', name: 'Rescue Piglet from the Flood', emoji: '🌧️', minutes: 480, goalSeconds: 25_000, minGoal: 1_000_000, combs: [8, 16, 32] },
];
const TIERS = [0.25, 0.6, 1];
const FINAL_BOOST = { mult: 2, secs: 20 * 60 };

// ---------- persistence ----------

let rooms = {};
try {
  if (existsSync(DATA_FILE)) rooms = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
} catch (err) {
  console.error('Could not read saved rooms, starting fresh:', err.message);
}

let dirty = false;
function markDirty() { dirty = true; }
function save() {
  if (!dirty) return;
  dirty = false;
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(rooms));
  renameSync(tmp, DATA_FILE);
}
setInterval(save, 5_000).unref();
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { dirty = true; save(); process.exit(0); });
}

// ---------- helpers ----------

const sockets = new Map(); // `${room}:${pid}` -> Set<ws>

const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const cleanText = (s, max) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const num = (n) => (Number.isFinite(n) && n > 0 ? n : 0);
// A player's map (owned / level / manager per building), kept small and tidy.
function cleanBuildings(b) {
  if (!b || typeof b !== 'object') return undefined;
  const pick = (obj, fn) => {
    const out = {};
    for (const [k, v] of Object.entries(obj || {}).slice(0, 20)) if (/^[a-z]{2,12}$/.test(k)) out[k] = fn(v);
    return out;
  };
  return {
    owned: pick(b.owned, (v) => Math.min(1e6, num(Number(v)))),
    levels: pick(b.levels, (v) => Math.min(10, num(Number(v)))),
    managed: pick(b.managed, (v) => v === true),
  };
}
const publicId = (secret) => createHash('sha256').update(String(secret)).digest('hex').slice(0, 12);

function getRoom(code) {
  if (!rooms[code]) {
    rooms[code] = { code, createdAt: Date.now(), members: {}, chat: [], contract: null, inbox: {} };
    markDirty();
  }
  return rooms[code];
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function isOnline(code, pid) {
  return (sockets.get(`${code}:${pid}`)?.size ?? 0) > 0;
}

function sendTo(room, pid, msg, { queue = false } = {}) {
  const set = sockets.get(`${room.code}:${pid}`);
  if (set && set.size) {
    for (const ws of set) send(ws, msg);
  } else if (queue) {
    (room.inbox[pid] ||= []).push(msg);
    room.inbox[pid] = room.inbox[pid].slice(-50);
    markDirty();
  }
}

function broadcast(room, msg, exceptPid) {
  for (const pid of Object.keys(room.members)) {
    if (pid !== exceptPid) sendTo(room, pid, msg);
  }
}

function roster(room) {
  return Object.entries(room.members).map(([id, m]) => ({
    id, name: m.name, avatar: m.avatar, online: isOnline(room.code, id), lastSeen: m.lastSeen, stats: m.stats || {},
  }));
}

function pushChat(room, entry) {
  room.chat.push(entry);
  room.chat = room.chat.slice(-CHAT_HISTORY);
  markDirty();
  broadcast(room, { t: 'chat', msg: entry });
}

function system(room, text) {
  pushChat(room, { id: `${Date.now()}-${Math.random()}`, system: true, text, at: Date.now() });
}

// ---------- contracts ----------

function startContract(room, def, starter) {
  const totalHps = Object.values(room.members).reduce((s, m) => s + num(m.stats?.hps), 0);
  const goal = Math.max(def.minGoal, Math.round(totalHps * def.goalSeconds));
  room.contract = {
    id: def.id, goal, progress: 0, contributions: {}, tiersReached: 0, status: 'active',
    startedAt: Date.now(), endsAt: Date.now() + def.minutes * 60_000, startedBy: starter,
  };
  markDirty();
  broadcast(room, { t: 'contract', contract: room.contract });
  system(room, `${def.emoji} ${room.members[starter]?.name || 'Someone'} started "${def.name}"! Goal: ${goal.toLocaleString('en-US')} honey together.`);
}

function contribute(room, pid, amount) {
  const c = room.contract;
  if (!c || c.status !== 'active' || amount <= 0) return;
  c.progress += amount;
  c.contributions[pid] = (c.contributions[pid] || 0) + amount;
  const def = CONTRACTS.find((d) => d.id === c.id);
  while (c.tiersReached < TIERS.length && c.progress >= c.goal * TIERS[c.tiersReached]) {
    const tier = c.tiersReached;
    c.tiersReached++;
    const final = c.tiersReached === TIERS.length;
    const reward = { t: 'reward', contractId: c.id, tier, combs: def.combs[tier], boost: final ? FINAL_BOOST : null, name: def.name };
    for (const member of Object.keys(room.members)) sendTo(room, member, reward, { queue: true });
    system(room, final
      ? `🏆 "${def.name}" complete! Everyone gets ${def.combs[tier]} Golden Honeycombs and ×${FINAL_BOOST.mult} honey for ${FINAL_BOOST.secs / 60} min!`
      : `⭐ Tier ${tier + 1} of "${def.name}" reached! +${def.combs[tier]} Golden Honeycombs each.`);
    if (final) c.status = 'complete';
  }
  markDirty();
  broadcast(room, { t: 'contract', contract: c });
}

setInterval(() => {
  const now = Date.now();
  for (const room of Object.values(rooms)) {
    const c = room.contract;
    if (c && c.status === 'active' && now > c.endsAt) {
      c.status = 'expired';
      markDirty();
      broadcast(room, { t: 'contract', contract: c });
      system(room, `⌛ Time ran out on the Expotition. Oh bother. Try another!`);
    }
  }
}, 5_000).unref();

// ---------- connections ----------

// The web version of the game (built into server/public by `npm run build:web` in app/)
// is served from here too, so a phone can open it in the browser and add it to its home screen.
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.map': 'application/json',
};

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(PUBLIC_DIR, urlPath));
  if (!file.startsWith(PUBLIC_DIR)) return false; // no escaping the folder
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(PUBLIC_DIR, 'index.html');
  if (!existsSync(file)) return false;
  const hashed = urlPath.startsWith('/_expo/');
  res.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
    // Bundles have content hashes in their names; everything else should refresh promptly.
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
  return true;
}

const http = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: Object.keys(rooms).length }));
    return;
  }
  if (req.method === 'GET' && serveStatic(req, res)) return;
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('Hundred Acre Honey Tycoon server is buzzing. Connect with WebSocket.');
});

const wss = new WebSocketServer({ server: http, maxPayload: 16 * 1024 });

wss.on('connection', (ws) => {
  let room = null;
  let pid = null;
  let lastHug = 0;
  let lastBalloon = 0;
  let lastChat = 0;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;

    if (msg.t === 'hello') {
      const code = cleanCode(msg.room);
      if (code.length < 3) return send(ws, { t: 'error', text: 'Room codes need at least 3 letters or numbers.' });
      if (!msg.secret || String(msg.secret).length < 16) return send(ws, { t: 'error', text: 'Missing player secret.' });
      const id = publicId(msg.secret);
      const r = getRoom(code);
      if (!r.members[id] && Object.keys(r.members).length >= MAX_MEMBERS) {
        return send(ws, { t: 'error', text: `That wood is full (${MAX_MEMBERS} friends max).` });
      }
      const isNew = !r.members[id];
      r.members[id] = {
        ...(r.members[id] || {}),
        name: cleanText(msg.name, 16) || 'Bear',
        avatar: cleanText(msg.avatar, 8) || '🐻',
        lastSeen: Date.now(),
      };
      room = r; pid = id;
      const key = `${code}:${id}`;
      if (!sockets.has(key)) sockets.set(key, new Set());
      sockets.get(key).add(ws);
      markDirty();

      send(ws, { t: 'welcome', you: id, room: code, contracts: CONTRACTS, tiers: TIERS, roster: roster(r), chat: r.chat, contract: r.contract });
      for (const queued of r.inbox[id] || []) send(ws, queued);
      delete r.inbox[id];
      broadcast(r, { t: 'roster', roster: roster(r) }, id);
      if (isNew) system(r, `${r.members[id].avatar} ${r.members[id].name} wandered into the wood. Hallo!`);
      return;
    }

    if (!room) return send(ws, { t: 'error', text: 'Say hello first.' });
    const me = room.members[pid];
    me.lastSeen = Date.now();

    switch (msg.t) {
      case 'stats': {
        const s = msg.stats || {};
        me.stats = {
          hps: num(s.hps), honey: num(s.honey), allTime: num(s.allTime), combs: num(s.combs),
          variety: num(s.variety), naps: num(s.naps), buildings: cleanBuildings(s.buildings),
        };
        if (s.name) me.name = cleanText(s.name, 16) || me.name;
        if (s.avatar) me.avatar = cleanText(s.avatar, 8) || me.avatar;
        broadcast(room, { t: 'roster', roster: roster(room) });
        break;
      }
      case 'chat': {
        const text = cleanText(msg.text, 140);
        if (!text || Date.now() - lastChat < 600) return;
        lastChat = Date.now();
        pushChat(room, { id: `${Date.now()}-${pid}`, from: pid, name: me.name, avatar: me.avatar, text, at: Date.now() });
        break;
      }
      case 'gift': {
        const amount = num(Number(msg.amount));
        const to = String(msg.to || '');
        if (!amount || !room.members[to] || to === pid) return;
        sendTo(room, to, { t: 'gift', from: pid, name: me.name, avatar: me.avatar, amount }, { queue: true });
        send(ws, { t: 'giftSent', to, amount });
        system(room, `🎁 ${me.name} sent ${room.members[to].name} a pot of honey!`);
        break;
      }
      case 'hug': {
        const to = String(msg.to || '');
        if (!room.members[to] || to === pid) return;
        if (Date.now() - lastHug < HUG_COOLDOWN_MS) return send(ws, { t: 'error', text: 'Hugs need a little rest between them.' });
        lastHug = Date.now();
        sendTo(room, to, { t: 'hug', from: pid, name: me.name, avatar: me.avatar }, { queue: true });
        send(ws, { t: 'hugSent', to });
        break;
      }
      case 'balloon': {
        if (Date.now() - lastBalloon < BALLOON_COOLDOWN_MS) return;
        lastBalloon = Date.now();
        broadcast(room, { t: 'balloon', from: pid, name: me.name, avatar: me.avatar }, pid);
        break;
      }
      case 'startContract': {
        const def = CONTRACTS.find((d) => d.id === msg.id);
        if (!def) return;
        if (room.contract?.status === 'active') return send(ws, { t: 'error', text: 'An Expotition is already underway!' });
        startContract(room, def, pid);
        break;
      }
      case 'abandonContract': {
        if (room.contract?.status !== 'active') return;
        room.contract.status = 'expired';
        markDirty();
        broadcast(room, { t: 'contract', contract: room.contract });
        system(room, `${me.name} called off the Expotition. Perhaps another time.`);
        break;
      }
      case 'contribute':
        contribute(room, pid, num(Number(msg.amount)));
        break;
      case 'ping':
        send(ws, { t: 'pong', at: Date.now() });
        break;
    }
  });

  ws.on('close', () => {
    if (!room) return;
    const key = `${room.code}:${pid}`;
    sockets.get(key)?.delete(ws);
    if (room.members[pid]) room.members[pid].lastSeen = Date.now();
    markDirty();
    broadcast(room, { t: 'roster', roster: roster(room) });
  });
});

// Drop dead connections (phones that went to sleep without closing).
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000).unref();

http.listen(PORT, () => {
  console.log(`🍯 Honey Tycoon server listening on port ${PORT}`);
});
