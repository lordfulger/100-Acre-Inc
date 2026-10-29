// Game audio for the web version, using the browser's Web Audio engine.
//
// Each sound is downloaded and decoded once, then played from memory: cheap,
// overlapping, no lag. Unlike <audio> elements it doesn't register with the
// phone's lock-screen media controls, so nothing keeps playing in the background.
//
// iPhones are fussy: after switching apps or pages the engine is left
// "interrupted", and a plain resume() sometimes does nothing. So every tap wakes
// it (with the classic silent-sound trick), and if it still isn't running a
// moment later the engine is thrown away and rebuilt.
import { Asset } from 'expo-asset';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<void>>();
let musicSource: AudioBufferSourceNode | null = null;
let checkTimer: ReturnType<typeof setTimeout> | null = null;

/** Called after the engine is rebuilt, so the caller can reload sounds and restart music. */
export let onRebuilt: () => void = () => {};
export const setOnRebuilt = (fn: () => void) => { onRebuilt = fn; };

function create() {
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx!.createGain();
  master.connect(ctx!.destination);
}

function rebuild() {
  try { musicSource?.stop(); } catch {}
  musicSource = null;
  ctx?.close().catch(() => {});
  ctx = null;
  buffers.clear();
  loading.clear();
  create();
  onRebuilt();
}

/** Wakes the engine. Must be called from a finished tap (it's called on every tap). */
export function wake() {
  if (!ctx) create();
  if (!ctx || !master) return;
  master.gain.value = 1;
  if (ctx.state === 'running') return;
  ctx.resume().catch(() => {});
  // Playing a tiny silent sound during the tap is what really unlocks iPhone audio.
  try {
    const silent = ctx.createBufferSource();
    silent.buffer = ctx.createBuffer(1, 1, 22050);
    silent.connect(ctx.destination);
    silent.start(0);
  } catch {}
  if (checkTimer) clearTimeout(checkTimer);
  checkTimer = setTimeout(() => {
    checkTimer = null;
    if (ctx && ctx.state !== 'running') rebuild();
  }, 500);
}

/** Silences everything while the game is off screen. */
export function sleep() {
  if (master) master.gain.value = 0;
  ctx?.suspend().catch(() => {});
}

/** Downloads and decodes a sound (once). */
export function load(key: string, module: number) {
  if (buffers.has(key) || loading.has(key) || !ctx) return loading.get(key);
  const c = ctx;
  const p = (async () => {
    try {
      const res = await fetch(Asset.fromModule(module).uri);
      const buf = await c.decodeAudioData(await res.arrayBuffer());
      if (c === ctx) buffers.set(key, buf);
    } catch {}
    loading.delete(key);
  })();
  loading.set(key, p);
  return p;
}

/** Plays a loaded sound. Sounds still loading are skipped rather than played late. */
export function playBuffer(key: string, volume: number) {
  const buf = buffers.get(key);
  if (!ctx || !master || !buf || ctx.state !== 'running') return;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.buffer = buf;
  src.connect(gain).connect(master);
  src.start();
}

export async function startLoop(key: string, module: number, volume: number) {
  if (!ctx || musicSource) return;
  await load(key, module);
  const buf = buffers.get(key);
  if (!ctx || !master || !buf || musicSource) return;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  musicSource = ctx.createBufferSource();
  musicSource.buffer = buf;
  musicSource.loop = true;
  musicSource.connect(gain).connect(master);
  musicSource.start();
}

export function stopLoop() {
  try { musicSource?.stop(); } catch {}
  musicSource?.disconnect();
  musicSource = null;
}
