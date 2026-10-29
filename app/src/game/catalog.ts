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
  { id: 'beetree', name: 'The Bee Tree', emoji: '🌳', blurb: 'A buzzing noise means somebody is making honey.', baseCost: 5, growth: 1.13, cycle: 1, revenue: 1, manager: { name: 'Pooh', emoji: '🐻', cost: 500 * 3 } },
  { id: 'haycorn', name: "Piglet's House", emoji: '🌰', blurb: 'In a beech tree, by a broken sign that says TRESPASSERS W.', baseCost: 100, growth: 1.16, cycle: 3, revenue: 24 / 2, manager: { name: 'Piglet', emoji: '🐷', cost: 8_000 * 3 } },
  { id: 'garden', name: "Rabbit's Farm", emoji: '🥕', blurb: 'Very Organised. Labelled. Hives between the carrots, tended by Friends-and-Relations.', baseCost: 1_500, growth: 1.17, cycle: 8, revenue: 480 / 2, manager: { name: 'Rabbit', emoji: '🐰', cost: 100_000 * 3 } },
  { id: 'oak', name: "Owl's House", emoji: '🦉', blurb: 'The Chestnuts. The sign on the door is spelled almost correctly.', baseCost: 25_000, growth: 1.17, cycle: 20, revenue: 8_000 / 2, manager: { name: 'Owl', emoji: '🦉', cost: 1_500_000 * 3 } },
  { id: 'kitchen', name: "Kanga's House", emoji: '🧁', blurb: 'By the Sandy Pit where Roo plays. Honey buns and strengthening medicine.', baseCost: 400_000, growth: 1.18, cycle: 45, revenue: 120_000 / 2, manager: { name: 'Kanga & Roo', emoji: '🦘', cost: 30_000_000 * 3 } },
  { id: 'thistle', name: "Eeyore's Gloomy Place", emoji: '🌾', blurb: "Rather boggy and sad. Bees don't mind thistles. Eeyore minds everything.", baseCost: 7e6, growth: 1.18, cycle: 100, revenue: 1.8e6 / 2, manager: { name: 'Eeyore', emoji: '🐴', cost: 5e8 * 3 } },
  { id: 'ranch', name: "Tigger's Picnic Hill", emoji: '🎪', blurb: 'Nice for picnics. The bees bounce. Tigger insists this is normal.', baseCost: 1.2e8, growth: 1.18, cycle: 240, revenue: 3e7 / 2, manager: { name: 'Tigger', emoji: '🐯', cost: 1e10 * 3 } },
  { id: 'works', name: "Christopher Robin's House", emoji: '🚪', blurb: 'Behind a green door in a big tree, where all the clever plans are made.', baseCost: 2e9, growth: 1.18, cycle: 600, revenue: 5e8 / 2, manager: { name: 'Christopher Robin', emoji: '🧒', cost: 2e11 * 3 } },
  { id: 'heffalump', name: 'The Heffalump Trap', emoji: '🕳️', blurb: 'A Very Deep Pit, baited with honey. No Heffalumps yet. Lots of honey.', baseCost: 4e10, growth: 1.18, cycle: 1_500, revenue: 8e9 / 2, manager: { name: 'Small', emoji: '🐞', cost: 5e12 * 3 } },
  { id: 'bridge', name: 'Poohsticks Bridge', emoji: '🌉', blurb: 'Honey barges float under the bridge all day, past the Floody Place.', baseCost: 8e11, growth: 1.18, cycle: 3_600, revenue: 1.3e11 / 2, manager: { name: 'The Woozles', emoji: '🐾', cost: 1e14 * 3 } },
  // Further into the wood (the south of the map).
  { id: 'floody', name: 'The Floody Place', emoji: '🛶', blurb: 'Where the river spreads out. Honey boats bob at a wobbly little dock.', baseCost: 1.6e13, growth: 1.18, cycle: 7_200, revenue: 2.2e12 / 2, manager: { name: 'Roo', emoji: '🐣', cost: 2e15 * 3 } },
  { id: 'galleons', name: 'Galleons Lap', emoji: '✨', blurb: 'An enchanted clearing on top of the wood, ringed with trees. You can see the whole world.', baseCost: 3.2e14, growth: 1.18, cycle: 14_400, revenue: 3.6e13 / 2, manager: { name: 'Pooh & Piglet', emoji: '🐻🐷', cost: 4e16 * 3 } },
  { id: 'camp', name: 'Expotition Camp', emoji: '⛺', blurb: 'Base camp for finding the North Pole. Mostly used for honey breaks.', baseCost: 6.4e15, growth: 1.18, cycle: 28_800, revenue: 6e14 / 2, manager: { name: 'The Bees', emoji: '🐝', cost: 8e17 * 3 } },
  { id: 'pines', name: 'Heffalump Pines', emoji: '🌲', blurb: 'Big round footprints between the pines. Something very large likes honey too.', baseCost: 1.3e17, growth: 1.18, cycle: 57_600, revenue: 1e16 / 2, manager: { name: 'The Heffalump', emoji: '🐘', cost: 1.6e19 * 3 } },
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
// than the last (cost = base × growth^level). Items appear as your all-time honey
// passes `unlock`. Only Busy Bees, Longer Strings and Owl's Research are endless;
// everything else has a `max`, so no mix of items can make honey run away.
export type ResearchKind =
  | 'globalMult' | 'tapPct' | 'offlineHours' | 'balloonRate' | 'balloonPower'
  | 'critChance' | 'autoTap' | 'speed' | 'managerDiscount' | 'bizDiscount' | 'combPower'
  | 'frenzyPower' | 'swarmPower' | 'hugSecs' | 'giftBonus' | 'varietyDiscount' | 'expoBonus';
