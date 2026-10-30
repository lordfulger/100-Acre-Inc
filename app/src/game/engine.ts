// Pure game logic. No React, no networking — just honey arithmetic, so it can
// be tested on its own and reused by any screen.

import {
  Addon, addonsFor, allMilestonesReached, BALLOONS, BalloonKind, BIZ_BY_ID, buildingCost, buildingMult, Business, BUSINESSES,
  COMB_BONUS, COMB_DIVISOR, lookName, lookOf, milestonesReached, MIN_CYCLE, nextAllMilestone, nextMilestone,
  JointId, jointBonus, POOH_HOUSE, poohCost, poohTapMult, RESEARCH, RESEARCH_BY_ID, researchCost, ResearchKind, varietyAt,
} from './catalog';
import { ALBUM_BY_ID, albumMult } from './album';
import { bumpEvent, projectMult, seasonAt } from './calendar';
import { NEWS_VERSION } from './news';

export type BizState = { owned: number; managed: boolean; running: boolean; cycleStart: number };
export type Boost = { id: string; kind: 'profit' | 'tap'; mult: number; until: number; label: string };

export type GameState = {
  v: 1;
  honey: number;
  runEarned: number;
  allTimeEarned: number;
  combsFromNaps: number;
  combsBonus: number;
  variety: number;
  biz: Record<string, BizState>;
  research: Record<string, number>; // Rabbit's General Store item levels
  levels: Record<string, number>; // building levels on the map (business ids + 'pooh')
  addons: string[]; // add-ons bought, as `${home}:${index}`
  album: string[]; // album cards found (kept forever)
  albumNew: string[]; // found but not looked at yet
  chatSeen: number; // time of the newest chat message read on the Friends tab
  trophies: string[];
  decor: string[]; // decorations collected
  rooms: Record<string, string[]>; // decorations placed inside each home
  friends: Record<string, { hearts: number; day: string }>; // friendship with whoever lives in each home
  games: Record<string, { last: number; best: number }>; // minigames: last rewarded play and best score
  visitor: { day: string; idx: number; base: number; place: string; found: boolean; done: boolean };
  events: Record<string, number>; // holiday event progress, per event and year
  eventsWon: string[];
  projects: string[]; // shared projects finished in your wood (each adds honey)
  joint: Record<string, number>; // your wood's joint buildings: id -> level (each level helps everyone)
  letters: Letter[];
  newsSeen: number; // the newest "What's new" note already shown
  secrets: string[]; // map secrets found
  blocked: string[]; // players whose chat, hugs, gifts, letters and challenges are ignored
  treats: Record<string, number>; // when each map treat (bees, river stick) was last taken
  settings: { music: boolean; sfx: boolean; voices: boolean };
  boosts: Boost[];
  lastTick: number;
  pendingContribution: number; // honey earned but not yet reported to the co-op Expotition
  stats: {
    taps: number; balloons: number; naps: number; hugsGot: number; giftsSent: number; startedAt: number;
    hugsSent: number; upgrades: number; games: number; sticksWon: number; visitors: number; lettersSent: number; expos: number;
  };
  profile: { name: string; avatar: string; secret: string; room: string; server: string; cloud?: { token: string; email: string } };
};

export type Letter = { id: string; from: string; name: string; avatar: string; text: string; amount: number; at: number; read: boolean };

export type BizInfo = { cycle: number; perCycle: number; perSec: number; nextMilestone: number; mult: number };
export type Derived = {
  hps: number;
  tapValue: number;
  globalMult: number;
  biz: Record<string, BizInfo>;
  offlineHours: number;
  balloonRate: number;
  balloonPower: number;
  allMilestoneNext: number;
  critChance: number;
  autoTaps: number; // taps per second from Bouncy Helper
  frenzyMult: number;
  swarmMult: number;
  hugSecs: number;
  giftMult: number;
  expoMult: number;
};

/** Total effect of one kind of store item (summed levels × per-level effect). */
const researchSum = (s: GameState, kind: ResearchKind) =>
  RESEARCH.reduce((sum, r) => (r.kind === kind ? sum + r.per * (s.research[r.id] || 0) : sum), 0);

