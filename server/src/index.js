// 100 Acre Inc — multiplayer relay server.
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
import webpush from 'web-push';
import { handleCloud, loadRooms, roomsInCloud, storeRooms } from './cloud.js';

const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = process.env.DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const DATA_FILE = join(DATA_DIR, 'rooms.json');
const MAX_MEMBERS = 8;
const CHAT_HISTORY = 60;
const HUG_COOLDOWN_MS = 20_000;
// After sending a friend honey (a gift, or honey in a letter) you wait this long before sending
// that friend more. Each friend has their own wait.
const GIFT_COOLDOWN_MS = Number(process.env.GIFT_COOLDOWN_MS) || 5 * 60_000;
const BALLOON_COOLDOWN_MS = 8_000;

// Co-op contracts. `goalSeconds` = how many seconds of the wood's combined
// honey/sec the goal is worth when the contract starts (growth makes it easier).
export const CONTRACTS = [
  { id: 'tail', name: "Find Eeyore's Tail", emoji: '🐴', minutes: 30, goalSeconds: 600, minGoal: 5_000, combs: [1, 2, 4] },
  { id: 'party', name: "Pooh's Party Feast", emoji: '🎉', minutes: 60, goalSeconds: 1_800, minGoal: 25_000, combs: [2, 4, 8] },
  { id: 'pole', name: 'Expotition to the North Pole', emoji: '🧭', minutes: 180, goalSeconds: 7_200, minGoal: 150_000, combs: [4, 8, 16] },
  { id: 'flood', name: 'Rescue Piglet from the Flood', emoji: '🌧️', minutes: 480, goalSeconds: 25_000, minGoal: 1_000_000, combs: [8, 16, 32] },
  // The big ones: days long, much bigger rewards, and a bigger boost for finishing.
  { id: 'birthday', name: "Eeyore's Birthday Party", emoji: '🎂', minutes: 12 * 60, goalSeconds: 38_000, minGoal: 1e7, combs: [12, 24, 48], boost: { mult: 2, secs: 30 * 60 } },
  { id: 'wolery', name: 'A New Home for Owl', emoji: '🦉', minutes: 24 * 60, goalSeconds: 80_000, minGoal: 1e8, combs: [20, 40, 80], boost: { mult: 3, secs: 30 * 60 } },
  { id: 'mist', name: 'Lost in the Mist with Tigger', emoji: '🌫️', minutes: 48 * 60, goalSeconds: 165_000, minGoal: 1e9, combs: [35, 70, 140], boost: { mult: 3, secs: 60 * 60 } },
  { id: 'enchanted', name: 'The Enchanted Place', emoji: '🌳', minutes: 72 * 60, goalSeconds: 255_000, minGoal: 1e10, combs: [55, 110, 220], boost: { mult: 4, secs: 60 * 60 } },
  { id: 'beyond', name: 'Beyond the Hundred Acre Wood', emoji: '🌄', minutes: 7 * 24 * 60, goalSeconds: 620_000, minGoal: 1e11, combs: [100, 200, 400], boost: { mult: 5, secs: 2 * 60 * 60 } },
];
const TIERS = [0.25, 0.6, 1];
// After an Expotition ends (finished, run out of time or called off) it rests before it
// can be started again, for as long as it runs. Each one rests on its own.
const restUntil = (def, now) => now + def.minutes * 60_000;

// Shared projects: built one after another by everyone in a wood, paid for with
// honey from the bank. Each one finished adds honey for good (the bonus lives in the app).
// `goalSeconds` works like the Expotitions'. After the named ones come endless festivals.
export const PROJECTS = [
  { id: 'eeyore', name: 'A House for Eeyore', emoji: '🛖', goalSeconds: 2 * 3600, minGoal: 1e5 },
  { id: 'wolery', name: 'A New House for Owl', emoji: '🏡', goalSeconds: 6 * 3600, minGoal: 1e6 },
  { id: 'picnic', name: 'The Great Picnic at Galleons Lap', emoji: '🧺', goalSeconds: 12 * 3600, minGoal: 1e7 },
  { id: 'pot', name: 'The Really Big Honey Pot', emoji: '🍯', goalSeconds: 24 * 3600, minGoal: 1e8 },
  { id: 'pole', name: 'A Proper North Pole Sign', emoji: '🪧', goalSeconds: 48 * 3600, minGoal: 1e9 },
];
// The joint map: buildings in the middle of the wood that everyone in it pays into,
// level after level with no top level. A level's cost is `hours` of the whole wood's
// honey per second (fixed when the level starts), 25% more each level. Every level
// gives everyone a bonus for good (the bonuses live in the app: JOINT in catalog.ts),
// and everyone gets a celebration boost when one goes up.
export const JOINT = [
  { id: 'market', name: 'The Honey Market', emoji: '🏪', hours: 8, minGoal: 1e6 },
  { id: 'hive', name: 'The Great Hive', emoji: '🐝', hours: 4, minGoal: 5e5 },
  { id: 'field', name: 'The Balloon Field', emoji: '🎈', hours: 4, minGoal: 5e5 },
  { id: 'fair', name: 'The Fairground', emoji: '🎡', hours: 5, minGoal: 5e5 },
  { id: 'lantern', name: 'The Lantern Tree', emoji: '🏮', hours: 6, minGoal: 8e5 },
];
const JOINT_GROWTH = 1.25;
// Every level up: ×2 honey for 10 minutes; every 5th level: ×3 for 30.
const jointBoost = (level) => (level % 5 === 0 ? { mult: 3, secs: 30 * 60 } : { mult: 2, secs: 10 * 60 });

