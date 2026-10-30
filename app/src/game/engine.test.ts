// Economy checks + pacing simulations: `npx tsx src/game/engine.test.ts`
// 1. The first hours: upgrades should come gradually (cheap first, steady stream).
// 2. Months of play with naps: progress never stalls and numbers never break.
import assert from 'node:assert/strict';
import { BUSINESSES, RESEARCH, varietyAt } from './catalog';
import {
  addonList, applyOffline, buildingNext, buyAddon, buyBiz, buyResearch, buyVariety, derive, GameState, hireManager, migrate,
  nap, napCombsAvailable, newGame, quote, researchNext, startCycle, tap, tick, totalCombs, upgradeBuilding, varietyCost,
} from './engine';
import { fmt, fmtTime } from './format';
import { ALBUM, checkAlbum } from './album';
import { activeEvent, seasonAt } from './calendar';
import { buyDecor, checkTrophies, findThing, finishGame, gameOpen, gameReady, INTERIOR_NAPS, placeDecor, talk, thankVisitor, visitorToday } from './extras';
import { addBoost, catchBalloon } from './engine';

let now = 1_700_000_000_000;

// ---------- basics ----------
{
  const s = newGame(now);
  startCycle(s, 'beetree', now);
  tick(s, now + 1000);
  assert.equal(s.honey, 1);
  tick(s, now + 6000);
  assert.equal(s.honey, 1, 'no manager → no passive honey');
  assert.equal(buildingNext(s, 'pooh').cost, 15, "Pooh's House starts cheap");
  assert.ok(researchNext(s, 'busy').cost <= 50, 'store starts cheap');
}

/** One greedy shopping spree. Returns how many things were bought. */
function shop(s: GameState, t: number) {
  let bought = 0;
  for (let guard = 0; guard < 200; guard++) {
    const d = derive(s, t);
    let any = false;
    for (const b of BUSINESSES) if (s.biz[b.id].owned > 0 && !s.biz[b.id].managed && hireManager(s, b.id, t)) any = true;
    for (const r of RESEARCH) { const n = researchNext(s, r.id); if (n.unlocked && !n.maxed && s.honey > n.cost * 2 && buyResearch(s, r.id)) any = true; }
    for (const id of ['pooh', ...BUSINESSES.map((b) => b.id)]) {
      const n = buildingNext(s, id);
      if (n.ready && s.honey > n.cost * 2 && upgradeBuilding(s, id)) any = true;
      for (const a of addonList(s, id)) if (!a.owned && a.unlocked && s.honey > a.cost * 2 && buyAddon(s, id, a.index)) any = true;
    }
    if (s.honey > varietyCost(s, s.variety + 1) * 1.5 && buyVariety(s)) any = true;
    let best: string | null = null;
    let bestScore = 0;
    for (const b of BUSINESSES) {
      const q = quote(s, b.id, 1);
      if (q.cost > s.honey) continue;
      const score = ((b.revenue / d.biz[b.id].cycle) * d.biz[b.id].mult) / q.cost;
      if (score > bestScore) { bestScore = score; best = b.id; }
    }
    if (best && buyBiz(s, best, 1, t)) any = true;
    if (!any) break;
    bought++;
  }
  return bought;
}