export type ResearchSection = 'Honey' | 'Taps' | 'Balloons' | 'Helpers' | 'Friends';
export type Research = {
  id: string;
  name: string;
  emoji: string;
  section: ResearchSection;
  base: number;
  growth: number;
  per: number; // effect per level
  kind: ResearchKind;
  max?: number;
  unlock: number; // all-time honey needed before it shows in the store
};

export const RESEARCH: Research[] = [
  // Honey
  { id: 'busy', name: 'Busy Bees', emoji: '🐝', section: 'Honey', base: 50, growth: 2.6, per: 1.04, kind: 'globalMult', unlock: 0 },
  { id: 'speed', name: 'Quick Wings', emoji: '⚡', section: 'Honey', base: 1e4, growth: 2.5, per: 0.02, kind: 'speed', max: 25, unlock: 1e4 },
  { id: 'combs', name: 'Comb Polish', emoji: '✨', section: 'Honey', base: 1e5, growth: 3, per: 0.001, kind: 'combPower', max: 20, unlock: 5e4 },
  { id: 'seeds', name: 'Flower Seeds', emoji: '🌻', section: 'Honey', base: 5e6, growth: 3, per: 0.05, kind: 'varietyDiscount', max: 10, unlock: 2e6 },
  { id: 'owl', name: "Owl's Research", emoji: '📚', section: 'Honey', base: 1e6, growth: 1e4, per: 2, kind: 'globalMult', unlock: 5e5 },
  // Taps
  { id: 'paws', name: 'Sticky Paws', emoji: '🍯', section: 'Taps', base: 250, growth: 2.2, per: 0.005, kind: 'tapPct', max: 100, unlock: 0 },
  { id: 'lucky', name: 'Lucky Paw', emoji: '🍀', section: 'Taps', base: 1_000, growth: 2.5, per: 0.01, kind: 'critChance', max: 15, unlock: 1_000 },
  { id: 'bouncy', name: 'Bouncy Helper', emoji: '🤸', section: 'Taps', base: 5_000, growth: 2.8, per: 0.5, kind: 'autoTap', max: 10, unlock: 5_000 },
  // Balloons
  { id: 'balloons', name: 'More Balloons', emoji: '🎈', section: 'Balloons', base: 750, growth: 2, per: 0.05, kind: 'balloonRate', max: 30, unlock: 300 },
  { id: 'strings', name: 'Longer Strings', emoji: '🧵', section: 'Balloons', base: 5_000, growth: 2, per: 0.1, kind: 'balloonPower', unlock: 3_000 },
  { id: 'frenzy', name: 'Frenzy Nectar', emoji: '🌺', section: 'Balloons', base: 1e4, growth: 2.6, per: 0.25, kind: 'frenzyPower', max: 8, unlock: 8_000 },
  { id: 'swarm', name: 'Swarm Song', emoji: '🎶', section: 'Balloons', base: 2e4, growth: 2.6, per: 1, kind: 'swarmPower', max: 8, unlock: 1.5e4 },
  // Helpers
  { id: 'tea', name: 'Manager Tea Party', emoji: '🫖', section: 'Helpers', base: 800, growth: 2.2, per: 0.05, kind: 'managerDiscount', max: 10, unlock: 500 },
  { id: 'bargain', name: "Rabbit's Bargains", emoji: '🏷️', section: 'Helpers', base: 3_000, growth: 2.3, per: 0.01, kind: 'bizDiscount', max: 20, unlock: 3_000 },
  { id: 'armchair', name: 'Cosy Armchair', emoji: '🛋️', section: 'Helpers', base: 2_000, growth: 2.2, per: 1, kind: 'offlineHours', max: 20, unlock: 1_500 },
  // Friends
  { id: 'hugs', name: 'Warm Hugs', emoji: '🤗', section: 'Friends', base: 500, growth: 2, per: 10, kind: 'hugSecs', max: 12, unlock: 400 },
  { id: 'ribbons', name: 'Gift Ribbons', emoji: '🎀', section: 'Friends', base: 5e4, growth: 2.5, per: 0.1, kind: 'giftBonus', max: 10, unlock: 3e4 },
  { id: 'map', name: 'Expotition Map', emoji: '🗺️', section: 'Friends', base: 1e5, growth: 2.5, per: 0.1, kind: 'expoBonus', max: 10, unlock: 6e4 },
];
export const RESEARCH_SECTIONS: ResearchSection[] = ['Honey', 'Taps', 'Balloons', 'Helpers', 'Friends'];
export const RESEARCH_BY_ID = Object.fromEntries(RESEARCH.map((r) => [r.id, r])) as Record<string, Research>;