export function projectDef(n) {
  if (n < PROJECTS.length) return PROJECTS[n];
  const k = n - PROJECTS.length + 1;
  return { id: `festival${k}`, name: `Honey Festival ${k}`, emoji: '🎪', goalSeconds: 24 * 3600, minGoal: 1e10 };
}
const LETTER_MAX = 280;
// Honey sent to a friend (as a gift or in a letter) is at most this share of what
// they have, as their phone last told us, so a far richer friend can't swamp them.
const GIFT_SHARE_MAX = 0.5;
const STICK_DROP_MS = 20_000;
const STICK_INVITE_MS = 90_000;
// Finishing an Expotition: ×2 honey for 20 minutes for everyone, unless it says otherwise.
const FINAL_BOOST = { mult: 2, secs: 20 * 60 };

// ---------- persistence ----------

// Rooms are kept in Supabase when it's set up (see cloud.js), and in a file too.
let rooms = {};
// False if Supabase couldn't be read at start-up: then it's never written either,
// so a hiccup can't replace everyone's rooms with an empty list.
let cloudRooms = roomsInCloud();
try {
  if (existsSync(DATA_FILE)) rooms = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
} catch (err) {
  console.error('Could not read saved rooms file:', err.message);
}
if (cloudRooms) {
  for (let attempt = 1; ; attempt++) {
    try {
      rooms = await loadRooms();
      break;
    } catch (err) {
      console.error(`Could not load rooms from Supabase (try ${attempt}):`, err.message);
      if (attempt === 5) { cloudRooms = false; break; }
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }
}

// ---------- phone notifications (web push) ----------

// The keys that sign notifications are made once and kept with the rooms (under a
// name no room code can have), unless they're set in the environment.
const KEYS = '_pushKeys';
const madeKeys = !rooms[KEYS];
if (madeKeys) rooms[KEYS] = process.env.VAPID_PUBLIC_KEY
  ? { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }
  : webpush.generateVAPIDKeys();
const pushKeys = rooms[KEYS];
// Push services want a contact address for whoever runs the server: its public address will do.
webpush.setVapidDetails(process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'https://one00-acre-inc.onrender.com', pushKeys.publicKey, pushKeys.privateKey);
const isRoom = (code) => code !== KEYS;

/** A phone's notification address, checked enough to be safe to keep and use. */
function cleanSub(sub) {
  if (!sub || typeof sub !== 'object') return null;
  const { endpoint, keys } = sub;
  if (typeof endpoint !== 'string' || !/^https:\/\/[^\s]{10,600}$/.test(endpoint)) return null;
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' || keys.p256dh.length > 200 || keys.auth.length > 100) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/**
 * Sends a notification to a player's phone, but only when they aren't in the game
 * (iPhones show every one, even mid-game). `always` is for things that need them
 * right now, like a Poohsticks challenge; phones that can, hide those while the game is on screen.
 */
function notify(room, pid, title, body, tag, { always = false } = {}) {
  const m = room.members[pid];
  if (!m?.push || (!always && isOnline(room.code, pid))) return;
  // A bad address can make the library throw straight away rather than fail later.
  Promise.resolve().then(() => webpush.sendNotification(m.push, JSON.stringify({ title, body, tag }), { TTL: 6 * 3600 })).catch((err) => {
    // Gone: the phone turned notifications off or the app was removed.
    if (err.statusCode === 404 || err.statusCode === 410) { delete m.push; markDirty(); }
    else console.error('Push failed:', err.statusCode || err.message);
  });
}

let dirty = false;
let saving = null;
function markDirty() { dirty = true; }
async function save() {
  if (!dirty || saving) return saving;
  dirty = false;
  const text = JSON.stringify(rooms);
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DATA_FILE + '.tmp';
    writeFileSync(tmp, text);
    renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error('Could not write rooms file:', err.message);
  }
  if (!cloudRooms) return;
  saving = storeRooms(JSON.parse(text))
    .catch((err) => { dirty = true; console.error('Could not save rooms to Supabase:', err.message); })
    .finally(() => { saving = null; });
  return saving;
}
// New notification keys are saved straight away, or phones would lose them on a restart.
if (madeKeys) markDirty();
setInterval(save, 5_000).unref();
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { dirty = true; await saving; await save(); process.exit(0); });
}