// Discounts from the store.
export const bizCostMult = (s: GameState) => 1 - researchSum(s, 'bizDiscount');
export const managerCost = (s: GameState, b: Business) => b.manager.cost * (1 - researchSum(s, 'managerDiscount'));
export const varietyCost = (s: GameState, i: number) => varietyAt(i).cost * (1 - researchSum(s, 'varietyDiscount'));

const freshBiz = (): BizState => ({ owned: 0, managed: false, running: false, cycleStart: 0 });

export function randomSecret() {
  let s = '';
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

export function newGame(now: number): GameState {
  const biz: Record<string, BizState> = {};
  for (const b of BUSINESSES) biz[b.id] = freshBiz();
  biz.beetree.owned = 1;
  return {
    v: 1, honey: 0, runEarned: 0, allTimeEarned: 0, combsFromNaps: 0, combsBonus: 0, variety: 0,
    biz, research: {}, levels: {}, addons: [], album: ['pooh'], albumNew: [], chatSeen: 0,
    trophies: [], decor: [], rooms: {}, friends: {}, games: {}, visitor: { day: '', idx: 0, base: 0, place: '', found: false, done: false },
    events: {}, eventsWon: [], projects: [], joint: {}, letters: [], newsSeen: NEWS_VERSION, secrets: [], blocked: [], treats: {},
    settings: { music: true, sfx: true, voices: true }, boosts: [], lastTick: now, pendingContribution: 0,
    stats: { taps: 0, balloons: 0, naps: 0, hugsGot: 0, giftsSent: 0, startedAt: now, hugsSent: 0, upgrades: 0, games: 0, sticksWon: 0, visitors: 0, lettersSent: 0, expos: 0 },
    profile: { name: '', avatar: '🐻', secret: randomSecret(), room: '', server: '' },
  };
}

// Old one-off store items, and roughly how many levels of the new store items they're worth.
const OLD_UPGRADES: Record<string, [string, number]> = {
  sticky1: ['paws', 2], sticky2: ['paws', 3], sticky3: ['paws', 5], nap1: ['armchair', 4], nap2: ['armchair', 16],
  bal1: ['balloons', 6], bal3: ['balloons', 6], bal2: ['strings', 5], g1: ['owl', 1], g2: ['owl', 1], g3: ['owl', 1],
  g4: ['owl', 2], g5: ['owl', 2],
};

// Fill in anything an older save is missing (e.g. businesses added later).
export function migrate(raw: any, now: number): GameState {
  const base = newGame(now);
  if (!raw || raw.v !== 1) return base;
  const s: GameState = {
    ...base, ...raw,
    stats: { ...base.stats, ...raw.stats },
    profile: { ...base.profile, ...raw.profile },
    settings: { ...base.settings, ...raw.settings },
    biz: { ...base.biz },
  };
  for (const b of BUSINESSES) s.biz[b.id] = { ...freshBiz(), ...(raw.biz?.[b.id] || {}) };
  if (s.biz.beetree.owned < 1) s.biz.beetree.owned = 1;

  if (!raw.research) {
    // Saves from before endless levels: old levels were worth ~5 new ones each,
    // and one-off store items turn into store item levels.
    const old: string[] = raw.upgrades || [];
    s.levels = {};
    for (const [id, lv] of Object.entries(raw.levels || {})) s.levels[id] = (lv as number) * 5;
    for (const b of BUSINESSES) {
      const n = old.filter((id) => id.startsWith(b.id + '-')).length;
      if (n) s.levels[b.id] = Math.max(s.levels[b.id] || 0, n * 5);
    }
    const paws = old.filter((id) => /^paw[0-9]$/.test(id)).length;
    if (paws) s.levels.pooh = Math.max(s.levels.pooh || 0, paws * 5);
    s.research = {};
    for (const id of old) {
      const m = OLD_UPGRADES[id];
      if (m) s.research[m[0]] = (s.research[m[0]] || 0) + m[1];
    }
  } else {
    s.research = { ...raw.research };
    s.levels = { ...(raw.levels || {}) };
  }
  delete (s as any).upgrades;
  s.addons = Array.isArray(raw.addons) ? raw.addons : [];
  // Only real cards, each once (the album adds honey, so no duplicates).
  const cards = (list: unknown) => (Array.isArray(list) ? [...new Set(list.filter((id) => typeof id === 'string' && id in ALBUM_BY_ID))] : []);
  s.album = raw.album ? cards(raw.album) : ['pooh'];
  s.albumNew = cards(raw.albumNew).filter((id) => s.album.includes(id));
  // Saves from before this was kept: count the chat so far as read.
  s.chatSeen = Number.isFinite(raw.chatSeen) ? raw.chatSeen : now;
  s.boosts = (raw.boosts || []).filter((b: Boost) => b.until > now);
  // Things added later: anything missing or the wrong shape starts empty.
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? { ...(v as object) } : {});
  s.trophies = list(raw.trophies);
  s.decor = list(raw.decor);
  s.eventsWon = list(raw.eventsWon);
  s.projects = list(raw.projects);
  s.joint = obj(raw.joint);
  s.rooms = obj(raw.rooms);
  s.friends = obj(raw.friends);
  s.games = obj(raw.games);
  s.events = obj(raw.events);
  s.visitor = { ...base.visitor, ...obj(raw.visitor) };
  s.letters = Array.isArray(raw.letters) ? raw.letters.slice(0, 30) : [];
  // Saves from before the notes existed haven't seen any.
  s.newsSeen = Number.isFinite(raw.newsSeen) ? raw.newsSeen : 0;
  s.secrets = list(raw.secrets);
  s.blocked = list(raw.blocked);
  s.treats = obj(raw.treats);
  // A save from a phone whose clock was ahead (or this phone's clock going back)
  // would leave times in the future, and businesses would stall until they came round.
  if (!(s.lastTick <= now)) s.lastTick = now;
  for (const b of BUSINESSES) if (!(s.biz[b.id].cycleStart <= now)) s.biz[b.id].cycleStart = now;
  return s;
}