export const researchCost = (r: Research, level: number) => r.base * r.growth ** level;

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Plain-words description of what a store item does at a given level. */
export function researchEffect(r: Research, level: number) {
  const v = r.per * level;
  switch (r.kind) {
    case 'globalMult': return `All honey ×${Number((r.per ** level).toPrecision(3))}`;
    case 'tapPct': return `Taps also earn ${pct(v)} of your honey/sec`;
    case 'offlineHours': return `Managers work ${4 + v}h while you're away`;
    case 'balloonRate': return `Balloons come ${pct(v)} more often`;
    case 'balloonPower': return `Balloon bonuses ${pct(v)} stronger`;
    case 'critChance': return `${pct(v)} of taps are lucky (×10 honey)`;
    case 'autoTap': return `The pot taps itself ${v}× a second`;
    case 'speed': return `Everything works ${pct(v)} faster`;
    case 'managerDiscount': return `Managers cost ${pct(v)} less`;
    case 'bizDiscount': return `Homes cost ${pct(v)} less to buy`;
    case 'combPower': return `Each Golden Honeycomb gives +${(2 + v * 100).toFixed(1)}%`;
    case 'frenzyPower': return `Bee Frenzy is ×${3 + v}`;
    case 'swarmPower': return `Bee Swarm taps are ×${8 + v}`;
    case 'hugSecs': return `Hugs last ${60 + v}s`;
    case 'giftBonus': return `Gifts you receive are worth ${pct(v)} more`;
    case 'varietyDiscount': return `Honey varieties cost ${pct(v)} less`;
    case 'expoBonus': return `Your honey counts ${pct(v)} extra in Expotitions`;
  }
}

// ---------- add-ons: six named upgrades for every home ----------

// One-time purchases that unlock as a home levels up. Each shows as a little
// decoration beside the home on the map. Effects: 'honey' multiplies that home's
// honey, 'speed' makes it work faster, 'taps' (Pooh's House) multiplies taps.
export type AddonEffect = 'honey' | 'speed' | 'taps';
export type Addon = { name: string; emoji: string; effect: AddonEffect; mult: number; level: number; cost: number };

const ADDON_LEVELS = [10, 20, 35, 50, 75, 100];
const ADDON_COSTS = [1e4, 1e6, 1e9, 1e12, 1e17, 2e22]; // × the home's base cost (~10× that level's upgrade)
const POOH_ADDON_COSTS = [1e4, 5e5, 2e8, 1e11, 3e15, 6e19];
const BIZ_EFFECTS: [AddonEffect, number][] = [['honey', 1.25], ['speed', 1.15], ['honey', 1.5], ['speed', 1.25], ['honey', 1.5], ['honey', 2]];
const POOH_EFFECTS: [AddonEffect, number][] = [['taps', 1.25], ['taps', 1.25], ['taps', 1.5], ['taps', 1.5], ['taps', 1.5], ['taps', 2]];