// ---------- 1. the first hours, played actively ----------
{
  const s = newGame(now);
  const report: string[] = [];
  let firstPooh = -1;
  let reached300B = -1;
  const buysPerWindow: number[] = [];
  let windowBuys = 0;
  const seen = new Set<string>();
  const HOURS = Number(process.env.HOURS || 6);
  for (let t = 0; t < HOURS * 3600; t += 10) {
    for (let i = 0; i < 30; i++) tap(s, now);
    for (const b of BUSINESSES) startCycle(s, b.id, now);
    now += 10_000;
    tick(s, now);
    windowBuys += shop(s, now);
    if (firstPooh < 0 && (s.levels.pooh || 0) > 0) firstPooh = t + 10;
    if (reached300B < 0 && s.allTimeEarned >= 3e11) reached300B = t + 10;
    if ((t + 10) % 600 === 0) { buysPerWindow.push(windowBuys); windowBuys = 0; }
    for (const b of BUSINESSES) {
      if (s.biz[b.id].owned > 0 && !seen.has(b.id)) { seen.add(b.id); report.push(`${fmtTime(t)}: first ${b.name}`); }
    }
    if (t % 3600 === 0) report.push(`${fmtTime(t)}: ${fmt(derive(s, now).hps)}/s, combs ready ${napCombsAvailable(s)}`);
  }
  console.log(report.join('\n'));
  console.log(`First Pooh's House upgrade after ${firstPooh}s of play`);
  console.log(`300B all-time honey after ${reached300B < 0 ? 'more than ' + HOURS + 'h' : fmtTime(reached300B)} of non-stop play`);
  console.log(`Purchases per 10 minutes: ${buysPerWindow.join(' ')}`);
  console.log(`Levels: ${JSON.stringify(s.levels)}\nStore: ${JSON.stringify(s.research)}\nAdd-ons owned: ${s.addons.length}/66`);
  assert.ok(s.addons.length > 0, 'greedy player should buy add-ons');
  assert.ok(Object.keys(s.research).length >= 10, 'most store items should unlock in the first hours');
  assert.ok(firstPooh > 0 && firstPooh <= 30, 'first upgrade should come within seconds');
  assert.ok(buysPerWindow.every((n) => n >= 3), 'something to buy every 10 minutes');

  // Offline earnings are capped.
  const before = s.honey;
  const off = applyOffline(s, now + 48 * 3600_000);
  assert.ok(off.seconds <= 24 * 3600 && s.honey > before);
  now += 48 * 3600_000;
}

// ---------- 2. months of play, with naps ----------
{
  const s = newGame(now);
  const DAYS = Number(process.env.DAYS || 60);
  const STEP = Number(process.env.STEP_MIN || 5); // minutes per simulated step
  const perDay = 1440 / STEP;
  const lines: string[] = [];
  let lastAllTime = 0;
  for (let step = 0; step < DAYS * perDay; step++) {
    // A short active session every few hours, otherwise idle.
    if (step % Math.round(180 / STEP) === 0) {
      for (let i = 0; i < 100; i++) tap(s, now);
      for (const b of BUSINESSES) startCycle(s, b.id, now);
    }
    now += STEP * 60_000;
    tick(s, now);
    shop(s, now);
    if (napCombsAvailable(s) >= Math.max(10, totalCombs(s))) nap(s, now);
    if ((step + 1) % (perDay * Number(process.env.EVERY_DAYS || Math.max(10, DAYS / 12))) === 0) {
      const day = (step + 1) / perDay;
      lines.push(`day ${day}: ${fmt(derive(s, now).hps)}/s · all-time ${fmt(s.allTimeEarned)} · combs ${fmt(totalCombs(s))} · naps ${s.stats.naps} · ${varietyAt(s.variety).name} · Pooh Lv ${s.levels.pooh || 0}`);
      assert.ok(s.allTimeEarned > lastAllTime, `progress stalled by day ${day}`);
      lastAllTime = s.allTimeEarned;
    }
    assert.ok(Number.isFinite(s.honey) && Number.isFinite(s.allTimeEarned), 'numbers stay finite');
  }
  console.log(lines.join('\n'));
}