// ---------- multipliers ----------

export const totalCombs = (s: GameState) => s.combsFromNaps + s.combsBonus;
/** How much honey each Golden Honeycomb adds (2%, plus Comb Polish), at a Comb Polish level (yours by default). */
export const combPower = (s: GameState, polish = s.research.combs || 0) =>
  COMB_BONUS + (RESEARCH_BY_ID.combs?.per ?? 0) * polish;
// A fourth root keeps naps rewarding without letting them snowball out of control.
const combsForHoney = (honey: number) => Math.floor(5 * (honey / COMB_DIVISOR) ** 0.25);
export const napCombsAvailable = (s: GameState) => Math.max(0, combsForHoney(s.allTimeEarned) - s.combsFromNaps);

/** All-time honey needed before the next nap comb unlocks. */
export function nextCombAt(s: GameState) {
  const next = combsForHoney(s.allTimeEarned) + 1;
  return (next / 5) ** 4 * COMB_DIVISOR;
}

function bizCycle(b: Business, owned: number, speed: number) {
  const m = milestonesReached(owned);
  const maxHalvings = Math.max(0, Math.floor(Math.log2(b.cycle / MIN_CYCLE)));
  const h = Math.min(m, maxHalvings);
  const raw = b.cycle / 2 ** h / speed;
  // Once a cycle is as fast as it can go, extra speed turns into extra honey instead.
  return raw >= MIN_CYCLE || raw >= b.cycle / 2 ** h
    ? { cycle: raw, extra: 2 ** (m - h) }
    : { cycle: MIN_CYCLE, extra: 2 ** (m - h) * (MIN_CYCLE / raw) };
}

// ---------- add-ons ----------

export const addonKey = (home: string, i: number) => `${home}:${i}`;
const homeBaseCost = (home: string) => (home === POOH_HOUSE.id ? 0 : BIZ_BY_ID[home].baseCost);