// ---------- helpers ----------

const sockets = new Map(); // `${room}:${pid}` -> Set<ws>

const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const cleanText = (s, max) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
// Kept short of the very largest numbers, so sums and goals can never turn into Infinity.
const num = (n) => (Number.isFinite(n) && n > 0 ? Math.min(n, 1e300) : 0);
/** A member of the wood, only if really there (ids like "__proto__" aren't members). */
const memberOf = (room, id) => (typeof id === 'string' && Object.hasOwn(room.members, id) ? room.members[id] : undefined);
/** How long until this player can send honey again (0 when they can). */
const giftWait = (member, to) => Math.max(0, (member.giftTo?.[to] || 0) + GIFT_COOLDOWN_MS - Date.now());
/** Every friend you're waiting on: their id -> ms left. */
const giftWaits = (room, member) => Object.fromEntries(Object.keys(room.members).map((to) => [to, giftWait(member, to)]).filter(([, ms]) => ms > 0));
const sentHoney = (member, to) => { (member.giftTo ||= {})[to] = Date.now(); markDirty(); };
const giftWaitText = (room, to, ms) => `You can send ${memberOf(room, to)?.name || 'them'} honey again in ${Math.ceil(ms / 60_000)} min.`;
const giftCap = (room, to) => num(memberOf(room, to)?.stats?.honey) * GIFT_SHARE_MAX;
// Best minigame scores, for the leaderboards: game id -> score.
function cleanBests(b) {
  const out = {};
  if (!b || typeof b !== 'object') return out;
  for (const [k, v] of Object.entries(b).slice(0, 30)) if (/^[a-z]{2,12}$/.test(k) && num(Number(v))) out[k] = Math.min(1e6, Math.floor(Number(v)));
  return out;
}
// A player's map (owned / level / manager per building), kept small and tidy.
function cleanBuildings(b) {
  if (!b || typeof b !== 'object') return undefined;
  const pick = (obj, fn) => {
    const out = {};
    for (const [k, v] of Object.entries(obj || {}).slice(0, 40)) if (/^[a-z]{2,12}$/.test(k)) out[k] = fn(v);
    return out;
  };
  return {
    owned: pick(b.owned, (v) => Math.min(1e6, num(Number(v)))),
    levels: pick(b.levels, (v) => Math.min(1e6, num(Number(v)))),
    managed: pick(b.managed, (v) => v === true),
    addons: Array.isArray(b.addons) ? b.addons.filter((a) => /^[a-z]{2,12}:[0-9]$/.test(a)).slice(0, 240) : [],
    rooms: pick(b.rooms, (v) => (Array.isArray(v) ? v.filter((d) => /^[a-z]{2,12}$/.test(d)).slice(0, 6) : [])),
    doors: Array.isArray(b.doors) ? b.doors.filter((d) => /^[a-z]{2,12}$/.test(d)).slice(0, 30) : [],
    // Where each decoration stands: numbers between 0 and 1 only.
    roomSpots: pick(b.roomSpots, (spots) => {
      const out = {};
      for (const [d, xy] of Object.entries(spots || {}).slice(0, 6)) {
        if (/^[a-z]{2,12}$/.test(d) && Array.isArray(xy) && xy.length === 2 && xy.every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) out[d] = [xy[0], xy[1]];
      }
      return out;
    }),
  };
}
const publicId = (secret) => createHash('sha256').update(String(secret)).digest('hex').slice(0, 12);