// Named so they don't repeat the free decorations each home gets every 5 levels (LEVEL_PERKS).
const ADDON_NAMES: Record<string, [string, string][]> = {
  pooh: [['Honey Spoon', '🥄'], ['Larder Door', '🚪'], ['Honey Cupboard', '🗄️'], ['Stoutness Exercises', '🏋️'], ['Party Hat', '🎉'], ['Golden Pot', '🏆']],
  beetree: [['Busy Hive', '🐝'], ['Drip Bucket', '🪣'], ['Climbing Branch', '🌿'], ['Blue Balloon', '🎈'], ['Little Black Rain-Cloud', '🌧️'], ['Royal Comb', '👑']],
  haycorn: [['Haycorn Patch', '🌰'], ['Fixed-Up Sign', '🪧'], ['Cosy Fireplace', '🔥'], ['Knitted Scarf', '🧣'], ['Violet Garden', '💜'], ['Beech-Tree Loft', '🏠']],
  garden: [['Cabbage Patch', '🥬'], ['Watering Can', '💧'], ['Labelled Jars', '🏷️'], ['Seed Packets', '🌱'], ['Relations Workforce', '🐇'], ['Prize Marrow', '🎃']],
  oak: [['Bell-Pull', '🔔'], ['Reading Lamp', '🪔'], ['Big Books', '📚'], ['Writing Desk', '🖋️'], ['Spelling Lessons', '✏️'], ["Owl's Spectacles", '👓']],
  kitchen: [['Mixing Bowl', '🥣'], ['Bun Oven', '🍞'], ['Strengthening Medicine', '🧴'], ["Roo's Toy Box", '🧸'], ['Bath-Time Tub', '🛁'], ['Honey Bun Basket', '🧺']],
  thistle: [['Thistle Patch', '🌿'], ['Stick Pile', '🪵'], ['Rainy-Day Umbrella', '🌂'], ['Bell-Rope Tail', '🎀'], ['Birthday Cake', '🎂'], ['Gloomy Raincloud', '🌧️']],
  ranch: [['Bouncy Ball', '⚽'], ['Picnic Basket', '🧃'], ['Extract of Malt', '🍼'], ['Kite', '🪁'], ['Stripy Tent', '⛺'], ['Bounce Trophy', '🏆']],
  works: [['Wellington Boots', '🥾'], ['Satchel', '🎒'], ['Biscuit Tin', '🍪'], ['Upside-Down Umbrella', '☂️'], ['Big Ideas Notebook', '📓'], ['Compass', '🧭']],
  heffalump: [['Leafy Cover', '🍂'], ['Rope Net', '🕸️'], ['Trap Map', '📜'], ['Pickaxe', '⛏️'], ['Woozle Tracker', '🐾'], ['Heffalump Lookout', '🔦']],
  bridge: [['Poohsticks Pile', '🥢'], ['Fishing Rod', '🎣'], ['Stepping Stones', '🪨'], ['Rope Railing', '🪢'], ['River Dock', '⚓'], ['Life Ring', '🛟']],
  floody: [['Oars', '🚣'], ['Bottle Messages', '🍾'], ['Rain Barrel', '🛢️'], ['Lily Pads', '🪷'], ['Paddle Steamer', '🚢'], ['Rainbow', '🌈']],
  galleons: [['Thinking Stone', '🪨'], ['Picnic Hamper', '🧺'], ['Wishing Well', '⛲'], ['Wildflower Ring', '🌼'], ['Starlight Lanterns', '🏮'], ['Enchanted Oak', '🌳']],
  camp: [['Sleeping Bags', '🛏️'], ['Kettle', '🫖'], ['Expotition Map', '🗺️'], ['Compass Post', '🧭'], ['Camp Songs', '🎵'], ['North Pole Sign', '🪧']],
  pines: [['Footprint Path', '🐾'], ['Pine Cone Pile', '🌰'], ['Giant Honey Pot', '🍯'], ['Snowy Branches', '❄️'], ['Trunk Shower', '🚿'], ['Heffalump Hammock', '🛏️']],
};