/** A home's six add-ons, each marked owned / unlocked (home level high enough). */
export function addonList(s: GameState, home: string): (Addon & { index: number; owned: boolean; unlocked: boolean })[] {
  const level = s.levels[home] || 0;
  return addonsFor(home, homeBaseCost(home)).map((a, index) => ({
    ...a, index, owned: s.addons.includes(addonKey(home, index)), unlocked: level >= a.level,
  }));
}

export function canBuyAddon(s: GameState, home: string) {
  return addonList(s, home).some((a) => !a.owned && a.unlocked && s.honey >= a.cost);
}

export function buyAddon(s: GameState, home: string, index: number) {
  const a = addonList(s, home)[index];
  if (!a || a.owned || !a.unlocked || !(s.honey >= a.cost)) return false;
  s.honey -= a.cost;
  s.addons.push(addonKey(home, index));
  return true;
}

/** Combined multiplier from a home's owned add-ons of one effect. */
function addonMult(s: GameState, home: string, effect: Addon['effect']) {
  let m = 1;
  for (const a of addonList(s, home)) if (a.owned && a.effect === effect) m *= a.mult;
  return m;
}

/** Each decoration put up inside a home: +3% to that home's honey (taps for Pooh's). */
export const COSY_BONUS = 0.03;
export const cosyMult = (s: GameState, home: string) => 1 + COSY_BONUS * (s.rooms[home]?.length || 0);
/** Each friendship heart: +0.2% honey everywhere. */
export const HEART_BONUS = 0.002;
export const totalHearts = (s: GameState) => Object.values(s.friends).reduce((n, f) => n + (f.hearts || 0), 0);
const friendMult = (s: GameState) => 1 + HEART_BONUS * totalHearts(s);

function boostMult(s: GameState, kind: Boost['kind'], now: number) {
  let m = 1;
  for (const b of s.boosts) if (b.kind === kind && b.until > now) m *= b.mult;
  return m;
}

export function derive(s: GameState, now: number): Derived {
  let tapPct = 0;
  let globalUpg = 1;
  let offlineHours = 4;
  let balloonRate = 1;
  let balloonPower = 1;
  for (const r of RESEARCH) {
    const lv = s.research[r.id] || 0;
    if (!lv) continue;
    if (r.kind === 'globalMult') globalUpg *= r.per ** lv;
    else if (r.kind === 'tapPct') tapPct += r.per * lv;
    else if (r.kind === 'offlineHours') offlineHours += r.per * lv;
    else if (r.kind === 'balloonRate') balloonRate += r.per * lv;
    else if (r.kind === 'balloonPower') balloonPower += r.per * lv;
  }
  const season = seasonAt(now);
  if (season === 'spring') balloonRate += 0.25;
  if (season === 'winter') offlineHours += 2;
  // Your wood's joint buildings.
  const joint = (id: JointId) => jointBonus(id, Number(s.joint[id]) || 0);
  offlineHours += joint('lantern');
  balloonRate += joint('field');
  balloonPower += joint('field');

  const speed = 1 + researchSum(s, 'speed');
  const combBonus = combPower(s);

  const minOwned = Math.min(...BUSINESSES.map((b) => s.biz[b.id].owned));
  const allMult = 2 ** allMilestonesReached(minOwned);
  const baseMult = varietyAt(s.variety).mult * (1 + combBonus * totalCombs(s)) * globalUpg * allMult * albumMult(s.album)
    * projectMult(s.projects) * (1 + joint('market')) * friendMult(s) * (season === 'summer' ? 1.1 : 1);
  const globalMult = baseMult * boostMult(s, 'profit', now);

  const biz: Record<string, BizInfo> = {};
  let hps = 0;
  for (const b of BUSINESSES) {
    const st = s.biz[b.id];
    const { cycle, extra } = bizCycle(b, st.owned, speed * addonMult(s, b.id, 'speed'));
    const mult = extra * buildingMult(s.levels[b.id] || 0) * addonMult(s, b.id, 'honey') * cosyMult(s, b.id) * globalMult;
    const perCycle = b.revenue * st.owned * mult;
    const perSec = perCycle / cycle;
    if (st.managed) hps += perSec;
    biz[b.id] = { cycle, perCycle, perSec, nextMilestone: nextMilestone(st.owned), mult };
  }

  const tapMult = poohTapMult(s.levels.pooh || 0) * addonMult(s, POOH_HOUSE.id, 'taps') * cosyMult(s, POOH_HOUSE.id)
    * (season === 'autumn' ? 1.25 : 1) * (1 + joint('hive'));
  const tapValue = (tapMult * baseMult * boostMult(s, 'profit', now) + hps * tapPct) * boostMult(s, 'tap', now);
  return {
    hps, tapValue, globalMult, biz, offlineHours, balloonRate, balloonPower, allMilestoneNext: nextAllMilestone(minOwned),
    critChance: researchSum(s, 'critChance'),
    autoTaps: researchSum(s, 'autoTap'),
    frenzyMult: BALLOONS.frenzy.mult + researchSum(s, 'frenzyPower'),
    swarmMult: BALLOONS.swarm.mult + researchSum(s, 'swarmPower'),
    hugSecs: 60 + researchSum(s, 'hugSecs'),
    giftMult: 1 + researchSum(s, 'giftBonus'),
    expoMult: 1 + researchSum(s, 'expoBonus'),
  };
}

