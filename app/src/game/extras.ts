// Everything around the honey business: decorations, homes you can go inside,
// talking with the friends who live there, the daily visitor, trophies and the
// minigames' prizes.
import { BIZ_BY_ID, BUSINESSES, POOH_HOUSE } from './catalog';
import { bumpEvent, EVENTS, WoodEvent } from './calendar';
import { ALBUM } from './album';
import { derive, earn, GameState } from './engine';
import type { PortraitId } from '../ui/Portrait';

export const dayKey = (now: number) => {
  const t = new Date(now);
  return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`;
};
const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};
/**
 * What you're worth this run, for prizes: the honey you have, or a fifth of what you've
 * made since your last nap if you've just spent it. Prizes come from this rather than
 * from your income, so a fresh run after a nap pays fresh-run prizes (Golden Honeycombs
 * make your income jump straight after a nap, long before your honey catches up).
 */
export const runWorth = (s: GameState) => Math.max(s.honey, s.runEarned * 0.2);
/** The smallest prize, so a brand-new game still gets something. */
const MIN_PRIZE = 100;
/** A prize of this share of what you're worth this run. */
export const runPrize = (s: GameState, part: number) => Math.max(MIN_PRIZE, runWorth(s) * part);

/** Some minutes of your honey per second, with a floor early on (prices in the decoration shop). */
const prize = (s: GameState, now: number, minutes: number) => {
  const d = derive(s, now);
  return Math.max(d.tapValue * 50, d.hps * minutes * 60);
};

// ---------- decorations ----------

export type DecorHow = 'shop' | 'visitor' | 'event' | 'trophy';
export type Decor = { id: string; name: string; emoji: string; how: DecorHow; need?: number };

export const DECOR: Decor[] = [
  // From Rabbit's General Store (the price grows with each one you buy).
  { id: 'rug', name: 'Woolly Rug', emoji: '🧶', how: 'shop' },
  { id: 'armchair', name: 'Squashy Armchair', emoji: '🛋️', how: 'shop' },
  { id: 'plant', name: 'Pot Plant', emoji: '🪴', how: 'shop' },
  { id: 'clock', name: 'Grandfather Clock', emoji: '🕰️', how: 'shop' },
  { id: 'painting', name: 'Painting of the Wood', emoji: '🖼️', how: 'shop' },
  { id: 'teapot', name: 'Teapot', emoji: '🫖', how: 'shop' },
  { id: 'lamp', name: 'Oil Lamp', emoji: '🪔', how: 'shop' },
  { id: 'tulips', name: 'Vase of Tulips', emoji: '🌷', how: 'shop' },
  { id: 'books', name: 'Stack of Books', emoji: '📚', how: 'shop' },
  { id: 'bed', name: 'Cosy Bed', emoji: '🛏️', how: 'shop' },
  { id: 'mirror', name: 'Round Mirror', emoji: '🪞', how: 'shop' },
  { id: 'candles', name: 'Candles', emoji: '🕯️', how: 'shop' },
  // Thank-you presents from the daily visitor: one for every 5 visitors helped.
  { id: 'teddy', name: 'Teddy Bear', emoji: '🧸', how: 'visitor', need: 5 },
  { id: 'posy', name: 'Posy of Violets', emoji: '💐', how: 'visitor', need: 10 },
  { id: 'shell', name: 'Seashell', emoji: '🐚', how: 'visitor', need: 15 },
  { id: 'present', name: 'Wrapped Present', emoji: '🎁', how: 'visitor', need: 20 },
  { id: 'star', name: 'Wishing Star', emoji: '⭐', how: 'visitor', need: 30 },
  // Trophy cabinet.
  { id: 'cup', name: 'Silver Cup', emoji: '🏆', how: 'trophy', need: 10 },
  { id: 'medal', name: 'Gold Medal', emoji: '🎖️', how: 'trophy', need: 20 },
  // Holiday events (same ids as the events).
  ...EVENTS.map((e): Decor => ({ id: e.id, name: e.name, emoji: e.emoji, how: 'event' })),
];
export const DECOR_BY_ID = Object.fromEntries(DECOR.map((d) => [d.id, d])) as Record<string, Decor>;

const shopBought = (s: GameState) => s.decor.filter((id) => DECOR_BY_ID[id]?.how === 'shop').length;
export const decorCost = (s: GameState, now: number) => prize(s, now, 20) * 1.5 ** shopBought(s);

export function buyDecor(s: GameState, id: string, now: number) {
  const item = DECOR_BY_ID[id];
  const cost = decorCost(s, now);
  if (!item || item.how !== 'shop' || s.decor.includes(id) || !(s.honey >= cost)) return false;
  s.honey -= cost;
  s.decor.push(id);
  return true;
}

/** Decorations earned by helping visitors or collecting trophies. Returns the new ones. */
export function checkDecor(s: GameState): Decor[] {
  const found: Decor[] = [];
  for (const item of DECOR) {
    if (s.decor.includes(item.id)) continue;
    const have = item.how === 'visitor' ? s.stats.visitors : item.how === 'trophy' ? s.trophies.length : -1;
    if (item.need !== undefined && have >= item.need) { s.decor.push(item.id); found.push(item); }
  }
  return found;
}

// ---------- going inside homes ----------

/** Homes open their doors once you've taken this many naps. */
export const INTERIOR_NAPS = 15;
export const ROOM_SLOTS = 6;
export const interiorsOpen = (s: GameState) => s.stats.naps >= INTERIOR_NAPS;
export const homeOpen = (s: GameState, home: string) => interiorsOpen(s) && (home === POOH_HOUSE.id || s.biz[home]?.owned > 0);

/** Where a decoration is, if it's been put up somewhere. */
export const placedIn = (s: GameState, id: string) => Object.keys(s.rooms).find((home) => s.rooms[home].includes(id)) || null;

export function placeDecor(s: GameState, home: string, id: string) {
  if (!homeOpen(s, home) || !s.decor.includes(id)) return false;
  const room = s.rooms[home] || [];
  if (room.includes(id) || room.length >= ROOM_SLOTS) return false;
  const from = placedIn(s, id);
  if (from) s.rooms[from] = s.rooms[from].filter((x) => x !== id);
  s.rooms[home] = [...room, id];
  return true;
}

export function takeDownDecor(s: GameState, home: string, id: string) {
  if (!s.rooms[home]?.includes(id)) return false;
  s.rooms[home] = s.rooms[home].filter((x) => x !== id);
  return true;
}

// ---------- talking with friends ----------

export const MAX_HEARTS = 10;

/** Who lives in each home: their portrait and name. */
export function resident(home: string): { portrait: PortraitId; name: string; emoji: string } {
  if (home === POOH_HOUSE.id) return { portrait: 'pooh', name: 'Pooh', emoji: '🐻' };
  const m = BIZ_BY_ID[home].manager;
  return { portrait: home === 'heffalump' ? 'small' : RESIDENT_PORTRAIT[home] || 'pooh', name: m.name, emoji: m.emoji };
}
const RESIDENT_PORTRAIT: Record<string, PortraitId> = {
  beetree: 'pooh', haycorn: 'piglet', garden: 'rabbit', oak: 'owl', kitchen: 'kanga', thistle: 'eeyore', ranch: 'tigger',
  works: 'robin', heffalump: 'small', bridge: 'woozle', floody: 'roo', galleons: 'poohpiglet', camp: 'bee', pines: 'heffalump',
};

// Original lines, written in the spirit of the books.
const LINES: Record<string, string[]> = {
  pooh: ["Is it time for a little something? It usually is.", "I was thinking, and then I forgot what about. It was probably honey.", "You're my favourite visitor today. Don't tell Piglet.", "This room is much cosier with you in it.", "Honey tastes nicer when there's someone to share it with."],
  beetree: ["The bees are humming a new song. I think it's about honey.", "If you listen very carefully, the tree goes buzz.", "I climbed up this morning. I climbed down rather quicker."],
  haycorn: ["Oh! It's you. I'm so glad it isn't a Heffalump.", "I've been very brave today. Mostly.", "I counted the haycorns twice. There were more the second time.", "It's easier to be brave when a friend is near."],
  garden: ["Ah, good. I've made a list, and you're on it.", "Everything here is labelled. Even the labels.", "My friends-and-relations send their regards. All of them.", "Do admire the carrots. From over there, please."],
  oak: ["Ah. You've come for my advice. Very wise.", "I was just spelling Tuesday. It's harder than it looks.", "Have I told you about my uncle? I shall.", "Knowledge is like honey: best kept on a high shelf."],
  kitchen: ["Come in, dear. Mind Roo, he's bouncing.", "Would you like a spoonful of strengthening medicine?", "There's always room at the table for one more.", "Do wipe your feet, dear. Thank you."],
  thistle: ["Oh. A visitor. How unexpected. Nice, I suppose.", "Thanks for noticing me. Most don't.", "It'll rain later, probably. It usually does.", "Kind of you to come. Not that I was waiting."],
  ranch: ["Hoo-hoo! A visitor! Tiggers LOVE visitors!", "Bouncing is what Tiggers do best.", "Wanna see me bounce to the ceiling? Stand back!", "You're the bounciest friend I've got. Well, second."],
  works: ["Hallo! I was just planning an Expotition.", "Silly old bear left honey on my map again.", "Doing nothing is the best kind of something.", "I'll always be here when you visit."],
  heffalump: ["I got lost again. Then I got found. It's nice being found.", "Everyone was looking for me! Even Rabbit.", "The trap is very deep. I looked. From the edge."],
  bridge: ["Pawprints circle the room twice… and stop at your feet.", "Something small and furry hums a Woozle song.", "There were two Woozles. Now there are three. Hallo."],
  floody: ["Watch me jump! Did you see? I'll do it again!", "I sailed a boat today. It sailed me, mostly.", "Mama says I'm growing. I can tell, I'm bouncier."],
  galleons: ["Pooh and Piglet are sitting very still, looking at the whole world.", "\"What day is it?\" asks Pooh. \"Today,\" says Piglet. \"My favourite.\"", "Up here you can see every home in the wood. Even yours."],
  camp: ["The bees buzz a marching song.", "A bee lands on the map, exactly on the North Pole.", "Bzz. (It sounds pleased to see you.)"],
  pines: ["The Heffalump peeks round a pine and waves its trunk shyly.", "A very large, very gentle sigh. It likes your visit.", "The Heffalump offers you a pine cone. It's warm."],
};
/** Something they say when you bump into them on the map. */
export const chatter = (home: string, rand = Math.random) => {
  const lines = LINES[home] || LINES.pooh;
  return lines[Math.floor(rand() * lines.length)];
};
const HEART_LINES = ["We're getting to be quite good friends, you and I.", "I saved you the comfiest seat.", "I'm always glad when it's you at the door."];

export function talk(s: GameState, home: string, now: number, rand = Math.random) {
  const lines = LINES[home] || LINES.pooh;
  const f = s.friends[home] || { hearts: 0, day: '' };
  const today = dayKey(now);
  const gained = f.day !== today && f.hearts < MAX_HEARTS;
  if (f.day !== today) s.friends[home] = { hearts: Math.min(MAX_HEARTS, f.hearts + 1), day: today };
  const hearts = s.friends[home]?.hearts || 0;
  const pool = hearts >= 5 ? [...lines, ...HEART_LINES] : lines;
  return { line: pool[Math.floor(rand() * pool.length)], gained, hearts };
}

// ---------- the daily visitor ----------

type VisitKind = 'find' | 'taps' | 'balloons' | 'games' | 'hugsSent' | 'upgrades';
export type VisitDef = { who: PortraitId; name: string; line: string; kind: VisitKind; target: number; thing?: string };
export const VISITS: VisitDef[] = [
  { who: 'eeyore', name: 'Eeyore', line: "I seem to have lost my tail. Not that anyone would notice.", kind: 'find', target: 1, thing: "Eeyore's tail" },
  { who: 'piglet', name: 'Piglet', line: 'Could you help me gather haycorns? Tapping the honey pot 300 times should do it.', kind: 'taps', target: 300 },
  { who: 'owl', name: 'Owl', line: 'I require three balloons for a Scientific Experiment.', kind: 'balloons', target: 3 },
  { who: 'tigger', name: 'Tigger', line: "Let's play a game! Any game! Bouncy ones are best!", kind: 'games', target: 1 },
  { who: 'kanga', name: 'Kanga', line: "Roo's hidden his toy somewhere in the wood. Could you look?", kind: 'find', target: 1, thing: "Roo's toy" },
  { who: 'rabbit', name: 'Rabbit', line: 'Things need Organising. Upgrade homes on the map 5 times, please.', kind: 'upgrades', target: 5 },
  { who: 'robin', name: 'Christopher Robin', line: "Send someone a hug, would you? It's that kind of day.", kind: 'hugsSent', target: 1 },
  { who: 'pooh', name: 'Pooh', line: "I'm a little bit hungry. Could you tap the honey pot 500 times?", kind: 'taps', target: 500 },
  { who: 'roo', name: 'Roo', line: 'Catch two balloons with me! The big shiny ones!', kind: 'balloons', target: 2 },
  { who: 'small', name: 'Small', line: "(A tiny voice) I'm lost again. I'm in one of the homes, I think.", kind: 'find', target: 1, thing: 'Small' },
  { who: 'owl', name: 'Owl', line: "Play two games, would you? I'm writing a Scholarly Article on them.", kind: 'games', target: 2 },
];

const statFor = (s: GameState, kind: VisitKind) => (kind === 'find' ? (s.visitor.found ? 1 : 0) : s.stats[kind]);

/** Today's visitor (a new one each day, different for each player). */
export function visitorToday(s: GameState, now: number) {
  const day = dayKey(now);
  if (s.visitor.day !== day) {
    let idx = hash(day + s.profile.secret) % VISITS.length;
    // Sending a hug needs someone to send it to.
    if (VISITS[idx].kind === 'hugsSent' && !s.profile.room) idx = (idx + 1) % VISITS.length;
    const homes = [POOH_HOUSE.id, ...BUSINESSES.filter((b) => s.biz[b.id].owned > 0).map((b) => b.id)];
    s.visitor = { day, idx, base: 0, place: homes[hash(day + 'place') % homes.length], found: false, done: false };
    s.visitor.base = statFor(s, VISITS[idx].kind);
  }
  const def = VISITS[s.visitor.idx] || VISITS[0];
  const progress = Math.min(def.target, statFor(s, def.kind) - s.visitor.base);
  return { def, progress, ready: progress >= def.target, done: s.visitor.done, place: s.visitor.place };
}

export function findThing(s: GameState, home: string) {
  if (s.visitor.found || s.visitor.place !== home || VISITS[s.visitor.idx]?.kind !== 'find') return false;
  s.visitor.found = true;
  return true;
}

/** A visitor's thank-you: this share of what you're worth this run. */
export const VISITOR_SHARE = 0.05;

export function thankVisitor(s: GameState, now: number) {
  const v = visitorToday(s, now);
  if (!v.ready || v.done) return 0;
  const honey = runPrize(s, VISITOR_SHARE);
  earn(s, honey);
  s.visitor.done = true;
  s.stats.visitors++;
  return honey;
}

// ---------- map secrets and treats ----------

// Little things hidden around the map. Each gives honey the first time it's found,
// then stays on the map. Spots are in map coordinates, clear of the homes' tap areas.
export type Secret = { id: string; x: number; y: number; emoji: string; text: string };
export const SECRETS: Secret[] = [
  { id: 'woozle', x: 168, y: 470, emoji: '🐾', text: 'Two Woozles… no, three! Oh. They were your own footprints all along.' },
  { id: 'heffalump', x: 235, y: 170, emoji: '🐘', text: 'Something came by the Sandy Pit. Look at the size of those footprints! A Heffalump?' },
  { id: 'tail', x: 560, y: 560, emoji: '🎀', text: "A bit of ribbon on a thistle. Not Eeyore's tail, but he'd like it." },
  { id: 'pole', x: 580, y: 165, emoji: '🍯', text: 'Someone left a pot of honey on the way to the North Pole. Probably Pooh. Possibly on purpose.' },
  { id: 'boots', x: 210, y: 124, emoji: '🥾', text: "Christopher Robin's boot, half buried in the Sandy Pit." },
  { id: 'small', x: 455, y: 210, emoji: '🐞', text: 'Small, hiding under a leaf. Everybody has been looking for him.' },
  { id: 'frog', x: 566, y: 100, emoji: '🐸', text: 'A frog sunning itself on the Big Stones and Rox.' },
  { id: 'bottle', x: 40, y: 575, emoji: '🍾', text: "A message in a bottle: \"HELP! PIGLET (ME)\". Don't worry, it's an old one." },
];

/** Finding a secret pays this share of what you're worth this run. */
export const SECRET_SHARE = 0.02;

export function findSecret(s: GameState, id: string, now: number) {
  if (s.secrets.includes(id) || !SECRETS.some((x) => x.id === id)) return 0;
  s.secrets.push(id);
  const honey = runPrize(s, SECRET_SHARE);
  earn(s, honey);
  return honey;
}

/** Little honey treats on the map: worth some taps, then a rest. The rest is kept in the save, so reloading doesn't skip it. */
export const TREATS = { bees: { taps: 10, secs: 45 }, stick: { taps: 25, secs: 180 } };
export type TreatKind = keyof typeof TREATS;
export const treatReady = (s: GameState, kind: TreatKind, now: number) => now - (s.treats[kind] || 0) >= TREATS[kind].secs * 1000;
/** Seconds until a treat is ready again. */
export const treatWait = (s: GameState, kind: TreatKind, now: number) =>
  Math.max(0, Math.ceil((TREATS[kind].secs * 1000 - (now - (s.treats[kind] || 0))) / 1000));

export function mapTreat(s: GameState, kind: TreatKind, now: number) {
  if (!treatReady(s, kind, now)) return 0;
  s.treats[kind] = now;
  const honey = derive(s, now).tapValue * TREATS[kind].taps;
  earn(s, honey);
  return honey;
}

// ---------- trophies ----------

export type Trophy = { id: string; name: string; emoji: string; test: (s: GameState) => boolean };
const t = (id: string, emoji: string, name: string, test: (s: GameState) => boolean): Trophy => ({ id, emoji, name, test });
export const TROPHIES: Trophy[] = [
  t('honey6', '🍯', 'A million honey, all-time', (s) => s.allTimeEarned >= 1e6),
  t('honey9', '🍯', 'A billion honey', (s) => s.allTimeEarned >= 1e9),
  t('honey12', '🍯', 'A trillion honey', (s) => s.allTimeEarned >= 1e12),
  t('honey18', '🍯', 'A quintillion honey', (s) => s.allTimeEarned >= 1e18),
  t('honey24', '🍯', 'Honey beyond counting (1e24)', (s) => s.allTimeEarned >= 1e24),
  t('honey33', '👑', 'Honey to the moon (1e33)', (s) => s.allTimeEarned >= 1e33),
  t('nap1', '😴', 'First nap', (s) => s.stats.naps >= 1),
  t('nap10', '😴', '10 naps', (s) => s.stats.naps >= 10),
  t('nap50', '🛌', '50 naps', (s) => s.stats.naps >= 50),
  t('taps10k', '👆', '10,000 taps', (s) => s.stats.taps >= 1e4),
  t('taps100k', '👆', '100,000 taps', (s) => s.stats.taps >= 1e5),
  t('balloon100', '🎈', '100 balloons caught', (s) => s.stats.balloons >= 100),
  t('balloon1000', '🎈', '1,000 balloons caught', (s) => s.stats.balloons >= 1000),
  t('hugs25', '💕', '25 hugs received', (s) => s.stats.hugsGot >= 25),
  t('hugs100', '💞', '100 hugs sent', (s) => s.stats.hugsSent >= 100),
  t('gifts10', '🎁', '10 gifts sent', (s) => s.stats.giftsSent >= 10),
  t('letters5', '✉️', '5 letters sent', (s) => s.stats.lettersSent >= 5),
  t('expo1', '🧭', 'First Expotition finished', (s) => s.stats.expos >= 1),
  t('expo10', '🧭', '10 Expotitions finished', (s) => s.stats.expos >= 10),
  t('games25', '🎲', '25 minigames played', (s) => s.stats.games >= 25),
  t('games100', '🎲', '100 minigames played', (s) => s.stats.games >= 100),
  t('sticks10', '🥢', '10 Poohsticks wins', (s) => s.stats.sticksWon >= 10),
  t('visit7', '🚪', '7 visitors helped', (s) => s.stats.visitors >= 7),
  t('visit30', '🚪', '30 visitors helped', (s) => s.stats.visitors >= 30),
  t('variety3', '🌸', 'Heather Honey or better', (s) => s.variety >= 2),
  t('variety7', '⭐', 'Starlight Honey or better', (s) => s.variety >= 7),
  t('addons30', '🧰', '30 add-ons at once', (s) => s.addons.length >= 30),
  t('pooh100', '🏠', "Pooh's House at Lv 100", (s) => (s.levels.pooh || 0) >= 100),
  t('hearts', '❤️', 'Best friends with someone (10 hearts)', (s) => Object.values(s.friends).some((f) => f.hearts >= 10)),
  t('cosy', '🛋️', 'A home with every spot decorated', (s) => Object.values(s.rooms).some((r) => r.length >= ROOM_SLOTS)),
  t('project3', '🔨', 'Built 3 shared projects', (s) => s.projects.length >= 3),
  t('secrets', '🔍', 'Found every secret on the map', (s) => SECRETS.every((x) => s.secrets.includes(x.id))),
  t('album', '📖', 'Every card in the album', (s) => ALBUM.every((c) => s.album.includes(c.id))),
];

export function checkTrophies(s: GameState): Trophy[] {
  const found = TROPHIES.filter((x) => !s.trophies.includes(x.id) && x.test(s));
  for (const x of found) s.trophies.push(x.id);
  return found;
}

// ---------- minigames ----------

/** Every home has its own game, played from the home on the map or the Games tab. */
export const GAMES = {
  stretch: { home: 'pooh', name: 'Stoutness Exercises', emoji: '🏋️', blurb: 'Stretch when the marker is in the green. Three wobbles and Pooh needs a sit-down.', perPoint: 40 },
  drip: { home: 'beetree', name: 'Honey Drip', emoji: '🍯', blurb: 'Slide the pot to catch dripping honey. Golden drops are worth 3. Dodge the bees!', perPoint: 12 },
  tracks: { home: 'haycorn', name: 'Woozle Tracks', emoji: '🐾', blurb: 'Watch the footprints appear in the snow, then follow them in the same order.', perPoint: 50 },
  garden: { home: 'garden', name: "Rabbit's Garden", emoji: '🥕', blurb: 'Pull up the vegetables as they pop up. Leave the Heffalumps alone!', perPoint: 12 },
  spelling: { home: 'oak', name: "Owl's Spelling Bee", emoji: '✏️', blurb: "Owl's spelling is Wobbly. Pick the word that's spelled right, as many as you can.", perPoint: 40 },
  bounce: { home: 'kitchen', name: "Roo's Bounce", emoji: '🪨', blurb: 'Tap to make Roo jump over the stones. How far can he go?', perPoint: 30 },
  tail: { home: 'thistle', name: "Find Eeyore's Tail", emoji: '🎀', blurb: 'Watch which thistle bush hides the tail while they shuffle, then pick it.', perPoint: 100 },
  balloons: { home: 'ranch', name: "Tigger's Balloons", emoji: '🎈', blurb: 'Pop the balloons as they float up. Gold ones are worth 3. Not the bees!', perPoint: 17 },
  count: { home: 'works', name: 'Counting Pots', emoji: '🔢', blurb: 'Christopher Robin flashes some honey pots. How many were there?', perPoint: 50 },
  trap: { home: 'heffalump', name: 'Spring the Trap', emoji: '🕳️', blurb: 'Tap when the Heffalump is right over the pit. Three misses and it wanders off.', perPoint: 60 },
  sticks: { home: 'bridge', name: 'Poohsticks', emoji: '🥢', blurb: 'Drop your stick off the bridge and race it downstream. Play together live, or against Pooh.', perPoint: 0 },
  river: { home: 'floody', name: 'Down the Floody River', emoji: '🛶', blurb: 'Tap left or right to steer the boat. Collect honey pots, miss the logs.', perPoint: 30 },
  pairs: { home: 'galleons', name: 'Galleons Pairs', emoji: '🃏', blurb: 'Turn over two cards at a time and find the matching friends.', perPoint: 50 },
  beeline: { home: 'camp', name: 'Bee Line', emoji: '🐝', blurb: 'Tap the numbered bees in order, 1, 2, 3… Each round adds a bee.', perPoint: 20 },
  oddone: { home: 'pines', name: 'Odd One Out', emoji: '🌲', blurb: "Something in the pines isn't quite like the rest. Find it, quick!", perPoint: 40 },
} satisfies Record<string, { home: string; name: string; emoji: string; blurb: string; perPoint: number }>;
export type GameId = keyof typeof GAMES;
export const GAME_IDS = Object.keys(GAMES) as GameId[];
/** Games that end when the clock runs out; the rest end when you run out of tries. */
export const TIMED_GAMES = new Set<GameId>(['drip', 'garden', 'spelling', 'balloons', 'count', 'pairs', 'beeline', 'oddone']);
/** Your best score in each game (Poohsticks counts wins instead), shared with your wood for the leaderboards. */
export const bestScores = (s: GameState) => {
  const out: Record<string, number> = {};
  for (const id of GAME_IDS) if (id !== 'sticks' && s.games[id]?.best) out[id] = s.games[id].best;
  return out;
};
export const gameForHome = (home: string) => GAME_IDS.find((id) => GAMES[id].home === home) || null;
/** Every game except Pooh's needs its home unlocked first. */
export const gameOpen = (s: GameState, id: GameId) => GAMES[id].home === POOH_HOUSE.id || s.biz[GAMES[id].home]?.owned > 0;
/** After you play a game it rests for this many minutes before you can play it again. */
export const GAME_COOLDOWN_MIN = 30;
/** A game's best prize (a top score, or beating Pooh at Poohsticks): this share of what you're worth this run. */
export const GAME_SHARE = 0.02;
/** The score worth the full prize is the one that earns this many points' worth (score × perPoint). */
const FULL_PRIZE_POINTS = 600;

export const gameReady = (s: GameState, id: GameId, now: number) => now - (s.games[id]?.last || 0) >= GAME_COOLDOWN_MIN * 60_000;
/** Whole minutes until a game can be played again (0 when it's ready). */
export const gameWait = (s: GameState, id: GameId, now: number) =>
  Math.max(0, Math.ceil((GAME_COOLDOWN_MIN * 60_000 - (now - (s.games[id]?.last || 0))) / 60_000));

/**
 * Records a finished game. Poohsticks passes `won`; the others pass their score.
 * Every finished game starts its rest. The only game that can end while resting is a live
 * Poohsticks race a friend asked you to: that one counts, but pays no prize.
 * Returns the honey won and whether it was a new best.
 */
export function finishGame(s: GameState, id: GameId, score: number, now: number, won?: boolean) {
  const rec = s.games[id] || { last: 0, best: 0 };
  const newBest = score > rec.best;
  const ready = gameReady(s, id, now);
  const part = id === 'sticks' ? (won ? 1 : 0.3) : Math.min(1, (score * GAMES[id].perPoint) / FULL_PRIZE_POINTS);
  const honey = ready && part > 0 ? runPrize(s, GAME_SHARE * part) : 0;
  if (honey > 0) earn(s, honey);
  s.games[id] = { last: ready ? now : rec.last, best: Math.max(rec.best, score) };
  s.stats.games++;
  if (won) s.stats.sticksWon++;
  const event: WoodEvent | null = bumpEvent(s, 'game', now);
  return { honey, newBest, event };
}