function getRoom(code) {
  if (!rooms[code]) {
    rooms[code] = { code, createdAt: Date.now(), members: {}, chat: [], contract: null, inbox: {}, project: null, built: [] };
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
    if (!memberOf(room, pid)) return;
    const box = Object.hasOwn(room.inbox, pid) ? room.inbox[pid] : [];
    room.inbox[pid] = [...box, msg].slice(-200);
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
    id, name: m.name, avatar: m.avatar, online: isOnline(room.code, id), lastSeen: m.lastSeen, stats: m.stats || {}, notify: !!m.push,
    owner: id === room.owner,
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
  const goal = safeGoal(Math.max(def.minGoal, roomHps(room) * def.goalSeconds));
  room.contract = {
    id: def.id, goal, progress: 0, contributions: {}, tiersReached: 0, status: 'active',
    startedAt: Date.now(), endsAt: Date.now() + def.minutes * 60_000, startedBy: starter,
  };
  markDirty();
  broadcast(room, contractMsg(room));
  system(room, `${def.emoji} ${room.members[starter]?.name || 'Someone'} started "${def.name}"! Goal: ${goal.toLocaleString('en-US')} honey together.`);
}

/** Ends the wood's Expotition and starts its rest. */
function endContract(room, status) {
  const c = room.contract;
  c.status = status;
  const def = CONTRACTS.find((d) => d.id === c.id);
  if (def) (room.rests ||= {})[c.id] = restUntil(def, Date.now());
  markDirty();
}

const contractMsg = (room) => ({ t: 'contract', contract: room.contract, rests: room.rests || {} });

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
    const boost = def.boost || FINAL_BOOST;
    const reward = { t: 'reward', contractId: c.id, tier, combs: def.combs[tier], boost: final ? boost : null, name: def.name };
    for (const member of Object.keys(room.members)) sendTo(room, member, reward, { queue: true });
    system(room, final
      ? `🏆 "${def.name}" complete! Everyone gets Golden Honeycombs (${def.combs[tier]}% of what their run is worth) and ×${boost.mult} honey for ${boost.secs / 60} min!`
      : `⭐ Tier ${tier + 1} of "${def.name}" reached! Golden Honeycombs for everyone: ${def.combs[tier]}% of what their run is worth.`);
    if (final) {
      endContract(room, 'complete');
      for (const member of Object.keys(room.members)) notify(room, member, `🏆 ${def.name} complete!`, 'Golden Honeycombs and double honey for everyone.', 'expo');
    }
  }
  markDirty();
  broadcast(room, contractMsg(room));
}

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of Object.entries(rooms)) {
    if (!isRoom(code)) continue;
    const c = room.contract;
    if (c && c.status === 'active' && now > c.endsAt) {
      endContract(room, 'expired');
      broadcast(room, contractMsg(room));
      system(room, `⌛ Time ran out on the Expotition. Oh bother. Try another!`);
    }
  }
}, 5_000).unref();

// ---------- shared projects ----------

// Goals (Expotitions, projects, joint levels) come from what the wood steadily earns: the
// average of each friend's best steady honey per second (boosts left out), fading by half every
// 3 days, so a nap (honey per second near 0) or a boost doesn't make goals tiny or huge, and one
// big wood doesn't set everyone's goals. Friends not seen for two weeks don't count.
const PEAK_HALF_LIFE_MS = 3 * 86_400_000;
const AWAY_MS = 14 * 86_400_000;
const peakNow = (m, now = Date.now()) => num(m.peak) * 0.5 ** (Math.max(0, now - (m.peakAt || now)) / PEAK_HALF_LIFE_MS);
const roomHps = (room) => {
  const now = Date.now();
  const here = Object.values(room.members).filter((m) => now - (m.lastSeen || 0) <= AWAY_MS);
  if (!here.length) return 0;
  return here.reduce((s, m) => s + Math.max(peakNow(m, now), num(m.stats?.steady ?? m.stats?.hps)), 0) / here.length;
};
// A best honey per second that this run's total honey couldn't have earned (more than a minute's
// worth of everything earned) is from before the friend started over, so it's dropped.
const PEAK_CHECK_SECS = 60;
/** Goals stay ordinary numbers (never Infinity, which would save as nothing). */
const safeGoal = (g) => Math.min(Math.round(g), 1e300);

/** The project being built now, started fresh (goal from today's honey) when needed. */
function currentProject(room) {
  room.built ||= [];
  const def = projectDef(room.built.length);
  if (!room.project || room.project.id !== def.id) {
    room.project = { id: def.id, goal: safeGoal(Math.max(def.minGoal, roomHps(room) * def.goalSeconds)), progress: 0, contributions: {} };
    markDirty();
  }
  return room.project;
}
const projectInfo = (room) => ({ project: currentProject(room), projectDef: projectDef(room.built.length), built: room.built });

function donate(room, pid, amount) {
  const p = currentProject(room);
  const def = projectDef(room.built.length);
  p.progress += amount;
  p.contributions[pid] = (p.contributions[pid] || 0) + amount;
  markDirty();
  if (p.progress >= p.goal) {
    room.built.push(p.id);
    room.project = null;
    for (const member of Object.keys(room.members)) sendTo(room, member, { t: 'projectDone', id: def.id, name: def.name, emoji: def.emoji }, { queue: true });
    system(room, `${def.emoji} You built "${def.name}" together! Everyone's honey is up for good.`);
    for (const member of Object.keys(room.members)) notify(room, member, `${def.emoji} ${def.name} is built!`, "Everyone's honey is up for good.", 'project');
  }
  broadcast(room, { t: 'project', ...projectInfo(room) });
}