// ---------- time ----------

// Numbers stop at ~1.8e308 in JavaScript; hold there rather than turning into Infinity.
const cap = (n: number) => (Number.isFinite(n) ? n : Number.MAX_VALUE);

export function earn(s: GameState, amount: number) {
  if (!(amount > 0)) return;
  s.honey = cap(s.honey + amount);
  s.runEarned = cap(s.runEarned + amount);
  s.allTimeEarned = cap(s.allTimeEarned + amount);
  s.pendingContribution = cap(s.pendingContribution + amount);
}

/** Advance the simulation to `now`. Returns honey earned. */
export function tick(s: GameState, now: number): number {
  s.boosts = s.boosts.filter((b) => b.until > now);
  const d = derive(s, now);
  let earned = 0;
  for (const b of BUSINESSES) {
    const st = s.biz[b.id];
    if (st.owned <= 0) continue;
    const info = d.biz[b.id];
    const cycleMs = info.cycle * 1000;
    if (st.managed) {
      if (!st.running) { st.running = true; st.cycleStart = now; continue; }
      const done = Math.floor((now - st.cycleStart) / cycleMs);
      if (done > 0) {
        earned += done * info.perCycle;
        st.cycleStart += done * cycleMs;
      }
    } else if (st.running && now - st.cycleStart >= cycleMs) {
      earned += info.perCycle;
      st.running = false;
    }
  }
  // Bouncy Helper taps the pot while the game is open (not while you're away).
  const dt = (now - s.lastTick) / 1000;
  if (d.autoTaps > 0 && dt > 0 && dt < 5) earned += d.autoTaps * d.tapValue * dt;
  earn(s, earned);
  s.lastTick = now;
  return earned;
}

/** Catch up after the app was closed. Managers keep working, up to the nap cap. */
export function applyOffline(s: GameState, now: number): { seconds: number; earned: number } {
  const elapsed = now - s.lastTick;
  if (elapsed < 5_000) return { seconds: 0, earned: 0 };
  const capMs = derive(s, s.lastTick).offlineHours * 3600_000;
  const skipped = Math.max(0, elapsed - capMs);
  for (const b of BUSINESSES) if (s.biz[b.id].running) s.biz[b.id].cycleStart += skipped;
  const earned = tick(s, now);
  return { seconds: Math.min(elapsed, capMs) / 1000, earned };
}

/** 0..1 progress of the current cycle, for progress bars. */
export function cycleProgress(s: GameState, d: Derived, id: string, now: number) {
  const st = s.biz[id];
  if (!st.running || st.owned <= 0) return 0;
  const cycle = d.biz[id].cycle;
  if (cycle < 0.3) return 1;
  return Math.min(1, ((now - st.cycleStart) / 1000 / cycle) % (st.managed ? 1 : Infinity));
}

// ---------- actions ----------

export function tap(s: GameState, now: number, rand = Math.random) {
  const d = derive(s, now);
  const lucky = rand() < d.critChance;
  const v = d.tapValue * (lucky ? 10 : 1);
  earn(s, v);
  s.stats.taps++;
  return v;
}

