// Everything you can own, hire, buy or discover in the Hundred Acre Wood.
// Characters are from A. A. Milne's original (public-domain) books.

export type Business = {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  baseCost: number;
  growth: number; // cost multiplier per unit owned
  cycle: number; // seconds per production cycle
  revenue: number; // honey per unit per cycle
  manager: { name: string; emoji: string; cost: number };
};

export const BUSINESSES: Business[] = [
  { id: 'beetree', name: 'The Bee Tree', emoji: '🌳', blurb: 'A buzzing noise means somebody is making honey.', baseCost: 5, growth: 1.10, cycle: 1, revenue: 1, manager: { name: 'Pooh', emoji: '🐻', cost: 500 } },
  { id: 'haycorn', name: "Piglet's House", emoji: '🌰', blurb: 'In a beech tree, by a broken sign that says TRESPASSERS W.', baseCost: 100, growth: 1.13, cycle: 3, revenue: 24, manager: { name: 'Piglet', emoji: '🐷', cost: 8_000 } },
  { id: 'garden', name: "Rabbit's Farm", emoji: '🥕', blurb: 'Very Organised. Labelled. Hives between the carrots, tended by Friends-and-Relations.', baseCost: 1_500, growth: 1.14, cycle: 8, revenue: 480, manager: { name: 'Rabbit', emoji: '🐰', cost: 100_000 } },
  { id: 'oak', name: "Owl's House", emoji: '🦉', blurb: 'The Chestnuts. The sign on the door is spelled almost correctly.', baseCost: 25_000, growth: 1.14, cycle: 20, revenue: 8_000, manager: { name: 'Owl', emoji: '🦉', cost: 1_500_000 } },
  { id: 'kitchen', name: "Kanga's House", emoji: '🧁', blurb: 'By the Sandy Pit where Roo plays. Honey buns and strengthening medicine.', baseCost: 400_000, growth: 1.15, cycle: 45, revenue: 120_000, manager: { name: 'Kanga & Roo', emoji: '🦘', cost: 30_000_000 } },
  { id: 'thistle', name: "Eeyore's Gloomy Place", emoji: '🌾', blurb: "Rather boggy and sad. Bees don't mind thistles. Eeyore minds everything.", baseCost: 7e6, growth: 1.15, cycle: 100, revenue: 1.8e6, manager: { name: 'Eeyore', emoji: '🐴', cost: 5e8 } },
  { id: 'ranch', name: "Tigger's Picnic Hill", emoji: '🎪', blurb: 'Nice for picnics. The bees bounce. Tigger insists this is normal.', baseCost: 1.2e8, growth: 1.15, cycle: 240, revenue: 3e7, manager: { name: 'Tigger', emoji: '🐯', cost: 1e10 } },
  { id: 'works', name: "Christopher Robin's House", emoji: '🚪', blurb: 'Behind a green door in a big tree, where all the clever plans are made.', baseCost: 2e9, growth: 1.15, cycle: 600, revenue: 5e8, manager: { name: 'Christopher Robin', emoji: '🧒', cost: 2e11 } },
  { id: 'heffalump', name: 'The Heffalump Trap', emoji: '🕳️', blurb: 'A Very Deep Pit, baited with honey. No Heffalumps yet. Lots of honey.', baseCost: 4e10, growth: 1.15, cycle: 1_500, revenue: 8e9, manager: { name: 'Small', emoji: '🐞', cost: 5e12 } },
  { id: 'bridge', name: 'Poohsticks Bridge', emoji: '🌉', blurb: 'Honey barges float under the bridge all day, past the Floody Place.', baseCost: 8e11, growth: 1.15, cycle: 3_600, revenue: 1.3e11, manager: { name: 'The Woozles', emoji: '🐾', cost: 1e14 } },
];

export const BIZ_BY_ID = Object.fromEntries(BUSINESSES.map((b) => [b.id, b])) as Record<string, Business>;

// ---------- milestones (endless) ----------