/**
 * Goals set before anyone's honey per second had arrived (a brand-new wood) start at the
 * floor. While nobody has paid in yet, set them again from what the wood really earns.
 */
function settleGoals(room) {
  for (const def of JOINT) {
    const j = room.joint?.[def.id];
    if (j && j.progress === 0 && !Object.keys(j.contributions).length) j.goal = 0;
  }
  if (room.project && room.project.progress === 0) room.project = null;
}

// ---------- the joint map ----------

/** One joint building, with the goal for its next level set from the wood's honey now if it isn't yet. */
function jointSite(room, def) {
  room.joint ||= {};
  const j = (room.joint[def.id] ||= { level: 0, goal: 0, progress: 0, contributions: {} });
  if (!j.goal) {
    const grow = JOINT_GROWTH ** j.level;
    j.goal = safeGoal(Math.max(def.minGoal, roomHps(room) * def.hours * 3600) * grow);
    markDirty();
  }
  return j;
}
const jointInfo = (room) => ({ joint: Object.fromEntries(JOINT.map((def) => [def.id, jointSite(room, def)])) });

function giveJoint(room, pid, def, amount) {
  const j = jointSite(room, def);
  j.progress += amount;
  j.contributions[pid] = (j.contributions[pid] || 0) + amount;
  if (j.progress >= j.goal) {
    j.level++;
    Object.assign(j, { goal: 0, progress: 0, contributions: {} });
    jointSite(room, def);
    const boost = jointBoost(j.level);
    for (const member of Object.keys(room.members)) sendTo(room, member, { t: 'jointUp', id: def.id, level: j.level, name: def.name, emoji: def.emoji, boost }, { queue: true });
    system(room, `${def.emoji} ${def.name} is now level ${j.level}! Everyone gets ×${boost.mult} honey for ${boost.secs / 60} min.`);
    if (j.level % 5 === 0) {
      for (const member of Object.keys(room.members)) notify(room, member, `${def.emoji} ${def.name} reached level ${j.level}!`, `×${boost.mult} honey for everyone for ${boost.secs / 60} minutes.`, 'joint');
    }
  }
  markDirty();
  broadcast(room, { t: 'joint', ...jointInfo(room) });
}

// ---------- Poohsticks ----------

// Races live only in memory: an invite, both players drop their sticks, then the
// server decides the race (so both phones see the same one) and sends it out.
const races = new Map(); // id -> { room, a, b, drops, phase, timer }

/** Seconds to the finish: a good drop takes up to 4s off, and the river adds up to 3s of luck. */
export const raceTimes = (quality, rand = Math.random) => quality.map((q) => 14 - 4 * q + rand() * 3);

function finishRace(id) {
  const race = races.get(id);
  if (!race || race.phase !== 'dropping') return;
  clearTimeout(race.timer);
  races.delete(id);
  const pids = [race.a, race.b];
  const quality = pids.map((p) => race.drops[p] ?? 0.3);
  const times = raceTimes(quality);
  const winner = times[0] <= times[1] ? race.a : race.b;
  const sticks = pids.map((p, i) => ({ pid: p, name: race.room.members[p]?.name, avatar: race.room.members[p]?.avatar, q: quality[i], time: times[i] }));
  const seed = Math.floor(Math.random() * 1e9);
  for (const p of pids) sendTo(race.room, p, { t: 'stickRace', id, sticks, winner, seed });
  const w = race.room.members[winner];
  const l = race.room.members[winner === race.a ? race.b : race.a];
  setTimeout(() => system(race.room, `🥢 ${w?.name} beat ${l?.name} at Poohsticks!`), 15_000).unref?.();
}

// ---------- connections ----------

// The web version of the game (built into server/public by `npm run build:web` in app/)
// is served from here too, so a phone can open it in the browser and add it to its home screen.
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.map': 'application/json',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
};

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(PUBLIC_DIR, urlPath));
  if (!file.startsWith(PUBLIC_DIR)) return false; // no escaping the folder
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(PUBLIC_DIR, 'index.html');
  if (!existsSync(file)) return false;
  // Bundles and asset files have content hashes in their names; everything else should refresh promptly.
  const hashed = urlPath.startsWith('/_expo/') || urlPath.startsWith('/assets/');
  const headers = {
    'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    'accept-ranges': 'bytes',
  };
  // Phones (iPhone Safari especially) only play audio from servers that can send a file in pieces.
  const size = statSync(file).size;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) {
      res.writeHead(416, { 'content-range': `bytes */${size}` });
      res.end();
      return true;
    }
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
    createReadStream(file, { start, end }).pipe(res);
    return true;
  }
  res.writeHead(200, { ...headers, 'content-length': size });
  createReadStream(file).pipe(res);
  return true;
}