// ---------- saves ----------
{
  // Old saves turn their one-off store items and old levels into the new endless ones.
  const old = migrate({ ...newGame(now), research: undefined, levels: { garden: 2 }, upgrades: ['beetree-a', 'paw1', 'g1', 'sticky1'] }, now);
  assert.deepEqual(old.levels, { garden: 10, beetree: 5, pooh: 5 });
  assert.deepEqual(old.research, { owl: 1, paws: 2 });
  assert.equal((old as any).upgrades, undefined);

  // Nap keeps combs and variety, resets levels and the store.
  const s = newGame(now);
  s.allTimeEarned = 1e15;
  s.levels = { pooh: 7 };
  s.research = { busy: 3 };
  s.addons = ['garden:0'];
  s.variety = 2;
  assert.ok(nap(s, now) > 0);
  assert.deepEqual(s.levels, {});
  assert.deepEqual(s.research, {});
  assert.equal(s.variety, 2);
  assert.deepEqual(s.addons, [], 'nap resets add-ons');
  assert.equal(migrate(JSON.parse(JSON.stringify(s)), now).combsFromNaps, s.combsFromNaps);
}
// ---------- card album ----------
{
  const s = newGame(now);
  assert.deepEqual(s.album, ['pooh'], 'Pooh is the first card');
  assert.deepEqual(checkAlbum(s), [], 'nothing else at the start');
  s.stats.taps = 500;
  s.biz.haycorn.managed = true;
  assert.deepEqual(checkAlbum(s).map((c) => c.id), ['hunny', 'piglet']);
  assert.deepEqual(checkAlbum(s), [], 'cards are only found once');
  const mult = derive(s, now).globalMult;
  s.album.push('owl');
  assert.ok(Math.abs(derive(s, now).globalMult / mult - 1.03 / 1.02) < 1e-9, 'each card adds +1% honey');
  s.allTimeEarned = 1e15;
  nap(s, now);
  assert.ok(s.album.includes('piglet'), 'naps keep the album');
  // Old saves get Pooh; junk and duplicates are dropped (the album adds honey).
  assert.deepEqual(migrate({ ...JSON.parse(JSON.stringify(s)), album: undefined }, now).album, ['pooh']);
  assert.deepEqual(migrate({ ...JSON.parse(JSON.stringify(s)), album: ['owl', 'owl', 'nope', 7], albumNew: ['owl', 'tigger'] }, now).album, ['owl']);
  assert.deepEqual(migrate({ ...JSON.parse(JSON.stringify(s)), album: ['owl'], albumNew: ['owl', 'tigger'] }, now).albumNew, ['owl']);
  assert.equal(new Set(ALBUM.map((c) => c.id)).size, ALBUM.length, 'card ids are unique');
}
// ---------- clocks and "Max" ----------
{
  // A save from a phone whose clock ran ahead doesn't stall the businesses.
  const ahead = newGame(now + 3_600_000);
  hireManager(Object.assign(ahead, { honey: 1e9 }), 'beetree', now + 3_600_000);
  const s = migrate(JSON.parse(JSON.stringify(ahead)), now);
  assert.ok(s.lastTick <= now && s.biz.beetree.cycleStart <= now, 'future times are brought back to now');
  assert.ok(tick(s, now + 60_000) > 0, 'businesses keep earning');
  // "Max" never asks for more honey than you have.
  for (const honey of [12, 1e3, 7.77e6, 1e12, 3.3e40]) {
    for (const b of BUSINESSES) {
      const g = newGame(now);
      g.honey = honey;
      g.biz[b.id].owned = 37;
      const q = quote(g, b.id, 'max');
      assert.ok(q.n === 1 || q.cost <= honey, `Max for ${b.id} with ${honey} honey`);
    }
  }
}
// ---------- seasons, events, homes, visitors, games ----------
{
  const day = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();
  assert.equal(seasonAt(day(10, 29)), 'autumn');
  assert.equal(seasonAt(day(1, 5)), 'winter');
  assert.equal(activeEvent(day(10, 29))?.id, 'halloween');
  assert.equal(activeEvent(day(1, 1))?.id, 'christmas', 'Christmas runs over New Year');
  assert.equal(activeEvent(day(3, 1)), null);
  const s = newGame(day(10, 29));
  // Autumn taps are 25% stronger than spring's.
  assert.ok(Math.abs(derive(s, day(10, 29)).tapValue / derive(s, day(4, 1)).tapValue - 1.25) < 1e-9);
  // Halloween: 13 balloons finish it once, for a card and a decoration.
  for (let i = 0; i < 13; i++) catchBalloon(s, day(10, 29), () => 0);
  assert.deepEqual(s.eventsWon, ['halloween']);
  assert.ok(s.decor.includes('halloween'));
  assert.ok(checkAlbum(s).some((c) => c.id === 'halloween'));

  // Homes open after enough naps; decorations go in, one place at a time, and add honey.
  assert.equal(placeDecor(s, 'pooh', 'halloween'), false, 'doors shut before the naps');
  s.stats.naps = INTERIOR_NAPS;
  s.honey = 1e9;
  assert.ok(buyDecor(s, 'rug', day(10, 29)));
  assert.ok(!buyDecor(s, 'rug', day(10, 29)), 'each only once');
  const taps = derive(s, day(10, 29)).tapValue;
  assert.ok(placeDecor(s, 'pooh', 'rug'));
  assert.ok(derive(s, day(10, 29)).tapValue > taps);
  s.biz.haycorn.owned = 1;
  assert.ok(placeDecor(s, 'haycorn', 'rug'));
  assert.deepEqual([s.rooms.pooh, s.rooms.haycorn], [[], ['rug']], 'moving takes it from the other home');

  // Talking: one heart a day.
  assert.ok(talk(s, 'pooh', day(10, 29)).gained);
  assert.ok(!talk(s, 'pooh', day(10, 29, 18)).gained);
  assert.ok(talk(s, 'pooh', day(10, 30)).gained);
  assert.equal(s.friends.pooh.hearts, 2);

  // The daily visitor: progress counts from when they arrive.
  s.profile.secret = 'x';
  let v = visitorToday(s, day(10, 29));
  for (let i = 0; i < 600; i++) tap(s, day(10, 29));
  for (let i = 0; i < 3; i++) catchBalloon(s, day(10, 29), () => 0);
  s.stats.games += 2; s.stats.hugsSent++; s.stats.upgrades += 5;
  if (v.def.kind === 'find') assert.ok(findThing(s, v.place));
  v = visitorToday(s, day(10, 29));
  assert.ok(v.ready, `visitor ${v.def.kind} ready`);
  s.honey = 1e12;
  s.runEarned = 5e12;
  addBoost(s, 'profit', 7, 600, 'Bee Frenzy', day(10, 29));
  assert.equal(thankVisitor(s, day(10, 29)), 1e12 * 0.05, 'a visitor pays 5% of your honey, boosts or not');
  assert.equal(thankVisitor(s, day(10, 29)), 0, 'once a day');
  assert.ok(!visitorToday(s, day(10, 30)).done, 'a new visitor tomorrow');

  // Minigames pay once per cooldown.
  const a = finishGame(s, 'drip', 30, day(10, 29));
  assert.ok(a.honey > 0 && a.newBest);
  assert.equal(finishGame(s, 'drip', 50, day(10, 29, 12) + 60_000).honey, 0);
  assert.equal(s.games.drip.best, 50);
  assert.ok(finishGame(s, 'drip', 5, day(10, 29, 13)).honey > 0);
  // Prizes come from what you're worth this run, not your income: just after a nap, with
  // honey in the millions and a big income, a top score pays 2% of the honey you have.
  s.honey = 3e6; s.runEarned = 4e6;
  addBoost(s, 'profit', 7, 3600, 'Bee Frenzy', day(10, 29, 14));
  assert.equal(finishGame(s, 'tracks', 99, day(10, 29, 14)).honey, 3e6 * 0.02);
  const had = s.honey;
  assert.equal(finishGame(s, 'stretch', 1, day(10, 29, 14)).honey, had * 0.02 * (40 / 600), 'smaller scores, smaller shares');
  // The wood's joint buildings help everyone in it, more with every level.
  const plain = derive(s, day(10, 29, 15));
  s.joint = { market: 2, hive: 3, lantern: 4, field: 1 };
  const helped = derive(s, day(10, 29, 15));
  assert.ok(Math.abs(helped.globalMult / plain.globalMult - 1.1) < 1e-9, 'Honey Market: +5% honey a level');
  assert.equal(helped.offlineHours - plain.offlineHours, 2, 'Lantern Tree: +half an hour away a level');
  assert.ok(Math.abs(helped.balloonRate - plain.balloonRate - 0.05) < 1e-9, 'Balloon Field: balloons more often');
  s.joint = {};
  // Any finished game rests, even with no score; locked homes have no game.
  finishGame(s, 'garden', 0, day(10, 29, 13));
  assert.ok(!gameReady(s, 'garden', day(10, 29, 13) + 29 * 60_000) && gameReady(s, 'garden', day(10, 29, 13) + 30 * 60_000));
  assert.ok(gameOpen(s, 'stretch') && gameOpen(s, 'tracks') && !gameOpen(s, 'oddone'));
  assert.ok(checkTrophies(s).length > 0);
  // Old saves get the new things empty.
  const m = migrate({ ...JSON.parse(JSON.stringify(newGame(now))), rooms: undefined, friends: 'bad', letters: undefined }, now);
  assert.deepEqual([m.rooms, m.friends, m.letters], [{}, {}, []]);
}
console.log('All engine checks passed 🍯');
