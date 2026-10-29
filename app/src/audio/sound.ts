// Music and sound effects. Every file is made by scripts/make-sounds.js.
//
// On the web (the home-screen version) sounds play through the browser's Web
// Audio engine (see webAudio.ts); in the native app through expo-audio.
import { Platform } from 'react-native';
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { PortraitId } from '../ui/Portrait';
import { SOUND_FILES, SoundName } from './soundFiles';
import * as Web from './webAudio';

export type Sfx =
  | 'lucky' | 'buy' | 'hire' | 'upgrade' | 'unlock' | 'milestone' | 'addon' | 'shop' | 'magic'
  | 'balloon' | 'whoosh' | 'buzz' | 'hug' | 'gift' | 'pop' | 'fanfare' | 'welcome' | 'tick' | 'nap' | 'oops';
export type SoundSettings = { music: boolean; sfx: boolean; voices: boolean };

const WEB = Platform.OS === 'web';
const MUSIC = require('../../assets/sounds/music.wav');
const MUSIC_VOLUME = 0.25;
// The files are mastered quietly already; these keep effects comfortably under the music.
const VOLUME: Partial<Record<string, number>> = { tick: 0.35, pop: 0.45, buzz: 0.5, whoosh: 0.5 };
const DEFAULT_VOLUME = 0.6;

let settings: SoundSettings = { music: true, sfx: true, voices: true };
let started = false;
// False while the game is off screen (another app, phone locked, another browser tab).
let appActive = true;

// ---------- native players (expo-audio) ----------

let music: AudioPlayer | null = null;
const pools: Partial<Record<SoundName, { players: AudioPlayer[]; next: number }>> = {};

function nativePlay(name: SoundName) {
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
}

// ---------- shared ----------

function playFile(name: SoundName) {
  if (!settings.sfx || !appActive) return;
  try {
    if (WEB) Web.playBuffer(name, VOLUME[name] ?? DEFAULT_VOLUME);
    else nativePlay(name);
  } catch {}
}

/**
 * Called on the first finished tap (phone browsers only allow sound after one):
 * wakes the audio engine, starts the music and loads every sound effect.
 */
export function unlockAudio() {
  if (WEB) {
    Web.wake();
    for (const name of Object.keys(SOUND_FILES) as SoundName[]) Web.load(name, SOUND_FILES[name]);
  }
  startMusic();
}

export function setAppActive(active: boolean) {
  if (active === appActive) return;
  appActive = active;
  try {
    if (WEB) {
      if (active) Web.wake();
      else Web.sleep();
    } else if (!active) music?.pause();
    else if (started && settings.music) music?.play();
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

/** Starts the background music (after the first tap). */
export function startMusic() {
  started = true;
  if (!settings.music || !appActive) return;
  try {
    if (WEB) {
      Web.startLoop('music', MUSIC, MUSIC_VOLUME);
    } else {
      if (!music) {
        music = createAudioPlayer(MUSIC);
        music.loop = true;
        music.volume = MUSIC_VOLUME;
      }
      music.play();
    }
  } catch {}
}

function stopMusic() {
  try {
    if (WEB) Web.stopLoop();
    else music?.pause();
  } catch {}
}

export function applySoundSettings(next: SoundSettings) {
  const was = settings;
  settings = next;
  if (was.music !== next.music) {
    if (next.music && started) startMusic();
    else stopMusic();
  }
}

export const soundSettings = () => settings;
