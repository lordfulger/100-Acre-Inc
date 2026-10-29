// Phone notifications on the web: registers public/sw.js and signs this phone up
// with the server's key. Nothing happens on the native apps (they'd need their own).
import { Platform } from 'react-native';

export const pushSupported = () =>
  Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window;

export const pushAllowed = () => pushSupported() && Notification.permission === 'granted';

/** On iPhone, notifications only work once the game is added to the Home Screen. */
export const needsHomeScreen = () =>
  Platform.OS === 'web' && typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
  && !(window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone);

export function registerWorker() {
  if (pushSupported()) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

function keyBytes(base64: string) {
  const b = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
};

/**
 * Returns this phone's notification address for the server, asking permission
 * first when `ask` is true. Null when notifications aren't possible or were refused.
 */
export async function subscribe(serverKey: string, ask: boolean): Promise<PushSubscriptionJSON | null> {
  if (!pushSupported()) return null;
  if (Notification.permission !== 'granted') {
    if (!ask || (await Notification.requestPermission()) !== 'granted') return null;
  }
  const reg = await navigator.serviceWorker.ready;
  const key = keyBytes(serverKey);
  let sub = await reg.pushManager.getSubscription();
  // Signed up with an older key (a server that started over): sign up again.
  if (sub && !sameKey(sub.options.applicationServerKey, key)) { await sub.unsubscribe(); sub = null; }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  return sub.toJSON();
}
