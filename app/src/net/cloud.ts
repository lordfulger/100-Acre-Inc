// Talks to the game server's /cloud endpoints: Google sign-in (via a link code
// and a browser page) and saving/loading the game for that account.

import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/** The game server's web address, from its WebSocket address. */
export const httpBase = (server: string) => server.replace(/^ws/, 'http').replace(/\/$/, '');

async function call(server: string, method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(httpBase(server) + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: any = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

export async function cloudReady(server: string) {
  try { return (await call(server, 'GET', '/cloud/status')).data.ready === true; } catch { return false; }
}

/** Opens the Google sign-in page and waits (up to 10 minutes) for it to finish. */
export async function signIn(server: string, cancelled: () => boolean): Promise<{ token: string; email: string }> {
  const link = await call(server, 'POST', '/cloud/link');
  if (link.status !== 200) throw new Error(link.data.error || 'Cloud saves are not available right now.');
  const url = `${httpBase(server)}/cloud/signin?code=${link.data.code}`;
  if (Platform.OS === 'web') window.open(url, '_blank');
  else WebBrowser.openBrowserAsync(url).catch(() => {});

  const until = Date.now() + 10 * 60_000;
  while (Date.now() < until && !cancelled()) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await call(server, 'GET', `/cloud/poll?code=${link.data.code}`).catch(() => null);
    if (!poll) continue;
    if (poll.status === 410) break;
    if (poll.data.token) {
      if (Platform.OS !== 'web') WebBrowser.dismissBrowser().catch(() => {});
      return { token: poll.data.token, email: poll.data.email };
    }
  }
  throw new Error(cancelled() ? 'Sign-in cancelled.' : 'Sign-in timed out. Please try again.');
}

export type CloudSave = { data: any; allTime: number; updatedAt: string } | null;

export async function loadCloud(server: string, token: string): Promise<CloudSave> {
  const r = await call(server, 'GET', '/cloud/save', undefined, token);
  if (r.status === 401) throw new Error('signed-out');
  if (r.status !== 200) throw new Error(r.data.error || 'Could not reach the cloud.');
  return r.data.data ? r.data : null;
}

/** Uploads a save. Returns 'conflict' with the cloud copy if the cloud is further ahead. */
/** Saves to the cloud. `base` is the cloud version this phone last synced with, so changes made elsewhere since are caught. */
export async function uploadCloud(server: string, token: string, data: unknown, force = false, base?: string) {
  const r = await call(server, 'PUT', '/cloud/save', { data, force, base }, token);
  if (r.status === 401) throw new Error('signed-out');
  if (r.status === 409) return { conflict: r.data.cloud as NonNullable<CloudSave> };
  if (r.status !== 200) throw new Error(r.data.error || 'Could not save to the cloud.');
  return { updatedAt: r.data.updatedAt as string };
}
