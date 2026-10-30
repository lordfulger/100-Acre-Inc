// End-to-end check: boots the server on a spare port, connects two players to
// the same wood, and exercises chat, gifts, hugs and a full co-op Expotition.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

const PORT = 3999;
const server = spawn(process.execPath, ['src/index.js'], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR: mkdtempSync(join(tmpdir(), 'honey-')) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((ok) => server.stdout.on('data', (d) => String(d).includes('listening') && ok()));

function player(secret, name, avatar, room = 'hunny') {
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  const inbox = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    inbox.push(msg);
    for (const w of [...waiters]) if (w.match(msg)) { waiters.splice(waiters.indexOf(w), 1); w.ok(msg); }
  });
  const p = {
    ws, inbox,
    send: (m) => ws.send(JSON.stringify(m)),
    wait: (match, ms = 2000) => {
      const found = inbox.find(match);
      if (found) { inbox.splice(inbox.indexOf(found), 1); return Promise.resolve(found); }
      return new Promise((ok, fail) => {
        const w = { match, ok: (m) => { inbox.splice(inbox.indexOf(m), 1); ok(m); } };
        waiters.push(w);
        setTimeout(() => fail(new Error(`${name} timed out waiting`)), ms);
      });
    },
  };
  ws.on('open', () => p.send({ t: 'hello', secret, name, avatar, room }));
  return p;
}

