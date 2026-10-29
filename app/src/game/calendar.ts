// The wood follows the real calendar: seasons with small bonuses, weather that
// changes every couple of hours, and holiday events with their own album cards.
import type { GameState } from './engine';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: Record<Season, { name: string; emoji: string; bonus: string; tint: string; particle: string }> = {
  spring: { name: 'Spring', emoji: '🌸', bonus: 'Balloons come 25% more often', tint: 'rgba(255,190,215,0.10)', particle: '🌸' },
  summer: { name: 'Summer', emoji: '☀️', bonus: 'All honey +10%', tint: 'rgba(255,225,110,0.08)', particle: '🦋' },
  autumn: { name: 'Autumn', emoji: '🍂', bonus: 'Taps +25%', tint: 'rgba(225,130,50,0.10)', particle: '🍂' },
  winter: { name: 'Winter', emoji: '❄️', bonus: "Managers work 2h longer while you're away", tint: 'rgba(240,248,255,0.32)', particle: '❄️' },
};

export function seasonAt(now: number): Season {
  const m = new Date(now).getMonth();
  return m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
}

export type Weather = 'clear' | 'rain' | 'snow' | 'windy';
export const WEATHER_NAMES: Record<Weather, string> = { clear: 'Fine', rain: 'Rainy', snow: 'Snowing', windy: 'Blustery' };

/** The same for everyone at the same time; it changes every 2 hours. */
export function weatherAt(now: number): Weather {
  const slot = Math.floor(now / 7_200_000);
  const r = Math.abs(Math.sin(slot * 12.9898) * 43758.5453) % 1;
  switch (seasonAt(now)) {
    case 'winter': return r < 0.45 ? 'snow' : 'clear';
    case 'autumn': return r < 0.3 ? 'windy' : r < 0.5 ? 'rain' : 'clear';
    case 'spring': return r < 0.3 ? 'rain' : r < 0.4 ? 'windy' : 'clear';
    default: return r < 0.15 ? 'rain' : 'clear';
  }
}

// ---------- holiday events ----------

export type EventKind = 'balloon' | 'hug' | 'game';
export type WoodEvent = {
  id: string; name: string; emoji: string; mapEmoji: string; goal: number; kind: EventKind; task: string;
  from: [number, number]; to: [number, number]; // [month, day], inclusive
};

/** Each event's id is also the id of its album card and the decoration it gives. */
export const EVENTS: WoodEvent[] = [
  { id: 'valentine', name: 'Hearts in the Wood', emoji: '💝', mapEmoji: '💕', goal: 14, kind: 'hug', task: 'Send 14 hugs', from: [2, 7], to: [2, 15] },
  { id: 'birthday', name: "Eeyore's Birthday", emoji: '🎂', mapEmoji: '🎈', goal: 10, kind: 'balloon', task: 'Catch 10 balloons for Eeyore', from: [4, 14], to: [4, 24] },
  { id: 'picnic', name: 'Midsummer Picnic', emoji: '🧺', mapEmoji: '🌼', goal: 10, kind: 'game', task: 'Play 10 minigames', from: [6, 17], to: [6, 27] },
  { id: 'halloween', name: 'Heffalump Hunt', emoji: '🎃', mapEmoji: '🎃', goal: 13, kind: 'balloon', task: 'Catch 13 balloons', from: [10, 24], to: [11, 2] },
  { id: 'christmas', name: 'Woozle Snow', emoji: '⛄', mapEmoji: '🎄', goal: 12, kind: 'balloon', task: 'Catch 12 balloons', from: [12, 18], to: [1, 2] },
];

const md = (m: number, d: number) => m * 100 + d;

export function activeEvent(now: number): WoodEvent | null {
  const t = new Date(now);
  const today = md(t.getMonth() + 1, t.getDate());
  return EVENTS.find((e) => {
    const a = md(...e.from);
    const b = md(...e.to);
    return a <= b ? today >= a && today <= b : today >= a || today <= b;
  }) || null;
}

/** Progress is kept per year, so an event that wraps over New Year counts as one. */
function eventKey(e: WoodEvent, now: number) {
  const t = new Date(now);
  const wrapped = md(...e.from) > md(...e.to) && md(t.getMonth() + 1, t.getDate()) <= md(...e.to);
  return `${e.id}-${t.getFullYear() - (wrapped ? 1 : 0)}`;
}

export const eventProgress = (s: GameState, e: WoodEvent, now: number) => s.events[eventKey(e, now)] || 0;

/** Counts one balloon/hug/game toward the running event. Returns the event if this finished it. */
export function bumpEvent(s: GameState, kind: EventKind, now: number): WoodEvent | null {
  const e = activeEvent(now);
  if (!e || e.kind !== kind || s.eventsWon.includes(e.id)) return null;
  const key = eventKey(e, now);
  s.events[key] = (s.events[key] || 0) + 1;
  if (s.events[key] < e.goal) return null;
  s.eventsWon.push(e.id);
  if (!s.decor.includes(e.id)) s.decor.push(e.id);
  return e;
}

// ---------- shared projects ----------

// Built together in a wood; the server keeps the goals. Each finished one adds honey for good.
export const PROJECT_LOOKS: Record<string, { emoji: string; name: string; near: string; dx: number; dy: number }> = {
  eeyore: { emoji: '🛖', name: "Eeyore's House", near: 'thistle', dx: -62, dy: -6 },
  wolery: { emoji: '🏡', name: 'The Wolery', near: 'oak', dx: -66, dy: -30 },
  picnic: { emoji: '🧺', name: 'The Great Picnic', near: 'galleons', dx: 62, dy: -10 },
  pot: { emoji: '🍯', name: 'The Really Big Pot', near: 'pooh', dx: 66, dy: -24 },
  pole: { emoji: '🪧', name: 'The North Pole Sign', near: 'camp', dx: -70, dy: -18 },
};
export const projectBonus = (id: string) => (id in PROJECT_LOOKS ? 0.05 : 0.02);
export const projectMult = (done: string[]) => done.reduce((m, id) => m * (1 + projectBonus(id)), 1);
