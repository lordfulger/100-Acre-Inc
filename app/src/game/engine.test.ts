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
    if ((step + 1) % (perDay * Math.max(10, DAYS / 12)) === 0) {
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
console.log('All engine checks passed 🍯');
