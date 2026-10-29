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

function poolFor(name: SoundName) {
  let pool = pools[name];
  if (!pool) {
    pool = { players: [createAudioPlayer(SOUND_FILES[name]), createAudioPlayer(SOUND_FILES[name])], next: 0 };
    pool.players.forEach((p) => { p.volume = VOLUME[name] ?? DEFAULT_VOLUME; });
    pools[name] = pool;
  }
  return pool;
}

let unlocked = false;
/**
 * Phone browsers only let a page make sound after a finished tap, and each sound
 * has to be started once during a tap before it may play later on its own (a hug
 * arriving, a balloon drifting in). Called on the first tap: starts the music and
 * silently plays every effect once so they're all allowed from then on.
 */
export function unlockAudio() {
  startMusic();
  if (unlocked) return;
  unlocked = true;
  for (const name of Object.keys(SOUND_FILES) as SoundName[]) {
    for (const p of poolFor(name).players) {
      try {
        p.muted = true;
        p.play();
        setTimeout(() => { try { p.pause(); p.seekTo(0).catch(() => {}); p.muted = false; } catch {} }, 60);
      } catch {}
    }
  }
}

function playFile(name: SoundName) {
  if (!settings.sfx) return;
  try {
    const pool = poolFor(name);
    const p = pool.players[pool.next];
    pool.next = (pool.next + 1) % pool.players.length;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {}
}

export const play = (name: Sfx) => playFile(name);

// Each tap plays a random note from a pentatonic scale (never the same note twice
// in a row). Any mix of these notes sounds pleasant together.
let lastNote = -1;
export function playTap(lucky = false) {
  if (lucky) return playFile('lucky');
  let note = Math.floor(Math.random() * 7);
  if (note >= lastNote) note++;
  lastNote = note;
  playFile(`tap${note}` as SoundName);
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
