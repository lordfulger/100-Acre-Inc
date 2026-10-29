// Music and sound effects. Files are made by scripts/make-sounds.js.
import { AudioPlayer, createAudioPlayer } from 'expo-audio';

export type Sfx = 'tap' | 'lucky' | 'buy' | 'hire' | 'upgrade' | 'balloon' | 'hug' | 'nap' | 'gift' | 'oops';
export type SoundSettings = { music: boolean; sfx: boolean; voices: boolean };

// Taps rotate between three slightly different bloops so quick tapping sounds natural.
const TAPS = [
  require('../../assets/sounds/tap1.wav'),
  require('../../assets/sounds/tap2.wav'),
  require('../../assets/sounds/tap3.wav'),
];
const FILES: Record<Exclude<Sfx, 'tap'>, number> = {
  lucky: require('../../assets/sounds/lucky.wav'),
  buy: require('../../assets/sounds/buy.wav'),
  hire: require('../../assets/sounds/hire.wav'),
  upgrade: require('../../assets/sounds/upgrade.wav'),
  balloon: require('../../assets/sounds/balloon.wav'),
  hug: require('../../assets/sounds/hug.wav'),
  nap: require('../../assets/sounds/nap.wav'),
  gift: require('../../assets/sounds/gift.wav'),
  oops: require('../../assets/sounds/oops.wav'),
};
// The files are already mastered quietly; these keep effects well under the music.
const VOLUME: Partial<Record<Sfx, number>> = { tap: 0.5, lucky: 0.55, buy: 0.6, oops: 0.5 };
const DEFAULT_VOLUME = 0.6;

let settings: SoundSettings = { music: true, sfx: true, voices: true };
let music: AudioPlayer | null = null;
let started = false;
// A few players per effect so quick taps can overlap.
const pools: Partial<Record<Sfx, { players: AudioPlayer[]; next: number }>> = {};

function player(name: Sfx) {
  let pool = pools[name];
  if (!pool) {
    const size = name === 'tap' ? 4 : 2;
    pool = { players: Array.from({ length: size }, (_, i) => createAudioPlayer(name === 'tap' ? TAPS[i % TAPS.length] : FILES[name])), next: 0 };
    pool.players.forEach((p) => { p.volume = VOLUME[name] ?? DEFAULT_VOLUME; });
    pools[name] = pool;
  }
  const p = pool.players[pool.next];
  pool.next = (pool.next + 1) % pool.players.length;
  return p;
}

export function play(name: Sfx) {
  if (!settings.sfx) return;
  try {
    const p = player(name);
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {}
}

/** Starts the background music. Browsers only allow this after a tap, so it's called on the first touch. */
export function startMusic() {
  started = true;
  if (!settings.music) return;
  try {
    if (!music) {
      music = createAudioPlayer(require('../../assets/sounds/music.wav'));
      music.loop = true;
      music.volume = 0.25;
    }
    music.play();
  } catch {}
}

export function applySoundSettings(next: SoundSettings) {
  const was = settings;
  settings = next;
  if (was.music !== next.music) {
    if (next.music && started) startMusic();
    else music?.pause();
  }
}

export const soundSettings = () => settings;
