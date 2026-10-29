// Music and sound effects. Every file is made by scripts/make-sounds.js.
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { PortraitId } from '../ui/Portrait';
import { SOUND_FILES, SoundName } from './soundFiles';

export type Sfx =
  | 'lucky' | 'buy' | 'hire' | 'upgrade' | 'unlock' | 'milestone' | 'addon' | 'shop' | 'magic'
  | 'balloon' | 'whoosh' | 'buzz' | 'hug' | 'gift' | 'pop' | 'fanfare' | 'welcome' | 'tick' | 'nap' | 'oops';
export type SoundSettings = { music: boolean; sfx: boolean; voices: boolean };

// The files are mastered quietly already; these keep effects comfortably under the music.
const VOLUME: Partial<Record<string, number>> = { tick: 0.35, pop: 0.45, buzz: 0.5, whoosh: 0.5 };
const DEFAULT_VOLUME = 0.6;

let settings: SoundSettings = { music: true, sfx: true, voices: true };
let music: AudioPlayer | null = null;
let started = false;
// Two players per sound so quick repeats can overlap.
const pools: Partial<Record<SoundName, { players: AudioPlayer[]; next: number }>> = {};

function playFile(name: SoundName) {
  if (!settings.sfx) return;
  try {
    let pool = pools[name];
    if (!pool) {
      pool = { players: [createAudioPlayer(SOUND_FILES[name]), createAudioPlayer(SOUND_FILES[name])], next: 0 };
      pool.players.forEach((p) => { p.volume = VOLUME[name] ?? DEFAULT_VOLUME; });
      pools[name] = pool;
    }
    const p = pool.players[pool.next];
    pool.next = (pool.next + 1) % pool.players.length;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {}
}

export const play = (name: Sfx) => playFile(name);

// Quick taps walk up and down a pentatonic scale, so tapping plays a little tune.
const TAP_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1];
let tapStep = 0;
let lastTap = 0;
export function playTap(lucky = false) {
  if (lucky) return playFile('lucky');
  const now = Date.now();
  tapStep = now - lastTap < 450 ? (tapStep + 1) % TAP_STEPS.length : 0;
  lastTap = now;
  playFile(`tap${TAP_STEPS[tapStep]}` as SoundName);
}

/** Home level-ups step up a scale (wrapping every 8 levels), so progress sounds like climbing. */
export const playLevel = (level: number) => playFile(`level${level % 8}` as SoundName);

/** Each character's own little tune. */
export function playMotif(who: PortraitId | null) {
  if (who && `motif-${who}` in SOUND_FILES) playFile(`motif-${who}` as SoundName);
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