/** Tap a business row: starts a cycle if there is no manager. */
export function startCycle(s: GameState, id: string, now: number) {
  const st = s.biz[id];
  if (st.owned <= 0 || st.managed || st.running) return false;
  st.running = true;
  st.cycleStart = now;
  return true;
}

export function costFor(b: Business, owned: number, n: number) {
  const g = b.growth;
  return b.baseCost * g ** owned * ((g ** n - 1) / (g - 1));
}

export function maxAffordable(b: Business, owned: number, honey: number) {
  const g = b.growth;
  const first = b.baseCost * g ** owned;
  if (honey < first) return 0;
  return Math.floor(Math.log((honey * (g - 1)) / first + 1) / Math.log(g));
}

export type BuyMode = 1 | 10 | 100 | 'max';

export function quote(s: GameState, id: string, mode: BuyMode) {
  const b = BIZ_BY_ID[id];
  const owned = s.biz[id].owned;
  const discount = bizCostMult(s);
  let n = mode === 'max' ? Math.max(1, maxAffordable(b, owned, s.honey / discount)) : mode;
  // Rounding in the logarithm can overshoot by one, which would make "Max" look affordable but do nothing.
  if (mode === 'max' && n > 1 && costFor(b, owned, n) * discount > s.honey) n--;
  return { n, cost: costFor(b, owned, n) * discount };
}

export function buyBiz(s: GameState, id: string, mode: BuyMode, now: number) {
  const { n, cost } = quote(s, id, mode);
  if (!(s.honey >= cost)) return false;
  s.honey -= cost;
  const st = s.biz[id];
  if (st.owned === 0 && st.managed) { st.running = true; st.cycleStart = now; }
  st.owned += n;
  return true;
}

export function hireManager(s: GameState, id: string, now: number) {
  const b = BIZ_BY_ID[id];
  const st = s.biz[id];
  const cost = managerCost(s, b);
  if (st.managed || st.owned <= 0 || s.honey < cost) return false;
  s.honey -= cost;
  st.managed = true;
  if (!st.running) { st.running = true; st.cycleStart = now; }
  return true;
}

// ---------- Rabbit's General Store ----------

export function researchNext(s: GameState, id: string) {
  const r = RESEARCH_BY_ID[id];
  const level = s.research[id] || 0;
  const maxed = r.max !== undefined && level >= r.max;
  return { level, cost: researchCost(r, level), maxed, unlocked: level > 0 || s.allTimeEarned >= r.unlock };
}

export function canBuyResearch(s: GameState, id: string) {
  const n = researchNext(s, id);
  return n.unlocked && !n.maxed && s.honey >= n.cost;
}

export function buyResearch(s: GameState, id: string) {
  const n = researchNext(s, id);
  if (!n.unlocked || n.maxed || !(s.honey >= n.cost)) return false;
  s.honey -= n.cost;
  s.research[id] = n.level + 1;
  return true;
}

// ---------- buildings on the map ----------

export type BuildingNext = {
  level: number; cost: number; gain: number; newLook: boolean; lookName: string; ready: boolean;
};

/** The next level for a home (a business id or 'pooh'). Levels never run out. */
export function buildingNext(s: GameState, id: string): BuildingNext {
  const level = s.levels[id] || 0;
  const newLook = lookOf(level + 1) > lookOf(level);
  if (id === POOH_HOUSE.id) {
    return {
      level, cost: poohCost(level), gain: poohTapMult(level + 1) / poohTapMult(level), newLook,
      lookName: lookName(level + 1), ready: true,
    };
  }
  return {
    level, cost: buildingCost(BIZ_BY_ID[id].baseCost, level), gain: buildingMult(level + 1) / buildingMult(level), newLook,
    lookName: lookName(level + 1), ready: s.biz[id].owned > 0,
  };
}

export function canUpgradeBuilding(s: GameState, id: string) {
  const next = buildingNext(s, id);
  return next.ready && s.honey >= next.cost;
}

