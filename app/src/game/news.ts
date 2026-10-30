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
  {
    v: 2,
    title: 'The wood comes alive',
    items: [
      ['🌙', 'Day and night', 'The map follows the real time of day: golden evenings, lights in the windows, and fireflies after dark.'],
      ['🐝', 'Busy bees', 'Bees buzz round the Bee Tree. Give them a tap.'],
      ['🥢', 'Something on the river', 'Now and then a stick floats down the river. Catch it if you can!'],
      ['✨', 'Secrets', 'Eight little secrets are hidden around the map, each marked by a faint sparkle. Can you find them all?'],
    ],
  },
  {
    v: 3,
    title: 'Friends in the wood',
    items: [
      ['📨', 'Invite friends', 'Up to 8 friends can share a wood. Tap Invite friends on the Friends tab to send a link that fills in your code.'],
      ['🗝️', 'Looking after the wood', 'Whoever started the wood can hand it over, or ask someone to leave.'],
      ['🔨', 'Projects belong to the wood', "A wood's projects raise honey for everyone in it. Leave, and the bonus stays behind with the wood until its last friend leaves."],
      ['🚫', 'Block', "Under More on someone's card. You won't see their chat or get anything from them."],
    ],
  },
  {
    v: 4,
    title: 'Our Wood',
    items: [
      ['🗺️', 'A map you share', "Every wood now has its own map on the Friends tab, with five buildings everyone pays into: the Honey Market, the Great Hive, the Balloon Field, the Fairground and the Lantern Tree."],
      ['⬆️', 'Endless levels', 'Each level costs a lot, but helps everyone in the wood for good: more honey, stronger taps, more balloons, bigger prizes, or longer earning while you are away.'],
      ['🎉', 'Celebrations', 'When a building goes up a level, everyone gets ×2 honey for 10 minutes (×3 for 30 minutes every 5th level).'],
      ['🏆', 'Leaderboards and high scores', 'See who leads the wood on the Friends tab, and every game\'s high scores on the Games tab.'],
    ],
  },
  {
    v: 5,
    title: 'Trips and treasures',
    items: [
      ['🧭', 'Trips round the wood', 'On the new Trips tab, send Christopher Robin exploring for 1, 4 or 12 hours. Roo joins after your first nap, and Owl after three.'],
      ['🏺', 'Treasures', "Friends come home with treasures like Pooh's Honey Spoon and Owl's Spectacles. Put three on display for their bonuses. Longer trips find rarer ones."],
      ['✨', 'Combine', 'Three of the same treasure make one of the next rarity: Common, Rare, Epic, then Legendary.'],
      ['🎁', 'A daily gift', 'A present every day you visit, better each day in a row. Day 7 has a rare treasure.'],
    ],
  },
  {
    v: 6,
    title: 'The Comb Store',
    items: [
      ['✨', 'Spend your Golden Honeycombs', 'On the Nap tab: upgrades that last through every nap, like the Queen Bee\'s Blessing (×1.15 honey a level), Golden Touch and Busy Managers.'],
      ['🤔', 'Choose well', 'A comb you spend stops adding its +% honey, so each one is a choice: keep it, or turn it into something bigger.'],
      ['💭', 'Dream Deeper', 'Naps give more Golden Honeycombs. The Explorer\'s Kit makes trips shorter.'],
    ],
  },
];

export const NEWS_VERSION = NEWS[NEWS.length - 1].v;
