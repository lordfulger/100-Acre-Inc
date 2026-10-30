// Trips round the wood and the treasures friends bring home from them, and the
// daily gift. Pure game logic, like engine.ts.
import { ARTIFACTS, artifactKey, RARITIES, readArtifact } from './catalog';
import { addBoost, combUpgrade, earn, GameState, runWorth } from './engine';
import { dayKey } from './extras';
import type { PortraitId } from '../ui/Portrait';

// ---------- trips ----------

/** Who can go exploring. More friends join as you take naps. */
export const EXPLORERS: { id: string; name: string; portrait: PortraitId; naps: number }[] = [
  { id: 'robin', name: 'Christopher Robin', portrait: 'robin', naps: 0 },
  { id: 'roo', name: 'Roo', portrait: 'roo', naps: 1 },
  { id: 'owl', name: 'Owl', portrait: 'owl', naps: 3 },
];

/** Where they can go. Longer trips find rarer treasure (`odds` per rarity, out of 100), and the longest finds two. */
export const TRIPS: { id: string; name: string; emoji: string; hours: number; finds: number; odds: number[] }[] = [
  { id: 'short', name: 'Down to the Sandy Pit', emoji: '🏖️', hours: 1, finds: 1, odds: [85, 13, 2, 0] },
  { id: 'mid', name: 'Across the Hundred Acre Wood', emoji: '🌳', hours: 4, finds: 1, odds: [62, 28, 9, 1] },
  { id: 'long', name: 'Up to the North Pole', emoji: '🧭', hours: 12, finds: 2, odds: [42, 36, 17, 5] },
];
export const TRIP_BY_ID = Object.fromEntries(TRIPS.map((t) => [t.id, t])) as Record<string, (typeof TRIPS)[number]>;

/** Treasures on display at once. */
export const DISPLAY_SLOTS = 3;
/** How many of one treasure make one of the next rarity. */
export const COMBINE = 3;

/** How long a trip takes you (shorter with the Explorer's Kit). */
export const tripHours = (s: GameState, trip: string) => (TRIP_BY_ID[trip]?.hours ?? 0) * (1 - combUpgrade(s, 'trips'));

export const explorerOpen = (s: GameState, id: string) => s.stats.naps >= (EXPLORERS.find((e) => e.id === id)?.naps ?? Infinity);

/** Where an explorer is: at home, out on a trip, or back with something to show you. */
export function explorerState(s: GameState, id: string, now: number) {
  const t = s.trips[id];
  const trip = t && TRIP_BY_ID[t.trip];
  if (!t || !trip) return { phase: 'home' as const };
  return { phase: now >= t.until ? ('back' as const) : ('away' as const), trip, left: Math.max(0, t.until - now) };
}

export function startTrip(s: GameState, explorer: string, trip: string, now: number) {
  const def = TRIP_BY_ID[trip];
  if (!def || !explorerOpen(s, explorer) || s.trips[explorer]) return false;
  s.trips[explorer] = { trip, until: now + tripHours(s, trip) * 3_600_000 };
  return true;
}

/** One treasure, its rarity rolled from these odds. */
export function rollArtifact(odds: number[], rand = Math.random) {
  const total = odds.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  let rarity = 0;
  for (let i = 0; i < odds.length; i++) {
    if ((r -= odds[i]) < 0) { rarity = i; break; }
  }
  const def = ARTIFACTS[Math.floor(rand() * ARTIFACTS.length) % ARTIFACTS.length];
  return artifactKey(def.id, rarity);
}

const addArtifact = (s: GameState, key: string) => { s.artifacts[key] = (s.artifacts[key] || 0) + 1; };

/** Welcome an explorer home: their finds go in your bag. Returns what they found. */
export function collectTrip(s: GameState, explorer: string, now: number, rand = Math.random) {
  const st = explorerState(s, explorer, now);
  if (st.phase !== 'back') return [];
  const found = Array.from({ length: st.trip.finds }, () => rollArtifact(st.trip.odds, rand));
  found.forEach((k) => addArtifact(s, k));
  delete s.trips[explorer];
  s.stats.trips++;
  return found;
}

/** Put a treasure on display (in place of another of the same kind, if one is up). */
export function equip(s: GameState, key: string) {
  const a = readArtifact(key);
  if (!a || !(s.artifacts[key] > 0) || s.equipped.includes(key)) return false;
  const same = s.equipped.findIndex((k) => readArtifact(k)?.def.id === a.def.id);
  if (same >= 0) s.equipped[same] = key;
  else if (s.equipped.length < DISPLAY_SLOTS) s.equipped.push(key);
  else return false;
  return true;
}

export const unequip = (s: GameState, key: string) => { s.equipped = s.equipped.filter((k) => k !== key); };

/** Three of the same treasure become one of the next rarity (put on display if the old one was). */
export function combine(s: GameState, key: string) {
  const a = readArtifact(key);
  if (!a || a.rarity >= RARITIES.length - 1 || (s.artifacts[key] || 0) < COMBINE) return null;
  s.artifacts[key] -= COMBINE;
  const next = artifactKey(a.def.id, a.rarity + 1);
  addArtifact(s, next);
  if (!s.artifacts[key]) {
    delete s.artifacts[key];
    if (s.equipped.includes(key)) s.equipped = s.equipped.map((k) => (k === key ? next : k));
  }
  return next;
}

// ---------- the daily gift ----------

/** Seven days of gifts, then round again. Missing a day starts again from day 1. */
export const DAILY: { emoji: string; text: string; honey?: number; boost?: { mult: number; mins: number }; treasure?: number[] }[] = [
  { emoji: '🍯', text: 'A pot of honey', honey: 0.02 },
  { emoji: '⚡', text: '×2 honey for 15 minutes', boost: { mult: 2, mins: 15 } },
  { emoji: '🍯', text: 'A bigger pot of honey', honey: 0.04 },
  { emoji: '🎁', text: 'A treasure', treasure: TRIPS[0].odds },
  { emoji: '🍯', text: 'A big pot of honey', honey: 0.06 },
  { emoji: '⚡', text: '×3 honey for 30 minutes', boost: { mult: 3, mins: 30 } },
  { emoji: '🌟', text: 'A rare treasure and lots of honey', honey: 0.1, treasure: [0, 70, 24, 6] },
];

/** Which day of the streak today's gift is (1-7), and whether it's still to open. */
export function dailyGift(s: GameState, now: number) {
  const today = dayKey(now);
  if (s.daily.last === today) return { day: ((s.daily.streak - 1) % DAILY.length) + 1, ready: false };
  const yesterday = dayKey(now - 86_400_000);
  const streak = s.daily.last === yesterday ? s.daily.streak + 1 : 1;
  return { day: ((streak - 1) % DAILY.length) + 1, ready: true };
}

/** Opens today's gift. Returns what was in it, or null if it's already been opened. */
export function claimDaily(s: GameState, now: number, rand = Math.random) {
  const g = dailyGift(s, now);
  if (!g.ready) return null;
  const gift = DAILY[g.day - 1];
  s.daily = { last: dayKey(now), streak: s.daily.last === dayKey(now - 86_400_000) ? s.daily.streak + 1 : 1 };
  const honey = gift.honey ? Math.max(100, runWorth(s) * gift.honey) : 0;
  if (honey) earn(s, honey);
  if (gift.boost) addBoost(s, 'profit', gift.boost.mult, gift.boost.mins * 60, 'Daily gift', now);
  const treasure = gift.treasure ? rollArtifact(gift.treasure, rand) : null;
  if (treasure) addArtifact(s, treasure);
  return { day: g.day, gift, honey, treasure };
}
