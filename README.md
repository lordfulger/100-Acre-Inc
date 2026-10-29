# 🍯 100 Acre Inc

A co-op idle tycoon for two (or up to 8) friends, set in the Hundred Acre Wood. It runs on iOS and Android from one codebase (Expo / React Native), and there's no end to it: every kind of upgrade keeps going forever, getting a little pricier each step.

## How it plays

| Inspired by | In the wood |
|---|---|
| **Cookie Clicker** | Tap the big honey pot. Golden 🎈 balloons drift by now and then: catch one for Lucky Honey, a ×7 Bee Frenzy, or a ×50 Bee Swarm for taps. **Rabbit's General Store** sells upgrades you can buy again and again, starting at 50 honey (Busy Bees, Sticky Paws, More Balloons, Cosy Armchair, Longer Strings, Owl's Research). |
| **Tycoon map** | The **Map** tab is a hand-drawn Hundred Acre Wood. Tap any home to upgrade it, level after level, with no top level. Each level adds a little honey and costs a bit more than the last; every 5th level gives a bigger boost and a new look on the map (Rabbit's carrot rows and scarecrow, Owl's lantern and weathervane, Kanga's chimney smoke and Roo's swing, Eeyore's house of sticks…). Pooh Bear's House powers up your taps, from 15 honey for the first level. |
| **AdVenture Capitalist** | 10 homes in the wood (the Bee Tree, Piglet's House, Rabbit's Farm, Owl's House … Poohsticks Bridge) run on timed cycles. Tap a business to collect from it until you hire its manager, who then runs it forever, even while the app is closed. Owning 25, 50, 100… of a business doubles its speed, with another milestone every 100 after 1000. Buy ×1/×10/×100/Max. |
| **Egg, Inc.** | Honey varieties (Clover → Heather → … → Hundred Acre Gold → Starlight → … and on) are permanent multipliers that also recolour the game. **Pooh's Nap** is the prestige reset: it trades your run for Golden Honeycombs (+2% honey each, forever). Co-op **Expotitions** are timed contracts you fill together for combs and a ×2 boost. |

**Together features:** share a room code, see each other's farms live, **visit each other's map**, send 💕 hugs (×2 honey for 60s), gift honey, chat (free text + quick phrases), and share balloon joy: when one of you catches a balloon, the other gets a small boost. Gifts and rewards sent while someone is offline wait for them.

The game itself runs on each phone, so it's smooth and works offline. The small server only links you together.

## Project layout

```
app/      Expo app (iOS + Android, also runs in a browser)
  src/game/      catalog.ts (all content & numbers), engine.ts (pure game logic), engine.test.ts
  src/state/     GameContext.tsx (game loop, saving, multiplayer wiring)
  src/net/       WoodClient.ts (auto-reconnecting WebSocket)
  src/screens/   Map, Hives, Shop, Friends (Wood), Nap
  src/ui/        WoodMap.tsx (the drawn map), Portrait.tsx (character portraits), header, balloons, onboarding
  assets/portraits/   drop your own character pictures here (see below)
server/   Node WebSocket server (rooms, chat, gifts, hugs, Expotitions)
```

## Play it today (same Wi-Fi, no accounts needed)

1. On your computer, start the server:
   ```bash
   cd server && npm install && npm start
   ```
2. In a second terminal, start the app:
   ```bash
   cd app && npm install && npm start
   ```
3. Install **Expo Go** on both phones (App Store / Play Store) and scan the QR code. Both phones must be on the same Wi-Fi as the computer. The first time, allow Node through the Windows firewall prompt. If you use a VPN on the computer (e.g. NordVPN), allow local network access or pause it.
4. Pick a name and character, open **Friends**, and both enter the same secret code (e.g. `HUNNYPOT`).

The app connects to `ws://<your computer's IP>:3001` automatically. You can change this under *Friends → Server settings*.

## Character portraits

Every character has an original drawn portrait. To use your own pictures instead, put square images in `app/assets/portraits/` named `pooh.png`, `piglet.png`, `tigger.png`, `rabbit.png`, `owl.png`, `eeyore.png`, `kanga.png`, `robin.png`, `small.png`, `bee.png` or `woozle.png`, then run `npm start` (or `npm run portraits`). Details are in `app/assets/portraits/README.md`.

## Play anywhere (deploy the server)

One free Render service runs both the multiplayer server and the web version of the game. Push this repository to GitHub, then in Render choose **New → Blueprint** and pick it; `render.yaml` does the rest. Render gives you an address like `https://one00-acre-inc.onrender.com`.

- **iPhone (no App Store, no Apple account):** open that address in Safari → Share → **Add to Home Screen**. It gets the honey-pot icon and opens full-screen like an app.
- **Android APK:** put the address in `app/app.json` before building, so the installed app finds the server:
  ```json
  "extra": { "serverUrl": "wss://one00-acre-inc.onrender.com" }
  ```

Free Render services sleep after 15 minutes without players; the first connection afterwards takes about a minute. Rooms are saved to `server/data/rooms.json`, which the free plan resets on restart. Progress lives on each phone, so that only resets chat and Expotitions.

To try the hosted version locally: `cd app && npm run build:web`, then `cd server && npm start` and open http://localhost:3001.

## Music, sounds and voices

Everything you hear is original and made in code: `npm run sounds` (in `app/`) rebuilds `assets/sounds/` from `scripts/make-sounds.js` — the background waltz "Honey on the Hill", 20 soft marimba and kalimba effects (unlocks, milestones, add-ons, store, new honey varieties, balloons, a Bee Frenzy buzz, chat, Expotition rewards, welcome back…), taps that each play a random note from a gentle pentatonic scale, home level-ups that climb a scale, and a short musical motif for each of the 12 characters.

Characters play their motif when you hire them, when their home gets a new look, and when they send a hug. To give them real voices, record yourselves: drop clips like `pooh-1.m4a` into `app/assets/voices/` (see the README there). Music, sound effects and (when you have recordings) voices each have a switch on the **Nap** tab.

## Cloud saves (Google sign-in)

On the **Nap** tab, *Sign in with Google* backs the game up to the cloud (every minute and whenever the app goes to the background) and brings it back on any phone. If a phone has less progress than the cloud, the game asks which save to keep instead of overwriting.

How it works: the game gets a one-time link code from the server and opens `/cloud/signin?code=…` in a browser; you sign in with Google's own button there; the game picks up the result. That works the same in the Android app, a browser, and an iPhone home-screen web app. Saves are stored in Supabase by the server (`server/src/cloud.js`).

One-time setup:

1. **Supabase** (free, supabase.com): create a project, open **SQL Editor**, paste `server/supabase.sql` and run it. Then **Project Settings → API keys**: copy the **Project URL** and a **secret** (service role) key.
2. **Google login key** (free, console.cloud.google.com): create a project → **Google Auth Platform** → set up branding (app name, your email) → **Audience**: External, and add both your Gmail addresses as test users → **Clients → Create client → Web application**, with **Authorized JavaScript origin** `https://one00-acre-inc.onrender.com`. Copy the **Client ID**. (No redirect URI or client secret is needed.)
3. **Render** → your service → **Environment**: add `GOOGLE_CLIENT_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `SESSION_SECRET` (click **Generate**). Save; Render restarts the server.

Until those are set, the button says cloud saves aren't switched on yet. Locally, `FAKE_GOOGLE=1 SESSION_SECRET=x npm start` (in `server/`) runs with a pretend Google login and saves to `server/data/saves.json`; `npm test` covers the whole flow.

## Install it as a real app

Builds run in Expo's cloud (`npm i -g eas-cli`, then `eas login` with a free Expo account):

- **Android:** `cd app && eas build -p android --profile preview` gives you an `.apk` link you can install directly on both phones.
- **iOS:** installing outside Expo Go needs an Apple Developer account ($99/yr): `eas build -p ios --profile preview` for an ad-hoc build, or `--profile production` + `eas submit` for TestFlight. Without one, keep using Expo Go.

## Tests

```bash
cd server && npm test                       # two simulated players: chat, gifts, hugs, maps, a full Expotition, offline delivery
cd app && npx tsx src/game/engine.test.ts   # economy checks: gradual early game + 60 days of play with naps (DAYS=365 STEP_MIN=30 for a year)
cd app && npx tsc --noEmit                  # typecheck
cd app && npx expo export --platform ios --platform android   # proves the iOS and Android bundles build
```

## Tuning

All content and balance lives in `app/src/game/catalog.ts`: business costs and cycles, managers, building level costs and boosts, store items, varieties, balloon odds, and quick chat phrases. Where each home sits on the map is `PLACES` in `app/src/ui/WoodMap.tsx`. Contract goals and rewards are in `server/src/index.js` (`CONTRACTS`).

The pacing test exists for a reason: endless upgrades that each look harmless can feed each other and explode (the first version hit infinity within an hour of simulated play). If you change the numbers, rerun it.

## A note on the characters

Characters and places come from A. A. Milne's original books (*Winnie-the-Pooh*, 1926, and *The House at Pooh Corner*, 1928), now public domain in the US. The map is laid out after the geography of the books' map, but all the art — map, homes and portraits — is original and drawn in code, with nothing copied from Shepard's or Disney's drawings. Later redrawings of the map (such as Shepard's 1959 signed copies) are still under copyright, so they're used only as a layout guide. If you add your own pictures, see the copyright note in `app/assets/portraits/README.md`. All of this is fine for a game you play yourselves; if you ever want to publish it, check trademark rules first ("Winnie the Pooh" is still a registered trademark for many products).
