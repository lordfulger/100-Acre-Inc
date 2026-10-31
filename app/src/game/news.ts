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
      ['🛋️', 'Inside the homes', "Open a home's door with Golden Honeycombs: decorate each room and chat with whoever lives there."],
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
      ['✨', 'Spend your Golden Honeycombs', 'On the Nap tab: upgrades that last through every nap, like the Queen Bee\'s Blessing (×1.1 honey a level), Golden Touch and Busy Managers.'],
      ['🤔', 'Choose well', 'A comb you spend stops adding its +% honey, so each one is a choice: keep it, or turn it into something bigger.'],
      ['💭', 'Dream Deeper', 'Naps give more Golden Honeycombs. The Explorer\'s Kit makes trips shorter.'],
    ],
  },
  {
    v: 7,
    title: 'Beyond the Wood',
    items: [
      ['🧭', 'Five new homes', "The map goes further south: the North Pole, the Misty Hollow, Pooh's Thoughtful Spot, the Bluebell Wood and the Highest Hill. Each one is far bigger than the last."],
      ['📈', 'Much bigger numbers', 'Honey can now climb far higher than before.'],
      ['⚖️', 'Homes cost more as you collect them', 'Each extra one of a home costs a bit more than it used to, and more so for the grander homes. The way up is the next home, not just more of the same.'],
    ],
  },
  {
    v: 8,
    title: 'Your weather',
    items: [
      ['🌦️', 'The wood can match outside', "Turn on My real weather on the Nap tab and the wood rains, snows, blows or shines when it does where you are. It uses your rough location, only to ask a weather service, and never sends it to the game."],
      ['☁️', 'Cloudy days', 'The wood has cloudy days now too.'],
    ],
  },
  {
    v: 9,
    title: 'Fairer and steadier',
    items: [
      ['⭐', 'Every home, twice over', 'Owning lots of every home in the Hundred Acre Wood doubles your honey again, as before. The homes Beyond the Wood now have a doubling of their own instead of resetting it.'],
      ['🎈', 'Prizes keep pace with you', "Lucky Honey, minigame prizes, secrets, visitors and the daily gift are now a share of your honey or a few minutes of your income, whichever is less. No more snowballing, and no tiny prizes once you're rich."],
      ['💭', 'Dream Deeper', 'Now helps every nap from here on, rather than paying out for naps you already took. The Queen Bee gives ×1.1 a level.'],
      ['🧭', 'Steady goals', "Expotitions and Our Wood are set from what your wood steadily earns, so they're the same size whether or not someone has just napped."],
    ],
  },
  {
    v: 10,
    title: 'Golden Honeycombs, rebalanced',
    items: [
      ['✨', 'Fairer combs', 'Your first 1,000 Golden Honeycombs count in full. Past that, more combs still add honey, but each one a little less. Millions of combs were making honey run away.'],
      ['🍯', 'Your honey per second will be lower', 'That is expected. Naps are still worth taking, and the bigger your nap, the bigger the boost.'],
    ],
  },
  {
    v: 11,
    title: 'Time for a nap?',
    items: [
      ['😴', 'Naps pay for this run', 'Each nap now pays Golden Honeycombs for the honey made since your last nap, not all-time. Napping regularly earns far more combs than one very long run.'],
      ['💤', 'Pooh gets sleepy', 'A 💤 on the Nap tab means a nap now would at least double your combs.'],
      ['🌙', 'No more giant naps', 'One nap brings at most 10× the combs you already have. A run left going for ages stops paying more, so nap when Pooh is sleepy.'],
    ],
  },
  {
    v: 12,
    title: 'Homes for good',
    items: [
      ['🔑', 'Open a door with combs', "Each home's door now opens with Golden Honeycombs, once, and stays open through every nap, so your rooms stay just as you left them. Doors you already had are still open."],
      ['🖐️', 'Arrange your rooms', 'Drag decorations anywhere in a room. A quick tap still takes one down.'],
      ['😴', 'Pooh rests between naps', 'After your first 3 naps, Pooh needs 12 hours of rest before the next one.'],
    ],
  },
  {
    v: 13,
    title: 'Friends round the wood',
    items: [
      ['⚡', 'Quick upgrade', 'Turn on ⚡ Quick upgrade on the map, then tap a building to level it up straight away.'],
      ['✏️', 'Edit your rooms', 'Rooms stay put until you tap ✏️ Edit room, so nothing moves by accident.'],
      ['🚪', 'Look round friends\' homes', 'When you visit a friend\'s wood, tap a home with an open door to see how they\'ve arranged it.'],
      ['⚔️', 'Challenges', 'Challenge a friend to beat your best score in a game. It waits in their Games tab, and whoever wins gets a honey prize.'],
      ['🏆', 'Fairer Expotitions', 'Expotition combs are now a share of what your current run is worth, so they help everyone without overpowering big woods.'],
    ],
  },
  {
    v: 14,
    title: 'Fairer goals',
    items: [
      ['🍯', 'Goals for everyone', "Building Together, Expotitions and Our Wood goals now come from the average friend's honey, not everyone's added up, so one big wood doesn't make them out of reach."],
      ['💕', 'Hugs take a rest', 'After hugging a friend you can hug them again in 10 minutes. The Hug button shows how long is left.'],
      ['⚔️', 'Challenges count', 'A great score in a friend\'s challenge now counts as your high score too.'],
      ['🐝', 'Slower hives', 'Every hive except the Bee Tree now makes half as much honey per cycle, so each run lasts longer and new homes feel more special.'],
      ['☁️', 'Your wood lives in the cloud', 'Sign in with Google to play. Your save always comes from your account, so every phone shows the same wood.'],
      ['🌱', 'A real fresh start', 'Starting over now clears your album cards and trophies too, and your old honey no longer sets the wood\'s goals.'],
    ],
  },
];

export const NEWS_VERSION = NEWS[NEWS.length - 1].v;
