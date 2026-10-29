// "What's new" notes, shown once after an update. Add a new entry (with the next
// `v`) whenever there's something worth telling; players see only the newest one.
export type News = { v: number; title: string; items: [emoji: string, title: string, text: string][] };

export const NEWS: News[] = [
  {
    v: 1,
    title: "What's new in the wood",
    items: [
      ['🎲', 'A game for every home', 'Fifteen minigames, one per home. Find them in the new Games tab, or tap a home on the map. Each pays honey, then rests for a while.'],
      ['🥢', 'Poohsticks together', 'Race your sticks live against each other, or against Pooh.'],
      ['🚪', 'A visitor every day', 'Someone knocks at the door with a little favour to ask. Look along the top of the map.'],
      ['🍂', 'Seasons and weather', 'The wood follows the real calendar, with a small bonus each season and holiday events with their own cards.'],
      ['🔨', 'Build together', 'Pay into shared projects on the Friends tab. Each one appears on the map and raises honey for good.'],
      ['✉️', 'Letters', 'Leave each other notes, with honey tucked inside if you like.'],
      ['📖', 'Card sets and trophies', 'New cards to find, bonuses for full sets, and trophies to show off.'],
      ['🛋️', 'Inside the homes', 'After 15 naps the doors open: decorate each room and chat with whoever lives there.'],
    ],
  },
];

export const NEWS_VERSION = NEWS[NEWS.length - 1].v;