/** Something to buy at this home on the map: its next level or an add-on. */
export const homeHasUpgrade = (s: GameState, id: string) => canUpgradeBuilding(s, id) || canBuyAddon(s, id);

export function upgradeBuilding(s: GameState, id: string) {
  const next = buildingNext(s, id);
  if (!next.ready || !(s.honey >= next.cost)) return false;
  s.honey -= next.cost;
  s.levels[id] = next.level + 1;
  s.stats.upgrades++;
  return true;
}

/** Everything the map needs to draw a wood — yours or a friend's. */
export type MapView = {
  owned: Record<string, number>; levels: Record<string, number>; managed: Record<string, boolean>; addons?: string[]; rooms?: Record<string, string[]>;
};

export function mapView(s: GameState): MapView {
  const owned: Record<string, number> = {};
  const managed: Record<string, boolean> = {};
  for (const b of BUSINESSES) { owned[b.id] = s.biz[b.id].owned; managed[b.id] = s.biz[b.id].managed; }
  return { owned, levels: { ...s.levels }, managed, addons: [...s.addons], rooms: JSON.parse(JSON.stringify(s.rooms)) };
}

export function buyVariety(s: GameState) {
  const cost = varietyCost(s, s.variety + 1);
  if (!(s.honey >= cost)) return false;
  s.honey -= cost;
  s.variety++;
  return true;
}

/** Pooh's Nap: start over with Golden Honeycombs. Varieties are kept. */
export function nap(s: GameState, now: number) {
  const gained = napCombsAvailable(s);
  if (gained < 1) return 0;
  const fresh = newGame(now);
  s.combsFromNaps += gained;
  s.honey = 0;
  s.runEarned = 0;
  s.biz = fresh.biz;
  s.research = {};
  s.levels = {};
  s.addons = [];
  s.boosts = [];
  s.stats.naps++;
  s.lastTick = now;
  return gained;
}

export function addBoost(s: GameState, kind: Boost['kind'], mult: number, secs: number, label: string, now: number) {
  s.boosts.push({ id: `${now}-${Math.random()}`, kind, mult, until: now + secs * 1000, label });
}

export function receiveGift(s: GameState, amount: number) {
  // Gifts are spendable but don't count toward naps or Expotitions (no double counting).
  if (amount > 0 && Number.isFinite(amount)) s.honey = cap(s.honey + amount);
}

/**
 * What you're worth this run, for prizes: the honey you have, or a fifth of what you've
 * made since your last nap if you've just spent it. Prizes come from this rather than
 * from your income, so a fresh run after a nap pays fresh-run prizes (Golden Honeycombs
 * make your income jump straight after a nap, long before your honey catches up).
 */
export const runWorth = (s: GameState) => Math.max(s.honey, s.runEarned * 0.2);
/** A Lucky Honey balloon: this share of what you're worth this run (more with balloon upgrades)… */
export const LUCKY_SHARE = 0.05;
/** …and never less than this, for a brand-new game. */
const MIN_LUCKY = 100;

export function catchBalloon(s: GameState, now: number, rand = Math.random) {
  const d = derive(s, now);
  const total = Object.values(BALLOONS).reduce((a, b) => a + b.weight, 0);
  let r = rand() * total;
  let kind: BalloonKind = 'lucky';
  for (const [k, v] of Object.entries(BALLOONS) as [BalloonKind, (typeof BALLOONS)[BalloonKind]][]) {
    if ((r -= v.weight) < 0) { kind = k; break; }
  }
  s.stats.balloons++;
  bumpEvent(s, 'balloon', now);
  const def = BALLOONS[kind];
  if (kind === 'lucky') {
    const amount = Math.max(MIN_LUCKY, runWorth(s) * LUCKY_SHARE * d.balloonPower);
    earn(s, amount);
    return { kind, title: def.title, amount, mult: 0, secs: 0 };
  }
  const mult = kind === 'frenzy' ? d.frenzyMult : d.swarmMult;
  const secs = def.secs * d.balloonPower;
  addBoost(s, kind === 'frenzy' ? 'profit' : 'tap', mult, secs, def.title, now);
  return { kind, title: def.title, amount: 0, mult, secs };
}
