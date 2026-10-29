// Rooms survive a server restart with a wiped disk (as on Render's free plan),
// because they're kept in Supabase. A tiny stand-in for Supabase's REST API
// holds the rows in memory.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

const PORT = 3998;
const SUPA_PORT = 3997;
const rows = {};
const supabase = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET') {
    const sub = url.searchParams.get('google_sub').replace(/^eq\./, '');
    res.end(JSON.stringify(rows[sub] ? [rows[sub]] : []));
    return;
  }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const row = JSON.parse(body);
    rows[row.google_sub] = row;
    res.statusCode = 201;
    res.end();
  });
});
await new Promise((ok) => supabase.listen(SUPA_PORT, ok));

async function boot() {
  // A fresh, empty data folder each time: the disk was wiped.
  const server = spawn(process.execPath, ['src/index.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: mkdtempSync(join(tmpdir(), 'honey-')), SUPABASE_URL: `http://localhost:${SUPA_PORT}`, SUPABASE_SERVICE_KEY: 'test' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((ok) => server.stdout.on('data', (d) => String(d).includes('listening') && ok()));
  return server;
}

function connect(secret, name) {
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  const inbox = [];
  ws.on('message', (raw) => inbox.push(JSON.parse(raw)));
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', secret, name, avatar: '🐻', room: 'hunny' })));
  const until = async (match) => {
    for (let i = 0; i < 100; i++) {
      const m = inbox.find(match);
      if (m) return m;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`${name} never got the message`);
  };
  return { ws, inbox, until, send: (m) => ws.send(JSON.stringify(m)) };
}

const POOH = 'pooh-secret-0123456789';
const PIGLET = 'piglet-secret-0123456789';

let server = await boot();
const pooh = connect(POOH, 'Pooh');
const welcome = await pooh.until((m) => m.t === 'welcome');
const piglet = connect(PIGLET, 'Piglet');
const pigletId = (await piglet.until((m) => m.t === 'welcome')).you;
piglet.send({ t: 'stats', stats: { honey: 1000 } });
await pooh.until((m) => m.t === 'roster' && m.roster.some((r) => r.id === pigletId && r.stats.honey === 1000));
piglet.ws.close();
await pooh.until((m) => m.t === 'roster' && m.roster.some((r) => r.id === pigletId && !r.online));
pooh.send({ t: 'chat', text: 'Hallo, Piglet!' });
pooh.send({ t: 'gift', to: pigletId, amount: 500 });
await pooh.until((m) => m.t === 'giftSent');
pooh.ws.close();
// Wait for the 5-second save, then "restart" onto an empty disk.
await new Promise((r) => setTimeout(r, 6_000));
assert.ok(rows['server:rooms'], 'rooms were saved to Supabase');
server.kill();
await new Promise((r) => server.on('exit', r));

server = await boot();
const back = connect(PIGLET, 'Piglet');
const again = await back.until((m) => m.t === 'welcome');
assert.equal(again.you, pigletId);
assert.ok(again.chat.some((c) => c.text === 'Hallo, Piglet!'), 'chat survived the restart');
assert.ok(again.roster.some((r) => r.id === welcome.you), 'Pooh is still in the wood');
const gift = await back.until((m) => m.t === 'gift');
assert.equal(gift.amount, 500, 'a gift sent while Piglet was away survived the restart');
console.log('✓ rooms, chat and queued gifts survive a restart with a wiped disk');

back.ws.close();
server.kill();
supabase.close();
console.log('\nAll room storage checks passed 🌳');
