// Game audio for the web version, using the browser's Web Audio engine.
//
// Each sound is downloaded and decoded once, then played from memory: cheap,
// overlapping, no lag. Unlike <audio> elements it doesn't register with the
// phone's lock-screen media controls, so nothing keeps playing in the
// background, and suspending the engine silences everything at once.
import { Asset } from 'expo-asset';

let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<void>>();
let musicSource: AudioBufferSourceNode | null = null;
let musicGain: GainNode | null = null;

/** Creates/wakes the engine. Must be called from a finished tap the first time. */
export function wake() {
  if (!ctx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx!.state === 'suspended') ctx!.resume().catch(() => {});
}

export function sleep() {
  ctx?.suspend().catch(() => {});
}

/** Downloads and decodes a sound (once). */
export function load(key: string, module: number) {
  if (buffers.has(key) || loading.has(key) || !ctx) return loading.get(key);
  const c = ctx;
  const p = (async () => {
    try {
      const res = await fetch(Asset.fromModule(module).uri);
      buffers.set(key, await c.decodeAudioData(await res.arrayBuffer()));
    } catch {}
    loading.delete(key);
  })();
  loading.set(key, p);
  return p;
}

/** Plays a loaded sound. Sounds still loading are skipped rather than played late. */
export function playBuffer(key: string, volume: number) {
  const buf = buffers.get(key);
  if (!ctx || !buf || ctx.state !== 'running') return;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.buffer = buf;
  src.connect(gain).connect(ctx.destination);
  src.start();
}

export async function startLoop(key: string, module: number, volume: number) {
  if (!ctx || musicSource) return;
  await load(key, module);
  const buf = buffers.get(key);
  if (!buf || musicSource) return;
  musicGain = ctx.createGain();
  musicGain.gain.value = volume;
  musicSource = ctx.createBufferSource();
  musicSource.buffer = buf;
  musicSource.loop = true;
  musicSource.connect(musicGain).connect(ctx.destination);
  musicSource.start();
}

export function stopLoop() {
  try { musicSource?.stop(); } catch {}
  musicSource?.disconnect();
  musicSource = null;
}