const http = createServer(async (req, res) => {
  if (await handleCloud(req, res)) return;
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: Object.keys(rooms).filter(isRoom).length }));
    return;
  }
  if (req.method === 'GET' && serveStatic(req, res)) return;
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('100 Acre Inc server is buzzing. Connect with WebSocket.');
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
    try {
      handle(raw);
    } catch (e) {
      // One bad message must never take the whole server (and everyone's wood) down.
      console.error('message failed:', e);
    }
  });
  const handle = (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;

    if (msg.t === 'hello') {
      // One wood per connection: the app opens a new one to change woods.
      if (room) return;
      const code = cleanCode(msg.room);
      // (cleanCode only gives capitals and digits, so it can never be the keys' name.)
      if (code.length < 3) return send(ws, { t: 'error', text: 'Room codes need at least 3 letters or numbers.' });
      if (!msg.secret || String(msg.secret).length < 16) return send(ws, { t: 'error', text: 'Missing player secret.' });
      const id = publicId(msg.secret);
      const r = getRoom(code);
      if ((r.barred || []).includes(id)) return send(ws, { t: 'error', text: "You can't join this wood." });
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
      // The first one into a wood looks after it (woods from before this get whoever comes first).
      if (!r.owner || !memberOf(r, r.owner)) r.owner = id;
      const key = `${code}:${id}`;
      if (!sockets.has(key)) sockets.set(key, new Set());
      sockets.get(key).add(ws);
      markDirty();

      send(ws, { t: 'welcome', you: id, room: code, contracts: CONTRACTS, tiers: TIERS, roster: roster(r), chat: r.chat, contract: r.contract, rests: r.rests || {}, ...projectInfo(r), ...jointInfo(r), giftWaits: giftWaits(r, r.members[id]), pushKey: pushKeys.publicKey, pushOn: !!r.members[id].push });
      for (const [raceId, race] of races) {
        if (race.room === r && race.b === id && race.phase === 'invited') {
          const from = r.members[race.a];
          send(ws, { t: 'stickInvite', id: raceId, from: race.a, name: from?.name, avatar: from?.avatar });
        }
      }
      for (const queued of (Object.hasOwn(r.inbox, id) && r.inbox[id]) || []) send(ws, queued);
      delete r.inbox[id];
      broadcast(r, { t: 'roster', roster: roster(r) }, id);
      if (isNew) system(r, `${r.members[id].avatar} ${r.members[id].name} wandered into the wood. Hallo!`);
      return;
    }

    if (!room) return send(ws, { t: 'error', text: 'Say hello first.' });
    const me = room.members[pid];
    if (!me) return; // removed from the wood a moment ago
    me.lastSeen = Date.now();

    switch (msg.t) {
      case 'stats': {
        const s = msg.stats || {};
        me.stats = {
          hps: num(s.hps), honey: num(s.honey), allTime: num(s.allTime), combs: num(s.combs),
          variety: num(s.variety), naps: num(s.naps), cards: num(s.cards), buildings: cleanBuildings(s.buildings),
          trophies: Math.min(1000, num(s.trophies)),
          bests: cleanBests(s.bests),
          steady: num(s.steady ?? s.hps),
        };
        if (num(me.peak) * PEAK_CHECK_SECS > me.stats.allTime) me.peak = 0;
        if (me.stats.steady >= peakNow(me)) { me.peak = me.stats.steady; me.peakAt = Date.now(); }
        settleGoals(room);
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
        const to = String(msg.to || '');
        if (!num(Number(msg.amount)) || to === pid) return;
        if (!memberOf(room, to)) return send(ws, { t: 'error', text: 'They have left the wood.', asked: num(Number(msg.amount)) });
        const amount = Math.floor(Math.min(num(Number(msg.amount)), giftCap(room, to)));
        if (!amount) return send(ws, { t: 'error', text: `${room.members[to].name} needs some honey of their own before you can send them more.`, asked: num(Number(msg.amount)) });
        if (giftWait(me, to)) return send(ws, { t: 'error', text: giftWaitText(room, to, giftWait(me, to)), giftWaits: giftWaits(room, me), asked: num(Number(msg.amount)) });
        sentHoney(me, to);
        sendTo(room, to, { t: 'gift', from: pid, name: me.name, avatar: me.avatar, amount }, { queue: true });
        notify(room, to, `🎁 ${me.name} sent you honey!`, 'Come and see how much.', 'gift');
        send(ws, { t: 'giftSent', to, amount, asked: num(Number(msg.amount)), giftWaits: giftWaits(room, me) });
        sendTo(room, pid, { t: 'giftWaits', giftWaits: giftWaits(room, me) });
        system(room, `🎁 ${me.name} sent ${room.members[to].name} a pot of honey!`);
        break;
      }
      case 'hug': {
        const to = String(msg.to || '');
        if (!memberOf(room, to) || to === pid) return;
        if (Date.now() - lastHug < HUG_COOLDOWN_MS) return send(ws, { t: 'error', text: 'Hugs need a little rest between them.' });
        lastHug = Date.now();
        sendTo(room, to, { t: 'hug', from: pid, name: me.name, avatar: me.avatar }, { queue: true });
        notify(room, to, `💕 ${me.name} sent you a big hug!`, 'Double honey while it lasts.', 'hug');
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
        const rest = (room.rests?.[def.id] || 0) - Date.now();
        if (rest > 0) return send(ws, { t: 'error', text: `${def.name} is resting. Ready again in ${Math.ceil(rest / 60_000)} min.` });
        startContract(room, def, pid);
        break;
      }
      case 'abandonContract': {
        if (room.contract?.status !== 'active') return;
        // Called off in its first 5 minutes (a slip of the finger, say): no rest afterwards.
        const early = Date.now() - room.contract.startedAt < 5 * 60_000;
        endContract(room, 'expired');
        if (early && room.rests) delete room.rests[room.contract.id];
        broadcast(room, contractMsg(room));
        system(room, `${me.name} called off the Expotition. Perhaps another time.`);
        break;
      }
      case 'contribute':
        contribute(room, pid, num(Number(msg.amount)));
        break;
      case 'donate': {
        const amount = num(Number(msg.amount));
        if (!amount) return;
        send(ws, { t: 'donated', amount });
        donate(room, pid, amount);
        break;
      }
      case 'jointGive': {
        const def = JOINT.find((d) => d.id === msg.id);
        const amount = num(Number(msg.amount));
        if (!def || !amount) return;
        send(ws, { t: 'donated', amount });
        giveJoint(room, pid, def, amount);
        break;
      }
      case 'letter': {
        const to = String(msg.to || '');
        // Letters keep their line breaks; other control characters become spaces.
        const text = String(msg.text || '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, LETTER_MAX);
        if (!memberOf(room, to) || to === pid || !text) return;
        const amount = Math.floor(Math.min(num(Number(msg.amount)), giftCap(room, to)));
        if (amount && giftWait(me, to)) return send(ws, { t: 'error', text: `${giftWaitText(room, to, giftWait(me, to))} Your letter can go without honey now.`, giftWaits: giftWaits(room, me), asked: num(Number(msg.amount)) });
        if (amount) sentHoney(me, to);
        const letter = { id: `${Date.now()}-${pid}`, from: pid, name: me.name, avatar: me.avatar, text, amount, at: Date.now() };
        sendTo(room, to, { t: 'letter', letter }, { queue: true });
        notify(room, to, `✉️ ${me.name} left you a letter`, amount ? 'With honey tucked inside.' : 'Open it in the Friends tab.', `letter-${letter.id}`);
        send(ws, { t: 'letterSent', amount, asked: num(Number(msg.amount)), giftWaits: giftWaits(room, me) });
        if (amount) sendTo(room, pid, { t: 'giftWaits', giftWaits: giftWaits(room, me) });
        system(room, `✉️ ${me.name} left ${room.members[to].name} a letter${amount ? ' with honey tucked inside' : ''}.`);
        break;
      }
      case 'stickInvite': {
        const to = String(msg.to || '');
        if (!memberOf(room, to) || to === pid) return;
        if (!isOnline(room.code, to) && !room.members[to].push) return send(ws, { t: 'error', text: `${room.members[to].name} isn't in the wood right now.` });
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const race = { room, a: pid, b: to, drops: {}, phase: 'invited' };
        race.timer = setTimeout(() => {
          if (races.get(id)?.phase !== 'invited') return;
          races.delete(id);
          sendTo(room, pid, { t: 'stickOff', id, why: 'No answer. Maybe later!' });
          sendTo(room, to, { t: 'stickOff', id, why: '' });
        }, STICK_INVITE_MS);
        races.set(id, race);
        sendTo(room, to, { t: 'stickInvite', id, from: pid, name: me.name, avatar: me.avatar });
        notify(room, to, `🥢 ${me.name} wants to play Poohsticks!`, 'Quick, come to the bridge.', 'sticks', { always: true });
        send(ws, { t: 'stickWaiting', id, to, name: room.members[to].name, avatar: room.members[to].avatar });
        break;
      }
      case 'stickAnswer': {
        const id = String(msg.id);
        const race = races.get(id);
        if (!race || race.room !== room || race.phase !== 'invited' || (pid !== race.b && pid !== race.a)) return;
        clearTimeout(race.timer);
        if (!msg.yes) {
          races.delete(id);
          sendTo(room, race.a, { t: 'stickOff', id, why: pid === race.a ? '' : `${me.name} can't play just now.` });
          sendTo(room, race.b, { t: 'stickOff', id, why: '' });
          return;
        }
        race.phase = 'dropping';
        const players = [race.a, race.b].map((p) => ({ pid: p, name: room.members[p]?.name, avatar: room.members[p]?.avatar }));
        for (const p of [race.a, race.b]) sendTo(room, p, { t: 'stickGo', id, players, ms: STICK_DROP_MS });
        race.timer = setTimeout(() => finishRace(id), STICK_DROP_MS + 2_000);
        break;
      }
      case 'stickDrop': {
        const id = String(msg.id);
        const race = races.get(id);
        if (!race || race.phase !== 'dropping' || (pid !== race.a && pid !== race.b)) return;
        race.drops[pid] = Math.max(0, Math.min(1, Number(msg.q) || 0));
        if (race.a in race.drops && race.b in race.drops) finishRace(id);
        break;
      }
      case 'push': {
        const sub = cleanSub(msg.sub);
        if (!sub) return;
        me.push = sub;
        markDirty();
        send(ws, { t: 'pushOn' });
        break;
      }
      case 'pushOff':
        delete me.push;
        markDirty();
        break;
      case 'remove': {
        // Only whoever looks after the wood can ask someone to leave; they can't come back.
        const who = String(msg.who || '');
        if (pid !== room.owner) return send(ws, { t: 'error', text: 'Only whoever looks after this wood can do that.' });
        if (!memberOf(room, who) || who === pid) return;
        const name = room.members[who].name;
        room.barred = [...(room.barred || []), who].slice(-100);
        delete room.members[who];
        delete room.inbox[who];
        for (const sock of sockets.get(`${room.code}:${who}`) || []) { send(sock, { t: 'removed' }); sock.close(); }
        sockets.delete(`${room.code}:${who}`);
        markDirty();
        broadcast(room, { t: 'roster', roster: roster(room) });
        system(room, `${name} has left the wood.`);
        break;
      }
      case 'challenge': {
        // "Beat my score": sent to a friend, waiting for them if they're away.
        const to = String(msg.to || '');
        const game = String(msg.game || '');
        const score = Math.min(1e6, num(Number(msg.score)));
        if (!room.members[to] || to === pid || !/^[a-z]{2,12}$/.test(game) || !score) return;
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        sendTo(room, to, { t: 'challenge', challenge: { id, from: pid, name: me.name, avatar: me.avatar, game, score, at: Date.now() } }, { queue: true });
        notify(room, to, `⚔️ ${me.name} challenges you!`, `Can you beat ${score}? It's in your Games tab.`, `challenge-${id}`);
        send(ws, { t: 'challengeSent', name: room.members[to].name });
        break;
      }
      case 'challengeResult': {
        const to = String(msg.to || '');
        if (!room.members[to] || to === pid) return;
        const score = Math.min(1e6, num(Number(msg.score)));
        const beat = msg.beat === true;
        sendTo(room, to, { t: 'challengeResult', from: pid, name: me.name, avatar: me.avatar, game: String(msg.game || '').slice(0, 12), theirScore: score, beat }, { queue: true });
        system(room, beat ? `⚔️ ${me.name} beat ${room.members[to].name}'s score!` : `⚔️ ${room.members[to].name}'s score held up against ${me.name}.`);
        break;
      }
      case 'leave': {
        // Leaving for real: the spot is freed, and the wood keeps what it built
        // for those still in it. When the last one leaves, the wood is gone.
        const name = me.name;
        delete room.members[pid];
        delete room.inbox[pid];
        sockets.delete(`${room.code}:${pid}`);
        const left = Object.keys(room.members);
        if (!left.length) {
          delete rooms[room.code];
        } else {
          if (room.owner === pid) room.owner = left[0];
          broadcast(room, { t: 'roster', roster: roster(room) });
          system(room, `${name} has left the wood.`);
        }
        markDirty();
        room = null;
        ws.close();
        break;
      }
      case 'makeOwner': {
        const who = String(msg.who || '');
        if (pid !== room.owner || !memberOf(room, who)) return;
        room.owner = who;
        markDirty();
        broadcast(room, { t: 'roster', roster: roster(room) });
        system(room, `${room.members[who].name} looks after the wood now.`);
        break;
      }
      case 'ping':
        send(ws, { t: 'pong', at: Date.now() });
        break;
    }
  };

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
  console.log(`🍯 100 Acre Inc server listening on port ${PORT}`);
});