try {
  const a = player('a'.repeat(32), 'Pooh', '🐻');
  const wa = await a.wait((m) => m.t === 'welcome');
  assert.equal(wa.room, 'HUNNY');
  const b = player('b'.repeat(32), 'Piglet', '🐷');
  const wb = await b.wait((m) => m.t === 'welcome');
  assert.equal(wb.roster.length, 2);
  console.log('✓ both players joined room', wb.room);

  a.send({ t: 'stats', stats: { hps: 10, honey: 500, allTime: 1000, buildings: { owned: { garden: 12, 'x y': 3 }, levels: { garden: 2 }, managed: { garden: true }, addons: ['garden:0', 'bad addon'], rooms: { garden: ['rug', 'Bad!'] } } } });
  b.send({ t: 'stats', stats: { hps: 5, honey: 200, allTime: 400, bests: { drip: 31, 'Bad!': 5, oddone: -2 } } });
  const piglet = (await a.wait((m) => m.t === 'roster' && m.roster.find((r) => r.name === 'Piglet')?.stats.bests?.drip)).roster.find((r) => r.name === 'Piglet');
  assert.deepEqual(piglet.stats.bests, { drip: 31 }, 'best scores are shared for the leaderboards, tidied');
  await b.wait((m) => m.t === 'roster' && m.roster.find((r) => r.name === 'Pooh')?.stats.hps === 10);
  const pooh = (await b.wait((m) => m.t === 'roster' && m.roster.find((r) => r.name === 'Pooh')?.stats.buildings)).roster.find((r) => r.name === 'Pooh');
  assert.deepEqual(pooh.stats.buildings, { owned: { garden: 12 }, levels: { garden: 2 }, managed: { garden: true }, addons: ['garden:0'], rooms: { garden: ['rug'] } });
  console.log('✓ live stats and maps shared');

  a.send({ t: 'chat', text: 'Hallo Piglet!' });
  await b.wait((m) => m.t === 'chat' && m.msg.text === 'Hallo Piglet!');
  console.log('✓ chat delivered');

  b.send({ t: 'gift', to: wa.you, amount: 123 });
  const gift = await a.wait((m) => m.t === 'gift');
  assert.equal(gift.amount, 123);
  // Gifts are held to half of what the friend has (Pooh has 500), however much is asked.
  b.send({ t: 'gift', to: wa.you, amount: 1e9 });
  assert.equal((await a.wait((m) => m.t === 'gift' && m.amount !== 123)).amount, 250);
  assert.equal((await b.wait((m) => m.t === 'giftSent' && m.amount === 250)).asked, 1e9);
  a.send({ t: 'hug', to: wb.you });
  await b.wait((m) => m.t === 'hug' && m.name === 'Pooh');
  a.send({ t: 'hug', to: wb.you });
  await a.wait((m) => m.t === 'error' && /rest/.test(m.text));
  console.log('✓ gifts and hugs (with cooldown)');

  a.send({ t: 'startContract', id: 'tail' });
  const c = await b.wait((m) => m.t === 'contract' && m.contract.status === 'active');
  assert.equal(c.contract.goal, 15 * 600 > 5000 ? 15 * 600 : 5000);
  a.send({ t: 'contribute', amount: c.contract.goal * 0.3 });
  const r1 = await b.wait((m) => m.t === 'reward' && m.tier === 0);
  assert.equal(r1.combs, 1);
  b.send({ t: 'contribute', amount: c.contract.goal });
  const r3 = await a.wait((m) => m.t === 'reward' && m.tier === 2);
  assert.ok(r3.boost);
  const done = await a.wait((m) => m.t === 'contract' && m.contract.status === 'complete');
  assert.ok(done.rests.tail > Date.now() + 29 * 60_000, 'a finished Expotition rests for as long as it runs');
  a.send({ t: 'startContract', id: 'tail' });
  await a.wait((m) => m.t === 'error' && /resting/.test(m.text));
  console.log('✓ co-op Expotition completes and rewards both players');

  // The joint map: everyone pays into a building's next level; when it goes up, everyone
  // gets a boost, and the next level costs 25% more.
  const market = wa.joint.market;
  assert.equal(market.level, 0);
  a.send({ t: 'jointGive', id: 'market', amount: market.goal / 2 });
  b.send({ t: 'jointGive', id: 'market', amount: market.goal / 2 });
  const up = await b.wait((m) => m.t === 'jointUp' && m.id === 'market');
  assert.deepEqual([up.level, up.boost.mult], [1, 2]);
  const levelled = await a.wait((m) => m.t === 'joint' && m.joint.market.level === 1);
  assert.equal(levelled.joint.market.progress, 0);
  assert.ok(levelled.joint.market.goal >= market.goal * 1.25 - 1, 'the next level costs more');
  a.send({ t: 'jointGive', id: 'nope', amount: 5 });
  console.log('✓ joint buildings levelled up together');

  // Shared projects: honey donated by both builds them, then the next one starts.
  assert.equal(wa.project.id, 'eeyore');
  a.send({ t: 'donate', amount: wa.project.goal / 2 });
  await a.wait((m) => m.t === 'donated');
  b.send({ t: 'donate', amount: wa.project.goal });
  const built = await a.wait((m) => m.t === 'projectDone');
  assert.equal(built.id, 'eeyore');
  const next = await b.wait((m) => m.t === 'project' && m.built.length === 1);
  assert.equal(next.project.id, 'wolery');
  console.log('✓ shared project built together');

  a.send({ t: 'letter', to: wb.you, text: 'Dear Piglet,\nHallo.', amount: 10 });
  const letter = await b.wait((m) => m.t === 'letter');
  assert.equal(letter.letter.text, 'Dear Piglet,\nHallo.');
  assert.equal((await a.wait((m) => m.t === 'letterSent')).amount, 10);
  console.log('✓ letters delivered');

  // Poohsticks: invite, accept, both drop, both see the same race.
  a.send({ t: 'stickInvite', to: wb.you });
  const inv = await b.wait((m) => m.t === 'stickInvite');
  b.send({ t: 'stickAnswer', id: inv.id, yes: true });
  await a.wait((m) => m.t === 'stickGo');
  await b.wait((m) => m.t === 'stickGo');
  a.send({ t: 'stickDrop', id: inv.id, q: 1 });
  b.send({ t: 'stickDrop', id: inv.id, q: 0.2 });
  const ra = await a.wait((m) => m.t === 'stickRace');
  const rb = await b.wait((m) => m.t === 'stickRace');
  assert.equal(ra.winner, rb.winner);
  assert.equal(ra.sticks.length, 2);
  a.send({ t: 'stickInvite', to: wb.you });
  const inv2 = await b.wait((m) => m.t === 'stickInvite');
  b.send({ t: 'stickAnswer', id: inv2.id, yes: false });
  assert.match((await a.wait((m) => m.t === 'stickOff')).why, /Piglet/);
  console.log('✓ Poohsticks races and declines');

  // Rewards/gifts queue for players who are offline.
  b.ws.close();
  await a.wait((m) => m.t === 'roster' && !m.roster.find((r) => r.name === 'Piglet').online);
  a.send({ t: 'gift', to: wb.you, amount: 77 });
  await new Promise((r) => setTimeout(r, 100));
  const b2 = player('b'.repeat(32), 'Piglet', '🐷');
  await b2.wait((m) => m.t === 'welcome');
  const late = await b2.wait((m) => m.t === 'gift');
  assert.equal(late.amount, 77);
  console.log('✓ offline gifts delivered on return');

  // Notifications: a phone signs up, and can then be challenged while away.
  assert.ok(wa.pushKey?.length > 60);
  b2.send({ t: 'push', sub: { endpoint: 'not a url', keys: {} } });
  b2.send({ t: 'push', sub: { endpoint: 'https://push.example.invalid/abc1234567', keys: { p256dh: 'x', auth: 'y' } } });
  await b2.wait((m) => m.t === 'pushOn');
  b2.ws.close();
  await a.wait((m) => m.t === 'roster' && m.roster.some((r) => r.name === 'Piglet' && !r.online && r.notify));
  a.send({ t: 'stickInvite', to: wb.you });
  await a.wait((m) => m.t === 'stickWaiting');
  const b3 = player('b'.repeat(32), 'Piglet', '🐷');
  assert.equal((await b3.wait((m) => m.t === 'welcome')).pushOn, true);
  const waiting = await b3.wait((m) => m.t === 'stickInvite');
  assert.equal(waiting.name, 'Pooh');
  console.log('✓ notifications sign-up, and challenges reach a friend who was away');

  // Whoever came first looks after the wood, and can ask someone to leave for good.
  const latest = (await a.wait((m) => m.t === 'roster' && m.roster.some((r) => r.name === 'Piglet' && r.online))).roster;
  assert.equal(latest.find((r) => r.name === 'Pooh').owner, true);
  b3.send({ t: 'remove', who: wa.you });
  await b3.wait((m) => m.t === 'error' && /looks after/.test(m.text));
  a.send({ t: 'remove', who: wb.you });
  await b3.wait((m) => m.t === 'removed');
  await a.wait((m) => m.t === 'roster' && !m.roster.some((r) => r.name === 'Piglet'));
  const b4 = player('b'.repeat(32), 'Piglet', '🐷');
  await b4.wait((m) => m.t === 'error' && /can't join/.test(m.text));
  console.log('✓ the wood keeper can remove someone, who then cannot come back');

  // Leaving for real: the wood keeps its projects for whoever is still there; the last one out disbands it.
  const c1 = player('c'.repeat(32), 'Owl', '🦉', 'nest');
  const wc1 = await c1.wait((m) => m.t === 'welcome');
  const c2 = player('d'.repeat(32), 'Kanga', '🦘', 'nest');
  await c2.wait((m) => m.t === 'welcome');
  c1.send({ t: 'donate', amount: wc1.project.goal });
  await c2.wait((m) => m.t === 'projectDone');
  c1.send({ t: 'leave' });
  const after = await c2.wait((m) => m.t === 'roster' && m.roster.length === 1);
  assert.equal(after.roster[0].owner, true, 'the keeper role passes on');
  const c3 = player('c'.repeat(32), 'Owl', '🦉', 'nest');
  assert.deepEqual((await c3.wait((m) => m.t === 'welcome')).built, ['eeyore'], 'the wood keeps what it built');
  c3.send({ t: 'leave' });
  c2.send({ t: 'leave' });
  await new Promise((ok) => setTimeout(ok, 200));
  const c4 = player('c'.repeat(32), 'Owl', '🦉', 'nest');
  const fresh = await c4.wait((m) => m.t === 'welcome');
  assert.deepEqual([fresh.built, fresh.roster.length], [[], 1], 'the last one out disbands the wood');
  console.log('✓ leaving frees the spot; the wood keeps its projects until the last one leaves');

  console.log('\nAll multiplayer checks passed 🍯');
  process.exitCode = 0;
} catch (err) {
  console.error('✗', err);
  process.exitCode = 1;
} finally {
  server.kill();
  setTimeout(() => process.exit(), 100);
}
