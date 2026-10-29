// Cloud save check: boots the server with a pretend Google login and walks
// through link → sign in → poll → save → load → conflict → forced save.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const PORT = 3998;
const base = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ['src/index.js'], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR: mkdtempSync(join(tmpdir(), 'honey-cloud-')), FAKE_GOOGLE: '1', SESSION_SECRET: 'test-secret', SUPABASE_URL: '', GOOGLE_CLIENT_ID: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
await new Promise((ok) => server.stdout.on('data', (d) => String(d).includes('listening') && ok()));

const call = async (method, path, body, token) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text() };
};

try {
  assert.equal((await call('GET', '/cloud/status')).body.ready, true);

  const { body: { code } } = await call('POST', '/cloud/link');
  assert.match(code, /^[0-9a-f]{32}$/);
  const page = await call('GET', `/cloud/signin?code=${code}`);
  assert.equal(page.status, 200);
  assert.match(page.body, /accounts\.google\.com\/gsi\/client/);
  assert.equal((await call('GET', '/cloud/poll?code=' + code)).body.pending, true);
  console.log('✓ link code and sign-in page');

  const done = await call('POST', '/cloud/complete', { code, credential: 'fake:123:pooh@example.com' });
  assert.equal(done.body.email, 'pooh@example.com');
  const { body: session } = await call('GET', '/cloud/poll?code=' + code);
  assert.ok(session.token);
  assert.equal((await call('GET', '/cloud/poll?code=' + code)).status, 410, 'a link can only be used once');
  console.log('✓ sign-in hands the game a session');

  assert.equal((await call('GET', '/cloud/save', null, session.token)).body.data, null);
  assert.equal((await call('PUT', '/cloud/save', { data: { allTimeEarned: 500, honey: 42 } }, session.token)).body.ok, true);
  assert.equal((await call('GET', '/cloud/save', null, session.token)).body.data.honey, 42);
  console.log('✓ saves and loads');

  const older = await call('PUT', '/cloud/save', { data: { allTimeEarned: 100, honey: 1 } }, session.token);
  assert.equal(older.status, 409, 'an older save must not overwrite newer progress');
  assert.equal(older.body.cloud.data.honey, 42);
  assert.equal((await call('PUT', '/cloud/save', { data: { allTimeEarned: 100, honey: 1 }, force: true }, session.token)).body.ok, true);
  console.log('✓ older progress is caught, and can be kept on purpose');

  assert.equal((await call('GET', '/cloud/save', null, session.token + 'x')).status, 401, 'tampered tokens are refused');
  assert.equal((await call('GET', '/cloud/save')).status, 401);
  assert.equal((await call('POST', '/cloud/complete', { code: 'nope', credential: 'fake:1:a@b.c' })).status, 410);
  console.log('✓ bad tokens and stale links are refused');

  console.log('\nAll cloud save checks passed ☁️');
} catch (err) {
  console.error('✗', err);
  process.exitCode = 1;
} finally {
  server.kill();
  setTimeout(() => process.exit(), 100);
}