// Owning this many of one business doubles its speed (or profit, once it is
// already lightning fast). After 1000 there's another one every 100, forever.
const MILESTONE_START = [25, 50, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
export function milestonesReached(owned: number) {
  let m = 0;
  for (const t of MILESTONE_START) if (owned >= t) m++;
  if (owned >= 1100) m += Math.floor((owned - 1000) / 100);
  return m;
}
export function nextMilestone(owned: number) {
  return MILESTONE_START.find((t) => t > owned) ?? (Math.floor(owned / 100) + 1) * 100;
}

// Owning this many of EVERY business doubles all honey. Endless too.
const ALL_START = [25, 50, 100, 200];
export function allMilestonesReached(minOwned: number) {
  let m = 0;
  for (const t of ALL_START) if (minOwned >= t) m++;
  if (minOwned >= 300) m += Math.floor((minOwned - 200) / 100);
  return m;
}
export function nextAllMilestone(minOwned: number) {
  return ALL_START.find((t) => t > minOwned) ?? (Math.floor(minOwned / 100) + 1) * 100;
}
export const MIN_CYCLE = 0.5;

// ---------- Rabbit's General Store (levelled, endless) ----------

// Every store item can be bought again and again. Each level costs a little more
// than the last (cost = base × growth^level), so there's always something next.
export type ResearchKind = 'globalMult' | 'tapPct' | 'offlineHours' | 'balloonRate' | 'balloonPower';
export type Research = {
  id: string;
  name: string;
  emoji: string;
  base: number;
  growth: number;
  per: number; // effect per level
  kind: ResearchKind;
  max?: number;
};

export const RESEARCH: Research[] = [
  { id: 'busy', name: 'Busy Bees', emoji: '🐝', base: 50, growth: 1.9, per: 1.05, kind: 'globalMult' },
  { id: 'paws', name: 'Sticky Paws', emoji: '🍯', base: 250, growth: 1.9, per: 0.01, kind: 'tapPct', max: 100 },
  { id: 'balloons', name: 'More Balloons', emoji: '🎈', base: 750, growth: 2, per: 0.05, kind: 'balloonRate', max: 30 },
  { id: 'armchair', name: 'Cosy Armchair', emoji: '🛋️', base: 2_000, growth: 2.2, per: 1, kind: 'offlineHours', max: 20 },
  { id: 'strings', name: 'Longer Strings', emoji: '🧵', base: 5_000, growth: 2, per: 0.1, kind: 'balloonPower' },
  { id: 'owl', name: "Owl's Research", emoji: '📚', base: 1e6, growth: 1e4, per: 2, kind: 'globalMult' },
];
export const RESEARCH_BY_ID = Object.fromEntries(RESEARCH.map((r) => [r.id, r])) as Record<string, Research>;

export const researchCost = (r: Research, level: number) => r.base * r.growth ** level;

/** Plain-words description of what a store item does at a given level. */
export function researchEffect(r: Research, level: number) {
  switch (r.kind) {
    case 'globalMult': return `All honey ×${Number((r.per ** level).toPrecision(3))}`;
    case 'tapPct': return `Taps also earn ${Math.round(r.per * level * 100)}% of your honey/sec`;
    case 'offlineHours': return `Managers work ${4 + r.per * level}h while you're away`;
    case 'balloonRate': return `Balloons come ${Math.round(r.per * level * 100)}% more often`;
    case 'balloonPower': return `Balloon bonuses ${Math.round(r.per * level * 100)}% stronger`;
  }
}

// ---------- honey varieties (endless) ----------

// Permanent multipliers that also recolour the whole wood. They survive Pooh's
// Nap. After the named ones, numbered repeats keep coming.
export type Variety = { name: string; mult: number; cost: number; color: string; deep: string; emoji: string };
const NAMED_VARIETIES: Variety[] = [
  { name: 'Wildflower Honey', mult: 1, cost: 0, color: '#F6B93B', deep: '#C27C0E', emoji: '🌼' },
  { name: 'Clover Honey', mult: 2, cost: 5e7, color: '#B8D86B', deep: '#6C8E23', emoji: '☘️' },
  { name: 'Heather Honey', mult: 4, cost: 5e10, color: '#D98BB4', deep: '#94416E', emoji: '🌸' },
  { name: 'Lavender Honey', mult: 8, cost: 5e13, color: '#A99BE0', deep: '#5D4CA8', emoji: '💜' },
  { name: 'Orange Blossom Honey', mult: 16, cost: 5e16, color: '#F79F55', deep: '#B85A12', emoji: '🍊' },
  { name: 'Manuka Honey', mult: 32, cost: 5e19, color: '#C98A4B', deep: '#7A4A1C', emoji: '🌿' },
  { name: 'Hundred Acre Gold', mult: 64, cost: 5e22, color: '#FFD84D', deep: '#B88A00', emoji: '👑' },
  { name: 'Starlight Honey', mult: 128, cost: 5e25, color: '#9FB7E8', deep: '#3E5A9C', emoji: '⭐' },
  { name: 'Moonbeam Honey', mult: 256, cost: 5e28, color: '#C9C3E6', deep: '#5B4F8F', emoji: '🌙' },
  { name: 'Rainbow Honey', mult: 512, cost: 5e31, color: '#F7A8B8', deep: '#B04A6A', emoji: '🌈' },
  { name: 'Enchanted Honey', mult: 1024, cost: 5e34, color: '#9ED9B8', deep: '#2F7D5A', emoji: '✨' },
];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const roman = (n: number) => (n <= 10 ? ROMAN[n] : String(n));

export function varietyAt(i: number): Variety {
  if (i < NAMED_VARIETIES.length) return NAMED_VARIETIES[i];
  const extra = i - NAMED_VARIETIES.length + 1;
  const cycle = NAMED_VARIETIES.length - 1;
  const looks = NAMED_VARIETIES[1 + ((extra - 1) % cycle)];
  const last = NAMED_VARIETIES[NAMED_VARIETIES.length - 1];
  return {
    ...looks,
    name: `${looks.name} ${roman(Math.ceil(extra / cycle) + 1)}`,
    mult: last.mult * 2 ** extra,
    cost: last.cost * 1000 ** extra,
  };
}

// ---------- Pooh's Nap ----------

// Pooh's Nap (prestige). Golden Honeycombs come from all-time honey.
export const COMB_BONUS = 0.02; // +2% honey per comb
export const COMB_DIVISOR = 1e9; // combs = floor(5 * (allTime / COMB_DIVISOR) ^ (1/4))

export type BalloonKind = 'lucky' | 'frenzy' | 'swarm';
export const BALLOONS: Record<BalloonKind, { weight: number; title: string; secs: number; mult: number }> = {
  lucky: { weight: 50, title: 'Lucky Honey!', secs: 0, mult: 0 },
  frenzy: { weight: 35, title: 'Bee Frenzy! ×7 honey', secs: 30, mult: 7 },
  swarm: { weight: 15, title: 'Bee Swarm! ×50 taps', secs: 12, mult: 50 },
};

export const AVATARS = ['🐻', '🐷', '🐯', '🐰', '🦉', '🐴', '🦘', '🧒', '🐞', '🐝'];

export const QUICK_PHRASES = [
  'Hallo! 👋', 'Oh bother.', 'Time for a little something? 🍯', 'Join the Expotition! 🧭',
  'Thank you for the honey! 💛', 'I caught a balloon! 🎈', 'Bouncy bouncy! 🐯', 'Love you 💕', 'Night night 😴',
];

// ---------- the map (endless levels) ----------

// Every home can be upgraded forever. Each level costs a bit more than the last
// and adds +4% honey; every 5th level also gives ×1.5 and adds something new
// to the home's picture on the map (a new "look").
export const LEVEL_STEP = 5;
const LOOK_NAMES = ['Just as it was', 'Spruced Up', 'Cosy', 'Bustling', 'Splendid', 'Legendary'];
export const lookOf = (level: number) => Math.floor(level / LEVEL_STEP);
export const lookName = (level: number) => {
  const look = lookOf(level);
  return look < LOOK_NAMES.length ? LOOK_NAMES[look] : `Legendary ${roman(look - LOOK_NAMES.length + 2)}`;
};

export const buildingCost = (baseCost: number, level: number) => baseCost * 8 * 1.6 ** level;
export const buildingMult = (level: number) => 1.04 ** level * 1.5 ** lookOf(level);

// Pooh's own house is where the honey pot lives: each level adds +1 honey per
// tap, and every 5th level gives taps ×1.5.
export const POOH_HOUSE = {
  id: 'pooh',
  name: "Pooh Bear's House",
  emoji: '🍯',
  blurb: 'Under the name of Mr. Sanders. Where the honey pot lives.',
};
export const poohCost = (level: number) => 15 * 1.5 ** level;
export const poohTapMult = (level: number) => (1 + level) * 1.5 ** lookOf(level);

/** What each new look adds to a home's picture on the map (every 5 levels). */
export const LEVEL_PERKS: Record<string, string[]> = {
  pooh: ['More honey pots by the door', 'A thinking log', 'A shelf of pots', 'Party bunting', 'A golden glow'],
  beetree: ['A hive in the branches', 'Honey drips', 'A second hive', 'A ladder', 'A golden swarm'],
  haycorn: ['Haycorn blossoms', 'A little fence', 'More blossoms', 'Window boxes', 'A haycorn grove'],
  garden: ['Another carrot row', 'A scarecrow', 'More rows', 'A beehive row', 'A greenhouse'],
  oak: ['A lantern', 'A second window', 'A weathervane', 'Bookshelves', 'A telescope'],
  kitchen: ['Chimney smoke', 'A flower garden', "Roo's swing", 'A new room', 'A honey bun sign'],
  thistle: ['A house of sticks', 'More thistles', 'The Useful Pot', 'Even more thistles', 'A birthday balloon'],
  ranch: ['A bouncy spring', 'A picnic blanket', 'Bunting', 'A second spring', 'A giant trampoline'],
  works: ['A swing', 'A flag', 'A treehouse platform', 'A lookout', 'A telescope'],
  heffalump: ['A ladder', 'A jar of honey bait', 'Lanterns', 'A mine cart', 'Heaps of honey'],
  bridge: ['A honey barge', 'Lanterns', 'Another barge', 'Flags', 'A whole fleet'],
};
