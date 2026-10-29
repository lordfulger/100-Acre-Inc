// The card album: one framed card for each friend in the wood (and a few
// favourite things). Cards are found by reaching goals, and once found they're
// kept forever, through naps and even a fresh start.
import { BIZ_BY_ID } from './catalog';
import type { GameState } from './engine';
import { EVENTS } from './calendar';

export type AlbumCard = {
  id: string;
  name: string;
  /** What to do to find the card. */
  goal: string;
  /** How far along you are, 0 to 1. */
  progress: (s: GameState) => number;
  /** Cards without a painted picture are drawn with this. */
  emoji?: string;
};

/** Each card found adds this much honey, forever. */
export const CARD_BONUS = 0.01;

/** Honey multiplier from the album. Pooh's card is a welcome gift, so it doesn't count. Full sets add more. */
export const albumMult = (album: string[]) =>
  (1 + CARD_BONUS * album.filter((id) => id !== 'pooh').length) * (1 + SET_BONUS * setsDone(album).length);

const hire = (id: string, name: string, biz: string): AlbumCard => ({
  id, name,
  goal: `Hire ${BIZ_BY_ID[biz].manager.name} at ${BIZ_BY_ID[biz].name}`,
  progress: (s) => (s.biz[biz]?.managed ? 1 : 0),
});

const count = (id: string, name: string, goal: string, target: number, value: (s: GameState) => number): AlbumCard => ({
  id, name, goal, progress: (s) => Math.min(1, value(s) / target),
});

export const ALBUM: AlbumCard[] = [
  { id: 'pooh', name: 'Winnie-the-Pooh', goal: 'Come into the wood', progress: () => 1 },
  count('hunny', 'Hunny', 'Tap the honey pot 500 times', 500, (s) => s.stats.taps),
  hire('piglet', 'Piglet', 'haycorn'),
  count('balloon', 'The Balloon', 'Catch 25 balloons', 25, (s) => s.stats.balloons),
  hire('rabbit', 'Rabbit', 'garden'),
  count('relations', "Rabbit's Friends-and-Relations", "Own 100 of Rabbit's Farm", 100, (s) => s.biz.garden?.owned || 0),
  hire('owl', 'Owl', 'oak'),
  hire('kanga', 'Kanga', 'kitchen'),
  hire('eeyore', 'Eeyore', 'thistle'),
  count('honeycomb', 'Golden Honeycomb', 'Take your first nap', 1, (s) => s.stats.naps),
  hire('tigger', 'Tigger', 'ranch'),
  hire('robin', 'Christopher Robin', 'works'),
  hire('small', 'Small', 'heffalump'),
  hire('woozle', 'The Woozles', 'bridge'),
  hire('roo', 'Roo', 'floody'),
  hire('poohpiglet', 'Pooh and Piglet', 'galleons'),
  hire('bee', 'The Bees', 'camp'),
  hire('heffalump', 'The Heffalump', 'pines'),
  // Games and neighbourliness.
  { ...count('sticks', 'Poohsticks', 'Win 5 games of Poohsticks', 5, (s) => s.stats.sticksWon), emoji: '🥢' },
  { ...count('drip', 'The Useful Pot', 'Score 40 in Honey Drip', 40, (s) => s.games.drip?.best || 0), emoji: '🍯' },
  { ...count('tracks', 'Woozle Tracks', 'Follow 8 tracks in Woozle Tracks', 8, (s) => s.games.tracks?.best || 0), emoji: '🐾' },
  { ...count('marrow', 'Prize Marrow', "Score 40 in Rabbit's Garden", 40, (s) => s.games.garden?.best || 0), emoji: '🥕' },
  { ...count('letter', "Owl's Letter", 'Send 5 letters', 5, (s) => s.stats.lettersSent), emoji: '✉️' },
  { ...count('visitor', 'A Knock at the Door', 'Help 10 daily visitors', 10, (s) => s.stats.visitors), emoji: '🚪' },
  { ...count('eeyorehouse', "Eeyore's House", 'Build a shared project together', 1, (s) => s.projects.length), emoji: '🛖' },
  { ...count('medal', 'The Medal', 'Earn 15 trophies', 15, (s) => s.trophies.length), emoji: '🏅' },
  // Holidays: only found during the event.
  ...EVENTS.map((e): AlbumCard => ({
    id: e.id, name: e.name, emoji: e.emoji, goal: `${e.name}: ${e.task.toLowerCase()} (${monthDay(e.from)} – ${monthDay(e.to)})`,
    progress: (s) => (s.eventsWon.includes(e.id) ? 1 : 0),
  })),
];

function monthDay([m, d]: [number, number]) {
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}`;
}

// Sets: finishing one adds +5% honey on top of the cards themselves.
export const SET_BONUS = 0.05;
export const SETS: { name: string; emoji: string; cards: string[] }[] = [
  { name: 'Pooh and Friends', emoji: '🐻', cards: ['pooh', 'piglet', 'rabbit', 'owl', 'kanga', 'roo', 'eeyore', 'tigger', 'robin'] },
  { name: 'Odd Things in the Wood', emoji: '🐾', cards: ['hunny', 'balloon', 'honeycomb', 'relations', 'woozle', 'small', 'heffalump', 'bee', 'poohpiglet'] },
  { name: 'Games in the Wood', emoji: '🎲', cards: ['sticks', 'drip', 'tracks', 'marrow'] },
  { name: 'Good Neighbours', emoji: '🏡', cards: ['letter', 'visitor', 'eeyorehouse', 'medal'] },
  { name: 'Through the Year', emoji: '📅', cards: EVENTS.map((e) => e.id) },
];
export const setsDone = (album: string[]) => SETS.filter((set) => set.cards.every((id) => album.includes(id)));

export const ALBUM_BY_ID = Object.fromEntries(ALBUM.map((c) => [c.id, c])) as Record<string, AlbumCard>;

/** Adds any cards whose goals are now reached. Returns the new ones. */
export function checkAlbum(s: GameState): AlbumCard[] {
  const found: AlbumCard[] = [];
  for (const c of ALBUM) {
    if (s.album.includes(c.id) || c.progress(s) < 1) continue;
    s.album.push(c.id);
    s.albumNew.push(c.id);
    found.push(c);
  }
  return found;
}