/** The six add-ons for a home (business id or 'pooh'), with costs worked out. */
export function addonsFor(id: string, baseCost: number): Addon[] {
  const pooh = id === 'pooh';
  return (ADDON_NAMES[id] || []).map(([name, emoji], i) => {
    const [effect, mult] = (pooh ? POOH_EFFECTS : BIZ_EFFECTS)[i];
    return { name, emoji, effect, mult, level: ADDON_LEVELS[i], cost: pooh ? POOH_ADDON_COSTS[i] : baseCost * ADDON_COSTS[i] };
  });
}

export const addonEffectText = (a: Addon) =>
  a.effect === 'speed' ? `Works ${Math.round((a.mult - 1) * 100)}% faster` : `${a.effect === 'taps' ? 'Taps' : 'Honey'} ×${a.mult}`;

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
  // The multiplier isn't in the title: store items make it bigger, and the boost chip shows the real one.
  frenzy: { weight: 35, title: 'Bee Frenzy!', secs: 20, mult: 3 },
  swarm: { weight: 15, title: 'Bee Swarm!', secs: 10, mult: 8 },
};

export const AVATARS = ['🐻', '🐷', '🐯', '🐰', '🦉', '🐴', '🦘', '🐣', '🧒', '🐞', '🐝', '🐘', '🐇'];

export const QUICK_PHRASES = [
  'Hallo! 👋', 'Oh bother.', 'Time for a little something? 🍯', 'Join the Expotition! 🧭',
  'Thank you for the honey! 💛', 'I caught a balloon! 🎈', 'Bouncy bouncy! 🐯', "You're the best! 💛", 'Night night 😴',
];

// ---------- the map (endless levels) ----------

// Every home can be upgraded forever. Each level costs a bit more than the last
// and adds +3% honey; every 5th level also gives ×1.35 and adds something new
// to the home's picture on the map (a new "look").
export const LEVEL_STEP = 5;
const LOOK_NAMES = ['Just as it was', 'Spruced Up', 'Cosy', 'Bustling', 'Splendid', 'Legendary'];
export const lookOf = (level: number) => Math.floor(level / LEVEL_STEP);
export const lookName = (level: number) => {
  const look = lookOf(level);
  return look < LOOK_NAMES.length ? LOOK_NAMES[look] : `Legendary ${roman(look - LOOK_NAMES.length + 2)}`;
};

export const buildingCost = (baseCost: number, level: number) => baseCost * 20 * 1.8 ** level;
export const buildingMult = (level: number) => 1.03 ** level * 1.35 ** lookOf(level);

// Pooh's own house is where the honey pot lives: each level adds +½ honey per
// tap, and every 5th level gives taps ×1.3.
export const POOH_HOUSE = {
  id: 'pooh',
  name: "Pooh Bear's House",
  emoji: '🍯',
  blurb: 'Under the name of Mr. Sanders. Where the honey pot lives.',
};
export const poohCost = (level: number) => 15 * 1.7 ** level;
export const poohTapMult = (level: number) => (1 + 0.5 * level) * 1.3 ** lookOf(level);

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
  floody: ['A honey boat', 'Dock lanterns', 'A second boat', 'Rope bunting', 'A sailboat'],
  galleons: ['A picnic blanket', 'A ring of stones', 'A kite', 'Twinkling lights', 'A golden glow'],
  camp: ['A second tent', 'A lantern', 'A map table', 'A flagpole', 'A telescope'],
  pines: ['Honey pots', 'Hives in the pines', 'More pines', 'Lanterns', 'A golden glow'],
};

/** Looks past Legendary: a gold star each, then a golden halo that keeps growing. */
const STAR_LOOKS = 10;
const HALO_LOOKS = 15;
export const MAX_LOOK = LEVEL_PERKS.pooh.length + STAR_LOOKS + HALO_LOOKS;

/** What a home's picture gains on reaching look `look + 1`, or null once it's as grand as it gets. */
export function perkFor(id: string, look: number): string | null {
  const named = LEVEL_PERKS[id]?.[look];
  if (named) return named;
  if (look < LEVEL_PERKS.pooh.length + STAR_LOOKS) return 'A golden star';
  if (look < MAX_LOOK) return 'A bigger golden halo';
  return null;
}
