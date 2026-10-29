// The card album: one framed card for each friend in the wood (and a few
// favourite things). Cards are found by reaching goals, and once found they're
// kept forever, through naps and even a fresh start.
import { BIZ_BY_ID } from './catalog';
import type { GameState } from './engine';

export type AlbumCard = {
  id: string;
  name: string;
  /** What to do to find the card. */
  goal: string;
  /** How far along you are, 0 to 1. */
  progress: (s: GameState) => number;
};

/** Each card found adds this much honey, forever. */
export const CARD_BONUS = 0.01;

/** Honey multiplier from the album. Pooh's card is a welcome gift, so it doesn't count. */
export const albumMult = (album: string[]) => 1 + CARD_BONUS * album.filter((id) => id !== 'pooh').length;

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
];

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
